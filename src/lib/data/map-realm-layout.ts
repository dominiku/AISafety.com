// PROTOTYPE Map 3.5: works out the island, the district borders and every
// pin's position, so the map has the same density of logos everywhere and
// each region's size shows how much goes on in it.
//
// The arrangement is given (map-realm-spec.ts): where the realm borders run
// from the middle of the island, the Advocacy anchorage off the north-east
// coast, an anchor for each district and the landmarks. This module settles
// the rest:
//
//   1. The coast. A realm's border lines are fixed, so its size is set by how
//      far out its shore lies: the coast is pushed out along a realm holding
//      more than its land and pulled in along one holding less, until every
//      realm's land is in proportion to its logos (a large logo counts as
//      four small ones, a medium as two). That, some slow swells and a bay at
//      each harbour make the island an island and not an oval. Closed orgs
//      and map furniture stay where Airtable puts them, and the coast keeps
//      clear of them.
//   2. The districts. Each realm is shared out among its districts in the
//      same proportion, as the cells of a power diagram around their anchors:
//      compact regions, no spikes. Where the road runs through a realm it is
//      a border too: districts keep to their own side of it.
//   3. The pins. Inside a district they push apart until each has its own
//      share of it, again in proportion to its size. On land they keep back
//      from the coast; ships in the anchorage keep off it.
//   4. The lie of the land. All of the above is worked out with ruler-straight
//      borders, then the whole map (borders, coast, road, pins) is put through
//      one gentle warp, so every line wanders a little the way borders on a
//      map do, and lines that met still meet.
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

export interface RealmLandmarks {
  arrivalHarbour: Point
  crossroads: Point
  departureHarbour: Point
  controlDam: Point
}

export interface RealmMapSpec {
  // The island the realm borders were drawn for. The coast starts from this
  // ellipse and is reshaped around it.
  island: { cx: number; cy: number; rx: number; ry: number }
  // Land realms by their Realm name in Airtable. The polygons overshoot the
  // island and are cut off by its coast.
  realms: Record<string, Point[]>
  // The one realm that is water: ships at anchor in the part of this box that
  // lies off the island. Matched on the start of the Realm name.
  anchorage: { realmStartsWith: string; box: Point[] }
  // Where each district is centered, by its District name in Airtable.
  districtAnchors: Record<string, Point>
  landmarks: RealmLandmarks
  // A realm the road runs through, where the road is itself a border: the
  // districts listed lie wholly to its north or south (walking the road from
  // the arrival harbour to the crossroads). Any other district of that realm
  // may lie across the road.
  roadside?: { realm: string; north: string[]; south: string[] }
}

export interface RealmLayout {
  positions: Map<string, { x: number; y: number }>
  // Everything below is in map grid units, warped and ready to draw.
  coast: Point[]
  // A realm's polygon runs out past the coast. A water realm lies off it.
  realms: { realm: string; polygon: Point[]; water: boolean }[]
  // A district's pieces are its whole cell (two pieces when it lies across
  // the road): draw them cut off by the realm's polygon, and by the coast
  // (inside it for land, outside it for water).
  districts: { district: string; realm: string; pieces: Point[][] }[]
  // The harbours moved onto the coast as it came out.
  landmarks: RealmLandmarks
  // The newcomer's road: in from the arrival harbour to the crossroads, then
  // a fork east to the departure harbour, one south-east past the dam, and
  // one north-east to the shore the anchorage lies off.
  roads: Point[][]
  // Share of the land each land realm ended up with, by realm name.
  landShare: Map<string, number>
  // Share of its realm each district ended up with, by district name.
  realmShare: Map<string, number>
}

const GRID_WIDTH = 60
const GRID_HEIGHT = 32.7
const STEP = 0.25

const COAST_POINTS = 180
// How far a realm's shore may move in or out to fit what the realm holds.
const SHORE_RANGE: [number, number] = [0.82, 1.22]
// Grid units of sea kept around every pin that is not on the land.
const KEEP_CLEAR_RADIUS = 3
// Grid units a pin's middle keeps from the coast, so its logo and the name
// under it stay on the land.
const COAST_MARGIN = 1.2
// Grid units a ship in the anchorage keeps from the coast.
const SHIP_MARGIN = 1.5
// Longest stretch of a line left straight before it is warped.
const TRACE_STEP = 0.4

/** Land a logo takes, relative to a small one. Matches the pin sizes on the
 *  map: a Large logo is twice as wide as a Small one. */
export function pinFootprint(scale: string | null): number {
  const size = (scale ?? 'Medium').toLowerCase()
  return size === 'large' ? 4 : size === 'small' ? 1 : 2
}

/** Where a point of the ruler-straight layout lies on the drawn map. A sum of
 *  slow waves, gentle enough (its slope stays well under 1) that the map is
 *  never folded over: whatever was inside a border stays inside it. */
function warp([x, y]: Point): Point {
  return [
    x +
      0.75 * Math.sin(0.43 * y + 0.21 * x + 1.3) +
      0.3 * Math.sin(1.05 * y - 0.5 * x + 4.1),
    y +
      0.6 * Math.sin(0.4 * x - 0.17 * y + 2.2) +
      0.26 * Math.sin(0.95 * x + 0.6 * y + 0.4),
  ]
}

/** A line of the layout as it is drawn: cut into short stretches, each end
 *  warped. */
function trace(line: Point[], closed: boolean): Point[] {
  const traced: Point[] = []
  const last = closed ? line.length : line.length - 1
  for (let i = 0; i < last; i++) {
    const from = line[i]
    const to = line[(i + 1) % line.length]
    const pieces = Math.max(
      1,
      Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / TRACE_STEP)
    )
    for (let piece = 0; piece < pieces; piece++) {
      const t = piece / pieces
      traced.push(
        warp([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t])
      )
    }
  }
  if (!closed) traced.push(warp(line[line.length - 1]))
  return traced
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

/**
 * The coast as COAST_POINTS distances from the middle of the island, one per
 * bearing, each a multiple of the spec ellipse's own reach that way. Bearings
 * are taken on the ellipse squashed to a circle, so they are even along it.
 */
class Coast {
  readonly reach = new Array<number>(COAST_POINTS).fill(1)

  private island: RealmMapSpec['island']

  constructor(island: RealmMapSpec['island']) {
    this.island = island
  }

  bearingOf(x: number, y: number): number {
    const angle = Math.atan2(
      (y - this.island.cy) / this.island.ry,
      (x - this.island.cx) / this.island.rx
    )
    return ((angle / (2 * Math.PI) + 1) % 1) * COAST_POINTS
  }

  pointAt(index: number, times = 1): Point {
    const angle = (index / COAST_POINTS) * 2 * Math.PI
    const reach = this.reach[index % COAST_POINTS] * times
    return [
      this.island.cx + Math.cos(angle) * this.island.rx * reach,
      this.island.cy + Math.sin(angle) * this.island.ry * reach,
    ]
  }

  /** Where the coast lies on the bearing of (x, y). */
  shoreToward(x: number, y: number): Point {
    const bearing = this.bearingOf(x, y)
    const index = Math.floor(bearing)
    const [ax, ay] = this.pointAt(index)
    const [bx, by] = this.pointAt(index + 1)
    const t = bearing - index
    return [ax + (bx - ax) * t, ay + (by - ay) * t]
  }

  contains(x: number, y: number): boolean {
    const [sx, sy] = this.shoreToward(x, y)
    const { cx, cy } = this.island
    return Math.hypot(x - cx, y - cy) <= Math.hypot(sx - cx, sy - cy)
  }

  outline(): Point[] {
    return this.reach.map((_, index) => this.pointAt(index))
  }
}

/** The island: see step 1 at the top of the file. */
function shapeCoast(
  spec: RealmMapSpec,
  wanted: Map<string, number>,
  keepClear: { x: number; y: number }[]
): Coast {
  const coast = new Coast(spec.island)
  const realms = [...wanted.keys()]

  // The lie of the coast before any realm moves it: slow swells, a little
  // roughness, and a bay at each harbour.
  const bays = [spec.landmarks.arrivalHarbour, spec.landmarks.departureHarbour]
  const swell = coast.reach.map((_, index) => {
    const angle = (index / COAST_POINTS) * 2 * Math.PI
    let reach =
      1 +
      0.06 * Math.sin(2 * angle + 0.9) +
      0.05 * Math.sin(3 * angle + 2.4) +
      0.03 * Math.sin(5 * angle + 0.3) +
      0.015 * Math.sin(11 * angle + 1.7) +
      0.008 * Math.sin(23 * angle)
    for (const [x, y] of bays) {
      const away = Math.abs(
        ((index - coast.bearingOf(x, y) + COAST_POINTS * 1.5) % COAST_POINTS) -
          COAST_POINTS / 2
      )
      reach -= 0.07 * Math.exp(-((away / 4) ** 2))
    }
    return reach
  })

  // Which realm's shore each bearing is: the realm just inside the ellipse.
  const shoreOf = swell.map((_, index) => {
    const angle = (index / COAST_POINTS) * 2 * Math.PI
    const x = spec.island.cx + Math.cos(angle) * spec.island.rx * 0.9
    const y = spec.island.cy + Math.sin(angle) * spec.island.ry * 0.9
    return realms.findIndex(realm => insidePolygon(x, y, spec.realms[realm]))
  })

  // Coarse samples are enough to weigh the realms against each other.
  const samples: { x: number; y: number; realm: number }[] = []
  for (let x = 0.25; x < GRID_WIDTH; x += 0.5) {
    for (let y = 0.25; y < GRID_HEIGHT; y += 0.5) {
      const realm = realms.findIndex(r => insidePolygon(x, y, spec.realms[r]))
      if (realm !== -1) samples.push({ x, y, realm })
    }
  }
  const landWanted = (Math.PI * spec.island.rx * spec.island.ry) / (0.5 * 0.5)

  const push = realms.map(() => 1)
  for (let round = 0; round < 40; round++) {
    // Blend each bearing with its neighbors so the shore does not step where
    // two realms meet.
    const pushed = shoreOf.map((_, index) => {
      let sum = 0
      for (let near = -5; near <= 5; near++) {
        const at = shoreOf[(index + near + COAST_POINTS) % COAST_POINTS]
        sum += at === -1 ? 1 : push[at]
      }
      return sum / 11
    })
    coast.reach.forEach((_, index) => {
      coast.reach[index] = swell[index] * pushed[index]
    })
    const land = realms.map(() => 0)
    for (const sample of samples) {
      if (coast.contains(sample.x, sample.y)) land[sample.realm]++
    }
    realms.forEach((realm, i) => {
      const short =
        ((wanted.get(realm) ?? 0) * landWanted) / Math.max(land[i], 1)
      push[i] = Math.min(
        SHORE_RANGE[1],
        Math.max(SHORE_RANGE[0], push[i] * short ** 0.7)
      )
    })
  }

  // Draw back from anything that has to stay at sea.
  coast.reach.forEach((reach, index) => {
    let times = 1
    const tooNear = () => {
      const [x, y] = coast.pointAt(index, times)
      return keepClear.some(
        p => Math.hypot(p.x - x, p.y - y) < KEEP_CLEAR_RADIUS
      )
    }
    while (times > 0.3 && tooNear()) times -= 0.01
    coast.reach[index] = reach * times
  })
  return coast
}

// How much of a district lying across the road is counted as north of it when
// the road is laid.
const ACROSS_NORTH = 0.3

/**
 * Where on the coast the road starts. The road is a border (see
 * RealmMapSpec.roadside) and ends at the crossroads, so where it starts
 * decides how much of its realm lies to either side: the arrival harbour
 * slides along the shore from where the spec has it until the north side has
 * room for the districts that go there.
 */
function settleArrivalHarbour(
  spec: RealmMapSpec,
  coast: Coast,
  pins: LayoutPin[]
): Point {
  const [hx, hy] = spec.landmarks.arrivalHarbour
  const roadside = spec.roadside
  const polygon = roadside && spec.realms[roadside.realm]
  if (!roadside || !polygon) return coast.shoreToward(hx, hy)

  const inRealm = pins.filter(pin => pin.realm === roadside.realm)
  const north = inRealm.filter(pin => roadside.north.includes(pin.district))
  const across = inRealm.filter(
    pin =>
      !roadside.north.includes(pin.district) &&
      !roadside.south.includes(pin.district)
  )
  const wantedNorth =
    (footprintOf(north) + ACROSS_NORTH * footprintOf(across)) /
    Math.max(footprintOf(inRealm), 1)

  const land: Point[] = []
  for (let x = 0.25; x < GRID_WIDTH; x += 0.5) {
    for (let y = 0.25; y < GRID_HEIGHT; y += 0.5) {
      if (insidePolygon(x, y, polygon) && coast.contains(x, y))
        land.push([x, y])
    }
  }
  const [ex, ey] = spec.landmarks.crossroads
  const from = Math.round(coast.bearingOf(hx, hy))
  let best = coast.shoreToward(hx, hy)
  let bestMiss = Infinity
  for (let slide = -14; slide <= 14; slide++) {
    const start = coast.pointAt((from + slide + COAST_POINTS) % COAST_POINTS)
    // Only along the realm the road runs through.
    const justInland: Point = [
      start[0] + (ex - start[0]) * 0.05,
      start[1] + (ey - start[1]) * 0.05,
    ]
    if (!insidePolygon(justInland[0], justInland[1], polygon)) continue
    const northOfRoad = land.filter(
      ([x, y]) =>
        (ex - start[0]) * (y - start[1]) - (ey - start[1]) * (x - start[0]) <= 0
    ).length
    // Near enough is good enough: of those, the least slide wins.
    const miss =
      Math.abs(northOfRoad / Math.max(land.length, 1) - wantedNorth) +
      Math.abs(slide) * 0.0005
    if (miss < bestMiss) {
      bestMiss = miss
      best = start
    }
  }
  return best
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
  rounds: number,
  // Which side of the road each sample and each site is on: -1 north, 1
  // south, 0 for a site that may hold land on both. A site never holds a
  // sample on the other side.
  sides?: { ofSample: Int8Array; ofSite: number[] }
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
        const side = sides?.ofSite[i] ?? 0
        if (side !== 0 && side !== sides?.ofSample[s]) continue
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

/** The part of a convex polygon where a·x + b·y <= c. */
function clipTo(polygon: Point[], a: number, b: number, c: number): Point[] {
  const kept: Point[] = []
  polygon.forEach((from, k) => {
    const to = polygon[(k + 1) % polygon.length]
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
  return kept
}

/** Site i's cell of the power diagram, cut out of `within` (a convex
 *  polygon): everything nearer to it than to any other site. */
function cellOf(sites: Site[], i: number, within: Point[]): Point[] {
  let cell = within
  const me = sites[i]
  sites.forEach((other, j) => {
    if (j === i || cell.length === 0) return
    cell = clipTo(
      cell,
      2 * (other.x - me.x),
      2 * (other.y - me.y),
      other.x ** 2 +
        other.y ** 2 -
        other.weight -
        (me.x ** 2 + me.y ** 2 - me.weight)
    )
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
  const byRealm = groupBy(pins, pin => pin.realm)
  const isWater = (realm: string) =>
    realm.startsWith(spec.anchorage.realmStartsWith)

  // What share of the land each land realm should have.
  const onLand = pins.filter(
    pin => spec.realms[pin.realm] && !isWater(pin.realm)
  )
  const wanted = new Map<string, number>()
  for (const [realm, inRealm] of byRealm) {
    if (!spec.realms[realm] || isWater(realm)) continue
    wanted.set(realm, footprintOf(inRealm) / footprintOf(onLand))
  }
  const coast = shapeCoast(spec, wanted, keepClear)

  const toShore = ([x, y]: Point) => coast.shoreToward(x, y)
  const roadStart = settleArrivalHarbour(spec, coast, pins)
  const layout: RealmLayout = {
    positions: new Map(),
    coast: trace(coast.outline(), true),
    realms: [],
    districts: [],
    landmarks: {
      arrivalHarbour: warp(roadStart),
      crossroads: warp(spec.landmarks.crossroads),
      departureHarbour: warp(toShore(spec.landmarks.departureHarbour)),
      controlDam: warp(spec.landmarks.controlDam),
    },
    roads: [],
    landShare: new Map(),
    realmShare: new Map(),
  }
  const { crossroads, controlDam } = spec.landmarks
  const box = spec.anchorage.box
  const roadEnd = crossroads
  layout.roads = [
    [roadStart, roadEnd],
    [crossroads, toShore(spec.landmarks.departureHarbour)],
    [
      crossroads,
      controlDam,
      [
        crossroads[0] + (controlDam[0] - crossroads[0]) * 3,
        crossroads[1] + (controlDam[1] - crossroads[1]) * 3,
      ],
    ],
    [
      crossroads,
      toShore([
        box.reduce((sum, p) => sum + p[0], 0) / box.length,
        box.reduce((sum, p) => sum + p[1], 0) / box.length,
      ]),
    ],
  ].map(road => trace(road as Point[], false))

  const cols = Math.ceil(GRID_WIDTH / STEP)
  const rows = Math.ceil(GRID_HEIGHT / STEP)
  const xs = new Float32Array(cols * rows)
  const ys = new Float32Array(cols * rows)
  const isLand = new Uint8Array(cols * rows)
  let landSamples = 0
  for (let index = 0; index < cols * rows; index++) {
    xs[index] = ((index % cols) + 0.5) * STEP
    ys[index] = (Math.floor(index / cols) + 0.5) * STEP
    if (coast.contains(xs[index], ys[index])) {
      isLand[index] = 1
      landSamples++
    }
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
  // District cells are cut out of this: the frame and a little over.
  const frame: Point[] = [
    [-6, -6],
    [GRID_WIDTH + 6, -6],
    [GRID_WIDTH + 6, GRID_HEIGHT + 6],
    [-6, GRID_HEIGHT + 6],
  ]

  for (const [realm, inRealm] of byRealm) {
    const water = isWater(realm)
    const polygon = water ? spec.anchorage.box : spec.realms[realm]
    if (!polygon) {
      console.warn(
        `[map-realm-layout] No borders for realm "${realm}"; its pins keep their draft positions`
      )
      continue
    }
    layout.realms.push({ realm, polygon: trace(polygon, true), water })
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
    if (!water) layout.landShare.set(realm, room.length / landSamples)
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

    // The road as a border: see RealmMapSpec.roadside.
    const roadside = spec.roadside?.realm === realm ? spec.roadside : null
    const sideOfSite = [...byDistrict.keys()].map(district =>
      roadside?.north.includes(district)
        ? -1
        : roadside?.south.includes(district)
          ? 1
          : 0
    )
    // Inside is a·x + b·y <= c on the north side, the reverse on the south.
    const roadA = -(roadEnd[1] - roadStart[1])
    const roadB = roadEnd[0] - roadStart[0]
    const roadC = roadA * roadStart[0] + roadB * roadStart[1]
    const districtOf = shareOut(
      room,
      xs,
      ys,
      sites,
      300,
      roadside
        ? {
            ofSample: Int8Array.from(room, i =>
              roadA * xs[i] + roadB * ys[i] <= roadC ? -1 : 1
            ),
            ofSite: sideOfSite,
          }
        : undefined
    )
    // A district's cell on one side of the road: everything nearer to it than
    // to the other districts that may hold land there, up to the road.
    const pieceOn = (index: number, side: -1 | 1): Point[] => {
      const there = sites.filter(
        (_, i) => sideOfSite[i] === 0 || sideOfSite[i] === side
      )
      const cell = cellOf(there, there.indexOf(sites[index]), frame)
      return cell.length === 0
        ? cell
        : clipTo(cell, -side * roadA, -side * roadB, -side * roadC)
    }

    ;[...byDistrict.entries()].forEach(([district, inDistrict], index) => {
      const districtRoom = room.filter((_, s) => districtOf[s] === index)
      layout.districts.push({
        district,
        realm,
        pieces: (roadside
          ? ([-1, 1] as const)
              .filter(side => [0, side].includes(sideOfSite[index]))
              .map(side => pieceOn(index, side))
              .filter(piece => piece.length > 0)
          : [cellOf(sites, index, frame)]
        ).map(piece => trace(piece, true)),
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
        const [x, y] = warp([moving[i].x, moving[i].y])
        layout.positions.set(pin.id, {
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
        })
      })
    })
  }

  return layout
}
