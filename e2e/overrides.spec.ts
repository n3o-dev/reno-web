import { expect, test } from '@playwright/test'

/**
 * AC-10 — a correction shows its reason and its chain, in both views.
 *
 * The correction in `fixtures/site/overrides.json` says one garbage slot
 * went uncovered on 12 September. What is checked here is that the screens
 * agree with each other about it: the row, the headline and the client view.
 */
const LIVE = 'lwas-2f8c41d6a9b34e07'
const FIGURE = 'manpower.filled.garbage.2'
const REASON = /Muhamad Abdullah left at 18:00 on 12 September/

for (const [surface, path] of [
  ['Reno', '/manpower'],
  ['the client link', `/c/${LIVE}/manpower`],
] as const) {
  test(`${surface} sees the correction and why`, async ({ page }) => {
    await page.goto(path)

    // The corrected count, not the claimed one: the line-up named someone
    // for all four days, and one of those was corrected away.
    await expect(page.locator(`[data-figure="${FIGURE}"]`)).toHaveText('3')
    await expect(page.locator(`[data-overridden="${FIGURE}"]`)).toContainText(REASON)
    await expect(page.locator(`[data-overridden="${FIGURE}"]`)).toContainText('Sarwedi')
  })
}

test('the rows still sum to the headline', async ({ page }) => {
  await page.goto('/manpower')
  const rows = await page
    .locator('[data-figure^="manpower.filled."]')
    .evaluateAll((nodes) => nodes.map((n) => Number(n.textContent)))
  const headline = Number(await page.locator('[data-figure="manpower.filled_slot_days"]').textContent())

  expect(rows.length).toBeGreaterThan(0)
  // The defect this replaces: the override was applied at render time, so
  // these summed to one less than the headline.
  expect(rows.reduce((a, b) => a + b, 0)).toBe(headline)
})

test('a figure nobody corrected carries no marker', async ({ page }) => {
  await page.goto('/manpower')
  await expect(page.locator('[data-overridden]')).toHaveCount(1)
  await expect(page.locator('[data-figure="manpower.filled.gf.1"]')).toHaveText('32')
})
