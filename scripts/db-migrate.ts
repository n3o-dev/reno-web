/**
 * Brings a database up to date. Safe to run repeatedly.
 *
 * Reads DATABASE_URL and nothing else, so the same command works against a
 * local database and the VPS without a flag to get wrong.
 */
import { connect } from '@/db/postgres'
import { migrate } from '@/db/migrate'

const url = process.env['DATABASE_URL']
if (url === undefined || url.trim() === '') {
  console.error('DATABASE_URL is not set; nothing to migrate')
  process.exit(1)
}

const db = connect(url)
try {
  const applied = await migrate(db.sql, db.exec)
  console.log(applied.length === 0 ? 'already up to date' : `applied ${applied.join(', ')}`)
} finally {
  await db.close()
}
