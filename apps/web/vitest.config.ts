import { configDefaults, defineProject, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineProject({
    test: {
      name: 'web',
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      // The Playwright e2e specs run under `npm run e2e`, not vitest.
      exclude: [...configDefaults.exclude, 'e2e/**'],
      testTimeout: 20000,
      css: { modules: { classNameStrategy: 'non-scoped' } },
    },
  }),
);
