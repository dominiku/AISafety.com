import { describe, expect, it } from 'vitest'
import {
  layoutRealmMap,
  pinFootprint,
  type LayoutPin,
  type Point,
  type RealmMapSpec,
} from './map-realm-layout'
import { MAP_35_SPEC } from './map-realm-spec'

// A small island split down the middle, with a cove in its north shore.
const spec: RealmMapSpec = {
  island: { cx: 30, cy: 17, rx: 22, ry: 12 },
  realms: {
    West: [
      [0, 0],
      [30, 0],
      [30, 34],
      [0, 34],
    ],
    East: [
      [30, 0],
      [64, 0],
      [64, 34],
      [30, 34],
    ],
  },
  anchorage: {
    realmStartsWith: 'Ships',
    box: [
      [38, -2],
      [46, -2],
      [46, 12],
      [38, 12],
    ],
    water: [
      [38, -2],
      [46, -2],
      [46, 12],
      [38, 12],
    ],
  },
  districtAnchors: {
    'West one': [16, 21],
    'West two': [20, 10],
    'East one': [38, 12],
    'East two': [44, 22],
    Boats: [42, 9],
  },
  landmarks: MAP_35_SPEC.landmarks,
  // The road from the west shore to (33, 18.5) splits the West realm.
  roads: [
    {
      realm: 'West',
      from: [12, 8],
      fromShore: true,
      settleFrom: true,
      to: [33, 18.5],
      left: ['West two'],
      right: ['West one'],
    },
  ],
  // A town in the East realm.
  blocks: { 'East two': { seed: [44, 22] } },
}

// Every district is drafted as a tight clump, one pin far out to sea.
function pinsOf(
  realm: string,
  district: string,
  count: number,
  x: number,
  y: number,
  scale = 'Medium'
): LayoutPin[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${district}-${i}`,
    realm,
    district,
    x: x + (i % 5) * 0.4,
    y: y + Math.floor(i / 5) * 0.4,
    scale,
  }))
}

const pins = [
  ...pinsOf('West', 'West one', 30, 10, 12),
  ...pinsOf('West', 'West two', 10, 12, 22),
  ...pinsOf('East', 'East one', 10, 40, 10, 'Large'),
  ...pinsOf('East', 'East two', 10, 40, 22, 'Small'),
  ...pinsOf('Ships and sailors', 'Boats', 6, 42, 8),
  {
    id: 'far',
    realm: 'East',
    district: 'East two',
    x: 200,
    y: -50,
    scale: 'Small',
  },
]
const graveyard = [{ x: 46, y: 24 }]
const layout = layoutRealmMap(pins, graveyard, spec)

function inside([x, y]: Point, polygon: Point[]): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit
    }
  }
  return hit
}

const at = (pin: LayoutPin): Point => {
  const spot = layout.positions.get(pin.id)
  if (!spot) throw new Error(`${pin.id} was not placed`)
  return [spot.x, spot.y]
}

describe('layoutRealmMap', () => {
  it('puts every pin in its own district, inside its realm', () => {
    for (const pin of pins) {
      const district = layout.districts.find(d => d.district === pin.district)!
      const realm = layout.realms.find(r => r.realm === pin.realm)!
      expect(
        district.pieces.some(piece => inside(at(pin), piece)),
        pin.id
      ).toBe(true)
      expect(inside(at(pin), realm.polygon), pin.id).toBe(true)
    }
  })

  it('keeps land pins on the land and ships in the cove', () => {
    for (const pin of pins) {
      const ship = pin.realm.startsWith('Ships')
      expect(inside(at(pin), layout.coast), pin.id).toBe(true)
      expect(inside(at(pin), layout.cove), pin.id).toBe(ship)
    }
  })

  it('shapes the coast so each realm has room in proportion to its logos', () => {
    const footprint = (of: LayoutPin[]) =>
      of.reduce((sum, p) => sum + pinFootprint(p.scale), 0)
    for (const realm of ['West', 'East']) {
      const wanted =
        footprint(pins.filter(p => p.realm === realm)) / footprint(pins)
      expect(layout.landShare.get(realm)! / wanted, realm).toBeGreaterThan(0.9)
      expect(layout.landShare.get(realm)! / wanted, realm).toBeLessThan(1.1)
    }
    // The harbour realm too, though a cove takes what room the coast gives.
    expect(layout.landShare.get('Ships and sailors')).toBeGreaterThan(0)
  })

  it('gives each district room in proportion to its logos', () => {
    for (const { district, realm } of layout.districts) {
      const footprint = (of: LayoutPin[]) =>
        of.reduce((sum, p) => sum + pinFootprint(p.scale), 0)
      const wanted =
        footprint(pins.filter(p => p.district === district)) /
        footprint(pins.filter(p => p.realm === realm))
      const got = layout.realmShare.get(district)! / wanted
      expect(got, district).toBeGreaterThan(0.85)
      expect(got, district).toBeLessThan(1.15)
    }
  })

  it('spreads clumped pins out', () => {
    const placed = pins.map(at)
    let closest = Infinity
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        closest = Math.min(
          closest,
          Math.hypot(placed[i][0] - placed[j][0], placed[i][1] - placed[j][1])
        )
      }
    }
    // Drafted 0.4 apart.
    expect(closest).toBeGreaterThan(0.8)
  })

  it('keeps districts to their own side of the road', () => {
    const [hx, hy] = layout.landmarks.arrivalHarbour
    const [cx, cy] = layout.landmarks.crossroads
    const southOfRoad = ([x, y]: Point) =>
      (cx - hx) * (y - hy) - (cy - hy) * (x - hx) > 0
    // Pins right by the road are left out: positions are rounded.
    const clear = (pin: LayoutPin) => {
      const [x, y] = at(pin)
      const off =
        Math.abs((cx - hx) * (y - hy) - (cy - hy) * (x - hx)) /
        Math.hypot(cx - hx, cy - hy)
      return off > 0.5
    }
    for (const pin of pins.filter(clear)) {
      if (pin.district === 'West two') expect(southOfRoad(at(pin))).toBe(false)
      if (pin.district === 'West one') expect(southOfRoad(at(pin))).toBe(true)
    }
  })

  it('makes a town a square block', () => {
    const town = layout.districts.find(d => d.district === 'East two')!
    expect(town.block).toBe(true)
    expect(town.pieces).toHaveLength(1)
    const xs = town.pieces[0].map(p => p[0])
    const ys = town.pieces[0].map(p => p[1])
    const width = Math.max(...xs) - Math.min(...xs)
    const height = Math.max(...ys) - Math.min(...ys)
    expect(width / height).toBeGreaterThan(0.75)
    expect(width / height).toBeLessThan(1.33)
  })

  it('grows a town to the outline the spec gives it', () => {
    // A lopsided diamond around the seed.
    const unit: Point[] = [
      [0, -0.6],
      [0.5, 0],
      [0, 0.4],
      [-0.4, 0],
    ]
    const hub = layoutRealmMap(pins, graveyard, {
      ...spec,
      blocks: { 'East two': { seed: [44, 22], outline: unit } },
    })
    const town = hub.districts.find(d => d.district === 'East two')!
    const [outline] = town.pieces
    // The same shape, scaled up about the seed.
    const scale = (outline[1][0] - 44) / unit[1][0]
    expect(scale).toBeGreaterThan(1)
    outline.forEach(([x, y], n) => {
      expect(x).toBeCloseTo(44 + unit[n][0] * scale, 5)
      expect(y).toBeCloseTo(22 + unit[n][1] * scale, 5)
    })
    for (const pin of pins.filter(p => p.district === 'East two')) {
      const spot = hub.positions.get(pin.id)!
      expect(inside([spot.x, spot.y], outline), pin.id).toBe(true)
    }
  })

  it('says which district a spot on the map is in', () => {
    for (const pin of pins) {
      const [x, y] = at(pin)
      expect(layout.districtAt(x, y), pin.id).toBe(pin.district)
    }
    expect(layout.districtAt(1, 1)).toBeNull()
  })

  it('draws the coast clear of the pins that stay put', () => {
    expect(inside([46, 24], layout.coast)).toBe(false)
    // The same spot on the other side of the island is land.
    expect(inside([16, 22], layout.coast)).toBe(true)
  })

  it('leaves a realm with no borders where the draft has it', () => {
    const stray = { ...pins[0], id: 'stray', realm: 'Nowhere' }
    const withStray = layoutRealmMap([...pins, stray], graveyard, spec)
    expect(withStray.positions.has('stray')).toBe(false)
  }, 20_000)

  it('gives the same map for the same records in any order', () => {
    const again = layoutRealmMap([...pins].reverse(), graveyard, spec)
    expect(again.districts.map(d => d.pieces)).toEqual(
      layout.districts.map(d => d.pieces)
    )
  }, 20_000)
})

describe('MAP_35_SPEC', () => {
  it('anchors every district inside its realm', () => {
    // Matched by position alone, so a typo in the borders or the anchors
    // shows up. The bay is cut out of the land realms' polygons, so an anchor
    // in it is a ship's.
    const regions = Object.values(MAP_35_SPEC.realms)
    for (const [district, anchor] of Object.entries(
      MAP_35_SPEC.districtAnchors
    )) {
      if (inside(anchor, MAP_35_SPEC.anchorage.box)) continue
      expect(
        regions.filter(polygon => inside(anchor, polygon)).length,
        district
      ).toBe(1)
    }
  })
})
