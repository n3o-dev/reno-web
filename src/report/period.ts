import { createRecordSource, type RecordSource } from '@/contract/source'

/**
 * The month's records, and only the month's.
 *
 * Without this the pack was inert in its own `month` argument: a report for
 * January 2099 carried September's complaints and billed a full month from
 * them. Every figure in a monthly pack has to come from that month, and the
 * filter belongs here rather than in each section, because a section that
 * forgot would be wrong quietly.
 */
/*
 * The date the record is *about*, not the moment it was posted. A line-up
 * for the 30th posted at 01:30 on the 1st landed in the following month and
 * was billed there — shift 2 runs to 23:00 and shift 3 past midnight, so
 * that is the normal case rather than a corner. Records without a business
 * date fall back to when they were sent, which is the only date they have.
 */
const businessDate = (record: { sent_at: string; date?: string }): string =>
  record.date ?? record.sent_at

const inMonth = <T extends { sent_at: string; date?: string }>(
  records: readonly T[],
  month: string,
): T[] => records.filter((record) => businessDate(record).startsWith(month))

export function narrowToMonth(source: RecordSource, month: string): RecordSource {
  return createRecordSource({
    message: inMonth(source.messages, month),
    work_report: inMonth(source.workReports, month),
    complaint: inMonth(source.complaints, month),
    work_order: inMonth(source.workOrders, month),
    lineup: inMonth(source.lineups, month),
    rkb_match: inMonth(source.rkbMatches, month),
    rkb_block: inMonth(source.rkbBlocks, month),
    photo: inMonth(source.photos, month),
    // Masters, not monthly records — same reason as `person`.
    area: [...source.areas],
    // The personnel master is not a monthly record: a person employed in
    // September is still the person a September line-up names.
    person: [...source.people],
  })
}

/** Every calendar day in `YYYY-MM`, as ISO dates. */
export function daysInMonth(month: string): readonly string[] {
  const [year, index] = month.split('-').map(Number)
  if (year === undefined || index === undefined) throw new Error(`bad month "${month}"`)
  const count = new Date(Date.UTC(year, index, 0)).getUTCDate()
  return Array.from(
    { length: count },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  )
}
