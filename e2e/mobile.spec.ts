import { expect, test } from '@playwright/test'

/**
 * AC-12 — usable on a phone held inside WhatsApp.
 *
 * Runs on the mobile project only; on desktop these constraints say nothing.
 */
const PATHS = [
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

test.describe('on a phone', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'mobile', 'these constraints only mean something on a phone')
  })

  for (const path of PATHS) {
    test(`${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(path)
      const overflow = await page.evaluate(() => {
        const { scrollWidth, clientWidth } = document.documentElement
        return scrollWidth - clientWidth
      })
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
    })
  }

  test('every navigation link is big enough to hit', async ({ page }) => {
    await page.goto('/')
    for (const link of await page.getByRole('navigation').getByRole('link').all()) {
      const box = await link.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    }
  })
})
