import { expect, test } from '@playwright/test'

/**
 * The monthly pack, end to end: the gates on the screen, the refusal when
 * they are open, the confirmation that opens them, and the workbook.
 *
 * Serial, and not retried. Confirming the roster is a write the later tests
 * depend on, so the order is the test — and a retry would start from the
 * state the first attempt created, where the "not yet confirmed" assertions
 * are false. A stateful group that retries is a group that lies.
 */
test.describe.configure({ mode: 'serial', retries: 0 })

/*
 * Desktop only. Confirming the roster is a write, so running the same group
 * again on the phone project would start from the state the first run left
 * and the "not yet confirmed" assertions would be false. The pack's layout
 * on a phone is covered by the mobile overflow suite.
 */
test.beforeEach(() => {
  test.skip(test.info().project.name !== 'desktop', 'writes shared state; runs once')
})

const MONTH = '2026-09'
const LIVE_TOKEN = 'lwas-2f8c41d6a9b34e07'

test('the gates are shown, and the unconfirmed roster holds the pack', async ({ page }) => {
  await page.goto('/report')
  await expect(page.locator('[data-status="report.gate.aliases_decided"]')).toHaveText('Passed')
  await expect(page.locator('[data-status="report.gate.blocks_cited"]')).toHaveText('Passed')
  await expect(page.locator('[data-status="report.gate.roster_confirmed"]')).toHaveText('Waiting')
  await expect(page.getByText(/Nobody has confirmed the roster for 2026-09/)).toBeVisible()
})

test('a draft prints the report but withholds the money', async ({ page }) => {
  await page.goto(`/print/${MONTH}`)
  // The narrative sections are useful early; the amount payable is what the
  // roster gate exists to hold back.
  await expect(page.locator('.report')).toContainText('Withheld')
  await expect(page.locator('.report')).toContainText('cannot be generated against claimed')
  await expect(page.locator('.report')).toContainText('Raised')
})

test('the print view saves as PDF, and a draft says so on paper', async ({ page }) => {
  await page.goto(`/print/${MONTH}`)
  const save = page.getByRole('button', { name: 'Save as PDF' })
  await expect(save).toBeVisible()

  await page.emulateMedia({ media: 'print' })
  // The control is for the screen; the draft mark is for the paper. A draft
  // that prints looking final is the failure worth preventing.
  await expect(save).toBeHidden()
  await expect(page.getByText(/Draft\./)).toBeVisible()
})

test('the workbook refuses to generate while a gate is open', async ({ page }) => {
  /*
   * Navigated, not fetched through the API context. The session cookie is
   * Secure in the production build these tests run, and an API context will
   * not send a Secure cookie over http while a browser will for localhost.
   */
  const response = await page.goto(`/api/report/rkb?month=${MONTH}`)
  expect(response?.status()).toBe(409)
  const body: unknown = JSON.parse(await page.locator('pre').innerText())
  expect(body).toMatchObject({ gates: ['roster_confirmed'] })
  expect(JSON.stringify(body)).toContain('claimed attendance alone')
})

test('confirming the roster records who did it and opens the gate', async ({ page }) => {
  await page.goto('/report')
  await page.getByRole('button', { name: /checked the roster/i }).click()

  await expect(page.locator('[data-status="report.gate.roster_confirmed"]')).toHaveText('Passed')
  await expect(page.getByText('Confirmed by Sarwedi')).toBeVisible()
})

test('the workbook downloads once every gate passes', async ({ page }) => {
  const download = page.waitForEvent('download')
  await page.goto(`/api/report/rkb?month=${MONTH}`).catch(() => undefined)
  const file = await download
  expect(file.suggestedFilename()).toBe('RKB_2026-09_realisasi.xlsx')

  const path = await file.path()
  const { readFile } = await import('node:fs/promises')
  const bytes = await readFile(path)
  // A real xlsx is a zip: "PK".
  expect(bytes.subarray(0, 2).toString()).toBe('PK')
  expect(bytes.byteLength).toBeGreaterThan(50_000)
})

test('the client report prints the same figures the screens show', async ({ page }) => {
  await page.goto(`/print/${MONTH}`)
  await expect(page.getByRole('heading', { name: 'Monthly Report', level: 1 })).toBeVisible()
  await expect(page.getByText('Living World Alam Sutera · September 2026')).toBeVisible()

  const report = page.locator('.report')
  await expect(report).toContainText('75')
  await expect(report).toContainText('41 min')
  await expect(report).toContainText('Not yet stated')
  await expect(report).toContainText('no line-up')
  // Sections a person fills are printed as such, never left blank.
  await expect(report).toContainText('Written by the Project Coordinator')
  await expect(report).toContainText('Awaiting')
})

test('neither the confirm button nor the workbook reaches the client link', async ({ page }) => {
  await page.goto(`/c/${LIVE_TOKEN}/report`)
  await expect(page.getByRole('button', { name: /checked the roster/i })).toHaveCount(0)
  await expect(page.locator('[data-download="rkb"]')).toHaveCount(0)
})
