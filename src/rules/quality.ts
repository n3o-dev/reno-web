import type { Defect } from '@/contract/schemas'
import { DEFECTS } from '@/contract/schemas'
import type { PhotoRecord, WorkReportRecord } from '@/contract/schemas'

/**
 * Report Quality is about Reno's own reporting, not about the cleaning.
 *
 * Two of these figures are accusations — a photo reused, a photo taken before
 * the complaint it claims to answer — so each is computed from the record
 * fields that can be shown to the person accused, never inferred.
 *
 * See docs/specs/reno-dashboard.md (screen 6).
 */

const MS_PER_HOUR = 60 * 60 * 1000
export const LATE_PHOTO_HOURS = 3

export interface DefectCount {
  readonly defect: Defect
  readonly count: number
}

/** Counts in the closed set's own order, so the chart never reorders itself. */
export function countDefects(reports: readonly WorkReportRecord[]): readonly DefectCount[] {
  return DEFECTS.map((defect) => ({
    defect,
    count: reports.filter((r) => r.defects.includes(defect)).length,
  }))
}

export function countBeforeAfter(reports: readonly WorkReportRecord[]): number {
  return reports.filter((r) => r.is_before_after).length
}

/**
 * Photos that reached the group more than three hours after they were taken.
 *
 * A photo with no capture time is not counted: the gap is unknown, and an
 * unknown gap is not a late one.
 */
export function countLatePhotos(
  photos: readonly PhotoRecord[],
  hours: number = LATE_PHOTO_HOURS,
): number {
  return photos.filter((photo) => {
    if (photo.captured_at === null) return false
    const gap = Date.parse(photo.received_at) - Date.parse(photo.captured_at)
    return gap > hours * MS_PER_HOUR
  }).length
}

export interface DuplicateGroup {
  readonly hash: string
  readonly photoIds: readonly string[]
}

/**
 * Photos sharing a perceptual hash, which is the only form in which the
 * duplicate accusation is safe to make: the screen shows both images side by
 * side and lets a person judge.
 */
export function findDuplicatePhotos(photos: readonly PhotoRecord[]): readonly DuplicateGroup[] {
  const byHash = new Map<string, string[]>()
  for (const photo of photos) {
    const group = byHash.get(photo.perceptual_hash) ?? []
    group.push(photo.record_id)
    byHash.set(photo.perceptual_hash, group)
  }
  return [...byHash.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([hash, photoIds]) => ({ hash, photoIds }))
    .sort((a, b) => a.hash.localeCompare(b.hash))
}

/** Share of reports carrying no defect at all. */
export function validationPassRate(reports: readonly WorkReportRecord[]): number {
  if (reports.length === 0) return 1
  return reports.filter((r) => r.defects.length === 0).length / reports.length
}
