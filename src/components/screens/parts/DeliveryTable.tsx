import type { Delivery, DeliveryState } from '@/rules/work-orders'

interface DeliveryTableProps {
  readonly deliveries: readonly Delivery[]
  readonly nameOf: (personId: string) => string
}

const STATE_LABEL: Record<DeliveryState, string> = {
  on_time: 'Delivered on time',
  late: 'Delivered late',
  open: 'Open',
  blocked: 'Blocked',
  closed_no_photo: 'Closed, no photo',
}

/** Status never travels as colour alone — every one carries its label. */
const STATE_COLOUR: Record<DeliveryState, string> = {
  on_time: 'var(--color-good)',
  late: 'var(--color-critical)',
  open: 'var(--color-warning)',
  blocked: 'var(--color-faint)',
  closed_no_photo: 'var(--color-serious)',
}

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const format = (iso: string): string => DATE.format(new Date(`${iso}T00:00:00Z`))

export function DeliveryTable({ deliveries, nameOf }: DeliveryTableProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="sr-only">Work orders the client raised in the group</caption>
      <thead>
        <tr className="text-[13px] tracking-[0.04em] text-faint">
          <th scope="col" className="px-0 py-2 font-normal">Request</th>
          <th scope="col" className="hidden px-3 py-2 font-normal sm:table-cell">Requested by</th>
          <th scope="col" className="px-3 py-2 font-normal">Due</th>
          <th scope="col" className="px-0 py-2 font-normal">Status</th>
        </tr>
      </thead>
      <tbody>
        {deliveries.map(({ order, state, closedOn }) => (
          <tr key={order.record_id} className="border-t border-line align-top text-[14px]">
            <th scope="row" className="max-w-[22rem] px-0 py-3 font-normal">
              {order.title}
              {order.document_id !== null && (
                <span className="block text-[13px] text-faint">{order.document_id}.pdf</span>
              )}
            </th>
            <td className="hidden px-3 py-3 text-muted sm:table-cell">
              {nameOf(order.requested_by)}
            </td>
            <td className="px-3 py-3 whitespace-nowrap tabular-nums">{format(order.due_date)}</td>
            <td data-figure={`work_orders.state.${order.record_id}`} className="px-0 py-3">
              <span className="flex items-center gap-2 whitespace-nowrap">
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: STATE_COLOUR[state] }}
                />
                {STATE_LABEL[state]}
              </span>
              {closedOn !== null && (
                <span className="block text-[13px] text-faint">closed {format(closedOn)}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
