import { expect, test } from '@playwright/test'

/**
 * AC-1 — every screen renders from the fixture set with no network calls.
 *
 * The heading is the assertion because it is what a person looks for. A route
 * that 404s, throws on the server, or renders an empty shell all fail here.
 */
const SCREENS = [
  { path: '/', heading: 'Today' },
  { path: '/complaints', heading: 'Complaints' },
  { path: '/work-orders', heading: 'Work Orders' },
  { path: '/rkb', heading: 'RKB Realisation' },
  { path: '/manpower', heading: 'Manpower & Billing' },
  { path: '/report-quality', heading: 'Report Quality' },
  { path: '/scorecard', heading: 'Pimpro Scorecard' },
  { path: '/report', heading: 'Monthly Report' },
  { path: '/personnel', heading: 'Personnel' },
] as const

for (const screen of SCREENS) {
  test(`${screen.heading} renders`, async ({ page }) => {
    const failures: string[] = []
    page.on('response', (response) => {
      if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`)
    })

    await page.goto(screen.path)
    await expect(page.getByRole('heading', { name: screen.heading, level: 1 })).toBeVisible()
    expect(failures).toEqual([])
  })
}

test('every screen is reachable from the navigation', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation')
  for (const screen of SCREENS) {
    await expect(nav.getByRole('link', { name: screen.heading, exact: true })).toHaveAttribute(
      'href',
      screen.path,
    )
  }
})
