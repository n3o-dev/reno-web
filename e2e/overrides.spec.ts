import { expect, test } from '@playwright/test'

/**
 * AC-10 — an overridden value shows its reason and its chain, in both views.
 *
 * The reason text is the assertion because that is what the client reads.
 * A correction Reno could make quietly would be worse than the agent being
 * wrong in the first place.
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

    // The corrected value is what is shown, not the agent's original.
    await expect(page.locator(`[data-figure="${FIGURE}"]`)).toHaveText('3')
    await expect(page.locator(`[data-overridden="${FIGURE}"]`)).toHaveText('corrected')

    const disclosure = page.locator('details', {
      has: page.locator(`summary[aria-label="Evidence for ${FIGURE}"]`),
    })
    await disclosure.locator('summary').click()
    const panel = disclosure.locator('div').first()

    await expect(panel).toContainText(REASON)
    await expect(panel).toContainText('Sarwedi')
    // The agent's own value stays on the record rather than being replaced.
    await expect(panel).toContainText('Corrected from 4')
  })
}

test('a figure nobody corrected carries no marker', async ({ page }) => {
  await page.goto('/manpower')
  await expect(page.locator('[data-overridden]')).toHaveCount(1)
  await expect(page.locator('[data-figure="manpower.filled.gf.1"]')).toHaveText('32')
})
