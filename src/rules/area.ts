/**
 * Turns an `area_id` into something a person reads.
 *
 * A stopgap. The agent emits `area_id` and nothing emits the area's name, so
 * there is no area master to look a label up in — the id is all the dashboard
 * has. Un-slugging it is better than printing `koridor_lt1_timur_sudut_plafon`
 * at a client, and worse than the real thing. When an area master exists this
 * becomes a lookup with this as the fallback.
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
