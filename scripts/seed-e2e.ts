/**
 * The database the end-to-end suite runs against.
 *
 * Auth has no open mode, so the suite cannot test the Reno surface without a
 * real database and a real account. PGlite gives both in-process, so this
 * needs nothing installed: one directory, wiped and rebuilt each run so the
 * suite starts from the same state every time.
 */
import { rm } from 'node:fs/promises'
import { RECORD_TYPES } from '@/contract/schemas'
import { loadFixtureSource } from '@/contract/source'
import { connectTo } from '@/db/connect'
import { migrate } from '@/db/migrate'
import { parseBatch, upsertBatch } from '@/db/records-store'
import { upsertAccount } from '@/services/sessions'

export const E2E_DIR = '.pglite-e2e'
export const E2E_URL = `pglite://./${E2E_DIR}`
export const E2E_EMAIL = 'sarwedi@renno.co.id'
export const E2E_PASSWORD = 'living world alam sutera 2026'
/*
 * A second account, used only by tests that sign in wrongly on purpose.
 * Failed attempts throttle the account they target, so without this the
 * refusal tests would lock out the account the rest of the suite uses.
 */
export const E2E_REFUSED_EMAIL = 'refused@renno.co.id'

await rm(E2E_DIR, { recursive: true, force: true })

const db = connectTo(E2E_URL)
try {
  await migrate(db.sql, db.exec)
  await upsertAccount(db.sql, E2E_EMAIL, 'Sarwedi', E2E_PASSWORD)
  await upsertAccount(db.sql, E2E_REFUSED_EMAIL, 'Refusal Test', E2E_PASSWORD)

  const fixtures = await loadFixtureSource()
  for (const type of RECORD_TYPES) {
    const batch = parseBatch(fixtures.all(type).map((payload) => ({ type, payload })))
    await db.transaction((sql) => upsertBatch(sql, batch, 'lwas'))
  }
  console.log(`seeded ${E2E_DIR}: one account and the full fixture set`)
} finally {
  await db.close()
}
