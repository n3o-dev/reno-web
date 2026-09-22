import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import { bundleEvidence } from '@/services/evidence'
import type { FigureEvidence } from '@/components/screens/parts/ComplaintFunnel'
import type { RecordSource } from '@/contract/source'
import { countByDay } from '@/rules/daily'
import { areaLabeller } from '@/rules/area'
import { deliveryOf } from '@/rules/work-orders'
import { getRecords } from '@/services/records'
import { OpenItems } from '@/components/screens/parts/OpenItems'
import { AreaCoverage } from '@/components/screens/parts/AreaCoverage'
import { DueToday, type DueRow } from '@/components/screens/parts/DueToday'
import { applySlotCorrections, coverage, provisionalContracts, slotDays } from '@/rules/manpower'
import { contractSlots, getContract } from '@/services/contract'
import { getSlotOverrides } from '@/services/overrides'
import { getWorkbook, jobRowId, WORKBOOK_MONTH, WORKBOOK_LABEL } from '@/services/rkb'

const bundle = (source: RecordSource, ids: readonly string[]): FigureEvidence =>
  bundleEvidence(source, ids, 'Nothing on the latest reported day matched.')

/*
 * timeZone: 'UTC' because the value is a date, not an instant: an ISO date
 * parses to UTC midnight, so formatting it in the server's own zone printed
 * the previous day — and the previous month on the 1st — anywhere west of
 * UTC. The heading would then disagree with the data under it.
 */
const LONG_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC',
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
  const orders = records.workOrders
    .map(deliveryOf)
    .filter((d) => d.state === 'open' || d.state === 'blocked')

  const [contract, corrections, book] = await Promise.all([
    getContract(),
    getSlotOverrides(),
    getWorkbook(),
  ])
  const contracts = contractSlots(contract) ?? provisionalContracts(lineups)
  const todaysSlots = applySlotCorrections(slotDays(lineups), corrections)
  const areaRows = coverage(contracts, todaysSlots)

  /*
   * Only from a workbook that covers this day. The loaded plan is July's
   * and the latest reported day is in September; relabelling one month's
   * rows as another's is the lie the pack already refuses to tell.
   */
  const dayOfMonth = latest === null ? null : Number(latest.slice(8, 10))
  const coversToday =
    latest !== null && latest.startsWith(WORKBOOK_MONTH)
      ? null
      : `${WORKBOOK_LABEL} does not cover this day, so nothing can be listed as planned for it.`

  const matched = new Set(records.rkbMatches.map((m) => `${m.job_row_id}|${m.date}`))
  const blockedRows = new Set(records.rkbBlocks.map((b) => `${b.job_row_id}|${b.date}`))
  const dueRows: DueRow[] =
    coversToday !== null || dayOfMonth === null
      ? []
      : book.sheets.flatMap((sheet) =>
          sheet.sections.flatMap((section) =>
            section.rows
              .filter((row) => (row.days[dayOfMonth - 1]?.planned ?? 0) > 0)
              .map((row) => {
                const key = `${jobRowId(sheet.name, section.name, row.no)}|${latest}`
                return {
                  sheet: sheet.name,
                  section: section.name,
                  no: row.no,
                  subject: row.subject,
                  done: matched.has(key) || (row.days[dayOfMonth - 1]?.actual ?? 0) > 0,
                  blocked: blockedRows.has(key),
                }
              }),
          ),
        )

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
            <Figure
              name="today.on_site"
              evidence={bundle(records, lineups.map((l) => l.source_message_id)).items}
              total={bundle(records, lineups.map((l) => l.source_message_id)).total}
            >
              {onSite}
            </Figure>
          </p>
          <p className="text-[13px] text-muted">Claimed across {lineups.length} line-ups</p>
        </Card>
        <Card
          title="Complaints open"
          info="Raised on the latest reported day and not yet closed with a photo. A blocked complaint is counted here too, but its clock is paused."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure
              name="today.open_complaints"
              evidence={bundle(records, open.map((c) => c.source_message_id)).items}
              total={bundle(records, open.map((c) => c.source_message_id)).total}
            >
              {open.length}
            </Figure>
            <span className="text-faint"> / {complaints.length}</span>
          </p>
        </Card>
        <Card
          title="Blocked"
          info="Held up by something outside Reno's control, each citing the message that says so. The 24-hour clock does not run while an item is blocked."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure
              name="today.blocked"
              evidence={bundle(records, blocked.map((c) => c.source_message_id)).items}
              total={bundle(records, blocked.map((c) => c.source_message_id)).total}
            >
              {blocked.length}
            </Figure>
          </p>
        </Card>
        <Card
          title="Work orders open"
          info="Client requests raised and not yet closed with a photo, across the whole period rather than one day: a work order runs to the date the client set, not to a 24-hour clock."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure
              name="today.open_work_orders"
              evidence={bundle(records, orders.map((d) => d.order.source_message_id)).items}
              total={bundle(records, orders.map((d) => d.order.source_message_id)).total}
            >
              {orders.length}
            </Figure>
          </p>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <AreaCoverage rows={areaRows} days={new Set(todaysSlots.map((d) => d.date)).size} />
        <DueToday rows={dueRows} coversToday={coversToday} />
      </div>

      <section className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-[17px]">Still open</h2>
        <OpenItems complaints={open} orders={orders} labelOf={areaLabeller(records.areas)} />
      </section>
    </>
  )
}
