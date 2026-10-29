// Cross-platform build script for AssetVault Frontend
// Supports both monorepo root-hoisted node_modules and standalone frontend/node_modules,
// while avoiding Windows cmd.exe unquoted '&' directory path parsing bugs.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function resolveBinary(pkgName, binSubpath) {
  // 1. Try local frontend/node_modules
  const localPath = path.resolve(__dirname, '..', 'node_modules', pkgName, binSubpath);
  if (fs.existsSync(localPath)) return localPath;

  // 2. Try monorepo root node_modules
  const rootPath = path.resolve(__dirname, '..', '..', 'node_modules', pkgName, binSubpath);
  if (fs.existsSync(rootPath)) return rootPath;

  return null;
}

const tscPath = resolveBinary('typescript', 'bin/tsc');
const vitePath = resolveBinary('vite', 'bin/vite.js');
const prismaPath = resolveBinary('prisma', 'build/index.js');

const frontendDir = path.resolve(__dirname, '..');
const schemaPath = path.resolve(frontendDir, '..', 'backend', 'prisma', 'schema.prisma');

// 0. Ensure Prisma Client is generated for serverless /api routes
if (prismaPath && fs.existsSync(schemaPath)) {
  console.log('Generating Prisma Client for backend API...');
  spawnSync(process.execPath, [prismaPath, 'generate', `--schema=${schemaPath}`], {
    cwd: path.resolve(frontendDir, '..'),
    stdio: 'inherit',
  });
}

// 1. Run TypeScript typecheck
console.log('Running TypeScript typecheck...');
const tscResult = tscPath
  ? spawnSync(process.execPath, [tscPath], { cwd: frontendDir, stdio: 'inherit' })
  : spawnSync('tsc', [], { cwd: frontendDir, stdio: 'inherit', shell: true });

if (tscResult.status !== 0) {
  process.exit(tscResult.status || 1);
}

// 2. Run Vite production build
console.log('Running Vite production build...');
const viteResult = vitePath
  ? spawnSync(process.execPath, [vitePath, 'build'], { cwd: frontendDir, stdio: 'inherit' })
  : spawnSync('vite', ['build'], { cwd: frontendDir, stdio: 'inherit', shell: true });

if (viteResult.status !== 0) {
  process.exit(viteResult.status || 1);
}

// 3. Mirror frontend/dist to root dist for root-level Vercel deployments configured with outputDirectory: "dist"
try {
  const localDist = path.resolve(frontendDir, 'dist');
  const rootDist = path.resolve(frontendDir, '..', 'dist');
  if (fs.existsSync(localDist) && localDist !== rootDist) {
    fs.cpSync(localDist, rootDist, { recursive: true });
    console.log('Mirrored build output to root dist directory.');
  }
} catch (err) {
  console.warn('Warning: Could not mirror build output to root dist:', err.message);
}

process.exit(0);
