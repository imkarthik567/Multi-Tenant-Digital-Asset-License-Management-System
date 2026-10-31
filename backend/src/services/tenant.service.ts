// ==============================================================================
// AssetVault: Tenant Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces atomic tenant suspension/deletion transactions with token revocation
// ==============================================================================

import { TenantStatus, Prisma } from '@prisma/client';
import { tenantRepository } from '../repositories/tenant.repository';
import { planRepository } from '../repositories/plan.repository';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';
import { mockStore } from '../config/mockStore';
import { emailService } from './email.service';

export class TenantService {
  public async listTenants(
    prismaClient: any,
    params: PaginationParams,
    filter?: { status?: TenantStatus; planId?: number }
  ) {
    const { data, total } = await tenantRepository.findMany(prismaClient, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getTenantById(prismaClient: any, id: string) {
    const tenant = await tenantRepository.findById(prismaClient, id);
    if (!tenant) {
      throw new NotFoundError('Tenant organization not found');
    }
    return tenant;
  }

  public async createTenant(prismaClient: any, data: any, _actorUserId?: string) {
    const existing = await tenantRepository.findBySlug(prismaClient, data.slug);
    if (existing) {
      throw new ConflictError(`Tenant slug '${data.slug}' is already taken.`);
    }

    const plan = await planRepository.findById(prismaClient, data.planId);
    if (!plan) {
      throw new BadRequestError('Referenced subscription plan does not exist.');
    }

    return tenantRepository.create(prismaClient, {
      name: data.name,
      slug: data.slug,
      contactEmail: data.contactEmail,
      plan: { connect: { id: data.planId } },
      status: 'TRIAL',
    });
  }

  public async updateTenant(prismaClient: any, id: string, data: any) {
    await this.getTenantById(prismaClient, id);
    if (data.planId) {
      const plan = await planRepository.findById(prismaClient, data.planId);
      if (!plan) {
        throw new BadRequestError('Referenced subscription plan does not exist.');
      }
    }
    return tenantRepository.update(prismaClient, id, data);
  }

  public async changePlan(prismaClient: any, id: string, planId: number) {
    await this.getTenantById(prismaClient, id);
    const plan = await planRepository.findById(prismaClient, planId);
    if (!plan) {
      throw new BadRequestError('Referenced subscription plan does not exist.');
    }
    return tenantRepository.update(prismaClient, id, { plan: { connect: { id: planId } } });
  }

  /**
   * Atomic Tenant Suspension / Activation
   * Transaction 6: Atomically updates status, revokes user tokens, and writes audit log
   */
  public async suspendOrActivateTenant(id: string, status: TenantStatus, actorUserId?: string) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.is_super_admin', 'true', true),
          set_config('app.current_user_id', ${actorUserId || ''}, true);`
      );

      const current = await tx.tenant.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundError('Tenant organization not found');
      }

      const updated = await tx.tenant.update({
        where: { id },
        data: { status },
        include: { plan: true },
      });

      // If tenant is suspended, revoke all active refresh tokens for all tenant users
      if (status === 'SUSPENDED') {
        const tenantUsers = await tx.user.findMany({
          where: { tenantId: id },
          select: { id: true },
        });
        const userIds = tenantUsers.map((u: any) => u.id);

        if (userIds.length > 0) {
          await tx.refreshToken.updateMany({
            where: { userId: { in: userIds }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }

      return updated;
    });
  }

  /**
   * Atomic Tenant Deletion
   */
  public async deleteTenant(id: string, actorUserId?: string) {
    return prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.is_super_admin', 'true', true),
          set_config('app.allow_audit_delete', 'true', true),
          set_config('app.current_user_id', ${actorUserId || ''}, true);`
      );

      const current = await tx.tenant.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundError('Tenant organization not found');
      }

      // Revoke all tokens first
      const tenantUsers = await tx.user.findMany({
        where: { tenantId: id },
        select: { id: true },
      });
      const userIds = tenantUsers.map((u: any) => u.id);
      if (userIds.length > 0) {
        await tx.refreshToken.updateMany({
          where: { userId: { in: userIds } },
          data: { revokedAt: new Date() },
        });
      }

      // Explicit deleteMany calls for dependent tables before deleting assets and licenses
      await tx.licenseAllocation.deleteMany({
        where: { license: { tenantId: id } },
      });
      await tx.assetAccessLog.deleteMany({
        where: { asset: { tenantId: id } },
      });
      await tx.notification.deleteMany({
        where: { tenantId: id },
      });
      await tx.auditLog.deleteMany({
        where: { tenantId: id },
      });

      // Delete tenant's assets and licenses
      await tx.asset.deleteMany({ where: { tenantId: id } });
      await tx.license.deleteMany({ where: { tenantId: id } });

      // Clean up audit logs created by triggers during asset/license deletion
      await tx.auditLog.deleteMany({
        where: { tenantId: id },
      });

      // Delete vendors, categories, tags, and users before deleting tenant
      await tx.vendor.deleteMany({ where: { tenantId: id } });
      await tx.category.deleteMany({ where: { tenantId: id } });
      await tx.tag.deleteMany({ where: { tenantId: id } });
      await tx.user.deleteMany({ where: { tenantId: id } });

      // Final audit log clean up before tenant removal
      await tx.auditLog.deleteMany({
        where: { tenantId: id },
      });

      // Delete tenant
      const deleted = await tx.tenant.delete({ where: { id } });

      return deleted;
    });
  }

  /**
   * Admin-initiated workspace closure.
   * Purges organization data, sends offboarding emails to members,
   * removes the tenant from mockStore and database, and completely frees the admin's email account.
   */
  public async closeOrganization(
    prismaClient: any,
    tenantId: string,
    adminUserId: string,
    confirmationName: string
  ) {
    // 1. Find tenant
    let tenant: any = null;
    try {
      tenant = await prismaClient.tenant.findUnique({ where: { id: tenantId } });
    } catch {
      // Prisma error or mock mode
    }
    if (!tenant) {
      tenant = mockStore.state.tenants.find((t) => t.id === tenantId);
    }
    if (!tenant) {
      throw new NotFoundError('Organization not found');
    }

    // 2. Validate confirmation name
    const inputName = String(confirmationName || '').trim().toLowerCase();
    const actualName = String(tenant.name || '').trim().toLowerCase();
    if (!inputName || inputName !== actualName) {
      throw new BadRequestError(
        `Confirmation mismatch. Please enter the exact organization name "${tenant.name}" to confirm closure.`
      );
    }

    // 3. Verify requesting user is admin
    let adminUser: any = null;
    try {
      adminUser = await prismaClient.user.findUnique({
        where: { id: adminUserId },
        include: { role: true },
      });
    } catch {
      // ignore
    }
    if (!adminUser) {
      adminUser = mockStore.state.users.find((u) => u.id === adminUserId);
    }
    if (!adminUser) {
      throw new NotFoundError('Administrator user record not found');
    }

    const isAdmin =
      adminUser.isSuperAdmin ||
      adminUser.roleId === 2 ||
      adminUser.role?.name === 'TENANT_ADMIN' ||
      adminUser.role?.id === 2;

    if (!isAdmin) {
      throw new ForbiddenError('Only the organization administrator can permanently close this workspace.');
    }

    // 4. Gather member emails to notify before closure
    let memberEmails: string[] = [];
    try {
      const allDbUsers = await prismaClient.user.findMany({
        where: { tenantId },
        select: { id: true, email: true },
      });
      memberEmails = (allDbUsers || [])
        .filter((u: any) => u.id !== adminUserId && u.email && String(u.email).includes('@'))
        .map((u: any) => String(u.email).trim().toLowerCase());
    } catch {
      // fallback to mockStore
    }
    if (memberEmails.length === 0) {
      memberEmails = mockStore.state.users
        .filter((u) => u.tenantId === tenantId && u.id !== adminUserId && u.email && String(u.email).includes('@'))
        .map((u) => String(u.email).trim().toLowerCase());
    }

    // 5. Send workspace closure notification email to all members
    if (memberEmails.length > 0) {
      await emailService.dispatchWorkspaceClosureNotification({
        tenantId,
        tenantName: tenant.name,
        adminEmail: adminUser.email,
        adminName: adminUser.fullName || 'Organization Admin',
        recipientEmails: memberEmails,
      }).catch(() => {});
    }

    // 6. Delete from database if connected
    try {
      await this.deleteTenant(tenantId, adminUserId);
    } catch {
      // Mock mode fallback or non-fatal if db offline
    }

    // 7. Purge from mockStore and record tombstone
    mockStore.closeTenant(tenantId);

    return {
      success: true,
      message: `Organization "${tenant.name}" has been permanently closed. Your email address (${adminUser.email}) is now released.`,
      releasedEmail: adminUser.email,
    };
  }
}

export const tenantService = new TenantService();
