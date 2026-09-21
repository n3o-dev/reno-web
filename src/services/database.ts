import { cache } from 'react'
import type { Database } from '@/db/client'
import { connect } from '@/db/postgres'

/**
 * The application's database, or nothing.
 *
 * `DATABASE_URL` is read here and nowhere else. When it is absent the
 * dashboard falls back to the committed fixture set, which is what keeps the
 * whole thing runnable and testable without a server — and what stops a
 * missing environment variable from looking like an empty site.
 */
export const getDatabase = cache((): Database | null => {
  const url = process.env['DATABASE_URL']
  if (url === undefined || url.trim() === '') return null
  return connect(url)
})
