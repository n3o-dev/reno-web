import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import { countEvidence, resolveEvidence } from '@/services/evidence'
import {
  applySlotCorrections,
  absenceTotals,
  coverage,
  doubleListings,
  headcountMismatches,
  provisionalContracts,
  slotDays,
} from '@/rules/manpower'
import { getRecords } from '@/services/records'
import { monthReport } from '@/services/report'
import { rupiah } from '@/report/money'
import { CoverageTable } from '@/components/screens/parts/CoverageTable'
import { SignalsPanel } from '@/components/screens/parts/SignalsPanel'

const ABSENCE_LABEL = {
  off_day: 'Off Day',
  sakit: 'Sakit',
  izin: 'Izin',
  alfa: 'Alfa',
} as const

interface ManpowerScreenProps extends ScreenProps {
  /** The anti-fraud queue is Reno's. The client link never renders it (AC-3). */
  readonly showSignals?: boolean
}

export async function ManpowerScreen({ siteId, showSignals = true }: ManpowerScreenProps) {
  const [records, report] = await Promise.all([getRecords(siteId), monthReport('2026-09', siteId)])
  const { payable } = report.pack.manpower
  const lineups = records.lineups
  const contracts = provisionalContracts(lineups)
  // The same corrected slot-days the invoice is built from, so the coverage
  // table and the amount payable cannot disagree.
  const days = applySlotCorrections(slotDays(lineups), report.corrections)
  const rows = coverage(contracts, days)
  const absences = absenceTotals(lineups)
  const totalFilled = rows.reduce((n, r) => n + r.filled, 0)
  const totalContracted = rows.reduce((n, r) => n + r.contractedSlotDays, 0)
  // Every manpower figure stands on the line-up messages behind it.
  const lineupIds = lineups.map((l) => l.source_message_id)
  const lineupEvidence = {
    items: resolveEvidence(records, lineupIds),
    total: countEvidence(lineupIds),
  }

  return (
    <>
      <ScreenHeader
        title="Manpower & Billing"
        question="Who was on site and what the client owes"
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          title="Slot-days filled"
          info="A slot is one area, one shift, one day, and it is the unit the contract bills in. A slot bills in full whoever fills it. Attendance here is claimed — read from the line-up the project leader posts — and stays claimed until an admin confirms it."
        >
          <p className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums">
            <Figure
              name="manpower.filled_slot_days"
              evidence={lineupEvidence.items}
              total={lineupEvidence.total}
            >
              {totalFilled}
            </Figure>
            <span className="text-faint"> / {totalContracted}</span>
          </p>
          <p className="text-[13px] text-muted">Claimed, not yet admin-confirmed</p>
        </Card>
        <Card
          title="Absences"
          info="Off Day is planned leave and is already priced into the contract, so it never deducts. Sakit, Izin and Alfa deduct only when the slot went unfilled and nobody replaced the person."
        >
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
            {Object.entries(ABSENCE_LABEL).map(([key, label]) => (
              <div key={key} className="flex justify-between gap-2">
                <dt className="text-muted">{label}</dt>
                <dd>
                  <Figure
                    name={`manpower.absence.${key}`}
                    evidence={lineupEvidence.items}
                    total={lineupEvidence.total}
                    className="tabular-nums"
                  >
                    {absences[key as keyof typeof ABSENCE_LABEL]}
                  </Figure>
                </dd>
              </div>
            ))}
          </dl>
          {Object.values(absences).every((n) => n === 0) && (
            <p className="mt-3 border-t border-line pt-3 text-[13px] text-muted">
              None reported in this period.
            </p>
          )}
        </Card>
        <Card
          title="Amount payable"
          info="Gross less any unfilled, unreplaced slot-days. The arithmetic is shown in full on the BAPP pack. Complaints never touch this figure: a filthy toilet costs the Pimpro his score, not the invoice."
        >
          {payable.state === 'computed' ? (
            <>
              <p
                data-status="manpower.payable"
                className="font-[family-name:var(--font-display)] text-[32px] leading-[1.05] tabular-nums"
              >
                {rupiah(payable.billing.payable, payable.currency)}
              </p>
              <p className="mt-1 text-[13px] text-muted">
                {rupiah(payable.billing.gross, payable.currency)} less{' '}
                {rupiah(payable.billing.deduction, payable.currency)} for{' '}
                {payable.billing.unfilledSlotDays} unfilled slot-days
              </p>
              {payable.provisional && (
                <p
                  data-provisional="manpower.payable"
                  className="mt-2 border-t border-line pt-2 text-[13px] text-muted"
                >
                  Provisional. The headcount behind this is assumed from the line-ups, not
                  taken from the service contract.
                </p>
              )}
            </>
          ) : (
            <>
              <p
                data-status="manpower.payable"
                className="font-[family-name:var(--font-display)] text-[20px] leading-[1.2] text-muted"
              >
                Not yet stated
              </p>
              <p className="mt-1 text-[13px] text-muted">
                Rate{' '}
                {payable.monthlyRatePerMp === null
                  ? 'not loaded'
                  : `${rupiah(payable.monthlyRatePerMp, payable.currency)} per person per month`}
                . {payable.missing.join(' ')}
              </p>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="rounded-[var(--radius-card)] border border-line bg-surface p-5">
          <h2 className="font-[family-name:var(--font-display)] text-[17px]">
            Coverage by area and shift
          </h2>
          <p className="mt-1 mb-2 text-[13px] text-muted">
            Contracted figures are provisional — taken from the fullest roster the period shows,
            not from the service contract.
          </p>
          <CoverageTable rows={rows} evidence={lineupEvidence} corrections={report.corrections} />
        </section>
        {showSignals && (
          <SignalsPanel
            doubles={doubleListings(lineups)}
            mismatches={headcountMismatches(lineups)}
            aliasCandidates={records.people.filter((p) => p.aliases.length > 0)}
          />
        )}
      </div>
    </>
  )
}
