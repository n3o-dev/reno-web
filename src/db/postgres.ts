import { Pool } from 'pg'
import type { Database, Sql } from './client'

/**
 * The production database.
 *
 * `DATABASE_URL` is read once here and nowhere else, so nothing downstream
 * has to know whether it is talking to Postgres, to the embedded database the
 * tests use, or to neither.
 */
export function connect(url: string): Database {
  const pool = new Pool({ connectionString: url })

  const run =
    (query: (text: string, params: readonly unknown[]) => Promise<{ rows: unknown[] }>): Sql =>
    async <T>(text: string, params: readonly unknown[]) => {
      const result = await query(text, params)
      // The one cast in the data path. pg cannot know a query's row shape, so
      // this is the I/O boundary: everything that comes back through it is
      // parsed by Zod before it becomes a record.
      return result.rows as T[]
    }

  return {
    sql: run((text, params) => pool.query(text, [...params])),
    exec: async (script) => {
      await pool.query(script)
    },
    transaction: async (work) => {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const out = await work(run((text, params) => client.query(text, [...params])))
        await client.query('COMMIT')
        return out
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}
