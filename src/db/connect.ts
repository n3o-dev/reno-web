import type { Database } from './client'
import { connectPglite } from './pglite-database'
import { connect as connectPostgres } from './postgres'

/**
 * Picks a database from the URL scheme, and is the only place that does.
 *
 * `postgres://` and `postgresql://` reach a server. `pglite://` runs Postgres
 * in this process against a directory, which is what lets the tests and a
 * local run exercise sign-in without installing anything.
 */
export function connectTo(url: string): Database {
  if (url.startsWith('pglite://')) {
    const path = url.slice('pglite://'.length)
    return connectPglite(path === '' || path === 'memory' ? undefined : path)
  }
  return connectPostgres(url)
}
