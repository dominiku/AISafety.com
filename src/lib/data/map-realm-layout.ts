// PROTOTYPE Map 3.5: works out the island, the district borders and every
// pin's position, so the map has the same density of logos everywhere and
// each region's size shows how much goes on in it. The look it aims for is
// the classic map's: an angular coast and chunky regions whose borders run
// straight for a stretch and then turn.
//
// The arrangement is given (map-realm-spec.ts): where the realm borders run
// from the middle of the island, the Advocacy anchorage off the north-east
// coast, an anchor for each district, the towns and the landmarks. This
// module settles the rest:
//
//   1. The coast. A realm's border lines are fixed, so its size is set by how
//      far out its shore lies: the coast is pushed out along a realm holding
//      more than its land and pulled in along one holding less, until every
//      realm's land is in proportion to its logos (a large logo counts as
//      four small ones, a medium as two). Bays, capes and coves from the
//      spec, slow swells and finer roughness on top make it an island off a
//      fantasy map and not an oval. Closed orgs and map furniture stay where
//      Airtable puts them, and the coast keeps clear of them.
//   2. The towns. A district the spec makes a block (Career support, the
//      castle town at the crossroads) grows outward from its seed as a
//      square until it holds its share of the realm. Whatever border or
//      shore it meets on the way it runs right up to, so it leaves no sliver
//      of a neighbor behind it.
//   3. The districts. The rest of each realm is shared out among its other
//      districts in the same proportion, as the cells of a power diagram
//      around their anchors: compact regions, no spikes. Where the road runs
//      through a realm it is a border too: districts keep to their own side.
//   4. The pins. Inside a district they push apart until each has its own
//      share of it, again in proportion to its size. On land they keep back
//      from the coast; ships in the anchorage keep off it.
//   5. The roads. A road is always a border: the districts of the realm it
//      runs through keep to their own side of it, and one may lie across its
//      end. All of them meet at the crossroads.
//   6. The lie of the land. All of the above is worked out with ruler-straight
//      borders, then the whole map (borders, coast, roads, pins) is put
//      through one gentle warp. Lines are bent only where they cross a coarse
//      lattice or meet another line, so a border runs straight for a stretch
//      and then turns, and lines that met still meet.
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
  // Roughly where; the harbours end up on the coast as it comes out.
  landmarks: RealmLandmarks
  // The roads, each a border through one realm. Its districts listed `left`
  // or `right` (walking from `from` to `to`; left of a road heading east is
  // north) lie wholly on that side; any other may lie across the road. An end
  // marked as a shore is moved onto the coast. With `settleFrom` or
  // `settleTo`, that end also slides along the shore until both sides have
  // the room they need.
  roads?: {
    realm: string
    from: Point
    to: Point
    fromShore?: boolean
    toShore?: boolean
    settleFrom?: boolean
    settleTo?: boolean
    left: string[]
    right: string[]
  }[]
  // Districts that are a town: a block, not a share of the open land. It
  // grows as a square around `seed`. Put the seed on a corner or an edge of
  // the realm and the town fills that corner or end of it.
  blocks?: Record<string, { seed: Point }>
  // What shapes the coast besides the realms: a bay (depth below 0) or a
  // cape (above 0) on the bearing of `toward`, as a share of the island's
  // reach there, `width` bearings wide (there are 240 around the island).
  coastFeatures?: { toward: Point; depth: number; width: number }[]
}

export interface RealmLayout {
  positions: Map<string, { x: number; y: number }>
  // Everything below is in map grid units, warped and ready to draw.
  coast: Point[]
  // A realm's polygon runs out past the coast. A water realm lies off it.
  realms: { realm: string; polygon: Point[]; water: boolean }[]
  // A district's pieces are its whole cell (two pieces when it lies across
  // the road): draw them cut off by the realm's polygon, and by the coast
  // (inside it for land, outside it for water). A block is a town: it lies
  // over its neighbors' cells, so draw it after them.
  districts: {
    district: string
    realm: string
    pieces: Point[][]
    block: boolean
  }[]
  landmarks: RealmLandmarks
  roads: Point[][]
  /** The district a point of the drawn map lies in, or null at sea. */
  districtAt: (x: number, y: number) => string | null
  // Share of the land each land realm ended up with, by realm name.
  landShare: Map<string, number>
  // Share of its realm each district ended up with, by district name.
  realmShare: Map<string, number>
}

const GRID_WIDTH = 60
const GRID_HEIGHT = 32.7
const STEP = 0.25

const COAST_POINTS = 240
// How far a realm's shore may move in or out to fit what the realm holds.
const SHORE_RANGE: [number, number] = [0.8, 1.3]
// Grid units of sea kept around every pin that is not on the land.
const KEEP_CLEAR_RADIUS = 3
// Grid units a pin's middle keeps from the coast, so its logo and the name
// under it stay on the land.
const COAST_MARGIN = 1.2
// Grid units a ship in the anchorage keeps from the coast.
const SHIP_MARGIN = 1.5
// How strongly a district is held to its anchor, against settling in the
// middle of its own land. Lower makes chunkier districts.
const HOME_PULL = 0.3
// Lines are bent where they cross this lattice (grid units) and nowhere
// between, so they run straight for about this far.
const LATTICE = 3.5

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

/** The point of the straight layout that the warp puts at (x, y). */
function unwarp([x, y]: Point): Point {
  let at: Point = [x, y]
  for (let round = 0; round < 8; round++) {
    const [wx, wy] = warp(at)
    at = [at[0] - (wx - x), at[1] - (wy - y)]
  }
  return at
}

/**
 * Draws lines of the layout: see step 6 at the top of the file. A line is
 * bent where it crosses the lattice and at every corner (of any line) that
 * lies on it, so two lines along the same stretch bend at the same places
 * whatever their own ends are.
 */
function tracer(corners: Point[]) {
  return (line: Point[], closed: boolean): Point[] => {
    const traced: Point[] = []
    const last = closed ? line.length : line.length - 1
    for (let i = 0; i < last; i++) {
      const from = line[i]
      const to = line[(i + 1) % line.length]
      const dx = to[0] - from[0]
      const dy = to[1] - from[1]
      const length2 = dx * dx + dy * dy
      if (length2 < 1e-12) continue
      const cuts = [0]
      for (const [start, run] of [
        [from[0], dx],
        [from[1], dy],
      ]) {
        if (Math.abs(run) < 1e-9) continue
        const low = Math.min(start, start + run)
        const high = Math.max(start, start + run)
        for (let k = Math.ceil(low / LATTICE); k * LATTICE <= high; k++) {
          cuts.push((k * LATTICE - start) / run)
        }
      }
      for (const [cx, cy] of corners) {
        const t = ((cx - from[0]) * dx + (cy - from[1]) * dy) / length2
        if (t <= 0 || t >= 1) continue
        const offX = from[0] + dx * t - cx
        const offY = from[1] + dy * t - cy
        if (offX * offX + offY * offY < 1e-6) cuts.push(t)
      }
      cuts.sort((a, b) => a - b)
      let before = -1
      for (const t of cuts) {
        if (t - before < 1e-6 || t > 1 - 1e-6) continue
        before = t
        traced.push(warp([from[0] + dx * t, from[1] + dy * t]))
      }
    }
    if (!closed) traced.push(warp(line[line.length - 1]))
    return traced
  }
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

  // The lie of the coast before any realm moves it: slow swells, then finer
  // and finer roughness, and the bays and capes the spec asks for.
  const swell = coast.reach.map((_, index) => {
    const angle = (index / COAST_POINTS) * 2 * Math.PI
    let reach = 1
    for (const [waves, height, phase] of COAST_WAVES) {
      reach += height * Math.sin(waves * angle + phase)
    }
    for (const { toward, depth, width } of spec.coastFeatures ?? []) {
      const away = Math.abs(
        ((index - coast.bearingOf(toward[0], toward[1]) + COAST_POINTS * 1.5) %
          COAST_POINTS) -
          COAST_POINTS / 2
      )
      reach += depth * Math.exp(-((away / width) ** 2))
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
  // A little less land than the spec's ellipse, so the island with its capes
  // still fits the frame.
  const landWanted =
    (0.92 * Math.PI * spec.island.rx * spec.island.ry) / (0.5 * 0.5)

  const push = realms.map(() => 1)
  for (let round = 0; round < 40; round++) {
    // Blend each bearing with its neighbors so the shore does not step where
    // two realms meet.
    const pushed = shoreOf.map((_, index) => {
      let sum = 0
      for (let near = -7; near <= 7; near++) {
        const at = shoreOf[(index + near + COAST_POINTS) % COAST_POINTS]
        sum += at === -1 ? 1 : push[at]
      }
      return sum / 15
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

// Waves along the coast: [how many around the island, height, phase].
const COAST_WAVES = [
  [2, 0.06, 0.9],
  [3, 0.07, 2.4],
  [4, 0.05, 5.1],
  [5, 0.035, 0.3],
  [7, 0.03, 4.0],
  [9, 0.022, 1.1],
  [12, 0.02, 1.7],
  [16, 0.015, 3.3],
  [21, 0.012, 0.8],
  [29, 0.009, 2.9],
  [41, 0.007, 5.6],
  [58, 0.005, 1.4],
]

// How much of a district lying across the road is counted as left of it when
// the road is laid.
const ACROSS_LEFT = 0.3

/**
 * Where on the coast a road meets it, for a road end the spec lets settle.
 * The road is a border and its other end is fixed, so where this end lies
 * decides how much of its realm is to either side: it slides along the shore
 * from where the spec has it until the left side has room for its districts.
 *
 * @param open    the realm's land that is not a town's, as [x, y] samples
 * @param isStart whether the sliding end is the road's start (it matters for
 *                which side is left)
 */
function settleRoadEnd(
  spec: RealmMapSpec,
  coast: Coast,
  open: Point[],
  polygon: Point[],
  wantedLeft: number,
  [hx, hy]: Point,
  [ex, ey]: Point,
  isStart: boolean
): Point {
  const from = coast.bearingOf(hx, hy)
  let best = coast.shoreToward(hx, hy)
  let bestMiss = Infinity
  for (let slide = -12; slide <= 12; slide += 0.5) {
    const bearing = (from + slide + COAST_POINTS) % COAST_POINTS
    const angle = (bearing / COAST_POINTS) * 2 * Math.PI
    const start = coast.shoreToward(
      spec.island.cx + Math.cos(angle) * spec.island.rx,
      spec.island.cy + Math.sin(angle) * spec.island.ry
    )
    // Only along the realm the road runs through.
    if (
      !insidePolygon(
        start[0] + (ex - start[0]) * 0.05,
        start[1] + (ey - start[1]) * 0.05,
        polygon
      )
    ) {
      continue
    }
    const turn = isStart ? 1 : -1
    const leftOfRoad = open.filter(
      ([x, y]) =>
        turn *
          ((ex - start[0]) * (y - start[1]) -
            (ey - start[1]) * (x - start[0])) <=
        0
    ).length
    // Near enough is good enough: of those, the least slide wins.
    const miss =
      Math.abs(leftOfRoad / Math.max(open.length, 1) - wantedLeft) +
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
  // Its anchor. A site settles between there and the middle of what it holds
  // (HOME_PULL), so districts fill their realm without trading places.
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
        // A small district is held least: near a border or a shore, its
        // anchor would otherwise leave it a sliver along it.
        const pull = HOME_PULL * Math.min(1, site.share * 4)
        site.x = site.homeX * pull + (sumX[i] / count[i]) * (1 - pull)
        site.y = site.homeY * pull + (sumY[i] / count[i]) * (1 - pull)
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

  const cols = Math.ceil(GRID_WIDTH / STEP)
  const rows = Math.ceil(GRID_HEIGHT / STEP)
  const xs = new Float32Array(cols * rows)
  const ys = new Float32Array(cols * rows)
  const isLand = new Uint8Array(cols * rows)
  // Per sample: index into `districts` below, or -1.
  const owner = new Int16Array(cols * rows).fill(-1)
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
  const middleOfRoom = (samples: number[]): Point => [
    samples.reduce((sum, i) => sum + xs[i], 0) / samples.length,
    samples.reduce((sum, i) => sum + ys[i], 0) / samples.length,
  ]
  const everySample = Array.from({ length: cols * rows }, (_, i) => i)
  // District cells are cut out of this: the frame and a little over.
  const frame: Point[] = [
    [-6, -6],
    [GRID_WIDTH + 6, -6],
    [GRID_WIDTH + 6, GRID_HEIGHT + 6],
    [-6, GRID_HEIGHT + 6],
  ]

  // The straight layout, gathered here and drawn (traced) at the end, once
  // every corner is known.
  const realms: { realm: string; polygon: Point[]; water: boolean }[] = []
  const districts: {
    district: string
    realm: string
    pieces: Point[][]
    block: boolean
    middle: Point
  }[] = []
  const placed = new Map<string, Point>()
  const landShare = new Map<string, number>()
  const realmShare = new Map<string, number>()
  const { crossroads, controlDam } = spec.landmarks
  // Each road as it came out, by the realm it runs through.
  const laid = new Map<string, [Point, Point]>()

  for (const [realm, inRealm] of byRealm) {
    const water = isWater(realm)
    const polygon = water ? spec.anchorage.box : spec.realms[realm]
    if (!polygon) {
      console.warn(
        `[map-realm-layout] No borders for realm "${realm}"; its pins keep their draft positions`
      )
      continue
    }
    realms.push({ realm, polygon, water })
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
    if (!water) landShare.set(realm, room.length / landSamples)
    if (room.length === 0) {
      console.warn(`[map-realm-layout] No room for realm "${realm}"`)
      continue
    }

    const byDistrict = groupBy(inRealm, pin => pin.district)
    const realmFootprint = footprintOf(inRealm)

    // Pins settle over a district's room, and the district is on record.
    const settle = (
      district: string,
      inDistrict: LayoutPin[],
      districtRoom: number[],
      pieces: Point[][],
      block: boolean
    ) => {
      realmShare.set(district, districtRoom.length / room.length)
      // Borders that cannot move (the road, the coast) can leave a district
      // short of room or with too much: say so, the map will look uneven.
      const fit =
        districtRoom.length /
        room.length /
        (footprintOf(inDistrict) / realmFootprint)
      if (fit < 0.9 || fit > 1.1) {
        console.warn(
          `[map-realm-layout] "${district}" has ${Math.round(fit * 100)}% of the room its logos call for`
        )
      }
      if (districtRoom.length === 0) {
        console.warn(`[map-realm-layout] No room left for "${district}"`)
        districts.push({ district, realm, pieces, block, middle: crossroads })
        return
      }
      for (const sample of districtRoom) owner[sample] = districts.length
      const middle = middleOfRoom(districtRoom)
      districts.push({ district, realm, pieces, block, middle })

      // Start each pin where the draft has it relative to its neighbors,
      // carried over to where the district ended up. A sliver of offset
      // keeps pins drafted on the same spot from staying stuck together.
      const from = middleOf(inDistrict)
      const moving = inDistrict.map((pin, i) => ({
        x: middle[0] + (pin.x - from.x) + Math.cos(i * 2.4) * 0.01 * (i + 1),
        y: middle[1] + (pin.y - from.y) + Math.sin(i * 2.4) * 0.01 * (i + 1),
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
        placed.set(pin.id, [moving[i].x, moving[i].y])
      })
    }

    // The towns first: each a square grown from its fixed point until it
    // holds the district's share of the realm. What they take is no longer
    // open to the other districts, and they are drawn over them.
    let open = room
    const towns: (() => void)[] = []
    for (const [district, inDistrict] of byDistrict) {
      const block = spec.blocks?.[district]
      if (!block) continue
      const target = (footprintOf(inDistrict) / realmFootprint) * room.length
      const squareOf = (side: number) => {
        const x0 = block.seed[0] - side / 2
        const y0 = block.seed[1] - side / 2
        return { x0, y0, x1: x0 + side, y1: y0 + side }
      }
      const inSquare = (side: number) => {
        const { x0, y0, x1, y1 } = squareOf(side)
        return open.filter(
          i => xs[i] >= x0 && xs[i] < x1 && ys[i] >= y0 && ys[i] < y1
        )
      }
      let low = 0
      let high = 48
      for (let round = 0; round < 20; round++) {
        const side = (low + high) / 2
        if (inSquare(side).length < target) low = side
        else high = side
      }
      const { x0, y0, x1, y1 } = squareOf(high)
      const taken = new Set(inSquare(high))
      open = open.filter(i => !taken.has(i))
      const square: Point[] = [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
      ]
      towns.push(() => settle(district, inDistrict, [...taken], [square], true))
    }

    // The coast moves with the data, and an anchor left at sea or right on
    // the shore would give its district a thin strip of coast. Such an anchor
    // comes ashore: to the nearest open land well clear of the water.
    const inland = water ? open : open.filter(i => clearOf(i, 2, 1))
    const ashore = (at: { x: number; y: number }) => {
      const ground = inland.length > 0 ? inland : open
      let best = ground[0]
      let bestDistance = Infinity
      for (const i of ground) {
        const distance = (xs[i] - at.x) ** 2 + (ys[i] - at.y) ** 2
        if (distance < bestDistance) {
          bestDistance = distance
          best = i
        }
      }
      return bestDistance < STEP * STEP ? at : { x: xs[best], y: ys[best] }
    }

    const shared = [...byDistrict.entries()].filter(
      ([district]) => !spec.blocks?.[district]
    )
    const sharedFootprint = footprintOf(shared.flatMap(([, of]) => of))
    const sites = shared.map(([district, inDistrict]) => {
      const anchor = spec.districtAnchors[district]
      if (!anchor) {
        console.warn(
          `[map-realm-layout] No anchor for district "${district}"; using its draft positions`
        )
      }
      return siteAt(
        ashore(anchor ? { x: anchor[0], y: anchor[1] } : middleOf(inDistrict)),
        footprintOf(inDistrict) / sharedFootprint
      )
    })

    // The road as a border: see RealmMapSpec.roads.
    const road = spec.roads?.find(r => r.realm === realm) ?? null
    const sideOfSite = shared.map(([district]) =>
      road?.left.includes(district)
        ? -1
        : road?.right.includes(district)
          ? 1
          : 0
    )
    let roadStart: Point = crossroads
    let roadEnd: Point = crossroads
    if (road) {
      roadEnd = road.toShore ? toShore(road.to) : road.to
      roadStart = road.fromShore ? toShore(road.from) : road.from
      if (road.settleFrom || road.settleTo) {
        const footprintOn = (side: number) =>
          footprintOf(
            shared
              .filter((_, i) => sideOfSite[i] === side)
              .flatMap(([, of]) => of)
          )
        const settled = settleRoadEnd(
          spec,
          coast,
          open.map(i => [xs[i], ys[i]]),
          polygon,
          (footprintOn(-1) + ACROSS_LEFT * footprintOn(0)) /
            Math.max(sharedFootprint, 1),
          road.settleFrom ? road.from : road.to,
          road.settleFrom ? roadEnd : roadStart,
          road.settleFrom === true
        )
        if (road.settleFrom) roadStart = settled
        else roadEnd = settled
      }
      laid.set(realm, [roadStart, roadEnd])
    }
    // Inside is a·x + b·y <= c on the left side, the reverse on the right.
    const roadA = -(roadEnd[1] - roadStart[1])
    const roadB = roadEnd[0] - roadStart[0]
    const roadC = roadA * roadStart[0] + roadB * roadStart[1]
    const districtOf = shareOut(
      open,
      xs,
      ys,
      sites,
      300,
      road
        ? {
            ofSample: Int8Array.from(open, i =>
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

    shared.forEach(([district, inDistrict], index) => {
      settle(
        district,
        inDistrict,
        open.filter((_, s) => districtOf[s] === index),
        road
          ? ([-1, 1] as const)
              .filter(side => [0, side].includes(sideOfSite[index]))
              .map(side => pieceOn(index, side))
              .filter(piece => piece.length > 0)
          : [cellOf(sites, index, frame)],
        false
      )
    })
    for (const town of towns) town()
  }

  const roads: Point[][] = (spec.roads ?? []).flatMap(road => {
    const ends = laid.get(road.realm)
    return ends ? [ends] : []
  })
  // The harbours are where the first two roads of the spec meet the shore.
  const shoreEnd = (n: number, fallback: Point): Point => {
    const road = spec.roads?.[n]
    const ends = road && laid.get(road.realm)
    if (!road || !ends) return toShore(fallback)
    return road.fromShore ? ends[0] : ends[1]
  }
  const arrival = shoreEnd(0, spec.landmarks.arrivalHarbour)
  const departure = shoreEnd(1, spec.landmarks.departureHarbour)

  const trace = tracer([
    ...realms.flatMap(r => r.polygon),
    ...districts.flatMap(d => d.pieces.flat()),
    ...roads.flat(),
  ])
  // The harbours are corners of the drawn coast, so they sit right on it.
  const corners = [...coast.outline(), arrival, departure].sort(
    (a, b) => coast.bearingOf(a[0], a[1]) - coast.bearingOf(b[0], b[1])
  )
  const positions = new Map<string, { x: number; y: number }>()
  for (const [id, at] of placed) {
    const [x, y] = warp(at)
    positions.set(id, {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    })
  }
  return {
    positions,
    coast: corners.map(warp),
    realms: realms.map(r => ({ ...r, polygon: trace(r.polygon, true) })),
    districts: districts.map(({ district, realm, pieces, block }) => ({
      district,
      realm,
      block,
      pieces: pieces.map(piece => trace(piece, true)),
    })),
    landmarks: {
      arrivalHarbour: warp(arrival),
      crossroads: warp(crossroads),
      departureHarbour: warp(departure),
      controlDam: warp(controlDam),
    },
    roads: roads.map(road => trace(road, false)),
    districtAt: (x, y) => {
      const [ux, uy] = unwarp([x, y])
      const col = Math.floor(ux / STEP)
      const row = Math.floor(uy / STEP)
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null
      const index = owner[row * cols + col]
      return index === -1 ? null : districts[index].district
    },
    landShare,
    realmShare,
  }
}
