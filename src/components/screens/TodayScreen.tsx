import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { countByDay } from '@/rules/daily'
import { deliveryOf } from '@/rules/work-orders'
import { getRecords } from '@/services/records'
import { OpenItems } from '@/components/screens/parts/OpenItems'

const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
})

export async function TodayScreen({ siteId }: ScreenProps) {
  const records = await getRecords(siteId)
  const days = countByDay(records.messages)
  const latest = days.at(-1)?.date ?? null
  const onLatest = <T extends { sent_at: string }>(list: readonly T[]): readonly T[] =>
    latest === null ? [] : list.filter((r) => r.sent_at.startsWith(latest))

  const complaints = onLatest(records.complaints)
  const open = complaints.filter((c) => c.state !== 'closed_with_photo')
  const blocked = complaints.filter((c) => c.state === 'blocked')
  const lineups = latest === null ? [] : records.lineups.filter((l) => l.date === latest)
  const onSite = lineups.reduce((n, l) => n + l.entries.length, 0)
  const orders = records.workOrders.map(deliveryOf).filter((d) => d.state === 'open')

  return (
    <>
      <ScreenHeader title="Today" question="What is happening on site right now" />
      {latest !== null && (
        <p className="-mt-4 mb-6 text-[13px] text-muted">
          Latest day the group reported: {LONG_DATE.format(new Date(`${latest}T00:00:00Z`))}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-4">
        <Card
          title="On site"
          info="Names in the day's line-ups across every area and shift. Claimed attendance: the project leader typed it into the group, and it stays claimed until an admin confirms it."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="today.on_site">{onSite}</span>
          </p>
          <p className="text-[13px] text-muted">Claimed across {lineups.length} line-ups</p>
        </Card>
        <Card
          title="Complaints open"
          info="Raised on the latest reported day and not yet closed with a photo. A blocked complaint is counted here too, but its clock is paused."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="today.open_complaints">{open.length}</span>
            <span className="text-faint"> / {complaints.length}</span>
          </p>
        </Card>
        <Card
          title="Blocked"
          info="Held up by something outside Reno's control, each citing the message that says so. The 24-hour clock does not run while an item is blocked."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="today.blocked">{blocked.length}</span>
          </p>
        </Card>
        <Card
          title="Work orders open"
          info="Client requests raised and not yet closed with a photo, across the whole period rather than one day: a work order runs to the date the client set, not to a 24-hour clock."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <span data-figure="today.open_work_orders">{orders.length}</span>
          </p>
        </Card>
      </div>
      <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-[17px]">Still open</h2>
        <OpenItems complaints={open} />
      </section>
    </>
  )
}
