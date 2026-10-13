// ==============================================================================
// AssetVault: Audit Log Service
// Course: BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import { auditRepository, AuditLogFilterOptions } from '../repositories/audit.repository';
import { NotFoundError } from '../errors/AppError';
import { PaginationParams, formatPaginatedResponse } from '../utils/pagination.util';

export class AuditService {
  public async listAuditLogs(
    prismaClient: any,
    tenantId: string,
    params: PaginationParams,
    filter: AuditLogFilterOptions
  ) {
    const { data, total } = await auditRepository.findAuditLogs(prismaClient, tenantId, params, filter);
    return formatPaginatedResponse(data, total, params);
  }

  public async getAuditDiff(prismaClient: any, tenantId: string, logId: string) {
    const log = await auditRepository.findById(prismaClient, tenantId, BigInt(logId));
    if (!log) {
      throw new NotFoundError('Audit log entry not found');
    }

    const oldObj = typeof log.oldData === 'object' && log.oldData !== null ? (log.oldData as Record<string, any>) : {};
    const newObj = typeof log.newData === 'object' && log.newData !== null ? (log.newData as Record<string, any>) : {};
    const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));

    const changes: Record<string, { previous: any; current: any; changed: boolean }> = {};
    for (const key of allKeys) {
      const prevVal = oldObj[key];
      const currVal = newObj[key];
      const changed = JSON.stringify(prevVal) !== JSON.stringify(currVal);
      changes[key] = {
        previous: prevVal,
        current: currVal,
        changed,
      };
    }

    return {
      id: log.id,
      tableName: log.tableName,
      recordId: log.recordId,
      action: log.action,
      performedAt: log.performedAt,
      performedBy: log.user,
      diff: changes,
      raw: {
        oldData: log.oldData,
        newData: log.newData,
      },
    };
  }
}

export const auditService = new AuditService();
