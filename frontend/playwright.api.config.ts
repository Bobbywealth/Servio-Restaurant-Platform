import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: 'api-refresh-parallel.spec.ts',
  timeout: 60_000,
  reporter: [['list']],
  use: {
    headless: true
  }
})
