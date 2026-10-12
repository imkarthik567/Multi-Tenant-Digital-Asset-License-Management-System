import { licenseRepository } from './license.repository';
import { CreateLicenseInput, UpdateLicenseInput } from './license.schema';
import { NotFoundError } from '../../errors/AppError';
import { PaginationParams, createPaginationMeta } from '../../utils/pagination.util';
import { prisma } from '../../config/database';
import { Prisma } from '@prisma/client';

export class LicenseService {
  async listLicenses(tenantId: string, params: PaginationParams, filters?: {
    vendorId?: string;
    licenseType?: string;
    status?: string;
  }) {
    const { total, licenses } = await licenseRepository.findMany(tenantId, params, filters);
    return {
      licenses,
      meta: createPaginationMeta(total, params.page, params.limit),
    };
  }

  async getLicenseById(tenantId: string, licenseId: string) {
    const license = await licenseRepository.findById(tenantId, licenseId);
    if (!license) {
      throw new NotFoundError('License not found');
    }
    return license;
  }

  async createLicense(tenantId: string, input: CreateLicenseInput, userId?: string) {
    const vendor = await prisma.vendor.findFirst({
      where: { id: input.vendorId, tenantId },
    });
    if (!vendor) {
      throw new NotFoundError('Specified vendor does not exist in this tenant');
    }

    const created = await prisma.license.create({
      data: {
        tenant: { connect: { id: tenantId } },
        vendor: { connect: { id: input.vendorId } },
        name: input.name,
        licenseKey: input.licenseKey,
        licenseType: input.licenseType,
        totalSeats: input.totalSeats,
        cost: new Prisma.Decimal(input.cost),
        currency: input.currency,
        startsAt: new Date(input.startsAt),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        isAutoRenew: input.isAutoRenew,
        renewalReminderDays: input.renewalReminderDays,
        status: input.status,
      },
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'License',
          entityId: created.id,
          action: 'CREATE',
          newValues: { name: created.name, type: created.licenseType, totalSeats: created.totalSeats },
        },
      });
    }

    return this.getLicenseById(tenantId, created.id);
  }

  async updateLicense(tenantId: string, licenseId: string, input: UpdateLicenseInput, userId?: string) {
    const existing = await licenseRepository.findById(tenantId, licenseId);
    if (!existing) {
      throw new NotFoundError('License not found');
    }

    if (input.vendorId) {
      const vendor = await prisma.vendor.findFirst({
        where: { id: input.vendorId, tenantId },
      });
      if (!vendor) throw new NotFoundError('Specified vendor does not exist in this tenant');
    }

    const updated = await prisma.license.update({
      where: { id: licenseId },
      data: {
        ...(input.vendorId ? { vendorId: input.vendorId } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.licenseKey !== undefined ? { licenseKey: input.licenseKey } : {}),
        ...(input.licenseType ? { licenseType: input.licenseType } : {}),
        ...(input.totalSeats !== undefined ? { totalSeats: input.totalSeats } : {}),
        ...(input.cost !== undefined ? { cost: new Prisma.Decimal(input.cost) } : {}),
        ...(input.currency ? { currency: input.currency } : {}),
        ...(input.startsAt ? { startsAt: new Date(input.startsAt) } : {}),
        ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
        ...(input.isAutoRenew !== undefined ? { isAutoRenew: input.isAutoRenew } : {}),
        ...(input.renewalReminderDays !== undefined ? { renewalReminderDays: input.renewalReminderDays } : {}),
        ...(input.status ? { status: input.status } : {}),
      },
    });

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'License',
          entityId: licenseId,
          action: 'UPDATE',
          oldValues: { name: existing.name },
          newValues: input,
        },
      });
    }

    return this.getLicenseById(tenantId, updated.id);
  }

  async deleteLicense(tenantId: string, licenseId: string, userId?: string) {
    const existing = await licenseRepository.findById(tenantId, licenseId);
    if (!existing) {
      throw new NotFoundError('License not found');
    }

    // Soft delete
    await licenseRepository.softDelete(licenseId);

    if (userId) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          entityType: 'License',
          entityId: licenseId,
          action: 'DELETE',
          oldValues: { name: existing.name },
        },
      });
    }
  }
}

export const licenseService = new LicenseService();
