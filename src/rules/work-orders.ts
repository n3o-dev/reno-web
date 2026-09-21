import type { WorkOrderRecord } from '@/contract/schemas'

/**
 * A work order runs to the date the client set, never the 24-hour complaint
 * clock. Delivered on time means the closing photo went up on or before that
 * date — the date, not a timestamp, because that is what the client wrote.
 *
 * See docs/specs/reno-dashboard.md (screen 3).
 */
export const DELIVERY_STATES = ['on_time', 'late', 'open', 'blocked', 'closed_no_photo'] as const
export type DeliveryState = (typeof DELIVERY_STATES)[number]

export interface Delivery {
  readonly order: WorkOrderRecord
  readonly state: DeliveryState
  /** ISO date the closing photo landed, or null while it has not. */
  readonly closedOn: string | null
}

const closedAt = (order: WorkOrderRecord): string | null => {
  const entry = order.state_history.find((h) => h.state === 'closed_with_photo')
  return entry === undefined ? null : entry.at.slice(0, 10)
}

export function deliveryOf(order: WorkOrderRecord): Delivery {
  if (order.state === 'blocked') return { order, state: 'blocked', closedOn: null }
  if (order.state === 'closed_without_photo') {
    return { order, state: 'closed_no_photo', closedOn: null }
  }
  if (order.state !== 'closed_with_photo') return { order, state: 'open', closedOn: null }

  const closedOn = closedAt(order)
  if (closedOn === null) {
    // Closed but with no closure in its history: the agent saw the photo and
    // not the moment. Not counted as on time — an unproven claim is not a met
    // deadline.
    return { order, state: 'late', closedOn: null }
  }
  return { order, state: closedOn <= order.due_date ? 'on_time' : 'late', closedOn }
}

export type DeliverySummary = Readonly<Record<DeliveryState, number>> & { readonly total: number }

export function summariseDeliveries(orders: readonly WorkOrderRecord[]): DeliverySummary {
  const counts = { on_time: 0, late: 0, open: 0, blocked: 0, closed_no_photo: 0 }
  for (const order of orders) counts[deliveryOf(order).state] += 1
  return { ...counts, total: orders.length }
}
