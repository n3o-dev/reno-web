import { cache } from 'react'
import { createRecordSource, loadFixtureSource, type RecordSource } from '@/contract/source'
import type { RecordType } from '@/contract/schemas'

/**
 * The screens' one way in to the agent's records.
 *
 * Today it reads the committed fixture set off disk; when the ingest endpoint
 * lands it will read Postgres. Nothing above this line knows the difference —
 * that is what `RecordSource` is for. React's `cache` keeps one load per
 * request, so nine screens sharing a render do not read the files nine times.
 *
 * Server-only. A Client Component that imports this will fail to build, which
 * is the intended outcome: records reach the browser as props, not as reads.
 */
const loadAll = cache(async (): Promise<RecordSource> => loadFixtureSource())

/**
 * Records for one site, or every site when `siteId` is undefined.
 *
 * The filter is here rather than in each screen on purpose: a client token is
 * scoped to one site, and a screen that forgot to narrow would leak another
 * site's records. Narrowing at the single entry point makes forgetting
 * impossible (AC-4).
 */
export const getRecords = cache(
  async (siteId?: string): Promise<RecordSource> => {
    const all = await loadAll()
    if (siteId === undefined) return all

    const here = <T extends { site_id: string }>(records: readonly T[]): T[] =>
      records.filter((r) => r.site_id === siteId)

    return createRecordSource({
      message: here(all.messages),
      work_report: here(all.workReports),
      complaint: here(all.complaints),
      work_order: here(all.workOrders),
      lineup: here(all.lineups),
      rkb_match: here(all.rkbMatches),
      photo: here(all.photos),
      person: here(all.people),
    })
  },
)

export type { RecordType }
