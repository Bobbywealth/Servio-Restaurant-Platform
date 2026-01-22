import { defineConfig } from '@playwright/test';

const port = Number(process.env.PORT || 3000);
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  webServer: {
    // In CI, start a production-like server. Locally, reuse an existing server if present.
    command: process.env.CI ? 'npm run build && npm run start' : 'npm run dev',
    url: baseURL,
    // Some environments set CI=true even locally; always allow reuse to avoid port conflicts.
    reuseExistingServer: true,
    timeout: 180_000,
  },
});

