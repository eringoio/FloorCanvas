import { defineConfig } from '@playwright/test';

/**
 * Configuration for automated tests that launch the REAL Electron app
 * (Playwright `_electron`) against the real Windows filesystem.
 *
 * Run with: npm run test:electron
 *
 * These are local/Windows regression tests; the Ubuntu CI job runs only the
 * browser E2E suite (playwright.config.ts). Requires `npm run build` output
 * (dist/index.html) — `npm run test:electron` chains the build automatically.
 */
export default defineConfig({
  testDir: './tests/electron',
  outputDir: 'test-results-electron',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  reporter: 'list',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
