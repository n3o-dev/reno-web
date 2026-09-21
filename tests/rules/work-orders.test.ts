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
  it('has two orders delivered on time and one still open', () => {
    expect(summariseDeliveries(orders)).toEqual({
      on_time: 2,
      late: 0,
      open: 1,
      blocked: 0,
      closed_no_photo: 0,
      total: 3,
    })
  })

  it('every closed order names the photo that closed it', () => {
    for (const order of orders) {
      if (order.state === 'closed_with_photo') expect(order.closing_photo_id).not.toBeNull()
    }
  })
})
