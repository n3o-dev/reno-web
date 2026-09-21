import { readFile } from 'node:fs/promises'
import type {
  ComplaintRecord,
  LineupRecord,
  MessageRecord,
  PersonRecord,
  PhotoRecord,
  RecordType,
  RkbMatchRecord,
  WorkOrderRecord,
  WorkReportRecord,
} from './schemas'
import { RECORD_TYPES, zodSchemas } from './schemas'

/**
 * One interface over the agent's records, whatever is behind it.
 *
 * Downstream code — the rules layer, the screens, the report pack — depends on
 * this and never on where the records came from. The fixture implementation
 * below lets everything be built and tested before the agent emits anything;
 * an HTTP implementation slots in later without a single downstream change.
 *
 * See docs/specs/agent-data-contract.md (AC-6).
 */
export interface RecordsByType {
  message: MessageRecord
  work_report: WorkReportRecord
  complaint: ComplaintRecord
  work_order: WorkOrderRecord
  lineup: LineupRecord
  rkb_match: RkbMatchRecord
  photo: PhotoRecord
  person: PersonRecord
}

export interface RecordSource {
  all<T extends RecordType>(type: T): readonly RecordsByType[T][]
  readonly messages: readonly MessageRecord[]
  readonly workReports: readonly WorkReportRecord[]
  readonly complaints: readonly ComplaintRecord[]
  readonly workOrders: readonly WorkOrderRecord[]
  readonly lineups: readonly LineupRecord[]
  readonly rkbMatches: readonly RkbMatchRecord[]
  readonly photos: readonly PhotoRecord[]
  readonly people: readonly PersonRecord[]
}

type Store = { [K in RecordType]: RecordsByType[K][] }

export function createRecordSource(store: Store): RecordSource {
  return {
    all: (type) => store[type],
    messages: store.message,
    workReports: store.work_report,
    complaints: store.complaint,
    workOrders: store.work_order,
    lineups: store.lineup,
    rkbMatches: store.rkb_match,
    photos: store.photo,
    people: store.person,
  }
}

const FIXTURE_DIR = 'fixtures/agent'

/**
 * Reads the committed fixture set. Node-only: the browser never touches this.
 *
 * Every record is parsed through its schema on the way in. This is an I/O
 * boundary, so it is defensive: a malformed fixture fails loudly here rather
 * than becoming a typed value that lies to everything downstream.
 */
export async function loadFixtureSource(dir: string = FIXTURE_DIR): Promise<RecordSource> {
  const entries = await Promise.all(
    RECORD_TYPES.map(async (type) => {
      const raw = await readFile(`${dir}/${type}.json`, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error(`${dir}/${type}.json must hold an array`)
      const records = parsed.map((record, index) => {
        const result = zodSchemas[type].safeParse(record)
        if (!result.success) {
          throw new Error(
            `${dir}/${type}.json[${index}] does not match the ${type} schema: ${result.error.message}`,
          )
        }
        return result.data
      })
      return [type, records] as const
    }),
  )
  const store = Object.fromEntries(entries) as Store
  return createRecordSource(store)
}
