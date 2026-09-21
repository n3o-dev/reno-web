import { describe, expect, it } from 'vitest'
import { elapsedExcludingBlocked, closureStats, SLA_HOURS } from '@/rules/clock'
import { complaintRecord, type ComplaintRecord } from '@/contract/schemas'

const t = (iso: string): string => iso

/** Parsed through the schema, so a malformed fixture fails here rather than lying downstream. */
function complaint(over: Record<string, unknown> = {}): ComplaintRecord {
  return complaintRecord.parse({
    record_id: 'cmp_1',
    site_id: 'lwas',
    source_message_id: 'msg_1',
    sent_at: t('2026-09-13T19:55:00+07:00'),
    sender_raw: 'Cristian B. Suryanto',
    sender_person_id: null,
    confidence: 0.9,
    area_id: 'toilet_lt2',
    raised_by: 'p_cristian',
    raised_at: t('2026-09-13T19:55:00+07:00'),
    cause: 'hk_standard',
    state: 'raised',
    state_history: [],
    closing_photo_id: null,
    blocked_reason_message_id: null,
    ...over,
  })
}

describe('AC-3 · a blocked interval does not spend the clock', () => {
  it('excludes six blocked hours from a thirty-hour span, leaving twenty-four', () => {
    const elapsed = elapsedExcludingBlocked({
      from: t('2026-09-10T00:00:00+07:00'),
      to: t('2026-09-11T06:00:00+07:00'), // 30h
      history: [
        { state: 'blocked', at: t('2026-09-10T10:00:00+07:00'), source_message_id: 'msg_b' },
        { state: 'in_progress', at: t('2026-09-10T16:00:00+07:00'), source_message_id: 'msg_r' },
      ],
    })
    expect(elapsed.hours).toBe(24)
  })

  it('counts nothing while a complaint is still blocked at the end of the window', () => {
    const elapsed = elapsedExcludingBlocked({
      from: t('2026-09-10T00:00:00+07:00'),
      to: t('2026-09-10T10:00:00+07:00'),
      history: [
        { state: 'blocked', at: t('2026-09-10T04:00:00+07:00'), source_message_id: 'msg_b' },
      ],
    })
    expect(elapsed.hours).toBe(4)
    expect(elapsed.blockedHours).toBe(6)
  })

  it('leaves an unblocked complaint untouched', () => {
    const elapsed = elapsedExcludingBlocked({
      from: t('2026-09-10T00:00:00+07:00'),
      to: t('2026-09-10T12:00:00+07:00'),
      history: [],
    })
    expect(elapsed.hours).toBe(12)
    expect(elapsed.blockedHours).toBe(0)
  })
})

describe('AC-4 · an uncited block is invalid input, not a zero-duration block', () => {
  it('is rejected by the schema before it can reach the rules layer', () => {
    expect(() => complaint({ state: 'blocked', blocked_reason_message_id: null })).toThrow()
  })

  it('is also rejected by the rules layer, for records arriving unvalidated from a live source', () => {
    const uncited = complaint({ state: 'blocked', blocked_reason_message_id: 'msg_388' })
    // @ts-expect-error — the union makes this unrepresentable in typed code, which is the
    // point: the guard exists for records that reach us at runtime without being parsed.
    const smuggled: ComplaintRecord = { ...uncited, blocked_reason_message_id: null }
    expect(() => closureStats([smuggled])).toThrowError(/cmp_1.*blocked.*citation/i)
  })

  it('accepts a blocked complaint that cites its justification', () => {
    expect(() =>
      closureStats([complaint({ state: 'blocked', blocked_reason_message_id: 'msg_388' })]),
    ).not.toThrow()
  })
})

describe('AC-2 · the two medians are reported apart', () => {
  const answeredAfter = (mins: number, closeMins: number | null): ComplaintRecord =>
    complaint({
      state: closeMins === null ? 'answered' : 'closed_with_photo',
      closing_photo_id: closeMins === null ? null : 'ph_1',
      state_history: [
        {
          state: 'answered',
          at: t(`2026-09-13T${String(20 + Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}:00+07:00`),
          source_message_id: 'msg_a',
        },
        ...(closeMins === null
          ? []
          : [
              {
                state: 'closed_with_photo' as const,
                at: t(
                  `2026-09-13T${String(20 + Math.floor(closeMins / 60)).padStart(2, '0')}:${String(closeMins % 60).padStart(2, '0')}:00+07:00`,
                ),
                source_message_id: 'msg_c',
              },
            ]),
      ],
    })

  it('returns reply and closure medians as separate figures', () => {
    const stats = closureStats([
      answeredAfter(5, 45),
      answeredAfter(7, 50),
      answeredAfter(9, null),
    ])
    const reply = stats.medianReplyMinutes
    const closure = stats.medianClosureMinutes
    expect(reply).not.toBeNull()
    expect(closure).not.toBeNull()
    if (reply === null || closure === null) throw new Error('unreachable')
    expect(reply).not.toBe(closure)
    expect(reply).toBeGreaterThan(0)
    expect(closure).toBeGreaterThan(reply)
  })

  it('computes the closure median only over complaints that actually closed', () => {
    const stats = closureStats([answeredAfter(5, 45), answeredAfter(9, null)])
    expect(stats.closedWithPhoto).toBe(1)
    expect(stats.raised).toBe(2)
  })

  it('never merges the two into one number', () => {
    const stats = closureStats([answeredAfter(5, 45)])
    expect(Object.keys(stats)).toEqual(
      expect.arrayContaining(['medianReplyMinutes', 'medianClosureMinutes']),
    )
  })
})

describe('the SLA comes from the SOP, not from a magic number', () => {
  it('is 24 hours', () => {
    expect(SLA_HOURS).toBe(24)
  })
})
