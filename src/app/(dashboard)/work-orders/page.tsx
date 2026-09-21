import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { deliveryOf, summariseDeliveries } from '@/rules/work-orders'
import { getRecords } from '@/services/records'
import { DeliveryTable } from './_components/DeliveryTable'

export default async function WorkOrdersPage() {
  const records = await getRecords()
  const orders = records.workOrders
  const summary = summariseDeliveries(orders)
  const deliveries = [...orders]
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map(deliveryOf)

  // The requester arrives as an id; the personnel master holds the name.
  const names = new Map(records.people.map((p) => [p.person_id, p.canonical_name]))
  const nameOf = (personId: string): string => names.get(personId) ?? personId

  return (
    <>
      <ScreenHeader
        title="Work Orders"
        question="What the client asked for and whether it was delivered on time"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Delivered on time"
          info="A work order counts as delivered on time when its closing photo went up on or before the date the client wrote on the request. An order closed with no photo is not counted: the client asked for evidence, and a claim is not evidence."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="work_orders.on_time">{summary.on_time}</span>
            <span className="text-faint"> / {summary.total}</span>
          </p>
        </Card>
        <Card
          title="Still open"
          info="Raised and not yet closed. A blocked order is counted separately and its clock is paused, so it never drifts into this number just because it is waiting on the client."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="work_orders.open">{summary.open}</span>
          </p>
        </Card>
        <Card
          title="Blocked"
          info="Held up by something outside Reno's control, each one citing the message that says so. The clock is paused while an order is blocked."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="work_orders.blocked">{summary.blocked}</span>
          </p>
        </Card>
      </div>
      <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-[17px]">Every request</h2>
        <DeliveryTable deliveries={deliveries} nameOf={nameOf} />
      </section>
    </>
  )
}
