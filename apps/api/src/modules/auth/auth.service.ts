import { prisma } from '../../config/database';
import { RegisterInput, LoginInput } from './auth.schema';
import { hashPassword, comparePassword, hashToken } from '../../utils/hash.util';
import { generateAccessToken, generateRefreshTokenData } from '../../utils/token.util';
import { ConflictError, UnauthorizedError } from '../../errors/AppError';
import { AuthUser } from '../../@types/express';

export class AuthService {
  /**
   * Registers a new tenant organization and provisions the initial tenant administrator
   */
  async register(input: RegisterInput, ipAddress?: string, userAgent?: string) {
    // Check if slug is taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug: input.tenantSlug },
    });
    if (existingTenant) {
      throw new ConflictError(`Tenant with slug "${input.tenantSlug}" is already taken`);
    }

    const hashedPassword = await hashPassword(input.password);

    // Retrieve 'tenant_admin' role
    const adminRole = await prisma.role.findUnique({
      where: { name: 'tenant_admin' },
    });
    const roleId = adminRole ? adminRole.id : 2;

    // Transactional creation of tenant and tenant admin
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: input.tenantName,
          slug: input.tenantSlug,
          status: 'active',
          subscriptionTier: 'standard',
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          roleId,
          email: input.email.toLowerCase(),
          passwordHash: hashedPassword,
          fullName: input.fullName,
          isActive: true,
        },
        include: { role: true },
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          entityType: 'Tenant',
          entityId: tenant.id,
          action: 'CREATE',
          newValues: { tenantName: tenant.name, adminEmail: user.email },
          ipAddress,
        },
      });

      return { tenant, user };
    });

    const authUser: AuthUser = {
      id: result.user.id,
      email: result.user.email,
      fullName: result.user.fullName,
      tenantId: result.tenant.id,
      roleId: result.user.roleId,
      role: result.user.role.name,
      isSuperAdmin: false,
    };

    const accessToken = generateAccessToken(authUser);
    const { rawToken, tokenHash, expiresAt } = generateRefreshTokenData();

    await prisma.refreshToken.create({
      data: {
        userId: result.user.id,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      user: authUser,
      tenant: {
        id: result.tenant.id,
        name: result.tenant.name,
        slug: result.tenant.slug,
      },
      accessToken,
      refreshToken: rawToken,
    };
  }

  /**
   * Authenticates user with email and password
   */
  async login(input: LoginInput, ipAddress?: string, userAgent?: string) {
    const email = input.email.toLowerCase();

    // Query user with tenant and role
    const users = await prisma.user.findMany({
      where: {
        email,
        ...(input.tenantSlug
          ? { tenant: { slug: input.tenantSlug } }
          : {}),
      },
      include: { tenant: true, role: true },
    });

    if (users.length === 0) {
      throw new UnauthorizedError('Invalid email or password credentials');
    }

    // If multiple tenants for email and no slug provided, select the first active tenant
    const user = users.find((u) => u.isActive) || users[0];
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Your account has been deactivated. Please contact your organization administrator.');
    }

    if (user.tenant.status === 'suspended') {
      throw new UnauthorizedError('Tenant organization account is currently suspended.');
    }

    const isValidPassword = await comparePassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password credentials');
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: user.role.name,
      isSuperAdmin: user.role.name === 'super_admin',
    };

    const accessToken = generateAccessToken(authUser);
    const { rawToken, tokenHash, expiresAt } = generateRefreshTokenData();

    // Store SHA-256 hashed refresh token in database (never plaintext!)
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Record login audit
    await prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN',
        ipAddress,
      },
    });

    return {
      user: authUser,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      accessToken,
      refreshToken: rawToken,
    };
  }

  /**
   * Refreshes access token and rotates refresh token
   */
  async refresh(rawRefreshToken: string, ipAddress?: string, userAgent?: string) {
    const hashed = hashToken(rawRefreshToken);

    const storedToken = await prisma.refreshToken.findFirst({
      where: {
        tokenHash: hashed,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: { tenant: true, role: true },
        },
      },
    });

    if (!storedToken || !storedToken.user.isActive) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Revoke used refresh token (Token Rotation)
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });

    const user = storedToken.user;
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      tenantId: user.tenantId,
      roleId: user.roleId,
      role: user.role.name,
      isSuperAdmin: user.role.name === 'super_admin',
    };

    const accessToken = generateAccessToken(authUser);
    const { rawToken, tokenHash, expiresAt } = generateRefreshTokenData();

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    return {
      user: authUser,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      },
      accessToken,
      refreshToken: rawToken,
    };
  }

  /**
   * Invalidates active session refresh token on logout
   */
  async logout(rawRefreshToken?: string, userId?: string) {
    if (rawRefreshToken) {
      const hashed = hashToken(rawRefreshToken);
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashed },
        data: { revokedAt: new Date() },
      });
    }

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId: (await prisma.user.findUnique({ where: { id: userId }, select: { tenantId: true } }))?.tenantId || '00000000-0000-0000-0000-000000000000',
          userId,
          entityType: 'User',
          entityId: userId,
          action: 'LOGOUT',
        },
      });
    }
  }
}

export const authService = new AuthService();
