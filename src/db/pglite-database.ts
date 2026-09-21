import { PGlite } from '@electric-sql/pglite'
import type { Database, Sql } from './client'

/**
 * Postgres compiled to WASM, running inside this process.
 *
 * Here so the whole system — sign-in included — can be exercised end to end
 * without a Postgres server to install. `DATABASE_URL=pglite://./.pglite`
 * selects it. The same SQL runs against it as against the real thing, so it
 * is a smaller deployment rather than a different one; production still
 * points at a server.
 */
export function connectPglite(dataDir: string | undefined): Database {
  const pg = new PGlite(dataDir)

  /*
   * One connection, and PGlite aborts its WASM instance if two queries
   * overlap. Every call is chained onto the last, so concurrent requests
   * queue instead of tearing the database down. This is the cost of an
   * in-process Postgres and the reason production points at a server.
   */
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(work: () => Promise<T>): Promise<T> => {
    const next = queue.then(work, work)
    queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  const query: Sql = async <T>(text: string, params: readonly unknown[]) =>
    (await pg.query<T>(text, [...params])).rows

  const sql: Sql = <T>(text: string, params: readonly unknown[]) =>
    serial<readonly T[]>(() => query<T>(text, params))

  return {
    sql,
    exec: (script) => serial(async () => { await pg.exec(script) }),
    // A transaction holds the queue for its whole body, so nothing
    // interleaves between BEGIN and COMMIT.
    transaction: (work) =>
      serial(async () => {
        await query('BEGIN', [])
        try {
          const out = await work(query)
          await query('COMMIT', [])
          return out
        } catch (error) {
          await query('ROLLBACK', [])
          throw error
        }
      }),
    close: () => pg.close(),
  }
}
