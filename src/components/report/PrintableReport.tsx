import { areaLabel } from '@/rules/area'
import { rupiah } from '@/report/money'
import type { MonthReport } from '@/services/report'
import { PrintButton } from './PrintButton'
import './print.css'

interface PrintableReportProps {
  readonly report: MonthReport
}

/*
 * timeZone: 'UTC' because the value is a date, not an instant: an ISO date
 * parses to UTC midnight, so formatting it in the server's own zone printed
 * the previous day — and the previous month on the 1st — anywhere west of
 * UTC. The heading would then disagree with the data under it.
 */
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const day = (iso: string): string => DATE.format(new Date(`${iso}T00:00:00Z`))
const percent = (value: number | null): string =>
  value === null ? '—' : `${Math.round(value * 100)}%`
const minutes = (value: number | null): string =>
  value === null ? 'no data' : `${Math.round(value)} min`

const CAUSE_LABEL: Record<string, string> = {
  hk_standard: 'Housekeeping standard',
  tenant_project_event: 'Tenant project or event',
  engineering_equipment: 'Engineering or equipment',
  spill: 'Spill',
  external_other: 'External, other',
}

function Row({ label, value, note }: { label: string; value: string; note?: string | undefined }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2 last:border-0">
      <span className="text-[14px]">
        {label}
        {note !== undefined && <span className="block text-[13px] text-muted">{note}</span>}
      </span>
      <span className="shrink-0 font-[family-name:var(--font-display)] text-[17px] tabular-nums">
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-2 border-b border-ink pb-1 font-[family-name:var(--font-display)] text-[17px]">
        {title}
      </h2>
      {children}
    </section>
  )
}

/**
 * The month's report, on paper.
 *
 * Every number here comes from the same model the screens render, so the
 * document the client signs and the dashboard they were shown cannot
 * disagree. Sections a person has to fill are printed as such rather than
 * left blank — an empty heading reads as nothing to report.
 */
export function PrintableReport({ report }: PrintableReportProps) {
  const { pack } = report
  const open = report.gates.filter((gate) => !gate.passed).length
  /*
   * A draft may print — previewing one is the point — but the amount
   * payable may not. The spec's own reason: BAPP cannot generate against
   * claimed attendance alone. The rest of the report is narrative and safe
   * to read early; the money is the thing the gate exists to hold.
   */
  /*
   * Every gate, not just the roster. Gating on one id meant an undecided
   * alias — the spec's own example of a headcount error — let the print
   * view state an amount while the download route refused with 409. Two
   * surfaces of one pack must not have two gate policies.
   */
  const moneyWithheld = !report.generatable

  return (
    <main className="report px-6 py-8">
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-[28px] leading-[1.2]">
            Monthly Report
          </h1>
          <p className="text-[14px] text-muted">
            {pack.site.label} · {pack.period.label}
          </p>
        </div>
        <PrintButton />
      </header>

      {!report.generatable && (
        <p className="mt-4 rounded-[var(--radius-control)] border border-line bg-cream p-3 text-[13px]">
          <strong>Draft.</strong> {open === 1 ? 'One check is' : `${open} checks are`} still
          outstanding, so this is not a final pack. Printed on purpose: a draft that prints
          looking final is worse than one that does not print at all.
        </p>
      )}

      <Section title="RKB realisation">
        <Row
          label="Realisation, net of blocked work"
          value={percent(pack.rkb.whole.net)}
          note={`${pack.rkb.whole.done} of ${pack.rkb.whole.planned} planned job-row days · ${pack.rkb.workbook}`}
        />
        <Row label="Realisation, gross" value={percent(pack.rkb.whole.gross)} />
        {pack.rkb.sheets.map((sheet) => (
          <Row
            key={sheet.slug}
            label={sheet.name}
            value={percent(sheet.realisation.net)}
            note={`${sheet.realisation.done} of ${sheet.realisation.planned}`}
          />
        ))}
      </Section>

      <Section title="Complaints">
        <Row label="Raised" value={String(pack.complaints.stats.raised)} />
        <Row label="Answered" value={String(pack.complaints.stats.answered)} />
        <Row label="Closed with photo" value={String(pack.complaints.stats.closedWithPhoto)} />
        <Row
          label="Median time to first reply"
          value={minutes(pack.complaints.stats.medianReplyMinutes)}
        />
        <Row
          label="Median time to closing photo"
          value={minutes(pack.complaints.stats.medianClosureMinutes)}
          note="Shown apart from the reply: a fast reply is not a fast fix"
        />
        <Row
          label="Blocked, clock paused"
          value={String(pack.complaints.blocked)}
          note="Held up by something outside Reno's control, each citing the message that says so"
        />

        <h3 className="mt-4 mb-1 text-[14px]">Cause</h3>
        <Row
          label="Within Reno's control"
          value={String(pack.complaints.causes.withinRenoControl)}
        />
        <Row
          label="Outside Reno's control"
          value={String(pack.complaints.causes.outsideRenoControl)}
        />
        {pack.complaints.causes.items.map((item) => (
          <Row key={item.cause} label={`— ${CAUSE_LABEL[item.cause] ?? item.cause}`} value={String(item.count)} />
        ))}

        {pack.complaints.repeats.length > 0 && (
          <>
            <h3 className="mt-4 mb-1 text-[14px]">Areas complained about on more than one day</h3>
            {pack.complaints.repeats.map((repeat) => (
              <Row
                key={repeat.areaId}
                label={areaLabel(repeat.areaId) ?? repeat.areaId}
                value={`${repeat.days.length} days`}
                note={repeat.days.map(day).join(' · ')}
              />
            ))}
          </>
        )}
      </Section>

      <Section title="Work orders delivered">
        <Row
          label="Delivered on time"
          value={`${pack.workOrders.summary.on_time} / ${pack.workOrders.summary.total}`}
        />
        {pack.workOrders.deliveries.map(({ order, state, closedOn }) => (
          <Row
            key={order.record_id}
            label={order.title}
            value={state.replaceAll('_', ' ')}
            note={`due ${day(order.due_date)}${closedOn === null ? '' : ` · closed ${day(closedOn)}`}`}
          />
        ))}
      </Section>

      <Section title="Manpower">
        <Row
          label="Slot-days filled"
          value={`${pack.manpower.filledSlotDays} / ${pack.manpower.contractedSlotDays}`}
          note="Claimed attendance, confirmed by a person before this pack generates"
        />
        <Row label="Off Day" value={String(pack.manpower.absences.off_day)} />
        <Row label="Sakit" value={String(pack.manpower.absences.sakit)} />
        <Row label="Izin" value={String(pack.manpower.absences.izin)} />
        <Row label="Alfa" value={String(pack.manpower.absences.alfa)} />
        {moneyWithheld ? (
          <Row
            label="Amount payable"
            value="Withheld"
            note={`${report.gates.filter((g) => !g.passed).map((g) => g.detail).join(' ')} A pack generates no money until every check passes.`}
          />
        ) : pack.manpower.payable.state === 'computed' ? (
          <>
            <Row
              label="Gross"
              value={rupiah(pack.manpower.payable.billing.gross, pack.manpower.payable.currency)}
              note={`${rupiah(pack.manpower.payable.monthlyRatePerMp, pack.manpower.payable.currency)} per person per month`}
            />
            <Row
              label="Less unfilled, unreplaced slot-days"
              value={`− ${rupiah(pack.manpower.payable.billing.deduction, pack.manpower.payable.currency)}`}
              note={`${pack.manpower.payable.billing.unfilledSlotDays} slot-days, pro-rata on ${pack.manpower.payable.prorataDaysPerMonth} days`}
            />
            <Row
              label="Amount payable"
              value={rupiah(pack.manpower.payable.billing.payable, pack.manpower.payable.currency)}
              note={
                pack.manpower.payable.provisional
                  ? 'Provisional. The contracted headcount behind this is assumed from the line-ups, not taken from the service contract.'
                  : undefined
              }
            />
          </>
        ) : (
          <Row
            label="Amount payable"
            value="Not yet stated"
            note={`Rate ${pack.manpower.payable.monthlyRatePerMp === null ? 'not loaded' : `${rupiah(pack.manpower.payable.monthlyRatePerMp, pack.manpower.payable.currency)} per person per month`}. ${pack.manpower.payable.missing.join(' ')}`}
          />
        )}
      </Section>

      <Section title="Evidence">
        <Row
          label="Reports carrying before and after"
          value={String(pack.evidenceGallery.beforeAfter)}
          note={`of ${pack.evidenceGallery.reportCount} reports`}
        />
        <Row
          label="Reports that passed validation"
          value={percent(pack.evidenceGallery.passRate)}
        />
        <Row
          label="Photos sharing an image"
          value={String(pack.evidenceGallery.duplicatePairs)}
          note="Checked against each photo's own metadata, awaiting a human decision"
        />
      </Section>

      <Section title="Filled by a person">
        {pack.humanSections.map((section) => (
          <Row
            key={section.title}
            label={section.title}
            value="Awaiting"
            note={section.awaiting}
          />
        ))}
      </Section>

      <footer className="mt-10 border-t border-line pt-3 text-[13px] text-muted">
        Every figure in this report is derived from messages posted in the {pack.site.label} site
        WhatsApp group during {pack.period.label}, and can be traced back to them on the
        dashboard.
      </footer>
    </main>
  )
}
