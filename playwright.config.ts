import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { defineConfig, devices } from '@playwright/test'
import { STORAGE_STATE } from './e2e/credentials'

/*
 * Playwright 1.63 wants Chromium build 1243; this machine has 1217 cached from
 * an earlier install, which runs these tests perfectly well. Point at it when
 * it is there rather than pulling a second full browser down, and fall back to
 * Playwright's own resolution everywhere else (CI, a fresh checkout).
 */
const CACHED_CHROMIUM = `${homedir()}/Library/Caches/ms-playwright/chromium-1217/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`
const launchOptions = existsSync(CACHED_CHROMIUM)
  ? { executablePath: CACHED_CHROMIUM }
  : {}

const PORT = 3100
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env['CI']),
  reporter: process.env['CI'] === undefined ? [['list']] : [['github'], ['list']],
  /*
   * A cold `next start` gets hit by ten workers at once on the run that
   * builds first, and the first paint can take a while. A high ceiling costs
   * nothing once warm. One retry, so a straggler is reported as flaky rather
   * than passing silently or failing the run.
   */
  expect: { timeout: 20_000 },
  retries: 1,
  use: { baseURL: BASE_URL, trace: 'on-first-retry' },
  projects: [
    // Signs in once; the two browser projects reuse the cookie.
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { launchOptions } },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], launchOptions, storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
    // AC-12: the client view has to work on a phone held inside WhatsApp.
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], launchOptions, storageState: STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    env: { DATABASE_URL: 'pglite://./.pglite-e2e' },
    command: `pnpm seed:e2e && pnpm build && pnpm start --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 180_000,
  },
})
