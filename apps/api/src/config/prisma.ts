// ==============================================================================
// AssetVault - Tenant-Aware Prisma Client Instance & Extension
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces PostgreSQL RLS Session Context Variables & Application-Level Isolation
// ==============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { env } from './env';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : ['error'],
  });

if (env.NODE_ENV === 'development') {
  (prisma as any).$on('query', (e: any) => {
    // Only log if not a session configuration query to keep dev console clean
    if (!e.query.includes('set_config')) {
      console.log(`\x1b[36m[Prisma Query]\x1b[0m ${e.query} \x1b[33m+${e.duration}ms\x1b[0m`);
    }
  });

  global.__prisma = prisma;
}

export interface RequestContext {
  tenantId?: string | null;
  userId?: string | null;
  isSuperAdmin?: boolean;
}

const TENANT_TOP_LEVEL_MODELS = [
  'user',
  'vendor',
  'category',
  'tag',
  'asset',
  'license',
  'notification',
  'auditLog',
];

/**
 * Creates a tenant-aware Prisma client extension for the current request context.
 *
 * Enforces dual-layer multi-tenant defense:
 * Layer 1 (Database level): Sets PostgreSQL session variables (app.current_tenant_id,
 *                           app.current_user_id, app.is_super_admin) so that Row-Level
 *                           Security (RLS) policies and audit triggers execute properly.
 * Layer 2 (Application level): Auto-injects tenantId into query where/create clauses for
 *                             top-level models, preventing accidental tenant leaks.
 */
export function prismaForRequest(ctx: RequestContext) {
  const tenantId = ctx.tenantId || '';
  const userId = ctx.userId || '';
  const isSuperAdmin = ctx.isSuperAdmin ? 'true' : 'false';

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }: any) {
          const lowerModel = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';

          // Layer 2: Auto-inject tenantId for top-level tenant-scoped entities
          if (tenantId && !ctx.isSuperAdmin && TENANT_TOP_LEVEL_MODELS.includes(lowerModel)) {
            const mutableArgs = args as any;
            if (operation === 'create') {
              mutableArgs.data = { ...(mutableArgs.data || {}), tenantId };
            } else if (
              ['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'].includes(
                operation
              )
            ) {
              mutableArgs.where = { ...(mutableArgs.where || {}), tenantId };
            } else if (['updateMany', 'deleteMany'].includes(operation)) {
              mutableArgs.where = { ...(mutableArgs.where || {}), tenantId };
            }
          }

          // Layer 1: Execute within transaction setting PostgreSQL RLS variables
          return await prisma.$transaction(async (tx: any) => {
            await tx.$executeRaw(
              (Prisma as any).sql`SELECT 
                set_config('app.current_tenant_id', ${tenantId}, true),
                set_config('app.current_user_id', ${userId}, true),
                set_config('app.is_super_admin', ${isSuperAdmin}, true);`
            );
            return await tx[lowerModel][operation](args);
          });
        },
      },
    },
  });
}

export default prisma;
