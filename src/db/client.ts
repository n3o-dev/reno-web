/**
 * One narrow way to run SQL.
 *
 * Deliberately not an ORM and not a query builder: the ingest endpoint runs
 * about six statements, and every one of them reads better as SQL than as a
 * chain of method calls. The interface is a function so the tests can run
 * against an embedded Postgres without a Docker daemon, and production can
 * use a connection pool, with neither knowing about the other.
 */
export type Sql = <T = Record<string, unknown>>(
  text: string,
  params: readonly unknown[],
) => Promise<readonly T[]>

/**
 * Runs a script of several statements. Separate from `Sql` because a
 * parameterised query is one statement by definition — PGlite refuses a
 * multi-statement prepared statement outright, and Postgres only tolerates
 * it. Migrations are the only caller.
 */
export type Exec = (script: string) => Promise<void>

export interface Database {
  readonly sql: Sql
  readonly exec: Exec
  /** Runs `work` inside a transaction, rolling back on any throw. */
  transaction: <T>(work: (sql: Sql) => Promise<T>) => Promise<T>
  close: () => Promise<void>
}
