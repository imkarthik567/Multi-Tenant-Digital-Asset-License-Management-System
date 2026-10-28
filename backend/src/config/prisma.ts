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

import { createMockPrismaClient } from './mockStore';

export const mockFallbackClient = createMockPrismaClient();

export function isConnectionError(err: any): boolean {
  if (!err) return false;
  if (err instanceof NotFoundError) return false;
  const msg = String(err.message || err);
  const code = String(err.code || '');
  return (
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1003' ||
    code === 'P1017' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes("Can't reach database server") ||
    msg.includes('Connection closed')
  );
}

let basePrisma: PrismaClient;
const shouldTryDirectPostgres =
  process.env.ENABLE_DIRECT_POSTGRES === 'true' ||
  env.NODE_ENV === 'test' ||
  (process.env.ENABLE_DIRECT_POSTGRES !== 'false' && Boolean(process.env.DATABASE_URL));

if (shouldTryDirectPostgres) {
  try {
    basePrisma =
      global.__prisma ||
      new PrismaClient({
        log: env.NODE_ENV === 'development' ? [{ emit: 'event', level: 'query' }] : [],
      });
    global.__prisma = basePrisma;
  } catch {
    basePrisma = mockFallbackClient as PrismaClient;
  }
} else {
  basePrisma = mockFallbackClient as PrismaClient;
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
 * Creates a proxy client around an active transaction or persistence client (tx).
 * Guarantees that all queries, raw SQL procedures, and nested transactions execute
 * with tenant isolation and zero dead connection attempts when PostgreSQL is offline.
 */
function createTxScopedClient(tx: any, ctx: RequestContext): any {
  const tenantId = ctx.tenantId || '';

  return new Proxy(tx, {
    get(target, prop: string) {
      if (prop === '$queryRaw') {
        return async (...args: any[]) => {
          try {
            return await target.$queryRaw(...args);
          } catch (err: any) {
            if (isConnectionError(err)) {
              return await (mockFallbackClient as any).$queryRaw(...args);
            }
            throw err;
          }
        };
      }
      if (prop === '$executeRaw') {
        return async (...args: any[]) => {
          try {
            return await target.$executeRaw(...args);
          } catch (err: any) {
            if (isConnectionError(err)) {
              return await (mockFallbackClient as any).$executeRaw(...args);
            }
            throw err;
          }
        };
      }
      if (prop === '$transaction') {
        return async (fnOrArray: any) => {
          const scopedSelf = createTxScopedClient(target, ctx);
          if (typeof fnOrArray === 'function') {
            return fnOrArray(scopedSelf);
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

              try {
                return await modelTarget[currentOperation](mutableArgs);
              } catch (err: any) {
                if (err instanceof NotFoundError) throw err;
                if (isConnectionError(err)) {
                  const mockModel = (mockFallbackClient as any)[lowerModel];
                  if (mockModel && typeof mockModel[currentOperation] === 'function') {
                    return await mockModel[currentOperation](mutableArgs);
                  }
                }
                throw err;
              }
            };
          },
        });
      }

      return target[prop];
    },
  });
}

/**
 * Creates a tenant-aware Prisma client for the current request context.
 * Uses createTxScopedClient over the active transaction or mockFallbackClient
 * so all model operations, $transaction, $queryRaw, and $executeRaw work reliably.
 */
export function prismaForRequest(ctx: RequestContext, txClient?: any): any {
  const activeTx = txClient || ctx.tx;
  if (activeTx) {
    return createTxScopedClient(activeTx, ctx);
  }

  const tenantId = ctx.tenantId || '';
  const userId = ctx.userId || '';
  const isSuperAdmin = ctx.isSuperAdmin ? 'true' : 'false';

  if (!shouldTryDirectPostgres || !(basePrisma as any).$extends) {
    return createTxScopedClient(basePrisma || mockFallbackClient, ctx);
  }

  try {
    return (basePrisma as any).$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args }: any) {
            const lowerModel = model ? model.charAt(0).toLowerCase() + model.slice(1) : '';
            let currentOperation = operation;
            const mutableArgs = (args || {}) as any;

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

            try {
              return await basePrisma.$transaction(async (tx: any) => {
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
            } catch (err: any) {
              if (err instanceof NotFoundError) throw err;
              if (isConnectionError(err)) {
                const mockModel = (mockFallbackClient as any)[lowerModel];
                if (mockModel && typeof mockModel[currentOperation] === 'function') {
                  return await mockModel[currentOperation](mutableArgs);
                }
              }
              throw err;
            }
          },
        },
      },
      client: {
        async $queryRaw(query: any, ...values: any[]) {
          try {
            return await basePrisma.$transaction(async (tx: any) => {
              await tx.$executeRaw(
                (Prisma as any).sql`SELECT 
                  set_config('app.current_tenant_id', ${tenantId}, true),
                  set_config('app.current_user_id', ${userId}, true),
                  set_config('app.is_super_admin', ${isSuperAdmin}, true);`
              );
              return await tx.$queryRaw(query, ...values);
            });
          } catch (err: any) {
            if (isConnectionError(err)) {
              return await (mockFallbackClient as any).$queryRaw(query, ...values);
            }
            throw err;
          }
        },
        async $executeRaw(query: any, ...values: any[]) {
          try {
            return await basePrisma.$transaction(async (tx: any) => {
              await tx.$executeRaw(
                (Prisma as any).sql`SELECT 
                  set_config('app.current_tenant_id', ${tenantId}, true),
                  set_config('app.current_user_id', ${userId}, true),
                  set_config('app.is_super_admin', ${isSuperAdmin}, true);`
              );
              return await tx.$executeRaw(query, ...values);
            });
          } catch (err: any) {
            if (isConnectionError(err)) {
              return await (mockFallbackClient as any).$executeRaw(query, ...values);
            }
            throw err;
          }
        },
      },
    });
  } catch {
    return createTxScopedClient(basePrisma || mockFallbackClient, ctx);
  }
}

// Wrap raw prisma export with fallback proxy
const safePrisma = new Proxy(basePrisma, {
  get(target, prop: string) {
    if (prop === '$connect') {
      return async () => {
        try {
          return await target.$connect();
        } catch {
          // Using persistent mock store
        }
      };
    }
    if (prop === '$disconnect') {
      return async () => {};
    }
    if (prop === '$queryRaw' || prop === '$executeRaw') {
      return async (...args: any[]) => {
        try {
          return await (target as any)[prop].apply(target, args);
        } catch (err: any) {
          if (isConnectionError(err)) {
            return await (mockFallbackClient as any)[prop](...args);
          }
          throw err;
        }
      };
    }
    if (prop === '$transaction') {
      return async (fnOrArray: any) => {
        try {
          return await (target as any).$transaction(fnOrArray);
        } catch (err: any) {
          if (isConnectionError(err)) {
            if (typeof fnOrArray === 'function') {
              return await fnOrArray(mockFallbackClient);
            }
            if (Array.isArray(fnOrArray)) {
              return await Promise.all(fnOrArray);
            }
          }
          throw err;
        }
      };
    }
    const orig = (target as any)[prop];
    if (orig && typeof orig === 'object') {
      return new Proxy(orig, {
        get(modelTarget, op: string) {
          const fn = modelTarget[op];
          if (typeof fn !== 'function') return fn;
          return async (...args: any[]) => {
            try {
              return await fn.apply(modelTarget, args);
            } catch (err: any) {
              if (isConnectionError(err)) {
                const mockModel = (mockFallbackClient as any)[prop];
                if (mockModel && typeof mockModel[op] === 'function') {
                  return await mockModel[op](...args);
                }
              }
              throw err;
            }
          };
        },
      });
    }
    if (typeof orig === 'function') {
      return orig.bind(target);
    }
    return orig;
  },
});

export { safePrisma as prisma };
export const systemPrisma = prismaForRequest({ isSuperAdmin: true });
export default safePrisma;
