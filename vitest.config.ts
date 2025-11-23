import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['backend/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/evals/**'],
    setupFiles: ['vitest.setup.ts'],
  },
});
