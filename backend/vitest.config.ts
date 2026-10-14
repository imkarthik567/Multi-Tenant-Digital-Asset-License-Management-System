import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['backend/src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.ts'],
    fileParallelism: false, // Run integration tests sequentially to avoid DB race conditions
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['backend/src/services/**/*.ts', 'src/services/**/*.ts'],
    },
  },
});
