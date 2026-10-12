import app from './app';
import { env } from './config/env';
import { prisma } from './config/database';

const startServer = async () => {
  try {
    // Verify database connectivity
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL 16 database successfully.');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 AssetVault API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`🔗 Health check available at http://localhost:${env.PORT}/health`);
      console.log(`🔗 API Base: http://localhost:${env.PORT}/api/v1`);
    });

    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down AssetVault API...`);
      server.close(async () => {
        await prisma.$disconnect();
        console.log('🔌 PostgreSQL disconnected. Process exited.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('❌ Failed to start AssetVault API server:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
};

startServer();
