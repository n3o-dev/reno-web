import { cache } from 'react'
import { loadFixtureSource, type RecordSource } from '@/contract/source'

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
export const getRecords = cache(async (): Promise<RecordSource> => loadFixtureSource())
