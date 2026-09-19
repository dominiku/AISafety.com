import { describe, expect, it } from 'vitest'
import {
  layoutHexMap,
  strandedTiles,
  type HexLogo,
  type HexMapSpec,
} from './map-hex-layout'
import {
  MAP_35_HEX_ISLETS,
  MAP_35_HEX_NAMES,
  MAP_35_HEX_SPEC,
} from './map-hex-spec'
import { HEX_DIRECTIONS, hexNeighbor } from './map-hex'

// A little island: Alpha, the higher, along the north; Beta south of it; and
// a cove.
const SPEC: HexMapSpec = {
  view: { size: 3, squash: 0.6, lift: 0.4, origin: [5, 5] },
  tiles: `
    ..  ..  ..  ..  ..  ..
    ..  Aa  Aa  Aa  ..  ..
    ..  Bb  Bb  Bb  cv  ..
    ..  Bb  Bb  Bb  ..  ..
    ..  ..  ..  ..  ..  ..
  `,
  districts: [
    { code: 'Aa', district: 'Alpha', realm: 'North', height: 3 },
    { code: 'Bb', district: 'Beta', realm: 'South', height: 2 },
  ],
  features: [{ code: 'cv', kind: 'water', height: 0 }],
  river: { width: 0.8, branch: 0.75 },
  road: { width: 0.6 },
}
const withTiles = (
  tiles: string,
  more: Partial<HexMapSpec> = {}
): HexMapSpec => ({ ...SPEC, ...more, tiles })

const logos = (district: string, count: number, radius = 0.45): HexLogo[] =>
  Array.from({ length: count }, (_, n) => ({
    id: `${district}-${n}`,
    district,
    radius,
    name: `${district} ${String(n).padStart(3, '0')}`,
  }))

type Layout = ReturnType<typeof layoutHexMap>
const at = (layout: Layout, col: number, row: number) =>
  layout.tiles.find(tile => tile.col === col && tile.row === row)!
const states = (layout: Layout, code: string) =>
  layout.tiles
    .filter(tile => tile.code === code)
    .map(tile => tile.state)
    .sort()

describe('layoutHexMap', () => {
  it('gives a district only the tiles its logos need, the most inland first', () => {
    const few = layoutHexMap(SPEC, logos('Alpha', 3))
    expect(states(few, 'Aa')).toEqual(['sea', 'sea', 'used'])
    // The middle of this map lies between columns 2 and 3: the tile at the
    // west end is the farthest out, and the last to be taken.
    expect(at(few, 1, 1).state).toBe('sea')
    expect(few.unplaced).toEqual([])

    const many = layoutHexMap(SPEC, logos('Alpha', 14))
    expect(states(many, 'Aa')).toEqual(['sea', 'used', 'used'])
    expect(at(many, 1, 1).state).toBe('sea')
    expect(many.unplaced).toEqual([])
  })

  it('keeps a landlocked tile nobody needs as bare land, not a lake', () => {
    const layout = layoutHexMap(
      withTiles(`
        ..  ..  ..  ..  ..  ..  ..
        ..  Aa  Aa  Aa  Aa  Aa  ..
        ..  Aa  Aa  Bb  Aa  Aa  ..
        ..  Aa  Aa  Bb  Aa  Aa  ..
        ..  Aa  Aa  Aa  Aa  Aa  ..
        ..  ..  ..  ..  ..  ..  ..
      `),
      [...logos('Alpha', 150, 0.3), ...logos('Beta', 2)]
    )
    expect(states(layout, 'Bb')).toEqual(['spare', 'used'])
  })

  it('stands every logo on its own district, none overlapping', () => {
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

  it('draws no border between the tiles of one district', () => {
    const layout = layoutHexMap(SPEC, logos('Alpha', 14))
    const used = layout.tiles.filter(
      tile => tile.code === 'Aa' && tile.state === 'used'
    )
    expect(used).toHaveLength(2)
    // Each has five sides on the edge of the district and one on the join.
    for (const tile of used) {
      expect(tile.edges.filter(edge => !edge)).toHaveLength(1)
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

  it('joins the road up through the middle of shared sides, and keeps logos off it', () => {
    const all = logos('Alpha', 8)
    const layout = layoutHexMap(
      withTiles(SPEC.tiles.replace('Aa  Aa  Aa', 'Aa  Aa= Aa=')),
      all
    )
    expect(layout.unplaced).toEqual([])
    const road = layout.pieces.filter(piece => piece.kind === 'road')
    expect(road).toHaveLength(2)
    // One piece ends where the other begins: the tiles are of one height,
    // and each piece is let run on across the other's tile, without a seam.
    const ends = road.flatMap(piece => [
      piece.points[0],
      piece.points[piece.points.length - 1],
    ])
    const shared = ends.filter((a, i) =>
      ends.some(
        (b, j) => i !== j && Math.hypot(a[0] - b[0], a[1] - b[1]) < 1e-6
      )
    )
    expect(shared).toHaveLength(2)
    expect(road[0].clip).toHaveLength(2)
    // Road tiles are land whatever the logos need.
    expect(at(layout, 2, 1).state).toBe('used')
    expect(at(layout, 3, 1).state).toBe('used')
    for (const logo of all) {
      const spot = layout.positions.get(logo.id)!
      for (const piece of road) {
        for (const [x, y] of piece.points) {
          expect(Math.hypot(spot.x - x, spot.y - y)).toBeGreaterThan(
            logo.radius + 0.3 - 1e-9
          )
        }
      }
    }
  })

  it('runs the river downhill from its highest tile, with a fall where the viewer can see the step', () => {
    const tiles = SPEC.tiles
      .replace('..  Aa  Aa', '..  Aa~ Aa')
      .replace('..  Bb  Bb  Bb  cv', '..  Bb~ Bb  Bb  cv')
    const south = layoutHexMap(withTiles(tiles), [])
    expect(south.springs).toHaveLength(1)
    expect(south.springs[0].tile).toBe(at(south, 1, 1).ref)
    const step = south.drops.filter(drop => drop.tile === at(south, 1, 1).ref)
    expect(step).toHaveLength(1)
    expect(step[0].visible).toBe(true)
    expect(step[0].fall).toBeCloseTo(0.4)
    // It ends on the coast, so it runs out to sea: over a side the viewer
    // sees, so it falls the two levels from Beta to the water.
    expect(south.ends).toHaveLength(1)
    const mouth = south.drops.filter(drop => drop.tile === at(south, 1, 2).ref)
    expect(mouth).toHaveLength(1)
    expect(mouth[0].fall).toBeCloseTo(0.8)

    // With Beta the higher, the same river runs north and steps down a side
    // that faces away.
    const north = layoutHexMap(
      withTiles(tiles, {
        districts: [
          { ...SPEC.districts[0], height: 2 },
          { ...SPEC.districts[1], height: 3 },
        ],
      }),
      []
    )
    // Its step from Beta down to Alpha faces away; its mouth, on Alpha's
    // north-west side, does too, and has no fall.
    expect(north.drops).toHaveLength(1)
    expect(north.drops[0].visible).toBe(false)
  })

  it('parts the river where marked tiles branch, each arm narrower', () => {
    const layout = layoutHexMap(
      withTiles(
        `
        ..  ..  ..  ..  ..
        ..  Bb~ Aa~ Cc~ ..
        ..  ..  ..  ..  ..
      `,
        {
          districts: [
            ...SPEC.districts,
            { code: 'Cc', district: 'Gamma', realm: 'South', height: 2 },
          ],
        }
      ),
      []
    )
    const widths = layout.pieces.map(piece => piece.width).sort()
    expect(widths[0]).toBeCloseTo(0.6)
    expect(widths[1]).toBeCloseTo(0.6)
    expect(widths.slice(2)).toEqual([0.8, 0.8])
    expect(layout.ends).toHaveLength(2)
  })

  it('circles the keep with a moat and bridges the road over it', () => {
    const tiles = `
      ..  ..  ..  ..  ..
      ..  Aa~ Aa  Aa  ..
      ..  Aa  kp  Aa~ ..
      ..  ..  Aa= ..  ..
      ..  ..  ..  ..  ..
    `
    const features = [{ code: 'kp', kind: 'keep' as const, height: 3 }]
    const layout = layoutHexMap(withTiles(tiles, { features }), [])
    const moat = layout.pieces.filter(piece => piece.closed)
    expect(moat).toHaveLength(1)
    // A round through the middles of the tiles about the keep.
    for (const [col, row] of [
      [1, 1],
      [3, 2],
      [2, 3],
    ]) {
      const { center } = at(layout, col, row)
      expect(
        Math.min(
          ...moat[0].points.map(point =>
            Math.hypot(point[0] - center[0], point[1] - center[1])
          )
        )
      ).toBeLessThan(0.05)
    }
    // The river is no wider than the moat where it runs into it, and its
    // pieces there are marked to be drawn over the moat's bank.
    const joining = layout.pieces.filter(piece => piece.joinsMoat)
    expect(joining).toHaveLength(2)
    for (const piece of joining) {
      expect(Math.min(piece.width, piece.widthEnd!)).toBeLessThan(moat[0].width)
    }
    // Drawn once the tile in front of the keep is, over all seven tiles.
    expect(moat[0].tile).toBe(at(layout, 2, 3).ref)
    expect(moat[0].clip).toHaveLength(7)
    expect(layout.bridges).toHaveLength(1)
    expect(layout.ends.map(end => end.kind).sort()).toEqual(['river', 'road'])

    expect(() =>
      layoutHexMap(
        withTiles(tiles, { features: [{ ...features[0], height: 4 }] }),
        []
      )
    ).toThrow(/moat needs them level/)
  })

  it('climbs a road to a higher tile by a ramp on the lower one', () => {
    const layout = layoutHexMap(
      withTiles(
        SPEC.tiles
          .replace('..  Aa  Aa', '..  Aa= Aa')
          .replace('..  Bb  Bb  Bb  cv', '..  Bb= Bb  Bb  cv')
      ),
      []
    )
    const lower = layout.pieces.find(
      piece => piece.tile === at(layout, 1, 2).ref
    )!
    const upper = layout.pieces.find(
      piece => piece.tile === at(layout, 1, 1).ref
    )!
    expect(upper.ramps).toBeUndefined()
    expect(lower.ramps).toHaveLength(1)
    // The ramp's top meets the road on the higher tile, one level up.
    const ends = [lower.points[0], lower.points[lower.points.length - 1]]
    const join = upper.points.flatMap(point =>
      ends.map(end => Math.hypot(point[0] - end[0], point[1] - end[1]))
    )
    expect(Math.min(...join)).toBeLessThan(1e-6)
    expect(layout.drops).toEqual([])
  })

  it('gives a district its pier on a shore, and its river a dam where it falls in sight', () => {
    const tiles = SPEC.tiles
      .replace('..  Aa  Aa', '..  Aa~ Aa')
      .replace('..  Bb  Bb  Bb  cv', '..  Bb~ Bb  Bb  cv')
    const layout = layoutHexMap(
      withTiles(tiles, {
        districts: [
          { ...SPEC.districts[0], dam: true },
          { ...SPEC.districts[1], pier: true, cover: 'fields' },
        ],
      }),
      []
    )
    // Alpha's river falls south to Beta: over its dam.
    expect(layout.drops.filter(drop => drop.dam)).toHaveLength(1)
    // Beta's pier runs out into the cove, which it has on its east side.
    const piers = layout.ends.filter(end => end.kind === 'pier')
    expect(piers).toHaveLength(1)
    expect(piers[0].toward[0]).toBeGreaterThan(0)
    expect(at(layout, 1, 2).cover).toBe('fields')
  })

  it('lays a pier as a strip of planks over water, out from its district', () => {
    // Beta's pier stands on the tile east of its land, where the cove was.
    const tiles = SPEC.tiles.replace('Bb  Bb  Bb  cv', 'Bb  Bb  Bb  Bb+')
    const layout = layoutHexMap(withTiles(tiles), logos('Beta', 4))
    const pier = at(layout, 4, 2)
    // Water at sea level, still Beta's, with the deck at Beta's height.
    expect(pier.state).toBe('water')
    expect(pier.height).toBe(0)
    expect(pier.district).toBe('Beta')
    expect(pier.deck?.height).toBe(2)
    // The strip is narrower than the tile, and stops short of its far side.
    const xs = (points: [number, number][]) => points.map(point => point[0])
    const deck = pier.deck!.shape
    expect(Math.max(...xs(deck))).toBeLessThan(Math.max(...xs(pier.top)) - 0.5)
    // It counts as Beta's under the pointer, and the water beside it does not.
    const [x, y] = deck.reduce(
      (sum, point) => [
        sum[0] + point[0] / deck.length,
        sum[1] + point[1] / deck.length,
      ],
      [0, 0]
    )
    expect(layout.districtAt(x, y)).toBe('Beta')
    // A pier runs straight, and starts from solid ground.
    expect(() =>
      layoutHexMap(
        withTiles(SPEC.tiles.replace('Bb  Bb  Bb  ..', 'Bb  Bb  Bb+ ..')),
        []
      )
    ).toThrow(/a pier runs straight/)
    expect(() =>
      layoutHexMap(
        withTiles('..  ..  ..  ..\n..  Aa+ Aa+ ..\n..  ..  ..  ..'),
        []
      )
    ).toThrow(/starts from a tile of solid ground/)
  })

  it('marks the tiles of an escarpment, and lays a crater as land of its own', () => {
    const layout = layoutHexMap(
      withTiles(SPEC.tiles.replace('Bb  Bb  Bb  cv', 'Bb  Bb  Bb  cr'), {
        districts: [{ ...SPEC.districts[0], scarp: true }, SPEC.districts[1]],
        features: [{ code: 'cr', kind: 'crater', realm: 'South', height: 4 }],
        takeAllTiles: true,
      }),
      [...logos('Alpha', 1), ...logos('Beta', 1)]
    )
    expect(at(layout, 1, 1).scarp).toBe(true)
    expect(at(layout, 1, 2).scarp).toBe(false)
    // An escarpment's sides lean out, a crater's too; ordinary land is sheer.
    expect(at(layout, 1, 1).slope).toBeGreaterThan(0)
    expect(at(layout, 4, 2).slope).toBeGreaterThan(0)
    expect(at(layout, 1, 2).slope).toBe(0)
    expect(at(layout, 4, 2).state).toBe('crater')
    expect(at(layout, 4, 2).height).toBe(4)
  })

  it('takes up the tiles a district is told to, however few its logos', () => {
    const layout = layoutHexMap(
      {
        ...SPEC,
        districts: [{ ...SPEC.districts[0], minTiles: 3 }, SPEC.districts[1]],
      },
      logos('Alpha', 1)
    )
    expect(states(layout, 'Aa')).toEqual(['used', 'used', 'used'])
  })

  it('throws on a map that contradicts itself', () => {
    const gamma = {
      districts: [
        ...SPEC.districts,
        { code: 'Cc', district: 'Gamma', realm: 'South', height: 3 },
      ],
    }
    expect(() =>
      layoutHexMap(
        withTiles(
          '..  ..  ..\n..  Aa~ ..\n..  Bb~ ..\n..  Cc~ ..\n..  ..  ..',
          gamma
        ),
        []
      )
    ).toThrow(/uphill/)
    expect(() =>
      layoutHexMap(withTiles('..  Aa~ ..  Aa~ ..\n..  Aa  Aa  Aa  ..'), [])
    ).toThrow(/does not touch the rest of the river/)
    expect(() => layoutHexMap(withTiles('..  Aa  ..  Aa  ..'), [])).toThrow(
      /more than one part/
    )
    expect(() => layoutHexMap(withTiles('..  Qq  ..'), [])).toThrow(
      /no district or feature/
    )
    expect(() =>
      layoutHexMap(
        { ...SPEC, districts: [{ ...SPEC.districts[0], height: 0 }] },
        []
      )
    ).toThrow(/height above 0/)
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
  const layout = layoutHexMap(MAP_35_HEX_SPEC, everywhere)

  it('lists every district of that day, and has room for every logo', () => {
    expect(MAP_35_HEX_SPEC.districts.map(d => d.district).sort()).toEqual(
      Object.keys(COUNTS).sort()
    )
    expect(layout.unplaced).toEqual([])
  })

  it('lays the closed orgs on open water, as sunken ships', () => {
    const wrecks = layout.tiles.filter(tile => tile.code === 'Gy')
    expect(wrecks.length).toBeGreaterThan(0)
    for (const tile of wrecks) {
      expect(tile.sunken).toBe(true)
      expect(tile.height).toBe(0)
    }
  })

  it('has a working name, all different, for every realm and district', () => {
    const named = MAP_35_HEX_SPEC.districts.flatMap(d => [d.realm, d.district])
    for (const name of named) expect(MAP_35_HEX_NAMES[name]).toBeTruthy()
    const labels = Object.values(MAP_35_HEX_NAMES)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('is one island, but for the closed orgs’ islet', () => {
    expect(strandedTiles(layout, MAP_35_HEX_ISLETS)).toEqual([])
  })

  it('makes the castle seven tiles: the keep and Career support round it', () => {
    const keep = layout.tiles.find(tile => tile.state === 'keep')!
    const ring = HEX_DIRECTIONS.map(direction => {
      const { col, row } = hexNeighbor(keep, direction)
      return layout.tiles.find(tile => tile.col === col && tile.row === row)!
    })
    for (const tile of ring) {
      expect(tile.district).toBe('Career support and placement')
      expect(tile.state).toBe('used')
    }
    // Those six are all it has: its logos may stand over the moat.
    expect(
      layout.tiles.filter(tile => tile.code === 'Ca' && tile.state === 'used')
    ).toHaveLength(6)
    const moat = layout.pieces.find(piece => piece.closed)!
    ring.forEach(tile => {
      expect(
        Math.min(
          ...moat.points.map(point =>
            Math.hypot(point[0] - tile.center[0], point[1] - tile.center[1])
          )
        )
      ).toBeLessThan(0.05)
    })
  })

  it('has a delta of several mouths, and falls the viewer can see', () => {
    expect(
      layout.ends.filter(end => end.kind === 'river').length
    ).toBeGreaterThanOrEqual(3)
    expect(
      layout.drops.filter(drop => drop.kind === 'river' && drop.visible).length
    ).toBeGreaterThanOrEqual(3)
  })
})
