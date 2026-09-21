import { ScreenHeader } from '@/components/common/ScreenHeader'
import { closureStats } from '@/rules/clock'
import { countByDay } from '@/rules/daily'
import { getRecords } from '@/services/records'
import { ComplaintFunnel } from './_components/ComplaintFunnel'
import { ComplaintsByDay } from './_components/ComplaintsByDay'
import { ResponseTimes } from './_components/ResponseTimes'

export default async function ComplaintsPage() {
  const records = await getRecords()
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
