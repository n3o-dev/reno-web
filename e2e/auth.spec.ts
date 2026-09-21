import { expect, test } from '@playwright/test'
import { E2E_EMAIL, E2E_PASSWORD, E2E_REFUSED_EMAIL } from './credentials'

/**
 * AC-1, AC-2, AC-3, AC-5, AC-8, AC-10 — the door.
 *
 * Runs signed out: the saved cookie the rest of the suite uses is discarded
 * here, because what is under test is what happens without one.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const RENO_SCREENS = [
  '/',
  '/complaints',
  '/work-orders',
  '/rkb',
  '/manpower',
  '/report-quality',
  '/scorecard',
  '/report',
  '/personnel',
]

test.describe('signed out', () => {
  test('every Reno screen sends you to sign in, remembering where you were', async ({ page }) => {
    for (const path of RENO_SCREENS) {
      await page.goto(path)
      await expect(page, path).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}`))
      await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    }
  })

  test('AC-10 · the client link still opens without any session', async ({ page }) => {
    const response = await page.goto('/c/lwas-2f8c41d6a9b34e07/complaints')
    expect(response?.status()).toBe(200)
    await expect(page.locator('[data-figure="complaints.raised"]')).toHaveText('75')
  })

  test('an API call with no session gets 401 rather than a login page', async ({ request }) => {
    // Redirecting here would hand a machine 200 and a pile of HTML, which
    // reads as success.
    const response = await request.get('/api/report/rkb?month=2026-09')
    expect(response.status()).toBe(401)
    expect(response.headers()['content-type']).toContain('application/json')
  })

  test('AC-11 · the ingest endpoint does not want a session', async ({ request }) => {
    // Still 401 — but for the bearer token, not for the missing cookie.
    const response = await request.post('/api/records', { data: { records: [] } })
    expect(response.status()).toBe(401)
    expect(await response.json()).toEqual({ error: 'unauthorized' })
  })
})

test.describe('signing in', () => {
  test('AC-2 · lands on the screen you asked for', async ({ page }) => {
    await page.goto('/manpower')
    await expect(page).toHaveURL(/\/login/)
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByLabel('Password').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.getByRole('heading', { name: 'Manpower & Billing', level: 1 })).toBeVisible()
    // Not getByText: an override on this screen also names Sarwedi.
    await expect(page.locator('[data-signed-in-as]')).toHaveText('Sarwedi')
  })

  test('AC-3 · a wrong password and an unknown email read the same', async ({ page }) => {
    const refusals: string[] = []
    for (const [email, password] of [
      [E2E_REFUSED_EMAIL, 'definitely not the password'],
      ['nobody@renno.co.id', E2E_PASSWORD],
    ]) {
      await page.goto('/login')
      await page.getByLabel('Email').fill(String(email))
      await page.getByLabel('Password').fill(String(password))
      await page.getByRole('button', { name: 'Sign in' }).click()
      // Wait for the text rather than reading it: innerText does not retry,
      // so it can land between the alert appearing and React filling it.
      // Scoped to the form: Next's route announcer is also role=alert.
      const alert = page.locator('form [role="alert"]')
      await expect(alert).not.toBeEmpty()
      refusals.push(await alert.innerText())
    }
    expect(refusals[0]).toBe(refusals[1])
    expect(refusals[0]).toBe('Email or password is wrong')
  })

  test('AC-5 · the cookie is httpOnly, Lax, and carries nothing about the person', async ({
    request,
  }) => {
    const response = await request.post('/api/auth/login', {
      data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    })
    expect(response.status()).toBe(200)

    const setCookie = response.headers()['set-cookie'] ?? ''
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=lax')
    // Not Secure here because the suite runs over http; on the VPS the
    // reverse proxy sets x-forwarded-proto and it is.
    expect(setCookie).not.toContain('Secure')
    expect(setCookie).not.toContain(E2E_EMAIL)
    expect(setCookie).not.toContain('Sarwedi')
    expect(setCookie).not.toContain(E2E_PASSWORD)
  })

  test('does not let the next parameter send you off-site', async ({ page }) => {
    await page.goto('/login?next=https://example.com/phish')
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByLabel('Password').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/127\.0\.0\.1/)
  })
})

test.describe('signing out', () => {
  test('AC-8 · clears the cookie and the screens close behind you', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(E2E_EMAIL)
    await page.getByLabel('Password').fill(E2E_PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('heading', { name: 'Today', level: 1 })).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/manpower')
    await expect(page).toHaveURL(/\/login/)
  })
})
