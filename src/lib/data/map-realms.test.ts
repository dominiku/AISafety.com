import { describe, expect, it } from 'vitest'
import {
  categoriesForMapArea,
  isInQuietMapArea,
  mapAreaDepth,
  mapAreaPath,
  searchMapAreas,
} from './map-areas'
import { buildRealmScheme, renameAreas } from './map-realms'

const pin = (realm: string, district: string, x: number, y: number) => ({
  realm,
  district,
  x,
  y,
})

const scheme = buildRealmScheme([
  pin('Media and discourse', 'Forums', 28, 28),
  pin('Media and discourse', 'News and commentary', 16, 23),
  pin('Media and discourse', 'News and commentary', 20, 25),
  pin('Media and discourse', 'News and commentary', 24, 29),
  pin('No longer active', 'No longer active', 55, 30),
  { realm: null, district: null, x: 10, y: 10 },
  { realm: 'Talent pipeline', district: 'Career support', x: null, y: null },
])

describe('buildRealmScheme', () => {
  it('makes each realm a top-level area with its districts inside', () => {
    expect(mapAreaDepth('Media and discourse', scheme)).toBe(0)
    expect(mapAreaDepth('Forums', scheme)).toBe(1)
    expect(mapAreaPath('Forums', scheme)).toEqual([
      'Media and discourse',
      'Forums',
    ])
    expect(categoriesForMapArea('Media and discourse', scheme)).toEqual([
      'Forums',
      'News and commentary',
    ])
  })

  it('draws a label at the middle of its own pins', () => {
    const news = scheme.areas.find(a => a.label === 'News and commentary')
    expect(news).toMatchObject({ x: 20, y: 25 })
  })

  it('keeps a realm named like its only district as one quiet area', () => {
    expect(
      scheme.areas.filter(a => a.label === 'No longer active')
    ).toHaveLength(1)
    expect(mapAreaPath('No longer active', scheme)).toEqual([
      'No longer active',
    ])
    expect(isInQuietMapArea('No longer active', scheme)).toBe(true)
    expect(isInQuietMapArea('Forums', scheme)).toBe(false)
  })

  it('leaves out pins with no realm, and areas with no placed pin', () => {
    expect(scheme.areas.map(a => a.label).sort()).toEqual([
      'Forums',
      'Media and discourse',
      'News and commentary',
      'No longer active',
    ])
  })

  it('can show areas under other names without touching the data names', () => {
    const named = renameAreas(scheme, {
      'Media and discourse': 'Discourse Delta',
      'News and commentary': 'Commentary Coast',
      'No longer active': 'Gone Graveyard',
    })
    expect(named.areas.map(a => a.label).sort()).toEqual([
      'Commentary Coast',
      'Discourse Delta',
      'Forums',
      'Gone Graveyard',
    ])
    // Orgs are still placed by their data District.
    expect(mapAreaPath('News and commentary', named)).toEqual([
      'Discourse Delta',
      'Commentary Coast',
    ])
    expect(isInQuietMapArea('No longer active', named)).toBe(true)
    expect(() =>
      renameAreas(scheme, { Forums: 'News and commentary' })
    ).toThrow(/both named/)
  })

  it('is searchable like the classic areas', () => {
    expect(searchMapAreas('news', scheme).map(a => a.label)).toEqual([
      'News and commentary',
    ])
  })
})
