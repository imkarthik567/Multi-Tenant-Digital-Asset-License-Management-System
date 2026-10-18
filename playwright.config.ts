import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Playwright runs in its own process; load ignored local env files explicitly.
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node node_modules/ts-node/dist/bin.js backend/src/server.ts',
      url: 'http://localhost:5000/api/health',
      reuseExistingServer: true,
      timeout: 30000,
    },
    {
      command: 'node node_modules/vite/bin/vite.js frontend --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 30000,
    },
  ],
});
