import { expect, test } from '@playwright/test'

/**
 * AC-3, AC-4, AC-6 — the client link.
 *
 * Tokens come from fixtures/site/client-tokens.json. The revoked and
 * wrong-site entries exist so these can be checked rather than assumed.
 */
const LIVE = 'lwas-2f8c41d6a9b34e07'
const REVOKED = 'lwas-revoked-7c1e05'
const OTHER_SITE = 'ggb-4a7d92f1c0b85e3a'

const CLIENT_SCREENS = ['', '/complaints', '/work-orders', '/rkb', '/manpower', '/report']
const RENO_ONLY = ['/report-quality', '/scorecard', '/personnel']

test.describe('a live link', () => {
  test('opens every client screen', async ({ page }) => {
    for (const path of CLIENT_SCREENS) {
      const response = await page.goto(`/c/${LIVE}${path}`)
      expect(response?.status(), path).toBe(200)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    }
  })

  test('shows the same complaint figures Reno sees', async ({ page }) => {
    await page.goto(`/c/${LIVE}/complaints`)
    await expect(page.locator('[data-figure="complaints.raised"]')).toHaveText('75')
    await expect(page.locator('[data-figure="complaints.median_closure_minutes"]')).toHaveText(
      '41 min',
    )
  })

  test('has no way to change anything (AC-6)', async ({ page }) => {
    for (const path of CLIENT_SCREENS) {
      await page.goto(`/c/${LIVE}${path}`)
      await expect(page.locator('form'), path).toHaveCount(0)
      await expect(page.locator('input, textarea, select'), path).toHaveCount(0)
      await expect(page.locator('button[type=submit]'), path).toHaveCount(0)
    }
  })

  test('carries no Reno-only element (AC-3)', async ({ page }) => {
    for (const path of CLIENT_SCREENS) {
      await page.goto(`/c/${LIVE}${path}`)
      await expect(page.locator('[data-reno-only]'), path).toHaveCount(0)
    }
  })

  test('has no route to the internal screens (AC-3)', async ({ page }) => {
    for (const path of RENO_ONLY) {
      const response = await page.goto(`/c/${LIVE}${path}`)
      expect(response?.status(), path).toBe(404)
    }
  })

  test('never links anywhere outside its own token', async ({ page }) => {
    await page.goto(`/c/${LIVE}`)
    const hrefs = await page
      .getByRole('link')
      .evaluateAll((links) => links.map((l) => l.getAttribute('href') ?? ''))
    for (const href of hrefs) {
      expect(href.startsWith(`/c/${LIVE}`), `${href} escapes the token`).toBe(true)
    }
  })
})

test.describe('a link that should not work', () => {
  test('a revoked link answers 401 (AC-4)', async ({ page }) => {
    const response = await page.goto(`/c/${REVOKED}`)
    expect(response?.status()).toBe(401)
  })

  test('an unknown link answers 401', async ({ page }) => {
    const response = await page.goto('/c/not-a-real-token-at-all')
    expect(response?.status()).toBe(401)
  })

  test('a token for another site reads none of this one (AC-4)', async ({ page }) => {
    await page.goto(`/c/${OTHER_SITE}/complaints`)
    await expect(page.locator('[data-figure="complaints.raised"]')).toHaveText('0')
  })
})

test.describe('a token for another site sees none of this one', () => {
  /*
   * Records were scoped from the start; the workbook, the contract and the
   * amount payable were not. A Grand Galaxy token rendered LWAS's
   * Rp 370.000.000, its 533 planned job-row days and its 75 complaints.
   */
  const FIGURES_AT_ZERO = [
    ['/complaints', 'complaints.raised'],
    ['/report', 'report.complaints'],
    ['/manpower', 'manpower.filled_slot_days'],
  ] as const

  for (const [path, figure] of FIGURES_AT_ZERO) {
    test(`${path} reads zero`, async ({ page }) => {
      await page.goto(`/c/${OTHER_SITE}${path}`)
      await expect(page.locator(`[data-figure="${figure}"]`)).toHaveText('0')
    })
  }

  test('the amount payable is not shown at all', async ({ page }) => {
    await page.goto(`/c/${OTHER_SITE}/manpower`)
    await expect(page.locator('body')).not.toContainText('370.000.000')
  })

  test('the RKB workbook is not shown at all', async ({ page }) => {
    await page.goto(`/c/${OTHER_SITE}/rkb`)
    await expect(page.getByText('No RKB workbook has been loaded for this site.')).toBeVisible()
    await expect(page.locator('body')).not.toContainText('533')
  })
})
