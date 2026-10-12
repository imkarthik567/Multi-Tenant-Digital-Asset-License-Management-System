import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['src/__tests__/**/*.test.ts'],
    fileParallelism: false, // Run integration tests sequentially to avoid DB race conditions
  },
});
