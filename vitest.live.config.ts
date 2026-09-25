import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.live.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 60000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
