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

const MESSAGES_PER_DAY = [339, 414, 326, 299]
const PHOTOS_PER_DAY = [264, 314, 251, 223]
const REPORTS_PER_DAY = [166, 149, 170, 154]
const DEFECTS = {
  no_area: 36,
  done_without_complaint: 12,
  no_caption: 10,
  photo_reused: 3,
}
const BEFORE_AFTER = 61
const LATE_PHOTOS = 25
const DUPLICATE_PAIRS = 3

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

test.describe('Report Quality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/report-quality')
  })

  test('group activity totals match the deck', async ({ page }) => {
    await expect(page.locator(figure('quality.activity.messages'))).toHaveText(
      String(sum(MESSAGES_PER_DAY)),
    )
    await expect(page.locator(figure('quality.activity.photos'))).toHaveText(
      String(sum(PHOTOS_PER_DAY)),
    )
    await expect(page.locator(figure('quality.activity.reports'))).toHaveText(
      String(sum(REPORTS_PER_DAY)),
    )
  })

  test('each activity series is drawn day by day, in order', async ({ page }) => {
    for (const [key, expected] of [
      ['messages', MESSAGES_PER_DAY],
      ['photos', PHOTOS_PER_DAY],
      ['reports', REPORTS_PER_DAY],
    ] as const) {
      const counts = await page
        .locator(`[data-day-count="quality.activity.${key}"]`)
        .evaluateAll((nodes) => nodes.map((n) => Number(n.getAttribute('data-count'))))
      expect(counts, key).toEqual(expected)
    }
  })

  test('the defect breakdown matches the deck', async ({ page }) => {
    for (const [defect, expected] of Object.entries(DEFECTS)) {
      await expect(page.locator(figure(`quality.defect.${defect}`)), defect).toHaveText(
        String(expected),
      )
    }
  })

  test('evidence coverage matches the deck', async ({ page }) => {
    await expect(page.locator(figure('quality.before_after'))).toHaveText(String(BEFORE_AFTER))
    await expect(page.locator(figure('quality.late_photos'))).toHaveText(String(LATE_PHOTOS))
    await expect(page.locator(figure('quality.duplicate_pairs'))).toHaveText(
      String(DUPLICATE_PAIRS),
    )
  })

  test('the only completion percentage lives on the RKB screen (AC-7)', async ({ page }) => {
    await expect(page.locator('[data-figure-kind="completion"]')).toHaveCount(0)
  })
})

test.describe('Work Orders', () => {
  test('the delivery counts and every request are shown', async ({ page }) => {
    await page.goto('/work-orders')
    await expect(page.locator(figure('work_orders.on_time'))).toHaveText('2')
    await expect(page.locator(figure('work_orders.open'))).toHaveText('1')
    await expect(page.locator(figure('work_orders.blocked'))).toHaveText('0')
    await expect(page.getByRole('row')).toHaveCount(4) // header + three requests
    await expect(page.getByText('WO to HK — Pioneer DJ (12 – 13 September 2026)')).toBeVisible()
  })
})

test.describe('Manpower & Billing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/manpower')
  })

  test('slot-day coverage comes off the line-ups', async ({ page }) => {
    // 37 people across 8 areas, two shifts, four days.
    await expect(page.locator(figure('manpower.filled_slot_days'))).toHaveText('296')
    await expect(page.locator(figure('manpower.filled.gf.1'))).toContainText('32')
  })

  test('attendance is claimed, never verified (AC-9)', async ({ page }) => {
    // Not the first /claimed/ in the DOM: the info panels are closed <details>
    // and their text is present but hidden.
    await expect(page.getByText('Claimed, not yet admin-confirmed')).toBeVisible()
    await expect(page.getByText(/\bverified\b/i)).toHaveCount(0)
  })

  test('the anti-fraud panel is marked Reno-only (AC-3)', async ({ page }) => {
    await expect(page.locator('[data-reno-only="true"]')).toHaveCount(1)
  })

  test('states no money while the contract rate is unloaded', async ({ page }) => {
    // A status, not a figure: it states no number, so it cites no evidence.
    await expect(page.locator('[data-status="manpower.payable"]')).toHaveText('Rate not loaded')
  })
})

test.describe('RKB Realisation', () => {
  test('mirrors the workbook and computes realisation from it', async ({ page }) => {
    await page.goto('/rkb')
    // 533 planned job-row days across the six sheets of RKB Juli 2026.
    await expect(page.locator(figure('rkb.planned'))).toHaveText('533')
    await expect(page.locator(figure('rkb.net'))).toHaveText('50%')
    await expect(page.locator(figure('rkb.gross'))).toHaveText('50%')
    await expect(page.locator(figure('rkb.realisation.facade'))).toHaveText('100%')
    await expect(page.locator(figure('rkb.realisation.car-park'))).toHaveText('0%')
  })

  test('a sheet opens its own day grid', async ({ page }) => {
    await page.goto('/rkb')
    await page.getByRole('link', { name: 'FACADE' }).click()
    await expect(page.getByRole('heading', { name: 'FACADE', level: 1 })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(1)
  })
})
