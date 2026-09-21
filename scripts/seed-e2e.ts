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
/** Present in the database and absent from the fixtures, on purpose. */
export const E2E_DB_ONLY_RECORD = 'per_db_only_witness'
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
  /*
   * One record that exists only in the database. Without it the seeded data
   * is byte-identical to the fixture set the app falls back to, so the
   * screens would render the same figures even if the Postgres read path
   * were broken entirely — and the test proving "reads Postgres when
   * DATABASE_URL is set" could never fail. A person, not a message: the
   * deck figures are per-day message counts and must not move.
   */
  const template = fixtures.people[0]
  if (template === undefined) throw new Error('no person to base the witness on')
  const witness = {
    ...template,
    record_id: E2E_DB_ONLY_RECORD,
    person_id: 'db_only_witness',
    canonical_name: 'Database Only',
  }
  await db.transaction((sql) =>
    upsertBatch(sql, parseBatch([{ type: 'person', payload: witness }]), 'lwas'),
  )

  console.log(`seeded ${E2E_DIR}: one account and the full fixture set, plus one witness record`)
} finally {
  await db.close()
}
