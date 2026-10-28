// ==============================================================================
// AssetVault - Root Full-Stack Dev Server Entry Point
// Mounts Express REST API and Vite Dev Server on port 3000 (0.0.0.0)
// ==============================================================================

import path from 'path';
import fs from 'fs';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';

// Override any legacy container VITE_API_URL (e.g. http://localhost:5000/api)
// so Vite always bundles relative '/api' for the unified server
process.env.VITE_API_URL = '/api';

const rootDir = process.cwd();
const rootRequire = createRequire(path.resolve(rootDir, 'package.json'));
const backendRequire = createRequire(path.resolve(rootDir, 'backend/package.json'));
const frontendRequire = createRequire(path.resolve(rootDir, 'frontend/package.json'));

// Register tsx CJS loader so Node can import TypeScript backend modules even when invoked via `node server.ts`
try {
  rootRequire('tsx/cjs');
} catch {
  // Already running under tsx or precompiled
}

function ensurePrismaClientGenerated() {
  try {
    backendRequire.resolve('.prisma/client/default');
    return;
  } catch {
    // Generate Prisma client if not yet generated
  }

  const prismaCliCandidates = [
    path.resolve(rootDir, 'backend/node_modules/prisma/build/index.js'),
    path.resolve(rootDir, 'node_modules/prisma/build/index.js'),
  ];
  const prismaCli = prismaCliCandidates.find((p) => fs.existsSync(p));
  if (prismaCli) {
    spawnSync(
      process.execPath,
      [prismaCli, 'generate', '--schema', path.resolve(rootDir, 'backend/prisma/schema.prisma')],
      { cwd: rootDir, stdio: 'inherit' }
    );
  }
}

const PORT = 3000;
const HOST = '0.0.0.0';

async function bootstrap() {
  ensurePrismaClientGenerated();

  const express = backendRequire('express');
  const appModule = backendRequire('./src/app');
  const app = appModule.default || appModule;
  const { prisma } = backendRequire('./src/config/prisma');

  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL database.');
  } catch {
    console.warn('⚠️ PostgreSQL offline or unconfigured. In-memory resilience layer active.');
  }

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite dev server middleware for SPA rendering
    const viteEntry = frontendRequire.resolve('vite');
    const { createServer: createViteServer } = await import(pathToFileURL(viteEntry).href);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
      root: path.resolve(rootDir, 'frontend'),
    });

    app.use(vite.middlewares);

    // Fallback for SPA HTML routing
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const fsPromises = await import('fs/promises');
        const templatePath = path.resolve(rootDir, 'frontend/index.html');
        let template = await fsPromises.readFile(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        vite.ssrFixStacktrace(err);
        next(err);
      }
    });
  } else {
    // Production: serve built static frontend bundles
    const frontendDist = path.resolve(rootDir, 'frontend/dist');
    app.use(express.static(frontendDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(frontendDist, 'index.html'));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 AssetVault application listening on http://${HOST}:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Fatal startup error:', err);
});

