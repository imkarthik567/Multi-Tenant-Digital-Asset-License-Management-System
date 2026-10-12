// ==============================================================================
// AssetVault - Singleton PrismaClient Instance
// Enables query logging in development mode
// ==============================================================================

import { PrismaClient } from '@prisma/client';
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
            { emit: 'stdout', level: 'info' },
            { emit: 'stdout', level: 'warn' },
          ]
        : ['error'],
  });

if (env.NODE_ENV === 'development') {
  // Hook up query event listener in development
  (prisma as any).$on('query', (e: any) => {
    // Keep logs clean and readable
    console.log(`\x1b[36m[Prisma Query]\x1b[0m ${e.query} \x1b[33m+${e.duration}ms\x1b[0m`);
  });

  global.__prisma = prisma;
}

export default prisma;
