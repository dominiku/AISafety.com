// PROTOTYPE Map 3.5: works out the island, the district borders and every
// pin's position, so the map has the same density of logos everywhere and
// each region's size shows how much goes on in it. The look it aims for is
// the classic map's, and a tube map's: every line, the coast included, runs
// along an axis or at 45° and turns at a corner, so the regions are the
// chunky angular shapes the art for them will take.
//
// The arrangement is given (map-realm-spec.ts): where the realm borders run
// from the middle of the island, the Advocacy cove beside the castle town
// with the bit of land around it, an anchor for each district, the towns and
// the landmarks. This module settles the rest:
//
//   1. The coast. A realm's border lines are fixed, so its size is set by how
//      far out its shore lies: the coast is pushed out along a realm holding
//      more than its land and pulled in along one holding less, until every
//      realm's land is in proportion to its logos (a large logo counts as
//      four small ones, a medium as two). Bays, capes and coves from the
//      spec and slow swells give it the outline of an island, and that
//      outline is then drawn angular like everything else. Closed orgs and
//      map furniture stay where Airtable puts them, and the coast keeps
//      clear of them.
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
//   5. The ways. The road in from the arrival harbour is a border: the
//      districts of the realm it runs through keep to their own side of it.
//      East of the crossroads there is only a footpath, which calls at the
//      middle of each district in turn, and a short boardwalk from the castle
//      town to the cove.
//   6. The drawing. All of the above is worked out with ruler-straight
//      borders at whatever angle they fall, which gets the sizes right. Then
//      every line is redrawn in the map's angular hand: its corners moved
//      onto a grid, and each stretch between two corners run straight, at
//      45°, and straight again. Lines turn only at their corners, where they
//      meet another line and where they cross a coarse lattice, so two
//      regions sharing a border draw the same line. The pins are placed on
//      the regions as drawn.
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
  // The harbour realm, matched on the start of the Realm name: `water` is a
  // cove inside the coast (run it out past the coast where its mouth is) and
  // `box` is the whole realm, the cove and the land around it. Its pins stand
  // on either.
  anchorage: { realmStartsWith: string; box: Point[]; water: Point[] }
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
  // The districts the footpath calls at, in order, leaving the crossroads and
  // coming back to it.
  trail?: string[]
  // The boardwalk from the castle town to the cove, end to end.
  boardwalk?: Point[]
  // What shapes the coast besides the realms: a bay (depth below 0) or a
  // cape (above 0) on the bearing of `toward`, as a share of the island's
  // reach there, `width` bearings wide (there are 240 around the island).
  // One marked `atArrival` is the arrival bay: it moves to wherever the road
  // ends up meeting the shore.
  coastFeatures?: {
    toward: Point
    depth: number
    width: number
    atArrival?: boolean
  }[]
}

export interface RealmLayout {
  positions: Map<string, { x: number; y: number }>
  // Everything below is in map grid units, ready to draw.
  coast: Point[]
  // The cove: water inside the coast, drawn over the land.
  cove: Point[]
  // A realm's polygon runs out past the coast.
  realms: { realm: string; polygon: Point[] }[]
  // A district's pieces are its whole cell (two pieces when it lies across
  // the road): draw them cut off by the realm's polygon and by the coast. The
  // harbour realm's run on under the cove. A block is a town: it lies
  // over its neighbors' cells, so draw it after them.
  districts: {
    district: string
    realm: string
    pieces: Point[][]
    block: boolean
  }[]
  landmarks: RealmLandmarks
  roads: Point[][]
  // The places the footpath and the boardwalk call at, to be joined by a
  // curve: these two wander, unlike everything else on the map.
  trail: Point[]
  boardwalk: Point[]
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
// Grid units of sea the coast leaves to the edges of the frame, and how far
// down the title reaches.
const FRAME_MARGIN = 1.5
const FRAME_TOP = 3.4
// Grid units of sea kept around every pin that is not on the land.
const KEEP_CLEAR_RADIUS = 3
// Grid units a pin's middle keeps from the coast, so its logo and the name
// under it stay on the land.
const COAST_MARGIN = 1.2
// Grid units a ship in the anchorage keeps from the coast.
const SHIP_MARGIN = 0.75
// How strongly a district is held to its anchor, against settling in the
// middle of its own land. Lower makes chunkier districts.
const HOME_PULL = 0.3
// Corners of borders and roads sit on a grid this fine (grid units), and the
// coast's corners on a coarser one, for longer straight runs.
const SNAP = 0.5
const SHORE_SNAP = 1
// A long line also turns where it crosses this lattice (grid units), so it
// steps along its way in several places and not in one big dogleg.
const LATTICE = 5

/** Land a logo takes, relative to a small one. Matches the pin sizes on the
 *  map: a Large logo is twice as wide as a Small one. */
export function pinFootprint(scale: string | null): number {
  const size = (scale ?? 'Medium').toLowerCase()
  return size === 'large' ? 4 : size === 'small' ? 1 : 2
}

const snapTo = (value: number, grid: number) => Math.round(value / grid) * grid

/**
 * The way from one grid point to another in the map's own hand: straight
 * along an axis, one 45° stretch in the middle, straight again. Returns the
 * two turning points (none when the way is already straight or at 45°). The
 * same whichever end it is asked from, so two regions sharing a border draw
 * the same line.
 */
function dogleg(a: Point, b: Point): Point[] {
  const flipped = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])
  const [from, to] = flipped ? [b, a] : [a, b]
  const dx = to[0] - from[0]
  const dy = to[1] - from[1]
  const diagonal = Math.min(Math.abs(dx), Math.abs(dy))
  if (diagonal === 0 || Math.abs(dx) === Math.abs(dy)) return []
  const alongX = Math.abs(dx) > Math.abs(dy)
  const lead = snapTo((Math.abs(alongX ? dx : dy) - diagonal) / 2, SNAP)
  const first: Point = alongX
    ? [from[0] + lead * Math.sign(dx), from[1]]
    : [from[0], from[1] + lead * Math.sign(dy)]
  const second: Point = [
    first[0] + diagonal * Math.sign(dx),
    first[1] + diagonal * Math.sign(dy),
  ]
  return flipped ? [second, first] : [first, second]
}

/** A line through these grid points, in the map's hand (see dogleg). */
function angular(points: Point[], closed: boolean): Point[] {
  const line: Point[] = []
  const last = closed ? points.length : points.length - 1
  for (let i = 0; i < last; i++) {
    line.push(points[i], ...dogleg(points[i], points[(i + 1) % points.length]))
  }
  if (!closed) line.push(points[points.length - 1])
  return line
}

/**
 * Draws lines of the layout: see step 6 at the top of the file. A line turns
 * only where it crosses the lattice and at every corner (of any line) that
 * lies on it, so two lines along the same stretch turn at the same places
 * whatever their own ends are.
 */
function tracer(corners: Point[]) {
  return (line: Point[], closed: boolean): Point[] => {
    const turns: Point[] = []
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
      for (const t of cuts) {
        if (t > 1 - 1e-6) continue
        turns.push([
          snapTo(from[0] + dx * t, SNAP),
          snapTo(from[1] + dy * t, SNAP),
        ])
      }
    }
    if (!closed) {
      const end = line[line.length - 1]
      turns.push([snapTo(end[0], SNAP), snapTo(end[1], SNAP)])
    }
    // Snapping can land neighbors on the same grid point.
    const apart = turns.filter((p, i) => {
      const before = turns[(i + turns.length - 1) % turns.length]
      return (i === 0 && !closed) || p[0] !== before[0] || p[1] !== before[1]
    })
    return angular(apart, closed)
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
  // As much land as the spec's ellipse has.
  const landWanted = samples.filter(
    ({ x, y }) =>
      Math.hypot(
        (x - spec.island.cx) / spec.island.rx,
        (y - spec.island.cy) / spec.island.ry
      ) <= 1
  ).length

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
      // The island has to fit the frame, under the title.
      while (coast.reach[index] > 0.5) {
        const [x, y] = coast.pointAt(index)
        if (
          x >= FRAME_MARGIN &&
          x <= GRID_WIDTH - FRAME_MARGIN &&
          y >= FRAME_TOP &&
          y <= GRID_HEIGHT - FRAME_MARGIN / 2
        ) {
          break
        }
        coast.reach[index] -= 0.01
      }
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
 * The shore as it is drawn: the shaped coast kept at a corner every few
 * bearings, the corners moved onto a coarse grid and joined in the map's
 * angular hand. This polygon, not the smooth coast behind it, is the land.
 */
function angularShore(coast: Coast): Point[] {
  const bearings = new Set<number>()
  for (let at = 0, k = 0; at < COAST_POINTS - 3; at += 5 + ((k * 7) % 4), k++) {
    if (![...bearings].some(kept => Math.abs(kept - at) < 3)) bearings.add(at)
  }
  const corners: Point[] = []
  for (const at of [...bearings].sort((a, b) => a - b)) {
    const [x, y] = coast.pointAt(at)
    const corner: Point = [snapTo(x, SHORE_SNAP), snapTo(y, SHORE_SNAP)]
    const before = corners[corners.length - 1]
    if (!before || before[0] !== corner[0] || before[1] !== corner[1]) {
      corners.push(corner)
    }
  }
  return angular(corners, true)
}

/** The grid point on a line of the map (its turns are grid points and it runs
 *  along axes and diagonals, so it passes through many) nearest to `to`. */
function nearestOn(line: Point[], to: Point): Point {
  let best = line[0]
  let bestDistance = Infinity
  line.forEach((from, i) => {
    const next = line[(i + 1) % line.length]
    const steps = Math.round(
      Math.max(Math.abs(next[0] - from[0]), Math.abs(next[1] - from[1])) / SNAP
    )
    for (let step = 0; step < Math.max(steps, 1); step++) {
      const at: Point = [
        from[0] + ((next[0] - from[0]) * step) / Math.max(steps, 1),
        from[1] + ((next[1] - from[1]) * step) / Math.max(steps, 1),
      ]
      const distance = Math.hypot(at[0] - to[0], at[1] - to[1])
      if (distance < bestDistance) {
        bestDistance = distance
        best = at
      }
    }
  })
  return best
}

/**
 * @param pins      the orgs to lay out
 * @param keepClear pins that stay where they are (closed orgs, map furniture)
 */
export function layoutRealmMap(
  pins: LayoutPin[],
  keepClear: { x: number; y: number }[],
  spec: RealmMapSpec,
  // Set on the second go: see the end of the function.
  bayMoved = false
): RealmLayout {
  const byRealm = groupBy(pins, pin => pin.realm)
  const isHarbour = (realm: string) =>
    realm.startsWith(spec.anchorage.realmStartsWith)

  // What share of the land each land realm should have.
  const onLand = pins.filter(
    pin => spec.realms[pin.realm] && !isHarbour(pin.realm)
  )
  const wanted = new Map<string, number>()
  for (const [realm, inRealm] of byRealm) {
    if (!spec.realms[realm] || isHarbour(realm)) continue
    wanted.set(realm, footprintOf(inRealm) / footprintOf(onLand))
  }
  const coast = shapeCoast(spec, wanted, keepClear)
  const shore = angularShore(coast)
  const cove = spec.anchorage.water
  const toShore = ([x, y]: Point) => nearestOn(shore, coast.shoreToward(x, y))

  const cols = Math.ceil(GRID_WIDTH / STEP)
  const rows = Math.ceil(GRID_HEIGHT / STEP)
  const xs = new Float32Array(cols * rows)
  const ys = new Float32Array(cols * rows)
  // Inside the coast; and of that, what is not the cove.
  const inShore = new Uint8Array(cols * rows)
  const isLand = new Uint8Array(cols * rows)
  let landSamples = 0
  for (let index = 0; index < cols * rows; index++) {
    xs[index] = ((index % cols) + 0.5) * STEP
    ys[index] = (Math.floor(index / cols) + 0.5) * STEP
    if (!insidePolygon(xs[index], ys[index], shore)) continue
    inShore[index] = 1
    if (insidePolygon(xs[index], ys[index], cove)) continue
    isLand[index] = 1
    landSamples++
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
  // Where a realm's districts may be: its land, and for the harbour realm
  // the water of the cove too, a little off its shores.
  const roomOf = (polygon: Point[], harbour: boolean) => {
    const x0 = Math.min(...polygon.map(p => p[0]))
    const x1 = Math.max(...polygon.map(p => p[0]))
    const y0 = Math.min(...polygon.map(p => p[1]))
    const y1 = Math.max(...polygon.map(p => p[1]))
    return everySample.filter(
      i =>
        inShore[i] === 1 &&
        xs[i] >= x0 &&
        xs[i] <= x1 &&
        ys[i] >= y0 &&
        ys[i] <= y1 &&
        insidePolygon(xs[i], ys[i], polygon) &&
        (isLand[i] === 1 || (harbour && clearOf(i, SHIP_MARGIN, 0)))
    )
  }
  // District cells are cut out of this: the frame and a little over.
  const frame: Point[] = [
    [-6, -6],
    [GRID_WIDTH + 6, -6],
    [GRID_WIDTH + 6, GRID_HEIGHT + 6],
    [-6, GRID_HEIGHT + 6],
  ]

  // First the layout with ruler-straight borders, which gets the sizes
  // right. It is drawn in the map's angular hand further down, once every
  // corner is known, and the pins are placed on the regions as drawn.
  const realms: { realm: string; polygon: Point[]; harbour: boolean }[] = []
  const planned: {
    district: string
    realm: string
    pins: LayoutPin[]
    pieces: Point[][]
    block: boolean
  }[] = []
  const { crossroads, controlDam } = spec.landmarks
  // Each road as it came out, by the realm it runs through.
  const laid = new Map<string, [Point, Point]>()

  for (const [realm, inRealm] of byRealm) {
    const harbour = isHarbour(realm)
    const polygon = harbour ? spec.anchorage.box : spec.realms[realm]
    if (!polygon) {
      console.warn(
        `[map-realm-layout] No borders for realm "${realm}"; its pins keep their draft positions`
      )
      continue
    }
    realms.push({ realm, polygon, harbour })
    const room = roomOf(polygon, harbour)
    if (room.length === 0) {
      console.warn(`[map-realm-layout] No room for realm "${realm}"`)
      continue
    }
    const byDistrict = groupBy(inRealm, pin => pin.district)
    const realmFootprint = footprintOf(inRealm)

    // The towns first: each a square grown around its seed until it holds
    // the district's share of the realm. What they take is no longer open to
    // the other districts, and they are drawn over them.
    let open = room
    const towns: typeof planned = []
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
      towns.push({
        district,
        realm,
        pins: inDistrict,
        block: true,
        pieces: [
          [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ],
        ],
      })
    }

    // The coast moves with the data, and an anchor left at sea or right on
    // the shore would give its district a thin strip of coast. Such an anchor
    // comes ashore: to the nearest open land well clear of the water.
    const inland = harbour ? open : open.filter(i => clearOf(i, 2, 1))
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
        const settled = nearestOn(
          shore,
          settleRoadEnd(
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
    shareOut(
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
      planned.push({
        district,
        realm,
        pins: inDistrict,
        block: false,
        pieces: road
          ? ([-1, 1] as const)
              .filter(side => [0, side].includes(sideOfSite[index]))
              .map(side => pieceOn(index, side))
              .filter(piece => piece.length > 0)
          : [cellOf(sites, index, frame)],
      })
    })
    planned.push(...towns)
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

  // The arrival bay belongs where the road meets the shore, and the road's end
  // slides along the shore to balance its two sides. If it has slid out of
  // the bay, lay the map out once more with the bay moved to it. Once is
  // enough: the bay is small next to the realm, so the road barely moves.
  const arrivalBay = spec.coastFeatures?.find(feature => feature.atArrival)
  const arrivalRoad = spec.roads?.[0]
  const arrivalEnds = arrivalRoad && laid.get(arrivalRoad.realm)
  if (!bayMoved && arrivalBay && arrivalRoad?.settleFrom && arrivalEnds) {
    const [x, y] = arrivalEnds[0]
    if (Math.hypot(x - arrivalBay.toward[0], y - arrivalBay.toward[1]) > 1.5) {
      // Aim from the middle of the island, out past the shore.
      const toward: Point = [
        spec.island.cx + (x - spec.island.cx) * 1.3,
        spec.island.cy + (y - spec.island.cy) * 1.3,
      ]
      return layoutRealmMap(
        pins,
        keepClear,
        {
          ...spec,
          coastFeatures: spec.coastFeatures?.map(feature =>
            feature === arrivalBay ? { ...feature, toward } : feature
          ),
          roads: spec.roads?.map(road =>
            road === arrivalRoad ? { ...road, from: toward } : road
          ),
        },
        true
      )
    }
  }

  // Now the drawing, and the pins on the regions as drawn.
  const trace = tracer([
    ...realms.flatMap(r => r.polygon),
    ...planned.flatMap(d => d.pieces.flat()),
    ...roads.flat(),
  ])
  const drawnRealms = realms.map(r => ({
    ...r,
    polygon: trace(r.polygon, true),
  }))
  const districts = planned.map(d => ({
    district: d.district,
    realm: d.realm,
    block: d.block,
    pieces: d.pieces.map(piece => trace(piece, true)),
  }))

  // Per sample: index into `districts`, or -1. A town lies over the open
  // districts around it, so it is asked first.
  const owner = new Int16Array(cols * rows).fill(-1)
  const townsFirst = districts
    .map((_, index) => index)
    .sort((a, b) => Number(districts[b].block) - Number(districts[a].block))
  // Each piece's bounding box [x0, x1, y0, y1], to rule most of them out fast.
  const boxes = districts.map(d =>
    d.pieces.map(piece => [
      Math.min(...piece.map(p => p[0])),
      Math.max(...piece.map(p => p[0])),
      Math.min(...piece.map(p => p[1])),
      Math.max(...piece.map(p => p[1])),
    ])
  )
  const roomOfRealm = new Map<string, number>()
  for (const { realm, polygon, harbour } of drawnRealms) {
    const room = roomOf(polygon, harbour)
    roomOfRealm.set(realm, room.length)
    const inRealm = townsFirst.filter(index => districts[index].realm === realm)
    for (const sample of room) {
      const holder = inRealm.find(index =>
        districts[index].pieces.some(
          (piece, n) =>
            xs[sample] >= boxes[index][n][0] &&
            xs[sample] <= boxes[index][n][1] &&
            ys[sample] >= boxes[index][n][2] &&
            ys[sample] <= boxes[index][n][3] &&
            insidePolygon(xs[sample], ys[sample], piece)
        )
      )
      if (holder !== undefined) owner[sample] = holder
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  const landShare = new Map<string, number>()
  const realmShare = new Map<string, number>()
  for (const { realm, harbour } of drawnRealms) {
    if (!harbour)
      landShare.set(realm, (roomOfRealm.get(realm) ?? 0) / landSamples)
  }
  planned.forEach(({ district, realm, pins: inDistrict }, index) => {
    const room = everySample.filter(i => owner[i] === index)
    const realmRoom = roomOfRealm.get(realm) ?? 0
    const realmFootprint = footprintOf(byRealm.get(realm) ?? [])
    realmShare.set(district, room.length / Math.max(realmRoom, 1))
    // Borders that cannot move (a road, the coast) can leave a district short
    // of room or with too much: say so, the map will look uneven.
    const fit =
      room.length /
      Math.max(realmRoom, 1) /
      (footprintOf(inDistrict) / realmFootprint)
    if (fit < 0.85 || fit > 1.15) {
      console.warn(
        `[map-realm-layout] "${district}" has ${Math.round(fit * 100)}% of the room its logos call for`
      )
    }
    if (room.length === 0) return

    // Start each pin where the draft has it relative to its neighbors,
    // carried over to where the district ended up. A sliver of offset keeps
    // pins drafted on the same spot from staying stuck together.
    const from = middleOf(inDistrict)
    const middleX = room.reduce((sum, i) => sum + xs[i], 0) / room.length
    const middleY = room.reduce((sum, i) => sum + ys[i], 0) / room.length
    const moving = inDistrict.map((pin, i) => ({
      x: middleX + (pin.x - from.x) + Math.cos(i * 2.4) * 0.01 * (i + 1),
      y: middleY + (pin.y - from.y) + Math.sin(i * 2.4) * 0.01 * (i + 1),
      footprint: pinFootprint(pin.scale),
    }))
    const standing = isHarbour(realm)
      ? room
      : room.filter(i => clearOf(i, COAST_MARGIN, 1))
    spreadPins(
      standing.length >= moving.length ? standing : room,
      xs,
      ys,
      moving,
      60
    )
    inDistrict.forEach((pin, i) => {
      positions.set(pin.id, {
        x: Math.round(moving[i].x * 10) / 10,
        y: Math.round(moving[i].y * 10) / 10,
      })
    })
  })

  // The middle of each district as drawn, for the ways that call there.
  const stopIn = (name: string): Point[] => {
    const index = districts.findIndex(d => d.district === name)
    const room = everySample.filter(i => index !== -1 && owner[i] === index)
    if (room.length === 0) return []
    return [
      [
        room.reduce((sum, i) => sum + xs[i], 0) / room.length,
        room.reduce((sum, i) => sum + ys[i], 0) / room.length,
      ],
    ]
  }
  const trailStops = (spec.trail ?? []).flatMap(stopIn)

  return {
    positions,
    trail: trailStops.length > 0 ? [crossroads, ...trailStops, crossroads] : [],
    boardwalk: spec.boardwalk ?? [],
    coast: shore,
    cove,
    realms: drawnRealms.map(({ realm, polygon }) => ({ realm, polygon })),
    districts,
    landmarks: {
      arrivalHarbour: shoreEnd(0, spec.landmarks.arrivalHarbour),
      crossroads: [snapTo(crossroads[0], SNAP), snapTo(crossroads[1], SNAP)],
      departureHarbour: shoreEnd(1, spec.landmarks.departureHarbour),
      controlDam,
    },
    roads: roads.map(road => trace(road, false)),
    districtAt: (x, y) => {
      const col = Math.floor(x / STEP)
      const row = Math.floor(y / STEP)
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null
      const index = owner[row * cols + col]
      return index === -1 ? null : districts[index].district
    },
    landShare,
    realmShare,
  }
}
