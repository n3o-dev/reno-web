import { expect, test } from '@playwright/test'

/**
 * AC-12 — the client view is usable on a phone held inside WhatsApp.
 *
 * The client view, at exactly 390px, checking every interactive element.
 * The previous version of this file walked the Reno screens at the mobile
 * project's 412px and measured navigation links only — so it passed while
 * every evidence control on every screen was 24px.
 */
const LIVE = 'lwas-2f8c41d6a9b34e07'
const CLIENT_SCREENS = ['', '/complaints', '/work-orders', '/rkb', '/manpower', '/report']
const TAP_TARGET = 44

test.use({ viewport: { width: 390, height: 844 } })

test.describe('on a 390px phone', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'mobile', 'these constraints only mean something on a phone')
  })

  for (const path of CLIENT_SCREENS) {
    test(`/c/<token>${path} does not scroll sideways`, async ({ page }) => {
      await page.goto(`/c/${LIVE}${path}`)
      expect(await page.evaluate(() => window.innerWidth)).toBe(390)
      const overflow = await page.evaluate(() => {
        const { scrollWidth, clientWidth } = document.documentElement
        return scrollWidth - clientWidth
      })
      expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
    })

    test(`/c/<token>${path} has no tap target under ${TAP_TARGET}px`, async ({ page }) => {
      await page.goto(`/c/${LIVE}${path}`)

      // Everything a thumb can hit, not just the navigation.
      const small = await page
        .locator('a, button, summary, [role="button"]')
        .evaluateAll((nodes, min) =>
          nodes
            .map((n) => {
              const box = n.getBoundingClientRect()
              return {
                what: `${n.tagName.toLowerCase()} ${(n.getAttribute('aria-label') ?? n.textContent ?? '').trim().slice(0, 40)}`,
                w: Math.round(box.width),
                h: Math.round(box.height),
              }
            })
            .filter((t) => t.w > 0 && t.h > 0 && (t.w < min || t.h < min)),
          TAP_TARGET,
        )
      expect(small).toEqual([])
    })
  }

  test('the Reno navigation is reachable too', async ({ page }) => {
    await page.goto('/')
    for (const link of await page.getByRole('navigation').getByRole('link').all()) {
      const box = await link.boundingBox()
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(TAP_TARGET)
    }
  })
})
