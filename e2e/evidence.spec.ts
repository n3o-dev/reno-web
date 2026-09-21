import { expect, test } from '@playwright/test'

/**
 * AC-2 — every figure opens on the evidence behind it.
 *
 * Walks every element carrying `data-figure` and fails on any whose evidence
 * resolves to nothing. A dashboard whose numbers cannot be traced back to
 * what someone posted in the group is the thing this project exists to
 * replace.
 */
const SCREENS = [
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

for (const path of SCREENS) {
  test(`${path} — every figure cites something`, async ({ page }) => {
    await page.goto(path)
    const figures = await page.locator('[data-figure]').evaluateAll((nodes) =>
      nodes.map((n) => ({
        name: n.getAttribute('data-figure') ?? '',
        evidence: n.getAttribute('data-evidence'),
        value: (n.textContent ?? '').trim(),
      })),
    )
    expect(figures.length, `${path} carries no figures at all`).toBeGreaterThan(0)

    /*
     * A figure may legitimately count nothing — no work order was blocked
     * this period — and then it cites nothing and says so. What must never
     * happen is a figure with a non-zero value and no source behind it.
     * Checking the pair is what makes this gate able to fail: it used to
     * accept a stated absence as a source, so `data-evidence` was never 0.
     */
    const uncited = figures.filter((f) => f.value !== '0' && Number(f.evidence ?? 0) === 0)
    expect(uncited.map((f) => `${f.name} = ${f.value}`)).toEqual([])

    // And every figure must carry the attribute at all.
    expect(figures.filter((f) => f.evidence === null).map((f) => f.name)).toEqual([])
  })
}

test('an evidence panel names a sender and a time', async ({ page }) => {
  await page.goto('/complaints')
  // The figure's own disclosure, not the card's info control beside it.
  const disclosure = page.locator('details', {
    has: page.locator('summary[aria-label="Evidence for complaints.raised"]'),
  })
  await disclosure.locator('summary').click()

  const panel = disclosure.locator('div').first()
  await expect(panel).toBeVisible()
  await expect(panel).toContainText(/\d+ sources/)
  // WhatsApp display names, exactly as the group shows them.
  await expect(panel).toContainText(/Amartha|Acenk|Sarwedi|Sofyan|Cristian|Rachmad|Desak|Alexander/)
})
