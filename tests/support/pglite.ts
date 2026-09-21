import type { Database } from '@/db/client'
import { migrate } from '@/db/migrate'
import { connectPglite } from '@/db/pglite-database'

/**
 * A real Postgres for the tests, in this process.
 *
 * PGlite is Postgres compiled to WASM: the same SQL, the same types, the
 * same `ON CONFLICT` semantics — so these tests exercise the statements that
 * ship rather than a stub that agrees with them. No Docker daemon, which
 * means the suite runs the same way everywhere. In memory, so each test gets
 * a database nobody else has touched.
 */
export async function testDatabase(): Promise<Database> {
  const db = connectPglite(undefined)
  await migrate(db.sql, db.exec)
  return db
}
