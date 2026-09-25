import { defineConfig, configDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    // Live Gemini tests are excluded from `npm test`; run them with `npm run test:live`
    exclude: [...configDefaults.exclude, '**/*.live.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
