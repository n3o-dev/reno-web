import type { Database } from '@/db/client'
import { connectTo } from '@/db/connect'

/**
 * The application's database, or nothing.
 *
 * A process-wide singleton, deliberately not React's `cache`: that dedupes
 * within one request, so every request would have opened its own connection
 * — which for PGlite means a second instance on the same directory, and for
 * Postgres a pool per request. Both end badly; the first corrupts the files.
 *
 * `DATABASE_URL` is read here and nowhere else. When it is absent the
 * dashboard falls back to the committed fixture set, which is what keeps the
 * whole thing runnable without a server and stops a missing environment
 * variable from rendering as a site with no activity.
 */
declare global {
  var renoDatabase: Database | null | undefined
}

export function getDatabase(): Database | null {
  if (globalThis.renoDatabase !== undefined) return globalThis.renoDatabase

  const url = process.env['DATABASE_URL']
  const db = url === undefined || url.trim() === '' ? null : connectTo(url)
  // Cached on globalThis so a dev-server hot reload does not open a second
  // one alongside the first.
  globalThis.renoDatabase = db
  return db
}
