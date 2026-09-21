import { ScreenHeader } from '@/components/common/ScreenHeader'
import { Card } from '@/components/styled/Card'
import { countByDay } from '@/rules/daily'
import {
  countBeforeAfter,
  countDefects,
  countLatePhotos,
  findDuplicatePhotos,
  validationPassRate,
} from '@/rules/quality'
import { getRecords } from '@/services/records'
import { DefectBreakdown } from './_components/DefectBreakdown'
import { EvidenceQuality } from './_components/EvidenceQuality'
import { GroupActivity } from './_components/GroupActivity'

export default async function ReportQualityPage() {
  const records = await getRecords()
  const reports = records.workReports
  const passRate = validationPassRate(reports)

  return (
    <>
      <ScreenHeader title="Report Quality" question="Where Reno's own reporting is failing" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card
          title="Reports that passed validation"
          info="A report passes when it names its area, carries a caption, and is not flagged as reused or as done against no complaint. This is about the paperwork, not the cleaning: a failed report may describe work that was done perfectly."
        >
          <p
            data-figure="quality.pass_rate"
            data-figure-kind="quality"
            className="font-[family-name:var(--font-display)] text-[38px] leading-[1.15] tabular-nums"
          >
            {Math.round(passRate * 100)}%
          </p>
          <p className="text-[13px] text-muted">
            <span className="tabular-nums">{reports.filter((r) => r.defects.length === 0).length}</span>{' '}
            of <span className="tabular-nums">{reports.length}</span> reports
          </p>
        </Card>
        <EvidenceQuality
          beforeAfter={countBeforeAfter(reports)}
          reportCount={reports.length}
          latePhotos={countLatePhotos(records.photos)}
          duplicatePairs={findDuplicatePhotos(records.photos).length}
        />
        <DefectBreakdown defects={countDefects(reports)} reportCount={reports.length} />
        <GroupActivity
          series={[
            { key: 'messages', label: 'Messages', days: countByDay(records.messages) },
            { key: 'photos', label: 'Photos', days: countByDay(records.photos) },
            { key: 'reports', label: 'Work reports', days: countByDay(reports) },
          ]}
        />
      </div>
    </>
  )
}
