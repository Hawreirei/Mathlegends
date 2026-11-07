import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke test (#47): the production build in a real browser, on a desktop screen and a phone
 * screen (390 x 844, touch), in both languages. `npm run e2e` builds nothing: run `npm run build`
 * first (CI does). Traces are off: they cost CPU and the test prints what failed.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: 'http://localhost:4173/Mathlegends/',
    trace: 'off',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } },
    },
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Mathlegends/',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
