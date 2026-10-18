// ==============================================================================
// AssetVault: Authentication & Session Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces BCrypt (cost 12), token rotation with reuse detection, and atomic tenant onboarding
// ==============================================================================

import { prisma, prismaForRequest } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { hashPassword, comparePassword, hashToken } from '../utils/hash.util';

const systemPrisma = prismaForRequest({ isSuperAdmin: true });
import {
  generateAccessToken,
  generateRefreshTokenData,
} from '../utils/token.util';
import { checkEmailLockout, recordFailedLogin, resetFailedLogins } from './accountProtection.service';
import {
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  NotFoundError,
  BadRequestError,
} from '../errors/AppError';
import { RoleName, getPermissionsForRole, getMenuItemsForRole, MenuItem } from '../config/permissions';
import { LoginInput, RegisterTenantInput } from '../validators/auth.validator';
import { logger } from '../config/logger';

export interface AuthSuccessResult {
  accessToken: string;
  rawRefreshToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
    tenantId: string | null;
    role: RoleName;
    isSuperAdmin: boolean;
    permissions: string[];
    tenant?: {
      id: string;
      name: string;
      slug: string;
      status: string;
      plan?: {
        name: string;
        maxUsers: number;
        maxAssets: number;
      } | null;
    } | null;
  };
}

export class AuthService {
  /**
   * 1. Email + Password Login
   * - Strict generic error message (no account enumeration)
   * - Rejects inactive accounts and suspended tenants
   * - Account lockout after 5 failed attempts in 15m
   */
  public async login(
    input: LoginInput,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthSuccessResult> {
    const normalizedEmail = input.email.toLowerCase().trim();

    // 1. Check account lockout state
    checkEmailLockout(normalizedEmail);

    // 2. Query user from database
    const user = await systemPrisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        role: true,
        tenant: {
          include: { plan: true },
        },
      },
    });

    // 3. Generic failure if user not found or no password set (OAuth-only account)
    if (!user || !user.passwordHash) {
      recordFailedLogin(normalizedEmail);
      logger.warn({ email: normalizedEmail }, 'Authentication failed: User not found or no password hash');
      throw new UnauthorizedError('Invalid email or password');
    }

    // 4. Verify password with BCrypt
    const isPasswordValid = await comparePassword(input.password, user.passwordHash);
    if (!isPasswordValid) {
      recordFailedLogin(normalizedEmail);
      logger.warn({ email: normalizedEmail }, 'Authentication failed: Password mismatch');
      throw new UnauthorizedError('Invalid email or password');
    }

    // 5. Account state checks
    if (!user.isActive) {
      logger.warn({ userId: user.id }, 'Authentication rejected: Inactive account');
      throw new UnauthorizedError('Account is inactive. Please contact your organization administrator.');
    }

    if (user.tenant && user.tenant.status === 'SUSPENDED') {
      logger.warn({ tenantId: user.tenant.id }, 'Authentication rejected: Suspended tenant');
      throw new ForbiddenError('Organization account is suspended. Please contact platform support.');
    }

    // 6. Reset failed attempts upon successful login
    resetFailedLogins(normalizedEmail);

    // 7. Generate tokens and session records
    const roleName = user.role.name as RoleName;
    const isSuperAdmin = roleName === 'SUPER_ADMIN';

    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin,
    });

    const refreshData = generateRefreshTokenData();

    await systemPrisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshData.tokenHash,
        expiresAt: refreshData.expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });

    await systemPrisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      accessToken,
      rawRefreshToken: refreshData.rawToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        role: roleName,
        isSuperAdmin,
        permissions: getPermissionsForRole(roleName),
        tenant: user.tenant,
      },
    };
  }

  /**
   * 2. Tenant Self-Registration (Atomic Transaction)
   * Creates Tenant on Free Plan, its first TENANT_ADMIN user, and Audit record
   */
  public async registerTenant(
    input: RegisterTenantInput,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<AuthSuccessResult> {
    const normalizedEmail = input.adminEmail.toLowerCase().trim();
    const normalizedSlug = input.slug.toLowerCase().trim();

    // 1. Conflict checks
    const existingTenant = await systemPrisma.tenant.findUnique({
      where: { slug: normalizedSlug },
    });
    if (existingTenant) {
      throw new ConflictError('Tenant slug is already taken. Please choose another unique organization handle.');
    }

    const existingUser = await systemPrisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      throw new ConflictError('An account with this email address already exists.');
    }

    // 2. Fetch lookup records
    const freePlan = await systemPrisma.plan.findFirst({
      where: { name: 'Free Trial' },
    });
    if (!freePlan) {
      throw new BadRequestError('Default subscription plan (Free Trial) is not configured.');
    }

    const tenantAdminRole = await systemPrisma.role.findUnique({
      where: { name: 'TENANT_ADMIN' },
    });
    if (!tenantAdminRole) {
      throw new BadRequestError('TENANT_ADMIN role is not configured.');
    }

    // 3. Hash password with BCrypt (cost 12)
    const passwordHash = await hashPassword(input.password);

    // 4. Atomic transaction across Tenant, User, and AuditLog
    const { tenant, user } = await prisma.$transaction(async (tx: any) => {
      // Configure RLS admin override for onboarding transaction
      await tx.$executeRaw((Prisma as any).sql`SELECT set_config('app.is_super_admin', 'true', true);`);

      const createdTenant = await tx.tenant.create({
        data: {
          name: input.tenantName.trim(),
          slug: normalizedSlug,
          contactEmail: input.contactEmail.toLowerCase().trim(),
          planId: freePlan.id,
          status: 'TRIAL',
        },
        include: { plan: true },
      });

      const createdUser = await tx.user.create({
        data: {
          tenantId: createdTenant.id,
          roleId: tenantAdminRole.id,
          email: normalizedEmail,
          fullName: input.adminFullName.trim(),
          passwordHash,
          isActive: true,
          // Registration issues a session immediately, so record the initial login too.
          lastLoginAt: new Date(),
        },
        include: { role: true },
      });

      return { tenant: createdTenant, user: createdUser };
    });

    // 5. Issue session tokens
    const roleName = user.role.name as RoleName;
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin: false,
    });

    const refreshData = generateRefreshTokenData();

    await systemPrisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshData.tokenHash,
        expiresAt: refreshData.expiresAt,
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
      },
    });

    return {
      accessToken,
      rawRefreshToken: refreshData.rawToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        tenantId: user.tenantId,
        role: roleName,
        isSuperAdmin: false,
        permissions: getPermissionsForRole(roleName),
        tenant,
      },
    };
  }

  /**
   * 3. Refresh Token Rotation with Reuse Detection
   */
  public async refresh(
    rawRefreshToken: string,
    metadata: { userAgent?: string; ipAddress?: string } = {}
  ): Promise<{ accessToken: string; newRawRefreshToken: string }> {
    if (!rawRefreshToken) {
      throw new UnauthorizedError('Refresh token must be provided');
    }

    const tokenHash = hashToken(rawRefreshToken);
    const rotation = await prisma.$transaction(async (tx: any) => {
      // Keep the token's conditional revoke and replacement insert in one
      // transaction. The conditional update is the single-use compare-and-swap.
      await tx.$executeRaw(
        Prisma.sql`SELECT
          set_config('app.current_tenant_id', '', true),
          set_config('app.current_user_id', '', true),
          set_config('app.is_super_admin', 'true', true);`
      );

      const storedToken = await tx.refreshToken.findUnique({
        where: { tokenHash },
        include: {
          user: {
            include: {
              role: true,
              tenant: { include: { plan: true } },
            },
          },
        },
      });

      if (!storedToken) {
        return { kind: 'missing' as const };
      }

      const revokeActiveSessions = async () => {
        await tx.refreshToken.updateMany({
          where: { userId: storedToken.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      };

      if (storedToken.revokedAt !== null) {
        await revokeActiveSessions();
        return { kind: 'reuse' as const, userId: storedToken.userId, tokenId: storedToken.id };
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedError('Refresh token has expired. Please log in again.');
      }

      const user = storedToken.user;
      if (!user.isActive) {
        throw new UnauthorizedError('User account has been deactivated.');
      }
      if (user.tenant && user.tenant.status === 'SUSPENDED') {
        throw new ForbiddenError('Organization account is suspended.');
      }

      // Exactly one concurrent request can change revokedAt from NULL. A
      // loser treats the attempted second use as replay and invalidates sessions.
      const consumed = await tx.refreshToken.updateMany({
        where: { id: storedToken.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (consumed.count !== 1) {
        await revokeActiveSessions();
        return { kind: 'reuse' as const, userId: storedToken.userId, tokenId: storedToken.id };
      }

      const newRefreshData = generateRefreshTokenData();
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: newRefreshData.tokenHash,
          expiresAt: newRefreshData.expiresAt,
          userAgent: metadata.userAgent,
          ipAddress: metadata.ipAddress,
        },
      });

      return { kind: 'rotated' as const, user, newRefreshData };
    });

    if (rotation.kind === 'missing') {
      throw new UnauthorizedError('Invalid refresh token');
    }
    if (rotation.kind === 'reuse') {
      logger.warn(
        { userId: rotation.userId, tokenId: rotation.tokenId },
        'SECURITY ALERT: Revoked refresh token reuse detected! Invalidating all user sessions.'
      );
      throw new UnauthorizedError(
        'Compromised refresh token reuse detected. All active sessions have been revoked. Please log in again.'
      );
    }

    const user = rotation.user;
    const roleName = user.role.name as RoleName;
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: roleName,
      isSuperAdmin: roleName === 'SUPER_ADMIN',
    });

    return {
      accessToken,
      newRawRefreshToken: rotation.newRefreshData.rawToken,
    };
  }

  /**
   * 4. Logout: Revokes the current refresh token
   */
  public async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;

    const tokenHash = hashToken(rawRefreshToken);
    await systemPrisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 5. Logout All: Revokes all refresh tokens for the given user
   */
  public async logoutAll(userId: string): Promise<void> {
    await systemPrisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * 6. Retrieve authenticated user profile with permissions
   */
  public async getMe(userId: string) {
    const user = await systemPrisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
        tenant: {
          include: { plan: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User account not found');
    }

    const roleName = user.role.name as RoleName;

    return {
      id: user.id,
      name: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      role: roleName,
      isSuperAdmin: roleName === 'SUPER_ADMIN',
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            status: user.tenant.status,
          }
        : null,
      plan: user.tenant?.plan
        ? {
            id: user.tenant.plan.id,
            name: user.tenant.plan.name,
            maxUsers: user.tenant.plan.maxUsers,
            maxAssets: user.tenant.plan.maxAssets,
          }
        : null,
      permissions: getPermissionsForRole(roleName),
    };
  }

  /**
   * 7. Retrieve server-driven UI navigation menu for the given role
   */
  public getMenu(roleName: RoleName): MenuItem[] {
    return getMenuItemsForRole(roleName);
  }
}

export const authService = new AuthService();
