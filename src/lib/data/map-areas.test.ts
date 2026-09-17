import { describe, expect, it } from 'vitest'
import {
  MAP_AREAS,
  MAP_AREA_BY_CATEGORY,
  categoriesForMapArea,
  categoryForMapArea,
  mapAreaBounds,
  searchMapAreas,
} from './map-areas'

const labels = (query: string) => searchMapAreas(query).map(a => a.label)

describe('MAP_AREAS', () => {
  it('draws a label for every area a category maps to', () => {
    const drawn = new Set(MAP_AREAS.map(a => a.label))
    for (const area of Object.values(MAP_AREA_BY_CATEGORY)) {
      expect(drawn.has(area), area).toBe(true)
    }
  })
})

describe('categoryForMapArea', () => {
  it('reverses the category map', () => {
    expect(categoryForMapArea('Blog Beach')).toBe('Blog')
    expect(categoryForMapArea('Support Shoreline')).toBe('Research support')
  })

  it('has no single category for an umbrella area', () => {
    expect(categoryForMapArea('Research Range')).toBeNull()
  })
})

describe('categoriesForMapArea', () => {
  it('is the one category of an ordinary area', () => {
    expect(categoriesForMapArea('Blog Beach')).toEqual(['Blog'])
  })

  it('is the spanned categories of an umbrella area', () => {
    expect(categoriesForMapArea('Research Range')).toEqual([
      'Conceptual research',
      'Empirical research',
      'Capabilities research',
    ])
  })

  it('gives every drawn area at least one category, so each has listings to count', () => {
    for (const area of MAP_AREAS) {
      expect(
        categoriesForMapArea(area.label).length,
        area.label
      ).toBeGreaterThan(0)
    }
  })

  it('only spans categories that exist', () => {
    for (const category of categoriesForMapArea('Research Range')) {
      expect(MAP_AREA_BY_CATEGORY[category], category).toBeDefined()
    }
  })
})

describe('searchMapAreas', () => {
  it('finds an area by the start of its name, in any case', () => {
    expect(labels('blog')).toEqual(['Blog Beach'])
    expect(labels('  BLOG b ')).toEqual(['Blog Beach'])
  })

  it('finds an area by a later word of its name', () => {
    expect(labels('beach')).toEqual(['Blog Beach'])
  })

  it('finds an area by its category when the name shares no word', () => {
    expect(labels('research support')).toEqual(['Support Shoreline'])
    expect(labels('no longer')).toEqual(['Gone Graveyard'])
    expect(labels('inactive')).toEqual(['Gone Graveyard'])
  })

  it('ranks a starting match above a mid-word match, and a name above a category', () => {
    // Research Range starts with it by name, "Research support" by category;
    // the three "… research" categories only contain it.
    expect(labels('research')).toEqual([
      'Research Range',
      'Support Shoreline',
      'Conceptual Cliffs',
      'Empirical Escarpment',
      'Capabilities Cove',
    ])
  })

  it('returns nothing for an empty or unmatched query', () => {
    expect(labels('')).toEqual([])
    expect(labels('   ')).toEqual([])
    expect(labels('zebra')).toEqual([])
  })
})

describe('mapAreaBounds', () => {
  const area = { label: 'Blog Beach', x: 15, y: 25.8 }

  it('is the label point when the area has no pins', () => {
    expect(mapAreaBounds(area, [])).toEqual({
      minX: 15,
      minY: 25.8,
      maxX: 15,
      maxY: 25.8,
    })
  })

  it('boxes the pins together with the label', () => {
    expect(
      mapAreaBounds(area, [
        { x: 12, y: 20 },
        { x: 18, y: 24 },
        { x: 16, y: 22 },
      ])
    ).toEqual({ minX: 12, minY: 20, maxX: 18, maxY: 25.8 })
  })

  it('leaves out a pin placed far from the rest', () => {
    const cluster = [
      { x: 14, y: 22 },
      { x: 16, y: 22 },
      { x: 15, y: 21 },
      { x: 15, y: 23 },
      { x: 15, y: 22 },
    ]
    const bounds = mapAreaBounds(area, [...cluster, { x: 55, y: 3 }])
    expect(bounds).toEqual({ minX: 14, minY: 21, maxX: 16, maxY: 25.8 })
  })

  it('keeps a lone pin', () => {
    expect(mapAreaBounds(area, [{ x: 10, y: 20 }])).toEqual({
      minX: 10,
      minY: 20,
      maxX: 15,
      maxY: 25.8,
    })
  })
})
