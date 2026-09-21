import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { computeRealisation } from '@/rules/realisation'
import { WORKBOOK_LABEL, WORKBOOK_MONTH, getWorkbook, planCells, sheetSlug } from '@/services/rkb'
import { DayGrid } from '@/components/screens/parts/DayGrid'

interface SheetPageProps {
  readonly params: Promise<{ readonly sheet: string; readonly token: string }>
}

export default async function SheetPage({ params }: SheetPageProps) {
  const { sheet: slug, token } = await params
  const book = await getWorkbook()
  const sheet = book.sheets.find((s) => sheetSlug(s.name) === slug)
  if (sheet === undefined) notFound()

  const realisation = computeRealisation(planCells(sheet, WORKBOOK_MONTH))

  return (
    <>
      <Link href={`/c/${token}/rkb`} className="text-[13px] text-muted underline decoration-line">
        ← All sheets
      </Link>
      <ScreenHeader
        title={sheet.name.trim()}
        question={`${WORKBOOK_LABEL} · ${realisation.done} of ${realisation.planned} planned job-row days done`}
      />
      <div className="flex flex-col gap-6">
        {sheet.sections.map((section) => (
          <DayGrid key={`${section.name}-${section.rows[0]?.rowNumber ?? 0}`} section={section} />
        ))}
      </div>
    </>
  )
}
