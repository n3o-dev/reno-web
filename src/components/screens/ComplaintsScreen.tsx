import type { ScreenProps } from '@/components/screens/props'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { closureStats } from '@/rules/clock'
import { countByDay } from '@/rules/daily'
import { getRecords } from '@/services/records'
import { ComplaintFunnel } from '@/components/screens/parts/ComplaintFunnel'
import { ComplaintsByDay } from '@/components/screens/parts/ComplaintsByDay'
import { ResponseTimes } from '@/components/screens/parts/ResponseTimes'

export async function ComplaintsScreen({ siteId }: ScreenProps) {
  const records = await getRecords(siteId)
  const complaints = records.complaints
  const stats = closureStats(complaints)
  const days = countByDay(complaints)

  return (
    <>
      <ScreenHeader
        title="Complaints"
        question="What was raised, who caused it, what is still open"
      />
      <div className="grid gap-4 md:grid-cols-2">
        <ComplaintFunnel stats={stats} />
        <ResponseTimes stats={stats} />
        <div className="md:col-span-2">
          <ComplaintsByDay days={days} />
        </div>
      </div>
    </>
  )
}
