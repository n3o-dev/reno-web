import { describe, expect, it } from 'vitest'
import { areaLabel } from '@/rules/area'

describe('area labels', () => {
  it.each([
    ['koridor_lt1_timur_sudut_plafon', 'Koridor LT1 Timur Sudut Plafon'],
    ['carpark_p1_zona_a', 'Carpark P1 Zona A'],
    ['tangga_carpark_p1_p10', 'Tangga Carpark P1 P10'],
    ['tempat_sampah_cmo', 'Tempat Sampah CMO'],
    ['entrance_uniqlo', 'Entrance Uniqlo'],
    ['ug', 'UG'],
  ])('%s → %s', (id, expected) => {
    expect(areaLabel(id)).toBe(expected)
  })

  it('says nothing when the complaint named no area', () => {
    expect(areaLabel(null)).toBeNull()
  })

  it('does not invent a label from an empty id', () => {
    expect(areaLabel('___')).toBeNull()
  })
})
