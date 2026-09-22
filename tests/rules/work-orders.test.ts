import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import { deliveryOf, summariseDeliveries } from '@/rules/work-orders'
import type { WorkOrderRecord } from '@/contract/schemas'

const source = await loadFixtureSource()
const orders = source.workOrders
const first = orders[0]
if (first === undefined) throw new Error('fixture set has no work orders')

const withHistory = (order: WorkOrderRecord, at: string): WorkOrderRecord => ({
  ...order,
  state: 'closed_with_photo',
  state_history: [{ state: 'closed_with_photo', at, source_message_id: 'msg_1' }],
})

describe('delivery against the date the client set', () => {
  it('counts a closure on the due date as on time', () => {
    const order = withHistory({ ...first, due_date: '2026-09-12' }, '2026-09-12T23:30:00+07:00')
    expect(deliveryOf(order).state).toBe('on_time')
  })

  it('counts a closure the next day as late', () => {
    const order = withHistory({ ...first, due_date: '2026-09-12' }, '2026-09-13T00:10:00+07:00')
    expect(deliveryOf(order).state).toBe('late')
  })

  it('does not credit a closure it cannot date', () => {
    const order: WorkOrderRecord = { ...first, state: 'closed_with_photo', state_history: [] }
    expect(deliveryOf(order).state).toBe('late')
  })

  it('reports a blocked order as blocked, not as open or late', () => {
    const order: WorkOrderRecord = {
      ...first,
      state: 'blocked',
      blocked_reason_message_id: 'msg_9',
    }
    expect(deliveryOf(order).state).toBe('blocked')
  })
})

describe('the fixture period', () => {
  it('has two delivered on time, one open and one blocked', () => {
    expect(summariseDeliveries(orders)).toEqual({
      on_time: 2,
      late: 0,
      open: 1,
      blocked: 1,
      closed_no_photo: 0,
      total: 4,
    })
  })

  it('counts the blocked one as blocked rather than as open or late', () => {
    const blocked = orders.filter((o) => o.state === 'blocked')
    expect(blocked).toHaveLength(1)
    // The schema makes an uncited block unrepresentable; this confirms the
    // fixture carries the citation the screen renders.
    expect(blocked[0]?.blocked_reason_message_id).not.toBeNull()
    const onlyBlocked = blocked[0]
    if (onlyBlocked === undefined) throw new Error('expected a blocked order')
    expect(deliveryOf(onlyBlocked).state).toBe('blocked')
  })

  it('every closed order names the photo that closed it', () => {
    for (const order of orders) {
      if (order.state === 'closed_with_photo') expect(order.closing_photo_id).not.toBeNull()
    }
  })
})
