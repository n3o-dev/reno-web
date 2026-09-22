import type { AreaRecord } from '@/contract/schemas'

/**
 * Turns an `area_id` into something a person reads.
 *
 * The area master carries the label a person would write; this is the
 * fallback for an id the master does not know yet. Un-slugging is better
 * than printing `koridor_lt1_timur_sudut_plafon` at a client, and worse
 * than the real thing.
 */

/** Tokens the general rule would get wrong. */
const UPPERCASE = new Set(['lt1', 'lt2', 'lt3', 'ug', 'gf', 'lk', 'lp', 'cmo', 'led', 'pkd', 'oo'])
const SHORT_WORDS = new Set(['di', 'dan', 'ke', 'ex'])

const capitalise = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1)

export function areaLabel(areaId: string | null): string | null {
  if (areaId === null) return null
  const words = areaId.split('_').filter((w) => w !== '')
  if (words.length === 0) return null
  return words
    .map((word, index) => {
      if (UPPERCASE.has(word)) return word.toUpperCase()
      // p1, p10 — car park levels.
      if (/^p\d+$/.test(word)) return word.toUpperCase()
      if (index > 0 && SHORT_WORDS.has(word)) return word
      return capitalise(word)
    })
    .join(' ')
}

/** A lookup over the area master, falling back to un-slugging the id. */
export function areaLabeller(
  areas: readonly AreaRecord[],
): (areaId: string | null) => string | null {
  const labels = new Map(areas.map((area) => [area.area_id, area.label]))
  return (areaId) => {
    if (areaId === null) return null
    return labels.get(areaId) ?? areaLabel(areaId)
  }
}

/** The zone a place sits in, for the areas whose zone someone has stated. */
export function zoneLookup(areas: readonly AreaRecord[]): ReadonlyMap<string, string> {
  const zones = new Map<string, string>()
  for (const area of areas) {
    if (area.zone !== null) zones.set(area.area_id, area.zone)
  }
  return zones
}
