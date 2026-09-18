// PROTOTYPE Map 3.5: works out the district borders and every pin's position,
// so the map has the same density of logos everywhere.
//
// The geography is given (map-realm-spec.ts): the island, the straight-edged
// realm borders, the Advocacy anchorage off the north-east coast, and an
// anchor for each district. This module settles the rest:
//
//   1. The island's coast is cut into facets, like the classic map's. Closed
//      orgs and map furniture stay where Airtable puts them, and the coast
//      keeps clear of them.
//   2. Each realm is shared out among its districts, every district getting
//      room in proportion to the logos it holds (a large logo counts as four
//      small ones, a medium as two). The districts are the cells of a power
//      diagram around their anchors: straight borders and no spikes.
//   3. Inside a district the pins push apart until each has its own share of
//      the district, again in proportion to its size. On land they keep back
//      from the coast; ships in the anchorage keep off it.
//
// Everything is deterministic: the same records give the same map. Pure
// module with no dependencies, so it can be unit tested.

export interface LayoutPin {
  id: string
  realm: string
  district: string
  // The draft position from Airtable, in map grid units.
  x: number
  y: number
  scale: string | null
}

export type Point = [number, number]

export interface RealmMapSpec {
  // The island, before its coast is cut into facets.
  island: { cx: number; cy: number; rx: number; ry: number }
  // Land realms by their Realm name in Airtable. The polygons overshoot the
  // island and are cut off by its coast.
  realms: Record<string, Point[]>
  // The one realm that is water: ships at anchor in the part of this box that
  // lies off the island. Matched on the start of the Realm name.
  anchorage: { realmStartsWith: string; box: Point[] }
  // Where each district is centered, by its District name in Airtable.
  districtAnchors: Record<string, Point>
  landmarks: {
    arrivalHarbour: Point
    crossroads: Point
    departureHarbour: Point
    controlDam: Point
  }
}

export interface RealmLayout {
  positions: Map<string, { x: number; y: number }>
  // Everything below is in map grid units.
  coast: Point[]
  // A realm's polygon runs out past the coast. A water realm lies off it.
  realms: { realm: string; polygon: Point[]; water: boolean }[]
  // A district's polygon is its whole cell: draw it cut off by its realm's
  // polygon, and by the coast (inside it for land, outside it for water).
  districts: { district: string; realm: string; polygon: Point[] }[]
  // Share of its realm each district ended up with, by district name.
  realmShare: Map<string, number>
}

const GRID_WIDTH = 60
const GRID_HEIGHT = 32.7
const STEP = 0.25

// The coast is the spec's ellipse with a slow wobble, cut into facets.
const COAST_FACETS = 46
// Grid units of sea kept around every pin that is not on the land.
const KEEP_CLEAR_RADIUS = 2.4
// Grid units a pin's middle keeps from the coast, so its logo and the name
// under it stay on the land.
const COAST_MARGIN = 1.2
// Grid units a ship in the anchorage keeps from the coast.
const SHIP_MARGIN = 1.5

/** Land a logo takes, relative to a small one. Matches the pin sizes on the
 *  map: a Large logo is twice as wide as a Small one. */
export function pinFootprint(scale: string | null): number {
  const size = (scale ?? 'Medium').toLowerCase()
  return size === 'large' ? 4 : size === 'small' ? 1 : 2
}

function onIsland(x: number, y: number, island: RealmMapSpec['island']) {
  const dx = (x - island.cx) / island.rx
  const dy = (y - island.cy) / island.ry
  const angle = Math.atan2(dy, dx)
  const wobble =
    1 + 0.02 * Math.sin(3 * angle + 0.6) + 0.015 * Math.sin(7 * angle + 2.1)
  return Math.hypot(dx, dy) <= wobble
}

/** The coast: from the middle of the island, out along each of COAST_FACETS
 *  bearings until the island ends or an off-land pin is too near. */
function coastAround(
  island: RealmMapSpec['island'],
  keepClear: { x: number; y: number }[]
): Point[] {
  const coast: Point[] = []
  for (let facet = 0; facet < COAST_FACETS; facet++) {
    // Uneven bearings, so the facets differ in length.
    const bearing =
      ((facet + 0.35 * Math.sin(facet * 2.3)) / COAST_FACETS) * 2 * Math.PI
    // Stretched to the island's proportions so facets are even along it.
    const stepX = Math.cos(bearing) * island.rx * 0.004
    const stepY = Math.sin(bearing) * island.ry * 0.004
    let x = island.cx
    let y = island.cy
    for (;;) {
      const nextX = x + stepX
      const nextY = y + stepY
      const blocked =
        !onIsland(nextX, nextY, island) ||
        keepClear.some(
          p => Math.hypot(p.x - nextX, p.y - nextY) < KEEP_CLEAR_RADIUS
        )
      if (blocked) break
      x = nextX
      y = nextY
    }
    coast.push([x, y])
  }
  return coast
}

function insidePolygon(x: number, y: number, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

interface Site {
  x: number
  y: number
  // Its anchor. A site settles halfway between there and the middle of what
  // it holds, so districts fill their realm without trading places.
  homeX: number
  homeY: number
  // Share of the parent's samples this site should end up with.
  share: number
  // Power-diagram weight, in squared grid units.
  weight: number
}

const siteAt = (at: { x: number; y: number }, share: number): Site => ({
  ...at,
  homeX: at.x,
  homeY: at.y,
  share,
  weight: 0,
})

/**
 * Shares `samples` (indices into xs/ys) out among the sites so each gets its
 * share of them. Returns, per sample, the index of the site that holds it;
 * the sites are left as they were for that last sharing, so cellOf() traces
 * the same regions.
 */
function shareOut(
  samples: number[],
  xs: Float32Array,
  ys: Float32Array,
  sites: Site[],
  rounds: number
): Int16Array {
  const held = new Int16Array(samples.length)
  if (sites.length === 1) return held
  const area = samples.length * STEP * STEP
  for (let round = 0; round < rounds; round++) {
    const count = new Array<number>(sites.length).fill(0)
    const sumX = new Array<number>(sites.length).fill(0)
    const sumY = new Array<number>(sites.length).fill(0)
    for (let s = 0; s < samples.length; s++) {
      const x = xs[samples[s]]
      const y = ys[samples[s]]
      let best = 0
      let bestDistance = Infinity
      for (let i = 0; i < sites.length; i++) {
        const dx = x - sites[i].x
        const dy = y - sites[i].y
        const distance = dx * dx + dy * dy - sites[i].weight
        if (distance < bestDistance) {
          bestDistance = distance
          best = i
        }
      }
      held[s] = best
      count[best]++
      sumX[best] += x
      sumY[best] += y
    }
    if (round === rounds - 1) break
    sites.forEach((site, i) => {
      if (count[i] > 0) {
        site.x = (site.homeX + sumX[i] / count[i]) / 2
        site.y = (site.homeY + sumY[i] / count[i]) / 2
      }
      // Too little land: weigh more, and the borders move outward.
      const shortfall = site.share - count[i] / samples.length
      site.weight += 0.3 * shortfall * area
    })
  }
  return held
}

/** Site i's cell of the power diagram, cut out of `within` (a convex
 *  polygon): everything nearer to it than to any other site. */
function cellOf(sites: Site[], i: number, within: Point[]): Point[] {
  let cell = within
  const me = sites[i]
  sites.forEach((other, j) => {
    if (j === i || cell.length === 0) return
    // Inside is a·x + b·y <= c.
    const a = 2 * (other.x - me.x)
    const b = 2 * (other.y - me.y)
    const c =
      other.x ** 2 +
      other.y ** 2 -
      other.weight -
      (me.x ** 2 + me.y ** 2 - me.weight)
    const kept: Point[] = []
    cell.forEach((from, k) => {
      const to = cell[(k + 1) % cell.length]
      const fromIn = a * from[0] + b * from[1] <= c
      const toIn = a * to[0] + b * to[1] <= c
      if (fromIn) kept.push(from)
      if (fromIn !== toIn) {
        const t =
          (c - a * from[0] - b * from[1]) /
          (a * (to[0] - from[0]) + b * (to[1] - from[1]))
        kept.push([
          from[0] + t * (to[0] - from[0]),
          from[1] + t * (to[1] - from[1]),
        ])
      }
    })
    cell = kept
  })
  return cell
}

/**
 * Spreads a district's pins over its samples: each sample goes to the pin
 * nearest it (a bigger logo reaching further), and each pin moves to the
 * middle of its samples, until they settle.
 */
function spreadPins(
  samples: number[],
  xs: Float32Array,
  ys: Float32Array,
  pins: { x: number; y: number; footprint: number }[],
  rounds: number
) {
  for (let round = 0; round < rounds; round++) {
    const count = new Array<number>(pins.length).fill(0)
    const sumX = new Array<number>(pins.length).fill(0)
    const sumY = new Array<number>(pins.length).fill(0)
    for (const sample of samples) {
      let best = 0
      let bestDistance = Infinity
      for (let i = 0; i < pins.length; i++) {
        const dx = xs[sample] - pins[i].x
        const dy = ys[sample] - pins[i].y
        const distance = (dx * dx + dy * dy) / pins[i].footprint
        if (distance < bestDistance) {
          bestDistance = distance
          best = i
        }
      }
      count[best]++
      sumX[best] += xs[sample]
      sumY[best] += ys[sample]
    }
    pins.forEach((pin, i) => {
      if (count[i] === 0) {
        // Drafted so far off that no land is nearest it: drop it onto the
        // district and let the next rounds find it room.
        const sample = samples[(i * 7919) % samples.length]
        pin.x = xs[sample]
        pin.y = ys[sample]
        return
      }
      pin.x = sumX[i] / count[i]
      pin.y = sumY[i] / count[i]
    })
  }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function middleOf(pins: LayoutPin[]): { x: number; y: number } {
  return { x: median(pins.map(p => p.x)), y: median(pins.map(p => p.y)) }
}

function footprintOf(pins: LayoutPin[]): number {
  return pins.reduce((sum, pin) => sum + pinFootprint(pin.scale), 0)
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const group = groups.get(key(item))
    if (group) group.push(item)
    else groups.set(key(item), [item])
  }
  // Sorted, so the result never depends on the order records arrive in.
  return new Map([...groups].sort(([a], [b]) => a.localeCompare(b)))
}

/**
 * @param pins      the orgs to lay out
 * @param keepClear pins that stay where they are (closed orgs, map furniture)
 */
export function layoutRealmMap(
  pins: LayoutPin[],
  keepClear: { x: number; y: number }[],
  spec: RealmMapSpec
): RealmLayout {
  const coast = coastAround(spec.island, keepClear)
  const layout: RealmLayout = {
    positions: new Map(),
    coast,
    realms: [],
    districts: [],
    realmShare: new Map(),
  }

  const cols = Math.ceil(GRID_WIDTH / STEP)
  const rows = Math.ceil(GRID_HEIGHT / STEP)
  const xs = new Float32Array(cols * rows)
  const ys = new Float32Array(cols * rows)
  const isLand = new Uint8Array(cols * rows)
  for (let index = 0; index < cols * rows; index++) {
    xs[index] = ((index % cols) + 0.5) * STEP
    ys[index] = (Math.floor(index / cols) + 0.5) * STEP
    if (insidePolygon(xs[index], ys[index], coast)) isLand[index] = 1
  }
  // Whether everything `margin` grid units around a sample is land (or, for
  // a ship, sea).
  const clearOf = (index: number, margin: number, land: 0 | 1) => {
    const reach = Math.round(margin / STEP)
    const col = index % cols
    const row = Math.floor(index / cols)
    for (let turn = 0; turn < 8; turn++) {
      const c = col + Math.round(Math.cos((turn * Math.PI) / 4) * reach)
      const r = row + Math.round(Math.sin((turn * Math.PI) / 4) * reach)
      const inFrame = c >= 0 && c < cols && r >= 0 && r < rows
      // Past the frame is sea.
      if ((inFrame ? isLand[r * cols + c] : 0) !== land) return false
    }
    return true
  }
  const everySample = Array.from({ length: cols * rows }, (_, i) => i)
  const everywhere: Point[] = [
    [-GRID_WIDTH, -GRID_HEIGHT],
    [GRID_WIDTH * 2, -GRID_HEIGHT],
    [GRID_WIDTH * 2, GRID_HEIGHT * 2],
    [-GRID_WIDTH, GRID_HEIGHT * 2],
  ]

  for (const [realm, inRealm] of groupBy(pins, pin => pin.realm)) {
    const water = realm.startsWith(spec.anchorage.realmStartsWith)
    const polygon = water ? spec.anchorage.box : spec.realms[realm]
    if (!polygon) {
      console.warn(
        `[map-realm-layout] No borders for realm "${realm}"; its pins keep their draft positions`
      )
      continue
    }
    layout.realms.push({ realm, polygon, water })
    const room = everySample.filter(
      i =>
        isLand[i] === (water ? 0 : 1) &&
        insidePolygon(xs[i], ys[i], polygon) &&
        (!water ||
          (clearOf(i, SHIP_MARGIN, 0) &&
            !keepClear.some(
              p => Math.hypot(p.x - xs[i], p.y - ys[i]) < KEEP_CLEAR_RADIUS
            )))
    )
    if (room.length === 0) {
      console.warn(`[map-realm-layout] No room for realm "${realm}"`)
      continue
    }

    const byDistrict = groupBy(inRealm, pin => pin.district)
    const realmFootprint = footprintOf(inRealm)
    const sites = [...byDistrict.entries()].map(([district, inDistrict]) => {
      const anchor = spec.districtAnchors[district]
      if (!anchor) {
        console.warn(
          `[map-realm-layout] No anchor for district "${district}"; using its draft positions`
        )
      }
      return siteAt(
        anchor ? { x: anchor[0], y: anchor[1] } : middleOf(inDistrict),
        footprintOf(inDistrict) / realmFootprint
      )
    })
    const districtOf = shareOut(room, xs, ys, sites, 300)

    ;[...byDistrict.entries()].forEach(([district, inDistrict], index) => {
      const districtRoom = room.filter((_, s) => districtOf[s] === index)
      layout.districts.push({
        district,
        realm,
        polygon: cellOf(sites, index, everywhere),
      })
      layout.realmShare.set(district, districtRoom.length / room.length)
      if (districtRoom.length === 0) {
        console.warn(`[map-realm-layout] No room left for "${district}"`)
        return
      }

      // Start each pin where the draft has it relative to its neighbors,
      // carried over to where the district ended up. A sliver of offset
      // keeps pins drafted on the same spot from staying stuck together.
      const from = middleOf(inDistrict)
      const to = {
        x:
          districtRoom.reduce((sum, i) => sum + xs[i], 0) / districtRoom.length,
        y:
          districtRoom.reduce((sum, i) => sum + ys[i], 0) / districtRoom.length,
      }
      const moving = inDistrict.map((pin, i) => ({
        x: to.x + (pin.x - from.x) + Math.cos(i * 2.4) * 0.01 * (i + 1),
        y: to.y + (pin.y - from.y) + Math.sin(i * 2.4) * 0.01 * (i + 1),
        footprint: pinFootprint(pin.scale),
      }))
      const standing = water
        ? districtRoom
        : districtRoom.filter(i => clearOf(i, COAST_MARGIN, 1))
      spreadPins(
        standing.length >= moving.length ? standing : districtRoom,
        xs,
        ys,
        moving,
        60
      )
      inDistrict.forEach((pin, i) => {
        layout.positions.set(pin.id, {
          x: Math.round(moving[i].x * 10) / 10,
          y: Math.round(moving[i].y * 10) / 10,
        })
      })
    })
  }

  return layout
}
