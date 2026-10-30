// ==============================================================================
// AssetVault: User Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces atomic role changes with audit notes and token invalidation on deactivation
// ==============================================================================

import { userRepository } from '../repositories/user.repository';
import { NotFoundError, ConflictError, BadRequestError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { hashPassword } from '../utils/hash.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { mockStore } from '../config/mockStore';
import { emailService } from './email.service';
import {
  deriveNameFromEmail,
  generateAutoPassword,
  extractEmailsFromText,
} from '../utils/emailProfile.util';

export class UserService {
  public async listUsers(
    prismaClient: any,
    params: PaginationParams,
    filter?: { roleId?: number; roleName?: string; isActive?: boolean }
  ) {
    const { data, total } = await userRepository.findMany(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getUserById(prismaClient: any, id: string) {
    const user = await userRepository.findById(prismaClient, id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    return user;
  }

  public async createUser(prismaClient: any, tenantId: string, data: any, _actorUserId?: string) {
    const normalizedEmail = (data.email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestError('A valid member email address is required.');
    }

    const existing = await prismaClient.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      throw new ConflictError(`User with email '${normalizedEmail}' already exists.`);
    }

    const targetRoleName = data.roleName || 'MEMBER';
    const role = await prismaClient.role.findUnique({
      where: { name: targetRoleName },
    });
    if (!role || role.name === 'SUPER_ADMIN') {
      throw new BadRequestError('Invalid organization role specified.');
    }

    const autoDerivedName =
      data.fullName && String(data.fullName).trim().length >= 2
        ? String(data.fullName).trim()
        : deriveNameFromEmail(normalizedEmail);

    const rawPassword =
      data.password && String(data.password).trim().length >= 6
        ? String(data.password).trim()
        : generateAutoPassword();

    const passwordHash = await hashPassword(rawPassword);

    const createdUser = await userRepository.create(prismaClient, {
      email: normalizedEmail,
      fullName: autoDerivedName,
      passwordHash,
      avatarUrl: data.avatarUrl || null,
      role: { connect: { id: role.id } },
      tenant: { connect: { id: tenantId } },
      isActive: true,
    });

    await emailService.dispatchMemberOnboardingEmail({
      tenantId,
      userId: createdUser.id,
      email: normalizedEmail,
      fullName: autoDerivedName,
      roleName: role.name,
      generatedPassword: rawPassword,
    });

    return {
      ...createdUser,
      autoProvisioned: true,
      welcomeEmailSent: true,
    };
  }

  /**
   * Bulk provisions organization members from a list, CSV, or raw text of email addresses.
   * Requires zero manual name/password/role input from the admin.
   */
  public async bulkCreateUsersByEmail(
    prismaClient: any,
    tenantId: string,
    payload: { emails?: string[] | string; rawText?: string; roleName?: string },
    actorUserId?: string
  ) {
    const combinedInput = [
      ...(Array.isArray(payload.emails) ? payload.emails : payload.emails ? [payload.emails] : []),
      payload.rawText || '',
    ].join('\n');

    const extractedEmails = extractEmailsFromText(combinedInput);
    if (extractedEmails.length === 0) {
      throw new BadRequestError('No valid email addresses found in the provided input.');
    }

    const createdUsers: any[] = [];
    const skippedEmails: string[] = [];

    for (const email of extractedEmails) {
      const existing = await prismaClient.user.findUnique({
        where: { email },
      });
      if (existing) {
        skippedEmails.push(email);
        continue;
      }

      try {
        const user = await this.createUser(
          prismaClient,
          tenantId,
          {
            email,
            roleName: payload.roleName || 'MEMBER',
          },
          actorUserId
        );
        createdUsers.push(user);
      } catch {
        skippedEmails.push(email);
      }
    }

    return {
      createdCount: createdUsers.length,
      skippedCount: skippedEmails.length,
      createdUsers,
      skippedEmails,
      message:
        createdUsers.length > 0
          ? `Automatically provisioned ${createdUsers.length} member(s) and dispatched welcome emails.`
          : 'All provided email addresses are already registered in the organization.',
    };
  }

  /**
   * Finds an existing member by email in the tenant or automatically provisions one on the fly.
   */
  public async findOrCreateMemberByEmail(
    prismaClient: any,
    tenantId: string,
    email: string,
    actorUserId?: string,
    fullName?: string
  ) {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new BadRequestError('A valid email address is required.');
    }

    const existing = await prismaClient.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return existing;
    }

    return this.createUser(
      prismaClient,
      tenantId,
      {
        email: normalizedEmail,
        fullName: fullName && fullName.trim().length >= 2 ? fullName.trim() : undefined,
        roleName: 'MEMBER',
      },
      actorUserId
    );
  }

  public async updateUser(prismaClient: any, id: string, data: any) {
    const existingUser = await this.getUserById(prismaClient, id);
    const updatePayload = { ...data };

    const isEmailChanged =
      Boolean(updatePayload.email) &&
      updatePayload.email.toLowerCase() !== existingUser.email?.toLowerCase();

    if (isEmailChanged) {
      const normalizedNewEmail = updatePayload.email.trim().toLowerCase();
      const duplicate = await prismaClient.user.findUnique({
        where: { email: normalizedNewEmail },
      });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(`Another user with email '${normalizedNewEmail}' already exists.`);
      }
      updatePayload.email = normalizedNewEmail;

      // If admin only gave the new email without specifying a new name, or if old name was auto-derived, ensure fullName is valid
      if (!updatePayload.fullName || String(updatePayload.fullName).trim().length < 2) {
        updatePayload.fullName = deriveNameFromEmail(normalizedNewEmail);
      }
    }

    const previousRoleName =
      typeof existingUser.role === 'object' && existingUser.role?.name
        ? existingUser.role.name
        : typeof existingUser.role === 'string'
        ? existingUser.role
        : existingUser.roleId === 2
        ? 'ADMIN'
        : existingUser.roleId === 3
        ? 'MANAGER'
        : 'MEMBER';

    if (updatePayload.roleName && !updatePayload.roleId) {
      const roleObj = await prismaClient.role.findUnique({
        where: { name: updatePayload.roleName },
      });
      if (roleObj) {
        updatePayload.roleId = roleObj.id;
      }
      delete updatePayload.roleName;
    }

    const updated = await userRepository.update(prismaClient, id, updatePayload);

    // Sync any in-memory allocations for this user so seat allocations reflect the updated email/name
    for (const alloc of mockStore.state.allocations as any[]) {
      if (alloc.userId === id) {
        if (updatePayload.email) alloc.userEmail = updatePayload.email;
        if (updatePayload.fullName) alloc.userName = updatePayload.fullName;
        if (alloc.user) {
          if (updatePayload.email) alloc.user.email = updatePayload.email;
          if (updatePayload.fullName) alloc.user.fullName = updatePayload.fullName;
        }
      }
    }

    const newRoleName =
      typeof updated.role === 'object' && updated.role?.name
        ? updated.role.name
        : typeof updated.role === 'string'
        ? updated.role
        : updated.roleId === 2
        ? 'ADMIN'
        : updated.roleId === 3
        ? 'MANAGER'
        : 'MEMBER';

    if (isEmailChanged && updated.email) {
      await emailService.dispatchMemberOnboardingEmail({
        tenantId: updated.tenantId || existingUser.tenantId || 'tenant-acme-corp',
        userId: updated.id,
        email: updated.email,
        fullName: updated.fullName || deriveNameFromEmail(updated.email),
        roleName: newRoleName,
        isEmailUpdate: true,
      });
    } else if (updated.email && previousRoleName !== newRoleName) {
      await emailService.dispatchRoleChangeEmail({
        tenantId: updated.tenantId || existingUser.tenantId || 'tenant-acme-corp',
        userId: updated.id,
        email: updated.email,
        fullName: updated.fullName || deriveNameFromEmail(updated.email),
        previousRole: previousRoleName,
        newRole: newRoleName,
      });
    }

    return updated;
  }

  public async updateUserStatus(prismaClient: any, id: string, isActive: boolean) {
    await this.getUserById(prismaClient, id);
    const updated = await userRepository.update(prismaClient, id, { isActive });

    // If deactivated, revoke all active sessions immediately
    if (!isActive) {
      await prismaClient.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return updated;
  }

  /**
   * Atomic User Role Change with Audit Note
   * Transaction 5: Updates user role and records an immutable audit log entry
   */
  public async changeUserRole(
    tenantId: string,
    userId: string,
    newRoleName: string,
    reason: string = 'Administrative role realignment',
    actorUserId?: string
  ) {
    if (newRoleName === 'SUPER_ADMIN') {
      throw new BadRequestError('Cannot promote organizational user to SUPER_ADMIN.');
    }

    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${actorUserId || ''}, true),
          set_config('app.audit_reason', ${reason}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const targetRole = await tx.role.findUnique({ where: { name: newRoleName } });
      if (!targetRole) {
        throw new BadRequestError(`Role '${newRoleName}' does not exist.`);
      }

      const currentUser = await tx.user.findFirst({
        where: { id: userId, tenantId },
        include: { role: true },
      });
      if (!currentUser) {
        throw new NotFoundError('User not found in tenant organization.');
      }

      const previousRoleName =
        currentUser.role?.name ||
        (currentUser.roleId === 2
          ? 'ADMIN'
          : currentUser.roleId === 3
          ? 'MANAGER'
          : 'MEMBER');

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { roleId: targetRole.id },
        select: {
          id: true,
          email: true,
          fullName: true,
          roleId: true,
          role: { select: { id: true, name: true, description: true } },
        },
      });

      // Revoke refresh tokens so user gets updated role claim on re-login
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      if (updatedUser.email && previousRoleName !== targetRole.name) {
        await emailService.dispatchRoleChangeEmail({
          tenantId,
          userId: updatedUser.id,
          email: updatedUser.email,
          fullName: updatedUser.fullName || deriveNameFromEmail(updatedUser.email),
          previousRole: previousRoleName,
          newRole: targetRole.name,
          reason,
        });
      }

      return updatedUser;
    });
  }

  public async resetPassword(prismaClient: any, id: string, newPassword: string) {
    await this.getUserById(prismaClient, id);
    const passwordHash = await hashPassword(newPassword);

    const updated = await userRepository.update(prismaClient, id, { passwordHash });

    // Revoke all refresh tokens on password reset
    await prismaClient.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return updated;
  }

  public async deleteUser(prismaClient: any, id: string) {
    await this.getUserById(prismaClient, id);

    await prismaClient.refreshToken.updateMany({
      where: { userId: id },
      data: { revokedAt: new Date() },
    });

    await prismaClient.licenseAllocation.updateMany({
      where: { userId: id, status: 'ACTIVE' },
      data: { status: 'RELEASED', releasedAt: new Date() },
    });

    return userRepository.delete(prismaClient, id);
  }
}

export const userService = new UserService();
