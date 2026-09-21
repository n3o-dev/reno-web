import { expect, test as setup } from '@playwright/test'
import { E2E_EMAIL, E2E_PASSWORD } from './credentials'

/**
 * Signs in once and saves the cookie for the rest of the suite.
 *
 * Auth has no open mode, so every Reno screen now needs a session. Doing it
 * once here rather than per test keeps the suite fast and means the sign-in
 * path itself is exercised on every run.
 */
const STATE = 'e2e/.auth/state.json'

setup('sign in', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(E2E_EMAIL)
  await page.getByLabel('Password').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()

  await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible()
  await page.context().storageState({ path: STATE })
})
