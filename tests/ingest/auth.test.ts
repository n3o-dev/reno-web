import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Database } from '@/db/client'
import { loadFixtureSource } from '@/contract/source'
import { loadSource } from '@/db/records-store'
import { resolveAgentToken } from '@/services/ingest-auth'
import { ingest, withdraw, MAX_BATCH } from '@/services/ingest'
import { testDatabase } from '../support/pglite'

const TOKEN = 'lwas-agent-1c0ffee5c0ffee5c'
const OTHER = 'ggb-agent-0badc0de0badc0de'
const ENV = `lwas:${TOKEN},ggb:${OTHER}`

const fixtures = await loadFixtureSource()
const message = fixtures.messages[0]
if (message === undefined) throw new Error('no message fixture')
const batch = { records: [{ type: 'message' as const, payload: message }] }

let db: Database
beforeEach(async () => {
  db = await testDatabase()
})

describe('AC-7 · a request without a valid token is refused', () => {
  it.each([
    ['no header', null],
    ['an empty bearer', 'Bearer '],
    ['the wrong scheme', `Basic ${TOKEN}`],
    ['an unknown token', 'Bearer lwas-agent-deadbeefdeadbeef'],
  ])('%s', async (_case, authorization) => {
    const result = await ingest(db, { authorization, json: batch }, ENV)
    expect(result.status).toBe(401)
    expect((await loadSource(db.sql)).messages).toEqual([])
  })

  it('refuses everything when no tokens are configured at all', async () => {
    const result = await ingest(db, { authorization: `Bearer ${TOKEN}`, json: batch }, undefined)
    expect(result.status).toBe(401)
  })

  it('never echoes the token it rejected', async () => {
    const result = await ingest(db, { authorization: `Bearer ${TOKEN}x`, json: batch }, ENV)
    expect(JSON.stringify(result.body)).not.toContain(TOKEN)
    expect(result.body).toEqual({ error: 'unauthorized' })
  })

  it('refuses a withdrawal too', async () => {
    expect((await withdraw(db, { authorization: null }, message.record_id, ENV)).status).toBe(401)
  })
})

describe('AC-8 · the comparison does not leak the token', () => {
  /*
   * Timing itself is not asserted: a wall-clock assertion on a WASM-hosted
   * test runner would be flaky and would prove nothing about production.
   * What is checked is the property that makes constant time possible —
   * every wrong token of the right length is rejected the same way, with no
   * shared-prefix shortcut — plus that the implementation is reached at all.
   */
  const right = TOKEN
  it.each([
    ['differs in the first character', `X${right.slice(1)}`],
    ['differs in the middle', `${right.slice(0, 10)}X${right.slice(11)}`],
    ['differs in the last character', `${right.slice(0, -1)}X`],
  ])('rejects a same-length token that %s', (_case, candidate) => {
    expect(candidate).toHaveLength(right.length)
    expect(resolveAgentToken(`Bearer ${candidate}`, ENV)).toBeNull()
  })

  it('accepts the right one', () => {
    expect(resolveAgentToken(`Bearer ${right}`, ENV)).toEqual({ siteId: 'lwas' })
  })

  it('does not match a prefix of a valid token', () => {
    expect(resolveAgentToken(`Bearer ${right.slice(0, -1)}`, ENV)).toBeNull()
  })
})

describe('AC-9 · a token is scoped to its own site', () => {
  it('refuses a record belonging to another site', async () => {
    const result = await ingest(
      db,
      { authorization: `Bearer ${OTHER}`, json: batch },
      ENV,
    )
    expect(result.status).toBe(403)
    expect(String(result.body['error'])).toContain('ggb')
    expect((await loadSource(db.sql)).messages).toEqual([])
  })

  it('names which record in the batch was foreign', async () => {
    const records = [
      { type: 'message' as const, payload: message },
      { type: 'message' as const, payload: { ...fixtures.messages[1], site_id: 'somewhere_else' } },
    ]
    const result = await ingest(db, { authorization: `Bearer ${TOKEN}`, json: { records } }, ENV)
    expect(result.status).toBe(403)
    expect(result.body['index']).toBe(1)
  })

  it('cannot withdraw another site’s record', async () => {
    await ingest(db, { authorization: `Bearer ${TOKEN}`, json: batch }, ENV)
    const attempt = await withdraw(db, { authorization: `Bearer ${OTHER}` }, message.record_id, ENV)
    expect(attempt.status).toBe(404)
    expect((await loadSource(db.sql)).messages).toHaveLength(1)
  })
})

describe('AC-13 · an oversized batch is refused with the limit', () => {
  it('states the cap rather than timing out', async () => {
    const records = Array.from({ length: MAX_BATCH + 1 }, (_, i) => ({
      type: 'message' as const,
      payload: { ...message, record_id: `m_${i}`, source_message_id: `m_${i}` },
    }))
    const result = await ingest(db, { authorization: `Bearer ${TOKEN}`, json: { records } }, ENV)
    expect(result.status).toBe(413)
    expect(result.body['limit']).toBe(MAX_BATCH)
    expect((await loadSource(db.sql)).messages).toEqual([])
  })

  it('accepts a batch exactly at the cap', async () => {
    const records = Array.from({ length: MAX_BATCH }, (_, i) => ({
      type: 'message' as const,
      payload: { ...message, record_id: `m_${i}`, source_message_id: `m_${i}` },
    }))
    const result = await ingest(db, { authorization: `Bearer ${TOKEN}`, json: { records } }, ENV)
    expect(result.status).toBe(200)
  })
})

describe('AC-14 · nothing secret reaches the logs', () => {
  it('writes no log line at all on a rejected request', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    )
    try {
      await ingest(db, { authorization: `Bearer ${TOKEN}`, json: { records: 'nonsense' } }, ENV)
      await ingest(db, { authorization: 'Bearer wrong', json: batch }, ENV)
      const written = spies.flatMap((spy) => spy.mock.calls.flat().map(String))
      expect(written).toEqual([])
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  it('keeps the message text out of a validation error', async () => {
    const bad = { ...message, confidence: 9 }
    const result = await ingest(
      db,
      { authorization: `Bearer ${TOKEN}`, json: { records: [{ type: 'message', payload: bad }] } },
      ENV,
    )
    expect(result.status).toBe(422)
    expect(JSON.stringify(result.body)).not.toContain(message.text.slice(0, 20))
  })
})
