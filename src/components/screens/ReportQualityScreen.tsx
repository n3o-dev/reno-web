import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { Figure } from '@/components/common/Figure'
import type { RecordSource } from '@/contract/source'
import { countByDay } from '@/rules/daily'
import {
  countBeforeAfter,
  countDefects,
  countLatePhotos,
  findDuplicatePhotos,
  validationPassRate,
  LATE_PHOTO_HOURS,
} from '@/rules/quality'
import { bundleEvidence } from '@/services/evidence'
import { getRecords } from '@/services/records'
import { DefectBreakdown } from '@/components/screens/parts/DefectBreakdown'
import { EvidenceQuality } from '@/components/screens/parts/EvidenceQuality'
import { GroupActivity } from '@/components/screens/parts/GroupActivity'
import { ReporterScorecard } from '@/components/screens/parts/ReporterScorecard'
import { DuplicatePhotos } from '@/components/screens/parts/DuplicatePhotos'
import { scoreReporters } from '@/rules/reporters'
import type { FigureEvidence } from '@/components/screens/parts/ComplaintFunnel'

const bundle = (source: RecordSource, ids: readonly string[]): FigureEvidence =>
  bundleEvidence(source, ids, 'Nothing in this period matched.')

export async function ReportQualityScreen({ siteId }: ScreenProps) {
  const records = await getRecords(siteId)
  const reports = records.workReports
  const photos = records.photos
  const passRate = validationPassRate(reports)
  const clean = reports.filter((r) => r.defects.length === 0)
  const duplicates = findDuplicatePhotos(photos)
  const duplicateIds = new Set(duplicates.flatMap((d) => d.photoIds))

  const scores = scoreReporters(reports)
  const reporterEvidence: Record<string, FigureEvidence> = {}
  for (const score of scores) {
    reporterEvidence[score.reporter] = bundle(
      records,
      reports.filter((r) => r.sender_raw === score.reporter).map((r) => r.source_message_id),
    )
  }

  const defects = countDefects(reports)
  const defectEvidence: Record<string, FigureEvidence> = {}
  for (const entry of defects) {
    defectEvidence[entry.defect] = bundle(
      records,
      reports.filter((r) => r.defects.includes(entry.defect)).map((r) => r.source_message_id),
    )
  }

  return (
    <>
      <ScreenHeader title="Report Quality" question="Where Reno's own reporting is failing" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Reports that passed validation"
          info="A report passes when it names its area, carries a caption, and is not flagged as reused or as done against no complaint. This is about the paperwork, not the cleaning: a failed report may describe work that was done perfectly."
        >
          <Figure
            name="quality.pass_rate"
            evidence={bundle(records, clean.map((r) => r.source_message_id)).items}
            total={clean.length}
            className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums"
          >
            {Math.round(passRate * 100)}%
          </Figure>
          <p className="text-[13px] text-muted">
            <span className="tabular-nums">{clean.length}</span> of{' '}
            <span className="tabular-nums">{reports.length}</span> reports
          </p>
        </Card>
        <EvidenceQuality
          beforeAfter={countBeforeAfter(reports)}
          reportCount={reports.length}
          latePhotos={countLatePhotos(photos)}
          duplicatePairs={duplicates.length}
          evidence={{
            before_after: bundle(
              records,
              reports.filter((r) => r.is_before_after).map((r) => r.source_message_id),
            ),
            late_photos: bundle(
              records,
              photos
                .filter(
                  (p) =>
                    p.captured_at !== null &&
                    Date.parse(p.received_at) - Date.parse(p.captured_at) >
                      LATE_PHOTO_HOURS * 3_600_000,
                )
                .map((p) => p.source_message_id),
            ),
            duplicate_pairs: bundle(
              records,
              photos.filter((p) => duplicateIds.has(p.record_id)).map((p) => p.source_message_id),
            ),
          }}
        />
        <DefectBreakdown
          defects={defects}
          reportCount={reports.length}
          evidence={defectEvidence}
        />
        <div className="md:col-span-2">
          <ReporterScorecard scores={scores} evidence={reporterEvidence} />
        </div>
        <div className="md:col-span-2">
          <DuplicatePhotos groups={duplicates} photos={photos} />
        </div>
        <GroupActivity
          series={[
            {
              key: 'messages',
              label: 'Messages',
              days: countByDay(records.messages),
              evidence: bundle(records, records.messages.map((m) => m.source_message_id)),
            },
            {
              key: 'photos',
              label: 'Photos',
              days: countByDay(photos),
              evidence: bundle(records, photos.map((p) => p.source_message_id)),
            },
            {
              key: 'reports',
              label: 'Work reports',
              days: countByDay(reports),
              evidence: bundle(records, reports.map((r) => r.source_message_id)),
            },
          ]}
        />
      </div>
    </>
  )
}
