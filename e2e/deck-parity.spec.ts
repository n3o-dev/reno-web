import { expect, test } from '@playwright/test'

/**
 * AC-15 — the screens render the case-study deck's published figures.
 *
 * The deck is what the client has already been shown, so a mismatch is a
 * dashboard defect. These numbers are duplicated from
 * scripts/fixtures/published-figures.ts on purpose: a test that imports the
 * value it is checking proves nothing.
 */
const COMPLAINTS_PER_DAY = [19, 35, 4, 17]
const ANSWERED_TOTAL = 62
const CLOSED_WITH_PHOTO_TOTAL = 29
const MEDIAN_REPLY_MINUTES = 3
const MEDIAN_CLOSURE_MINUTES = 41

const figure = (name: string) => `[data-figure="${name}"]`

test.describe('Complaints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/complaints')
  })

  test('the funnel matches the deck', async ({ page }) => {
    const raised = COMPLAINTS_PER_DAY.reduce((a, b) => a + b, 0)
    await expect(page.locator(figure('complaints.raised'))).toHaveText(String(raised))
    await expect(page.locator(figure('complaints.answered'))).toHaveText(String(ANSWERED_TOTAL))
    await expect(page.locator(figure('complaints.closed_with_photo'))).toHaveText(
      String(CLOSED_WITH_PHOTO_TOTAL),
    )
  })

  test('the two medians are shown separately and never merged', async ({ page }) => {
    await expect(page.locator(figure('complaints.median_reply_minutes'))).toHaveText(
      `${MEDIAN_REPLY_MINUTES} min`,
    )
    await expect(page.locator(figure('complaints.median_closure_minutes'))).toHaveText(
      `${MEDIAN_CLOSURE_MINUTES} min`,
    )
  })

  test('the per-day counts match the deck', async ({ page }) => {
    const counts = await page.locator(figure('complaints.raised_on_day')).allInnerTexts()
    expect(counts.map(Number)).toEqual(COMPLAINTS_PER_DAY)
  })

  test('every chart explains itself behind the info control', async ({ page }) => {
    // A <summary> is exposed as a disclosure triangle, not a button, so this
    // matches the element rather than a role it does not have.
    const infos = page.locator('summary[aria-label^="What this shows"]')
    expect(await infos.count()).toBeGreaterThan(0)
    for (const info of await infos.all()) {
      await expect(info).toBeVisible()
    }
  })
})
