// ==============================================================================
// AssetVault: License Allocation Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces self-allocation boundaries for MEMBER roles and executes sp_allocate/release
// ==============================================================================

import { allocationRepository } from '../repositories/allocation.repository';
import { NotFoundError, ForbiddenError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { licenseAllocationFailuresTotal } from '../middleware/observability.middleware';
import { emailService } from './email.service';
import { userService } from './user.service';

export class AllocationService {
  /**
   * Allocates a seat via stored procedure sp_allocate_license_seat.
   * Supports direct member email input: if the email is not yet registered,
   * automatically provisions the member account and sends welcome + seat emails.
   */
  public async allocateSeat(
    tenantId: string,
    licenseId: string,
    targetUserId: string,
    callerUserId: string,
    callerRole: string,
    targetUserEmail?: string,
    prismaClient?: any,
    targetUserFullName?: string,
    notes?: string
  ) {
    try {
      let resolvedUserId = targetUserId;
      let resolvedEmail = targetUserEmail;

      // If caller passed an email inside targetUserId or via targetUserEmail, auto-resolve or auto-provision the member
      if (!resolvedEmail && resolvedUserId && resolvedUserId.includes('@')) {
        resolvedEmail = resolvedUserId.trim().toLowerCase();
        resolvedUserId = '';
      }

      if (resolvedEmail && !resolvedUserId) {
        const client = prismaClient || prisma;
        const member = await userService.findOrCreateMemberByEmail(
          client,
          tenantId,
          resolvedEmail,
          callerUserId,
          targetUserFullName
        );
        resolvedUserId = member.id;
      }

      // MEMBER role constraint: can only allocate to self
      if (callerRole === 'MEMBER' && resolvedUserId !== callerUserId) {
        licenseAllocationFailuresTotal.inc({ reason: 'forbidden_member_cross_allocation' });
        throw new ForbiddenError('Standard members can only allocate license seats to themselves.');
      }

      const result = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT 
            set_config('app.current_tenant_id', ${tenantId}, true),
            set_config('app.current_user_id', ${callerUserId}, true),
            set_config('app.is_super_admin', 'false', true);`
        );

        const allocationId = await allocationRepository.allocateSeat(
          tx,
          licenseId,
          resolvedUserId,
          callerUserId
        );

        if (notes && allocationId) {
          try {
            await tx.licenseAllocation.update({
              where: { id: allocationId },
              data: { notes: notes.trim() },
            });
          } catch {
            // Ignore optional notes update failure
          }
        }

        return {
          success: true,
          message: 'License seat allocated and automated confirmation email sent to member',
          allocationId,
          licenseId,
          userId: resolvedUserId,
        };
      });

      await emailService.dispatchSeatAllocationEmails({
        tenantId,
        licenseId,
        targetUserId: resolvedUserId,
        allocationId: result.allocationId,
      });

      return result;
    } catch (err: any) {
      const msg = err.message || '';
      const reason = msg.includes('exhausted')
        ? 'seats_exhausted'
        : msg.includes('already holds')
        ? 'already_allocated'
        : msg.includes('expired')
        ? 'license_expired'
        : msg.includes('inactive')
        ? 'user_inactive'
        : 'unknown_failure';
      licenseAllocationFailuresTotal.inc({ reason });
      throw err;
    }
  }

  /**
   * Releases an allocated seat via stored procedure sp_release_license_seat
   */
  public async releaseSeat(
    tenantId: string,
    allocationId: string,
    callerUserId: string,
    callerRole: string,
    reason?: string
  ) {
    let targetLicenseId = '';
    let targetUserId = '';
    const releaseReason = reason || 'User seat release';

    const result = await prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw(
        Prisma.sql`SELECT 
          set_config('app.current_tenant_id', ${tenantId}, true),
          set_config('app.current_user_id', ${callerUserId}, true),
          set_config('app.is_super_admin', 'false', true);`
      );

      const allocation = await allocationRepository.findById(tx, allocationId);
      if (!allocation) {
        throw new NotFoundError('License allocation not found');
      }

      // MEMBER role constraint: can only release self allocation
      if (callerRole === 'MEMBER' && allocation.userId !== callerUserId) {
        throw new ForbiddenError('Standard members can only release their own seat allocations.');
      }

      targetLicenseId = allocation.licenseId;
      targetUserId = allocation.userId;

      await allocationRepository.releaseSeat(
        tx,
        allocationId,
        callerUserId,
        releaseReason
      );

      return {
        success: true,
        message: 'License seat released and automated notification email sent to member',
        allocationId,
      };
    });

    if (targetLicenseId && targetUserId) {
      await emailService.dispatchSeatRevocationEmails({
        tenantId,
        licenseId: targetLicenseId,
        targetUserId,
        allocationId,
        reason: releaseReason,
      });
    }

    return result;
  }

  public async listAllocationsByLicense(
    prismaClient: any,
    licenseId: string,
    params: PaginationParams,
    callerUserId?: string,
    callerRole?: string
  ) {
    const filterUserId = callerRole === 'MEMBER' ? callerUserId : undefined;
    const { data, total } = await allocationRepository.findByLicense(
      prismaClient,
      licenseId,
      params,
      filterUserId
    );
    return formatPaginatedResponse(data, total, params);
  }

  public async listAllocationsByUser(
    prismaClient: any,
    userId: string,
    params: PaginationParams,
    callerUserId: string,
    callerRole: string
  ) {
    if (callerRole === 'MEMBER' && userId !== callerUserId) {
      throw new ForbiddenError('Standard members cannot view allocations of other users.');
    }

    const { data, total } = await allocationRepository.findByUser(prismaClient, userId, params);
    return formatPaginatedResponse(data, total, params);
  }

  public async listAllocations(prismaClient: any, tenantId: string, params: PaginationParams, status?: string) {
    const { data, total } = await allocationRepository.findAll(prismaClient, tenantId, params, status);
    return formatPaginatedResponse(data, total, params);
  }
}

export const allocationService = new AllocationService();


