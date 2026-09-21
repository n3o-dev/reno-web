import { describe, expect, it } from 'vitest'
import { loadFixtureSource } from '@/contract/source'
import { closureStats } from '@/rules/clock'

/**
 * AC-2 asserted against the real LWAS fixture set, not synthetic data:
 * "Given the LWAS fixtures, the rules layer returns complaint medians of
 *  3 minutes to first answer and 41 minutes to close with photo, a slowest
 *  close of 16h 50m, and 29 of 75 closed with photo."
 */
const source = await loadFixtureSource()
const stats = closureStats(source.complaints)

describe('AC-2 · the published medians come out of the fixtures', () => {
  it('median reply is 3 minutes', () => {
    expect(stats.medianReplyMinutes).toBe(3)
  })

  it('median closure is 41 minutes', () => {
    expect(stats.medianClosureMinutes).toBe(41)
  })

  it('the slowest closure is 16h 50m', () => {
    expect(stats.slowestClosureMinutes).toBe(16 * 60 + 50)
  })

  it('29 of 75 closed with a photo', () => {
    expect(stats.raised).toBe(75)
    expect(stats.closedWithPhoto).toBe(29)
  })

  it('62 were answered', () => {
    expect(stats.answered).toBe(62)
  })
})
