import { readdir } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { RECORD_TYPES } from '@/contract/schemas'
import { loadFixtureSource } from '@/contract/source'
import { migrate } from '@/db/migrate'
import { loadSource, parseBatch, upsertBatch } from '@/db/records-store'
import type { Sql } from '@/db/client'
import { testDatabase } from '../support/pglite'

const fixtures = await loadFixtureSource()

/** The whole fixture set, written through the same path the endpoint uses. */
async function seeded() {
  const db = await testDatabase()
  for (const type of RECORD_TYPES) {
    const batch = parseBatch(fixtures.all(type).map((payload) => ({ type, payload })))
    await db.transaction((sql) => upsertBatch(sql, batch, 'lwas'))
  }
  return db
}

const db = await seeded()
const fromDb = await loadSource(db.sql)

describe('AC-10 · Postgres serves the same records as the fixtures', () => {
  it.each(RECORD_TYPES)('%s matches record for record', (type) => {
    const expected = [...fixtures.all(type)].sort((a, b) => a.record_id.localeCompare(b.record_id))
    const actual = [...fromDb.all(type)].sort((a, b) => a.record_id.localeCompare(b.record_id))
    expect(actual).toEqual(expected)
  })

  it('narrows to one site', async () => {
    expect((await loadSource(db.sql, 'lwas')).complaints).toHaveLength(75)
    expect((await loadSource(db.sql, 'somewhere_else')).complaints).toEqual([])
  })
})

describe('AC-10, AC-11 · every screen figure is identical from either source', () => {
  /*
   * The screens only ever touch a RecordSource, so proving the rules layer
   * cannot tell the two apart is what "no screen changes" means. The one
   * thing this does not cover is the connection itself — there is no
   * Postgres server in the test environment, so `connect()` is exercised by
   * deployment, not here.
   */
  it('complaints', async () => {
    const { closureStats } = await import('@/rules/clock')
    expect(closureStats(fromDb.complaints)).toEqual(closureStats(fixtures.complaints))
  })

  it('report quality', async () => {
    const q = await import('@/rules/quality')
    expect(q.countDefects(fromDb.workReports)).toEqual(q.countDefects(fixtures.workReports))
    expect(q.countBeforeAfter(fromDb.workReports)).toBe(q.countBeforeAfter(fixtures.workReports))
    expect(q.countLatePhotos(fromDb.photos)).toBe(q.countLatePhotos(fixtures.photos))
    expect(q.findDuplicatePhotos(fromDb.photos)).toEqual(q.findDuplicatePhotos(fixtures.photos))
    expect(q.validationPassRate(fromDb.workReports)).toBe(
      q.validationPassRate(fixtures.workReports),
    )
  })

  it('work orders', async () => {
    const { summariseDeliveries } = await import('@/rules/work-orders')
    expect(summariseDeliveries(fromDb.workOrders)).toEqual(
      summariseDeliveries(fixtures.workOrders),
    )
  })

  it('manpower', async () => {
    const m = await import('@/rules/manpower')
    expect(m.provisionalContracts(fromDb.lineups)).toEqual(
      m.provisionalContracts(fixtures.lineups),
    )
    expect(m.absenceTotals(fromDb.lineups)).toEqual(m.absenceTotals(fixtures.lineups))
    expect(
      m.coverage(m.provisionalContracts(fromDb.lineups), m.slotDays(fromDb.lineups)),
    ).toEqual(m.coverage(m.provisionalContracts(fixtures.lineups), m.slotDays(fixtures.lineups)))
  })

  it('activity by day', async () => {
    const { countByDay } = await import('@/rules/daily')
    expect(countByDay(fromDb.messages)).toEqual(countByDay(fixtures.messages))
    expect(countByDay(fromDb.photos)).toEqual(countByDay(fixtures.photos))
  })

  it('evidence resolves to the same messages', async () => {
    const { resolveEvidence } = await import('@/services/evidence')
    const ids = fixtures.complaints.map((c) => c.source_message_id)
    expect(resolveEvidence(fromDb, ids)).toEqual(resolveEvidence(fixtures, ids))
  })
})

describe('a stored record that no longer validates is loud', () => {
  it('refuses to serve it rather than trusting it', async () => {
    const fresh = await testDatabase()
    await fresh.sql(
      `INSERT INTO records (record_id, site_id, type, sent_at, source_message_id, payload)
       VALUES ('broken', 'lwas', 'message', now(), 'msg_0_0', $1)`,
      [JSON.stringify({ record_id: 'broken' })],
    )
    await expect(loadSource(fresh.sql)).rejects.toThrow(/no longer matches its schema/)
  })
})

describe('AC-12 · migrations run forward and are idempotent', () => {
  it('leaves the same schema when run twice', async () => {
    const pg = new PGlite()
    const sql: Sql = async <T>(text: string, params: readonly unknown[]) =>
      (await pg.query<T>(text, [...params])).rows
    const exec = async (script: string): Promise<void> => {
      await pg.exec(script)
    }

    // Not a hardcoded list: that would need editing for every migration
    // added, which is noise rather than a check. What matters is that every
    // file on disk ran, in order, and that a second run runs none of them.
    const onDisk = (await readdir(new URL('../../src/db/migrations/', import.meta.url)))
      .filter((f) => f.endsWith('.sql'))
      .sort()
    const first = await migrate(sql, exec)
    expect(first).toEqual(onDisk)
    expect(first.length).toBeGreaterThan(0)

    const columns = async () =>
      sql<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name FROM information_schema.columns
         WHERE table_schema = 'public' ORDER BY table_name, column_name`,
        [],
      )
    const before = await columns()

    const second = await migrate(sql, exec)
    expect(second).toEqual([])
    expect(await columns()).toEqual(before)
    expect(before.length).toBeGreaterThan(10)

    await pg.close()
  })
})
