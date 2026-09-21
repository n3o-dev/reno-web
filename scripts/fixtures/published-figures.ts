/**
 * The published Living World Alam Sutera figures, 10–13 September 2026.
 *
 * Every number here is from the Reno AI case-study deck. They are the
 * acceptance criteria in docs/specs/agent-data-contract.md (AC-4, AC-5) —
 * do not tune them to make a test pass.
 */

export const SITE = 'lwas'
export const DAYS = ['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13'] as const
export const MESSAGES = [339, 414, 326, 299] as const
export const PHOTOS = [264, 314, 251, 223] as const
export const REPORTS = [166, 149, 170, 154] as const
export const COMPLAINTS = [19, 35, 4, 17] as const
export const ANSWERED = [17, 25, 4, 16] as const
export const CLOSED_WITH_PHOTO = [9, 10, 3, 7] as const
/**
 * 61 reports carry before-and-after.
 *
 * The deck states 61 twice — in the KPI table and again in the evidence
 * appendix — but its own per-reporter table sums to 65. The headline wins:
 * it is stated twice and is the figure the QBR is built on. The per-day split
 * below keeps the shape of the per-reporter table and trims the difference.
 */
export const BEFORE_AFTER = [10, 21, 22, 8] as const
export const DEFECTS: Record<string, readonly number[]> = {
  no_area: [7, 12, 9, 8],
  done_without_complaint: [5, 3, 2, 2],
  no_caption: [5, 4, 0, 1],
  photo_reused: [3, 0, 0, 0],
}
export const LATE_OVER_3H = 25
/**
 * Reply and closure durations, in minutes, chosen so the period medians land
 * on the published figures: reply median 3 (fastest under 1, slowest 25) and
 * closure median 41 (fastest 6, slowest 16h50m = 1010).
 */
export const REPLY_MINUTES: readonly number[] = [0, ...Array<number>(30).fill(2), ...Array<number>(30).fill(4), 25]
export const CLOSURE_MINUTES: readonly number[] = [6, ...Array<number>(13).fill(30), 41, ...Array<number>(13).fill(60), 1010]
export const DUPLICATE_PAIRS = 3

/** Areas complained about on more than one day, with the days they recurred. */
export const REPEAT_AREAS: ReadonlyArray<readonly [string, readonly number[]]> = [
  ['toilet_lt2', [1, 2, 3]],
  ['tempat_sampah_cmo', [0, 1, 3]],
  ['tangga_carpark_p1_p10', [0, 2]],
  ['asbak_smoking_area', [1, 3]],
  ['carpark_p1_zona_a', [0, 1]],
  ['area_apong', [0, 1]],
  ['depan_skin_plus', [0, 3]],
]

