import type { RecordType } from '@/contract/schemas'
import type { RecordSource, RecordsByType } from '@/contract/source'

/**
 * A second, genuinely independent RecordSource implementation.
 *
 * Deliberately NOT built on `createRecordSource`: it stores records in pages
 * and reassembles them on demand behind a cache, which is the shape a polled
 * or webhook transport would take. If the two implementations ever disagree,
 * something downstream has learned which one it is holding.
 */
type Pages = { [K in RecordType]: readonly (readonly RecordsByType[K][])[] }

export function createPagedRecordSource(pages: Pages): RecordSource {
  const cache = new Map<RecordType, readonly unknown[]>()

  function materialise<T extends RecordType>(type: T): readonly RecordsByType[T][] {
    const cached = cache.get(type)
    if (cached !== undefined) return cached as readonly RecordsByType[T][]
    const flat: RecordsByType[T][] = []
    for (const page of pages[type]) for (const record of page) flat.push(record)
    cache.set(type, flat)
    return flat
  }

  return {
    all: materialise,
    get messages() {
      return materialise('message')
    },
    get workReports() {
      return materialise('work_report')
    },
    get complaints() {
      return materialise('complaint')
    },
    get workOrders() {
      return materialise('work_order')
    },
    get lineups() {
      return materialise('lineup')
    },
    get rkbMatches() {
      return materialise('rkb_match')
    },
    get photos() {
      return materialise('photo')
    },
    get people() {
      return materialise('person')
    },
  }
}

/** Splits an array into fixed-size pages, the way a paged API would return it. */
export function paginate<T>(records: readonly T[], size: number): readonly (readonly T[])[] {
  const pages: T[][] = []
  for (let i = 0; i < records.length; i += size) pages.push(records.slice(i, i + size))
  return pages
}
