import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Real-Electron suites live in tests/electron and run via
  // playwright.electron.config.ts (`npm run test:electron`).
  testMatch: ['**/*.spec.ts'],
  testIgnore: ['**/electron/**'],
  outputDir: 'test-results-wsl',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npx vite preview --host 127.0.0.1 --port 5199',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
