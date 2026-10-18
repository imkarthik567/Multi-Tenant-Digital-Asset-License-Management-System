// ==============================================================================
// AssetVault HTTP Server Entry Point
// Course: VIT, BCSE307L Database Systems (Fall 2026-27)
// ==============================================================================

import app from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { jobScheduler } from './jobs/scheduler';

const startServer = async () => {
  try {
    // Verify database connectivity
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database successfully.');

    // Start background schedulers in API process (controlled by ENABLE_IN_PROCESS_WORKER or RUN_WORKER_IN_API)
    const enableWorker = env.ENABLE_IN_PROCESS_WORKER ?? env.RUN_WORKER_IN_API;
    if (enableWorker) {
      jobScheduler.startScheduler();
    }

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 AssetVault API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`🔗 Health check available at http://localhost:${env.PORT}/api/health`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down AssetVault API...`);
      if (enableWorker) {
        jobScheduler.stopScheduler();
      }
      server.close(async () => {
        await prisma.$disconnect();
        if (enableWorker) await jobScheduler.disconnectDatabase();
        console.log('🔌 PostgreSQL connections closed. Process exited.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start AssetVault API server:', error);
    await prisma.$disconnect();
    await jobScheduler.disconnectDatabase();
    process.exit(1);
  }
};

startServer();
