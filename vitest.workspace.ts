import { defineConfig } from 'vitest/config';

/** Workspace Vitest projects run in parallel; each package owns its config. */
export default defineConfig({
  test: {
    projects: [
      'packages/core/vitest.config.ts',
      'packages/crypto/vitest.config.ts',
      'packages/network/vitest.config.ts',
      'packages/storage/vitest.config.ts',
      'packages/ui/vitest.config.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts', 'packages/crypto/src/**/*.ts', 'packages/storage/src/**/*.ts'],
      thresholds: {
        'packages/core/src/**/*.ts': { lines: 80, functions: 80, branches: 80, statements: 80 },
        'packages/crypto/src/**/*.ts': { lines: 80, functions: 80, branches: 80, statements: 80 },
        'packages/storage/src/**/*.ts': { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  },
});
