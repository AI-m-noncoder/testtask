import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/env.ts'],
    // Files share one database, so they must not run in parallel
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
