import { describe, expect, it } from 'vitest'
import {
  layoutHexMap,
  strandedTiles,
  type HexLogo,
  type HexMapSpec,
} from './map-hex-layout'
import { MAP_35_HEX_ISLETS, MAP_35_HEX_SPEC } from './map-hex-spec'
import { HEX_DIRECTIONS, hexNeighbor } from './map-hex'

// A little island: Alpha, the higher, runs west to east along the north with
// its third tile on the coast; Beta lies south of it; and a cove.
const SPEC: HexMapSpec = {
  view: { size: 3, squash: 0.6, lift: 0.4, origin: [5, 5] },
  tiles: `
    ..   ..   ..   ..   ..   ..
    ..   Aa1  Aa2  Aa3  ..   ..
    ..   Bb1  Bb2  Bb3  cv1  ..
    ..   Bb4  Bb5  Bb6  ..   ..
    ..   ..   ..   ..   ..   ..
  `,
  districts: [
    { code: 'Aa', district: 'Alpha', realm: 'North', height: 3 },
    { code: 'Bb', district: 'Beta', realm: 'South', height: 2 },
  ],
  features: [{ code: 'cv', kind: 'water', height: 0 }],
  landmarks: [],
  paths: [],
}

const logos = (district: string, count: number, radius = 0.45): HexLogo[] =>
  Array.from({ length: count }, (_, n) => ({
    id: `${district}-${n}`,
    district,
    radius,
    name: `${district} ${String(n).padStart(3, '0')}`,
  }))

const stateOf = (layout: ReturnType<typeof layoutHexMap>, ref: string) =>
  layout.tiles.find(tile => tile.ref === ref)!.state

describe('layoutHexMap', () => {
  it('gives a district only the tiles its logos need, in its order', () => {
    const few = layoutHexMap(SPEC, logos('Alpha', 3))
    expect(stateOf(few, 'Aa1')).toBe('used')
    expect(stateOf(few, 'Aa2')).toBe('sea')
    expect(stateOf(few, 'Aa3')).toBe('sea')
    expect(few.unplaced).toEqual([])

    const many = layoutHexMap(SPEC, logos('Alpha', 14))
    expect(stateOf(many, 'Aa1')).toBe('used')
    expect(stateOf(many, 'Aa2')).toBe('used')
    expect(many.unplaced).toEqual([])
  })

  it('keeps a landlocked tile nobody needs as bare land, not a lake', () => {
    // Beta's first tile is enough, and its fifth is needed by nobody; with
    // Alpha grown over the north, Bb2 has land or the cove on every side but
    // only once its neighbors are used, so fill all but Bb2's own need.
    const spec: HexMapSpec = {
      ...SPEC,
      tiles: `
        ..   ..   ..   ..   ..
        ..   Aa1  Aa2  Aa3  ..
        ..   Aa4  Bb2  Aa5  ..
        ..   Aa6  Bb1  Aa7  ..
        ..   ..   ..   ..   ..
      `,
    }
    const layout = layoutHexMap(spec, [
      ...logos('Alpha', 200, 0.3),
      ...logos('Beta', 2),
    ])
    expect(stateOf(layout, 'Bb1')).toBe('used')
    expect(stateOf(layout, 'Bb2')).toBe('spare')
  })

  it('stands every logo on a tile of its own district, none overlapping', () => {
    const all = [...logos('Alpha', 20), ...logos('Beta', 40, 0.3)]
    const layout = layoutHexMap(SPEC, all)
    expect(layout.unplaced).toEqual([])
    const placed = all.map(logo => ({
      ...logo,
      ...layout.positions.get(logo.id)!,
    }))
    for (const logo of placed) {
      expect(layout.districtAt(logo.x, logo.y)).toBe(logo.district)
    }
    placed.forEach((a, i) => {
      for (const b of placed.slice(i + 1)) {
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(
          a.radius + b.radius
        )
      }
    })
  })

  it('never moves a larger logo when a smaller one is added', () => {
    const before = layoutHexMap(SPEC, logos('Alpha', 6, 0.6))
    const after = layoutHexMap(SPEC, [
      ...logos('Alpha', 6, 0.6),
      { id: 'new', district: 'Alpha', radius: 0.3, name: 'A newcomer' },
    ])
    for (const [id, at] of before.positions) {
      expect(after.positions.get(id)).toEqual(at)
    }
  })

  it('reports logos it has no tile for', () => {
    const layout = layoutHexMap(SPEC, [
      ...logos('Alpha', 400),
      ...logos('Nowhere', 1),
    ])
    expect(layout.unplaced).toContain('Nowhere-0')
    expect(layout.unplaced.length).toBeGreaterThan(300)
  })

  it('keeps logos off a road, and the road to the middle of shared sides', () => {
    const spec: HexMapSpec = {
      ...SPEC,
      paths: [{ kind: 'road', width: 0.6, tiles: ['Aa2', 'Aa3'], enter: 'NW' }],
    }
    // Enough logos to need all three of Alpha's tiles.
    const all = logos('Alpha', 18)
    const layout = layoutHexMap(spec, all)
    expect(layout.unplaced).toEqual([])
    const [first, second] = layout.pieces
    expect(first.tile).toBe('Aa2')
    // Where the first piece ends is where the second begins: the two tiles
    // are of one height.
    const end = first.points[first.points.length - 1]
    expect(second.points[0][0]).toBeCloseTo(end[0])
    expect(second.points[0][1]).toBeCloseTo(end[1])
    for (const logo of all) {
      const at = layout.positions.get(logo.id)!
      for (const piece of layout.pieces) {
        for (const [x, y] of piece.points) {
          expect(Math.hypot(at.x - x, at.y - y)).toBeGreaterThan(
            logo.radius + 0.3 - 1e-9
          )
        }
      }
    }
  })

  it('marks a fall only where the river steps down a side the viewer sees', () => {
    const river = (tiles: string[]): HexMapSpec => ({
      ...SPEC,
      paths: [{ kind: 'river', width: 0.4, tiles }],
    })
    const all = [...logos('Alpha', 30), ...logos('Beta', 30)]
    // Aa1 (3 high) down to Bb1 (2 high) across Aa1's south side.
    const south = layoutHexMap(river(['Aa1', 'Bb1']), all)
    expect(south.drops).toHaveLength(1)
    expect(south.drops[0].tile).toBe('Aa1')
    expect(south.drops[0].bottom[1] - south.drops[0].top[1]).toBeCloseTo(0.4)
    // Aa1 down to Aa2 across its north-east side: out of sight.
    expect(layoutHexMap(river(['Aa1', 'Aa2']), all).drops).toEqual([])
  })

  it('runs a river round the moated tile, not across it', () => {
    const layout = layoutHexMap(
      {
        ...SPEC,
        moat: 'Aa2',
        paths: [{ kind: 'river', width: 0.4, tiles: ['Aa1', 'Aa2', 'Aa3'] }],
      },
      logos('Alpha', 30)
    )
    const onMoat = layout.pieces.filter(piece => piece.tile === 'Aa2')
    expect(onMoat.filter(piece => piece.closed)).toHaveLength(1)
    expect(onMoat).toHaveLength(3)
  })

  it('throws on a map that contradicts itself', () => {
    const withPath = (tiles: string[], kind: 'road' | 'river' = 'road') => ({
      ...SPEC,
      paths: [{ kind, width: 0.4, tiles }],
    })
    expect(() => layoutHexMap(withPath(['Aa1', 'Aa3']), [])).toThrow(/touch/)
    expect(() => layoutHexMap(withPath(['Aa1', 'Zz9']), [])).toThrow(/Zz9/)
    expect(() => layoutHexMap(withPath(['Bb1', 'Aa1'], 'river'), [])).toThrow(
      /uphill/
    )
    expect(() =>
      layoutHexMap({ ...SPEC, tiles: SPEC.tiles.replace('Aa2', 'Aa4') }, [])
    ).toThrow(/numbered/)
    expect(() =>
      layoutHexMap({ ...SPEC, tiles: SPEC.tiles.replace('Aa2', 'Qq1') }, [])
    ).toThrow(/no district or feature/)
  })
})

describe('the Map 3.5 hex map', () => {
  // How many Large, Medium and Small logos each district held in the forked
  // base on 19 September 2026.
  const COUNTS: Record<string, [number, number, number]> = {
    'Alignment and control': [4, 4, 13],
    'Capabilities research': [3, 2, 1],
    'Career support and placement': [2, 4, 7],
    'Conceptual and foundations research': [1, 9, 11],
    'Evaluations and threat research': [1, 2, 7],
    'Field-building and local groups': [1, 4, 2],
    'Forums and online communities': [3, 0, 1],
    'Foundational and explanatory': [3, 8, 13],
    'Governments and multi-stakeholder bodies': [1, 3, 2],
    'Grantmakers and donor advisory': [8, 14, 6],
    'Grassroots campaigns': [1, 0, 7],
    'Hubs and coworking': [1, 3, 4],
    'Interpretability and model understanding': [0, 1, 5],
    'Introductory learning': [3, 2, 5],
    'Macrostrategy and forecasting': [0, 12, 7],
    'News and commentary': [4, 9, 17],
    'No longer active': [0, 0, 30],
    'Operations and services': [3, 3, 5],
    'Policy advocacy and lobbying': [1, 2, 8],
    'Policy and governance programs': [0, 3, 7],
    'Policy research and think tanks': [0, 9, 14],
    'Professional advocacy and communication': [1, 1, 7],
    'Standards, assurance and verification': [0, 1, 5],
    'Technical research programs': [7, 13, 10],
    'Tools, databases and research infrastructure': [1, 3, 5],
    'Venture capital and incubators': [0, 2, 7],
  }
  // The map's logo sizes, in grid units.
  const RADII = [0.62, 0.46, 0.31]
  const everywhere = Object.entries(COUNTS).flatMap(([district, counts]) =>
    counts.flatMap((count, size) =>
      logos(district, count, RADII[size]).map(logo => ({
        ...logo,
        id: `${logo.id}-${size}`,
      }))
    )
  )

  it('lists every district of that day', () => {
    expect(MAP_35_HEX_SPEC.districts.map(d => d.district).sort()).toEqual(
      Object.keys(COUNTS).sort()
    )
  })

  it('is well formed, with every road and river running tile to tile', () => {
    const layout = layoutHexMap(MAP_35_HEX_SPEC, everywhere)
    expect(layout.unplaced).toEqual([])
    expect(layout.pieces.length).toBeGreaterThan(10)
    // The river falls toward the viewer at least once.
    expect(layout.drops.some(drop => drop.kind === 'river')).toBe(true)
  })

  it('is one island, but for the closed orgs’ islet', () => {
    const layout = layoutHexMap(MAP_35_HEX_SPEC, everywhere)
    expect(strandedTiles(layout, MAP_35_HEX_ISLETS)).toEqual([])
  })

  it('has one realm across each of the castle’s six sides', () => {
    const layout = layoutHexMap(MAP_35_HEX_SPEC, everywhere)
    const castle = layout.tiles.find(tile => tile.ref === 'Ca1')!
    const around = HEX_DIRECTIONS.map(direction => {
      const { col, row } = hexNeighbor(castle, direction)
      return layout.tiles.find(tile => tile.col === col && tile.row === row)!
    })
    expect(around).toHaveLength(6)
    const realms = new Set(
      around.map(tile => (tile.state === 'water' ? 'cove' : tile.realm))
    )
    expect(realms.size).toBe(6)
  })
})
