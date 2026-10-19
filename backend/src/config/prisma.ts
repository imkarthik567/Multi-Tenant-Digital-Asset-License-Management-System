// ==============================================================================
// AssetVault - Tenant-Aware Prisma Client Instance & Extension
// Course: BCSE307L Database Systems (Fall 2026-27)
// Enforces PostgreSQL RLS Session Context Variables & Application-Level Isolation
// ==============================================================================

import { PrismaClient, Prisma } from '@prisma/client';
import { env } from './env';
import { NotFoundError } from '../errors/AppError';

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
  tx?: any;
}

const TENANT_TOP_LEVEL_MODELS = [
  'tenant',
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
 * Creates a proxy client around an active transaction client (tx).
 * Guarantees that all queries inside an HTTP request execute within a single
 * transaction on a single dedicated connection, where set_config has been called ONCE.
 */
function createTxScopedClient(tx: any, ctx: RequestContext): any {
  const tenantId = ctx.tenantId || '';

  return new Proxy(tx, {
    get(target, prop: string) {
      if (prop === '$queryRaw') {
        return target.$queryRaw.bind(target);
      }
      if (prop === '$executeRaw') {
        return target.$executeRaw.bind(target);
      }
      if (prop === '$transaction') {
        return async (fnOrArray: any) => {
          if (typeof fnOrArray === 'function') {
            return fnOrArray(tx);
          }
          if (Array.isArray(fnOrArray)) {
            return Promise.all(fnOrArray);
          }
          return fnOrArray;
        };
      }

      const model = target[prop];
      if (model && typeof model === 'object') {
        const lowerModel = prop ? prop.charAt(0).toLowerCase() + prop.slice(1) : '';
        const shouldScope = tenantId && !ctx.isSuperAdmin && TENANT_TOP_LEVEL_MODELS.includes(lowerModel);
        const tenantFilter = lowerModel === 'tenant' ? { id: tenantId } : { tenantId };

        return new Proxy(model, {
          get(modelTarget, operation: string) {
            const origMethod = modelTarget[operation];
            if (typeof origMethod !== 'function') return origMethod;

            return async (args: any = {}) => {
              let currentOperation = operation;
              const mutableArgs = (args || {}) as any;

              if (shouldScope) {
                if (currentOperation === 'create') {
                  if (lowerModel !== 'tenant') {
                    if (mutableArgs.data && !mutableArgs.data.tenant) {
                      mutableArgs.data.tenant = { connect: { id: tenantId } };
                    }
                    if (mutableArgs.data && 'tenantId' in mutableArgs.data) {
                      delete mutableArgs.data.tenantId;
                    }
                  }
                } else if (currentOperation === 'findUnique') {
                  currentOperation = 'findFirst';
                  mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
                } else if (currentOperation === 'findUniqueOrThrow') {
                  currentOperation = 'findFirstOrThrow';
                  mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
                } else if (
                  ['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'].includes(
                    currentOperation
                  )
                ) {
                  mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
                } else if (['updateMany', 'deleteMany'].includes(currentOperation)) {
                  mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
                }

                if (['update', 'delete'].includes(currentOperation)) {
                  const scopedRecord = await modelTarget.findFirst({
                    where: { AND: [mutableArgs.where || {}, tenantFilter] },
                    select: { id: true },
                  });
                  if (!scopedRecord) {
                    throw new NotFoundError(`${prop} not found or access denied`);
                  }
                }
              }

              return modelTarget[currentOperation](mutableArgs);
            };
          },
        });
      }

      return target[prop];
    },
  });
}

/**
 * Creates a tenant-aware Prisma client extension for the current request context.
 *
 * Enforces dual-layer multi-tenant defense:
 * Layer 1 (Database level): Sets PostgreSQL session variables (app.current_tenant_id,
 *                           app.current_user_id, app.is_super_admin) so that Row-Level
 *                           Security (RLS) policies and audit triggers execute properly.
 * Layer 2 (Application level): Auto-injects tenantId into query where/create clauses for
 *                             top-level models, and scopes findUnique/update/delete,
 *                             preventing accidental cross-tenant data leaks.
 *
 * When txClient or ctx.tx is provided (via tenantContext per-request transaction),
 * queries execute on the single dedicated transaction/connection with set_config called once.
 */
export function prismaForRequest(ctx: RequestContext, txClient?: any): typeof prisma {
  const activeTx = txClient || ctx.tx;
  if (activeTx) {
    return createTxScopedClient(activeTx, ctx) as unknown as typeof prisma;
  }

  const tenantId = ctx.tenantId || '';
  const userId = ctx.userId || '';
  const isSuperAdmin = ctx.isSuperAdmin ? 'true' : 'false';

  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args }: any) {
          const lowerModel = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';
          let currentOperation = operation;
          const mutableArgs = (args || {}) as any;

          // Layer 2: Auto-inject tenantId for top-level tenant-scoped entities
          const shouldScope = tenantId && !ctx.isSuperAdmin && TENANT_TOP_LEVEL_MODELS.includes(lowerModel);
          const tenantFilter = lowerModel === 'tenant' ? { id: tenantId } : { tenantId };

          if (shouldScope) {
            if (currentOperation === 'create') {
              if (lowerModel !== 'tenant') {
                if (mutableArgs.data && !mutableArgs.data.tenant) {
                  mutableArgs.data.tenant = { connect: { id: tenantId } };
                }
                if (mutableArgs.data && 'tenantId' in mutableArgs.data) {
                  delete mutableArgs.data.tenantId;
                }
              }
            } else if (currentOperation === 'findUnique') {
              currentOperation = 'findFirst';
              mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
            } else if (currentOperation === 'findUniqueOrThrow') {
              currentOperation = 'findFirstOrThrow';
              mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
            } else if (
              ['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy'].includes(
                currentOperation
              )
            ) {
              mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
            } else if (['updateMany', 'deleteMany'].includes(currentOperation)) {
              mutableArgs.where = { AND: [mutableArgs.where || {}, tenantFilter] };
            }
          }

          // Layer 1: Execute within transaction setting PostgreSQL RLS variables (standalone fallback)
          return await prisma.$transaction(async (tx: any) => {
            await tx.$executeRaw(
              (Prisma as any).sql`SELECT 
                set_config('app.current_tenant_id', ${tenantId}, true),
                set_config('app.current_user_id', ${userId}, true),
                set_config('app.is_super_admin', ${isSuperAdmin}, true);`
            );

            if (shouldScope && ['update', 'delete'].includes(currentOperation)) {
              const scopedRecord = await tx[lowerModel].findFirst({
                where: { AND: [mutableArgs.where || {}, tenantFilter] },
                select: { id: true },
              });
              if (!scopedRecord) {
                throw new NotFoundError(`${model} not found or access denied`);
              }
            }

            return await tx[lowerModel][currentOperation](mutableArgs);
          });
        },
      },
    },
    client: {
      async $queryRaw(query: any, ...values: any[]) {
        return await prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw(
            (Prisma as any).sql`SELECT 
              set_config('app.current_tenant_id', ${tenantId}, true),
              set_config('app.current_user_id', ${userId}, true),
              set_config('app.is_super_admin', ${isSuperAdmin}, true);`
          );
          return await tx.$queryRaw(query, ...values);
        });
      },
      async $executeRaw(query: any, ...values: any[]) {
        return await prisma.$transaction(async (tx: any) => {
          await tx.$executeRaw(
            (Prisma as any).sql`SELECT 
              set_config('app.current_tenant_id', ${tenantId}, true),
              set_config('app.current_user_id', ${userId}, true),
              set_config('app.is_super_admin', ${isSuperAdmin}, true);`
          );
          return await tx.$executeRaw(query, ...values);
        });
      },
    },
  }) as unknown as typeof prisma;
}

export const systemPrisma = prismaForRequest({ isSuperAdmin: true });

export default prisma;
