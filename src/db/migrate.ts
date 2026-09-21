import { readdir, readFile } from 'node:fs/promises'
import type { Exec, Sql } from './client'

/**
 * Runs every migration in order, once.
 *
 * Plain SQL files rather than a migration library: there are two tables and a
 * handful of indexes, and every statement here is already idempotent. A
 * library would be a dependency, a config file and a lock table to express
 * `CREATE TABLE IF NOT EXISTS`.
 */
const DIR = new URL('./migrations/', import.meta.url)

export async function migrate(sql: Sql, exec: Exec): Promise<readonly string[]> {
  await sql(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name text PRIMARY KEY,
       run_at timestamptz NOT NULL DEFAULT now()
     )`,
    [],
  )

  const files = (await readdir(DIR)).filter((f) => f.endsWith('.sql')).sort()
  const applied: string[] = []

  for (const file of files) {
    const already = await sql<{ name: string }>(
      'SELECT name FROM schema_migrations WHERE name = $1',
      [file],
    )
    if (already.length > 0) continue
    await exec(await readFile(new URL(file, DIR), 'utf8'))
    await sql('INSERT INTO schema_migrations (name) VALUES ($1)', [file])
    applied.push(file)
  }
  return applied
}
