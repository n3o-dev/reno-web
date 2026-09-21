import { notFound } from 'next/navigation'
import { monthReport } from '@/services/report'
import { requireAccount } from '@/services/current-account'
import { PrintableReport } from '@/components/report/PrintableReport'

/** Same reason as the dashboard: it depends on the session and the database. */
export const dynamic = 'force-dynamic'

interface PrintPageProps {
  readonly params: Promise<{ readonly month: string }>
}

/**
 * The client report, laid out for paper.
 *
 * The same data as the screens, rendered once for print rather than
 * assembled in a second document format that would drift from them. Save as
 * PDF from the browser, or point a headless Chromium at this route.
 */
export default async function PrintPage({ params }: PrintPageProps) {
  const { month } = await params
  if (!/^\d{4}-\d{2}$/.test(month)) notFound()

  /*
   * The proxy only checked that a cookie exists, which is true of an empty
   * one. This is the second check, and this route needs it most: it is where
   * the amount payable is printed.
   */
  await requireAccount(`/print/${month}`)

  const report = await monthReport(month)
  return <PrintableReport report={report} />
}
