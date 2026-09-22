import { cache } from 'react'
import { createRecordSource, loadFixtureSource, type RecordSource } from '@/contract/source'
import { loadSource } from '@/db/records-store'
import { SITE_ID } from '@/config/site'
import { getDatabase } from './database'
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
/**
 * Postgres when there is one, the committed fixture set otherwise.
 *
 * The fallback is not a convenience: it is what keeps every screen runnable
 * and testable without a server, and it stops a missing DATABASE_URL from
 * rendering as a site with no activity.
 */
const loadAll = cache(async (siteId: string): Promise<RecordSource> => {
  const db = getDatabase()
  return db === null ? loadFixtureSource() : loadSource(db.sql, siteId)
})

/**
 * Records for one site. There is no "every site".
 *
 * The filter is here rather than in each screen on purpose: a client token
 * is scoped to one site, and a screen that forgot to narrow would leak
 * another site's records. Narrowing at the single entry point makes
 * forgetting impossible (AC-4).
 */
export const getRecords = cache(
  async (siteId: string = SITE_ID): Promise<RecordSource> => {
    /*
     * Defaults to this deployment's site, never to "every site". It used to
     * default to everything: the client link passed its token's site, but
     * the Reno screens, the print route and the workbook export passed
     * nothing — so any valid ingest token for any site could put rows on
     * this dashboard and into the printed invoice. The write path was
     * hardened against exactly that while the read path was open.
     */
    const all = await loadAll(siteId)

    const here = <T extends { site_id: string }>(records: readonly T[]): T[] =>
      records.filter((r) => r.site_id === siteId)

    return createRecordSource({
      message: here(all.messages),
      work_report: here(all.workReports),
      complaint: here(all.complaints),
      work_order: here(all.workOrders),
      lineup: here(all.lineups),
      rkb_match: here(all.rkbMatches),
      rkb_block: here(all.rkbBlocks),
      photo: here(all.photos),
      person: here(all.people),
    })
  },
)

export type { RecordType }
