import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e', timeout: 35_000, fullyParallel: true, workers: 2,
  reporter: 'list', outputDir: 'test-results',
  use: { baseURL: process.env.TEST_BASE_URL || 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', screenshot: 'only-on-failure' },
})
