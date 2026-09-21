import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import { RECORD_TYPES } from '@/contract/schemas'
import { resolveEvidence } from '@/services/evidence'

/**
 * Every record cites a message that exists.
 *
 * The contract has always said `source_message_id` is "the message this
 * record was derived from. Every figure traces back through it." Until this
 * test, nothing checked that the id resolved — the fixture set built the id
 * out of a timestamp while messages were keyed by index, so all 1,823 of
 * them pointed at nothing, and every evidence panel would have opened empty
 * in front of a client.
 */
const source = await loadFixtureSource()
const known = new Set(source.messages.map((m) => m.source_message_id))

describe('every record cites a message that exists', () => {
  it.each(RECORD_TYPES)('%s', (type) => {
    const dangling = source
      .all(type)
      .filter((r) => !known.has(r.source_message_id))
      .map((r) => `${r.record_id} → ${r.source_message_id}`)
    expect(dangling.slice(0, 5)).toEqual([])
  })
})

describe('every state change cites a message that exists', () => {
  it.each(['complaint', 'work_order'] as const)('%s', (type) => {
    const records = type === 'complaint' ? source.complaints : source.workOrders
    const dangling = records
      .flatMap((r) => r.state_history.map((h) => ({ id: r.record_id, cite: h.source_message_id })))
      .filter((h) => !known.has(h.cite))
      .map((h) => `${h.id} → ${h.cite}`)
    expect(dangling.slice(0, 5)).toEqual([])
  })
})

describe('resolving evidence', () => {
  it('returns a sender and a timestamp for a real citation', () => {
    const complaint = source.complaints[0]
    if (complaint === undefined) throw new Error('no complaints in the fixture set')
    const [item] = resolveEvidence(source, [complaint.source_message_id])
    expect(item?.kind).toBe('message')
    if (item?.kind !== 'message') throw new Error('expected a message')
    expect(item.sender).not.toBe('')
    expect(Number.isNaN(Date.parse(item.sentAt))).toBe(false)
  })

  it('says so rather than dropping a citation it cannot resolve', () => {
    const [item] = resolveEvidence(source, ['msg_does_not_exist'])
    expect(item).toEqual({
      kind: 'absent',
      reason: 'message msg_does_not_exist is not in the loaded records',
    })
  })

  it('does not count the same message twice', () => {
    const complaint = source.complaints[0]
    if (complaint === undefined) throw new Error('no complaints in the fixture set')
    const id = complaint.source_message_id
    expect(resolveEvidence(source, [id, id, id])).toHaveLength(1)
  })

  it('caps what it shows so a panel opens on a phone', () => {
    const ids = source.complaints.map((c) => c.source_message_id)
    expect(ids.length).toBeGreaterThan(5)
    expect(resolveEvidence(source, ids)).toHaveLength(5)
  })
})
