import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import type { ComplaintRecord } from '@/contract/schemas'
import { closureStats } from '@/rules/clock'
import { countByDay } from '@/rules/daily'
import { bundleEvidence, resolveEvidence, type Evidence } from '@/services/evidence'
import { getRecords } from '@/services/records'
import { ComplaintFunnel, type FigureEvidence } from '@/components/screens/parts/ComplaintFunnel'
import { ComplaintsByDay } from '@/components/screens/parts/ComplaintsByDay'
import { ResponseTimes } from '@/components/screens/parts/ResponseTimes'
import { LowConfidence } from '@/components/screens/parts/LowConfidence'
import { BlockedItems } from '@/components/screens/parts/BlockedItems'
import { CauseSplit } from '@/components/screens/parts/CauseSplit'
import { AreaHeatmap } from '@/components/screens/parts/AreaHeatmap'
import { RepeatTracker } from '@/components/screens/parts/RepeatTracker'
import { causeSplit, repeatAreas, WITHIN_RENO_CONTROL } from '@/rules/causes'
import { complaintHeatmap } from '@/rules/heatmap'
import { areaLabeller } from '@/rules/area'
import type { RecordSource } from '@/contract/source'

/** A complaint's own message, plus the messages of the states it passed through. */
const messagesBehind = (complaints: readonly ComplaintRecord[]): string[] =>
  complaints.flatMap((c) => [c.source_message_id, ...c.state_history.map((h) => h.source_message_id)])

const bundle = (source: RecordSource, ids: readonly string[]): FigureEvidence =>
  bundleEvidence(source, ids, 'No complaint in this period reached that state.')

const reached = (complaints: readonly ComplaintRecord[], state: string): ComplaintRecord[] =>
  complaints.filter((c) => c.state_history.some((h) => h.state === state))

export async function ComplaintsScreen({ siteId }: ScreenProps) {
  const records = await getRecords(siteId)
  const complaints = records.complaints
  const stats = closureStats(complaints)
  const days = countByDay(complaints)

  const unsure = complaints.filter((c) => c.confidence < 0.6)
  const blocked = complaints.filter((c) => c.state === 'blocked')
  const citations: Record<string, Evidence | undefined> = {}
  for (const complaint of blocked) {
    // The union's blocked arm guarantees this is a string, never null.
    const [cited] = resolveEvidence(records, [complaint.blocked_reason_message_id ?? ''])
    citations[complaint.record_id] = cited
  }

  const labelOf = areaLabeller(records.areas)
  const split = causeSplit(complaints)
  const heatmap = complaintHeatmap(complaints, days.map((d) => d.date))
  const repeats = repeatAreas(complaints)

  const causeEvidence: Record<string, FigureEvidence> = {
    within: bundle(
      records,
      complaints
        .filter((c) => WITHIN_RENO_CONTROL.includes(c.cause))
        .map((c) => c.source_message_id),
    ),
    outside: bundle(
      records,
      complaints
        .filter((c) => !WITHIN_RENO_CONTROL.includes(c.cause))
        .map((c) => c.source_message_id),
    ),
  }
  for (const item of split.items) {
    causeEvidence[item.cause] = bundle(
      records,
      complaints.filter((c) => c.cause === item.cause).map((c) => c.source_message_id),
    )
  }

  const byDay: Record<string, FigureEvidence> = {}
  for (const day of days) {
    const raisedThatDay = complaints.filter((c) => c.sent_at.startsWith(day.date))
    byDay[day.date] = bundle(records, raisedThatDay.map((c) => c.source_message_id))
  }

  return (
    <>
      <ScreenHeader
        title="Complaints"
        question="What was raised, who caused it, what is still open"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ComplaintFunnel
          stats={stats}
          evidence={{
            raised: bundle(records, complaints.map((c) => c.source_message_id)),
            answered: bundle(
              records,
              complaints.filter((c) => c.state !== 'raised').map((c) => c.source_message_id),
            ),
            closed_with_photo: bundle(
              records,
              complaints
                .filter((c) => c.state === 'closed_with_photo')
                .map((c) => c.source_message_id),
            ),
          }}
        />
        <ResponseTimes
          stats={stats}
          replyEvidence={bundle(records, messagesBehind(reached(complaints, 'answered')))}
          closureEvidence={bundle(
            records,
            messagesBehind(reached(complaints, 'closed_with_photo')),
          )}
        />
        <CauseSplit split={split} evidence={causeEvidence} />
        <RepeatTracker repeats={repeats} labelOf={labelOf} />
        <div className="md:col-span-2">
          <AreaHeatmap heatmap={heatmap} labelOf={labelOf} />
        </div>
        <BlockedItems complaints={blocked} citations={citations} labelOf={labelOf} />
        <LowConfidence
          complaints={unsure}
          evidence={bundle(records, unsure.map((c) => c.source_message_id))}
        />
        <div className="md:col-span-2">
          <ComplaintsByDay days={days} evidence={byDay} />
        </div>
      </div>
    </>
  )
}
