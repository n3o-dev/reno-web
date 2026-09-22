import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ScreenHeader } from '@/components/common/ScreenHeader'
import { computeRealisation } from '@/rules/realisation'
import { WORKBOOK_LABEL, WORKBOOK_MONTH, getWorkbook, planCells, sheetSlug } from '@/services/rkb'
import { getRecords } from '@/services/records'
import { DayGrid } from '@/components/screens/parts/DayGrid'

interface SheetPageProps {
  readonly params: Promise<{ readonly sheet: string }>
}

export async function generateStaticParams(): Promise<{ sheet: string }[]> {
  const book = await getWorkbook()
  return book.sheets.map((sheet) => ({ sheet: sheetSlug(sheet.name) }))
}

export default async function SheetPage({ params }: SheetPageProps) {
  const { sheet: slug } = await params
  const book = await getWorkbook()
  const sheet = book.sheets.find((s) => sheetSlug(s.name) === slug)
  if (sheet === undefined) notFound()

  const records = await getRecords()
  const { rkbMatches: matches, rkbBlocks: blocks } = records
  const realisation = computeRealisation(planCells(sheet, WORKBOOK_MONTH, matches, blocks))

  return (
    <>
      <Link href="/rkb" // 44px tall: this is a client route and a thumb has to hit it (AC-12).
        className="inline-flex min-h-11 items-center text-[13px] text-muted underline decoration-line">
        ← All sheets
      </Link>
      <ScreenHeader
        title={sheet.name.trim()}
        question={`${WORKBOOK_LABEL} · ${realisation.done} of ${realisation.planned} planned job-row days done`}
      />
      <div className="flex flex-col gap-6">
        {sheet.sections.map((section) => (
          <DayGrid matches={matches} blocks={blocks} sheetName={sheet.name} key={`${section.name}-${section.rows[0]?.rowNumber ?? 0}`} section={section} />
        ))}
      </div>
    </>
  )
}
