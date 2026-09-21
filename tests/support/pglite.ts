import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from '@/db/client'
import { migrate } from '@/db/migrate'

/**
 * A real Postgres for the tests, in this process.
 *
 * PGlite is Postgres compiled to WASM: the same SQL, the same types, the
 * same `ON CONFLICT` semantics — so these tests exercise the statements that
 * ship rather than a stub that agrees with them. No Docker daemon, which
 * means the suite runs the same way everywhere.
 */
export async function testDatabase(): Promise<Database> {
  const pg = new PGlite()

  const sql: Sql = async <T>(text: string, params: readonly unknown[]) => {
    const result = await pg.query<T>(text, [...params])
    return result.rows
  }

  const db: Database = {
    sql,
    exec: async (script) => {
      await pg.exec(script)
    },
    // PGlite is single-connection, so a transaction is the same handle.
    transaction: async (work) => {
      await pg.query('BEGIN')
      try {
        const out = await work(sql)
        await pg.query('COMMIT')
        return out
      } catch (error) {
        await pg.query('ROLLBACK')
        throw error
      }
    },
    close: () => pg.close(),
  }

  await migrate(sql, db.exec)
  return db
}
