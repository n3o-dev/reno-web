/**
 * Loads the committed fixture month into whatever `DATABASE_URL` points at.
 *
 * The fixture set is the concept deck's month: the same per-day message,
 * photo, report and complaint counts the slides show. Seeding it gives a
 * populated dashboard to walk someone through before the agent is emitting
 * anything.
 *
 * Idempotent — every record keeps its own `record_id`, so running this twice
 * upserts the same rows. It adds records and nothing else: no accounts, and
 * no month confirmation, because the roster gate is a person's signature and
 * seeding one would be forging it.
 *
 * `pnpm seed:demo`. Refuses without `--yes`, since the usual target is live.
 */
import { RECORD_TYPES } from '@/contract/schemas'
import { loadFixtureSource } from '@/contract/source'
import { SITE_ID } from '@/config/site'
import { connectTo } from '@/db/connect'
import { migrate } from '@/db/migrate'
import { parseBatch, upsertBatch } from '@/db/records-store'

if (!process.argv.includes('--yes')) {
  console.error('This writes the fixture month into DATABASE_URL. Re-run with --yes.')
  process.exit(1)
}

const url = process.env['DATABASE_URL']
if (url === undefined || url.trim() === '') {
  console.error('DATABASE_URL is not set')
  process.exit(1)
}

const db = connectTo(url)
try {
  await migrate(db.sql, db.exec)
  const fixtures = await loadFixtureSource()

  let total = 0
  for (const type of RECORD_TYPES) {
    const records = fixtures.all(type)
    const batch = parseBatch(records.map((payload) => ({ type, payload })))
    await db.transaction((sql) => upsertBatch(sql, batch, SITE_ID))
    total += records.length
    console.log(`${String(records.length).padStart(5)}  ${type}`)
  }
  console.log(`seeded ${total} records into ${SITE_ID}`)
} finally {
  await db.close()
}
