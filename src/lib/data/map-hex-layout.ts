// PROTOTYPE Map 3.5, "Hex work" view: from the hand-made tile map and the
// logos to a laid-out board.
//
// The tile map (map-hex-spec.ts) paints each tile with its district's two
// letters and marks where a district starts, where the river and the road
// run and where landmarks stand. Everything else is worked out here.
//
// A district is one plateau: all its tiles stand at the district's height and
// run into each other with no border between them, so a district is told from
// its neighbors by its step up or down, its rim and its tone. It takes its
// tiles up from the most inland one outward, and only as many as its logos
// need. A painted tile nobody needs yet is planned growth: it is sea
// while the sea can reach it, and bare land if it is landlocked. Tiles the
// river, the road or a landmark are on are always land.
//
// Logos are upright circles on squashed tiles, so their spots are worked out
// on the tiles' tops as they are drawn: a fine fixed lattice over each top,
// tried from the back of the plateau forward, the largest logos first. A logo
// may stand across the join of two tiles of its district. A spot has to keep
// clear of the district's edge, of a taller tile standing in front, of the
// river and the road, and of a landmark's tile.
//
// The river is every tile marked for it, joined up from its source (its
// highest tile) tile by tile through the middle of the sides they share. It
// may part, and then runs narrower; it must never run uphill (that throws);
// where it reaches the coast it has a mouth. Round the keep it runs as a
// moat through the middles of the six tiles about it. Where it steps down a side the viewer can see
// it falls; where the side faces away, it goes over the far lip. The road is
// joined up the same way, from the keep outward.
//
// Dependency-free apart from map-hex, so it can be unit tested.

import {
  SOUTH_FACING,
  backToFront,
  directionBetween,
  distanceToStretch,
  hexCenter,
  hexCorners,
  hexKey,
  hexNeighbor,
  hexSide,
  hexSideMiddle,
  insideConvex,
  parseHexGrid,
  projectPoint,
  HEX_DIRECTIONS,
  type HexDirection,
  type HexGridTile,
  type HexView,
  type Point,
} from './map-hex'

// A piece of the classic art, by its symbol's id in the landmarks sprite, at
// the size it is drawn (map grid units).
export interface HexLandmarkArt {
  symbol: string
  width: number
  height: number
}

export type HexCover =
  | 'forest'
  | 'grove'
  | 'thicket'
  | 'fields'
  | 'vineyard'
  | 'hamlet'

export interface HexDistrictSpec {
  // The two letters its tiles carry on the tile map.
  code: string
  // The District and Realm field values.
  district: string
  realm: string
  // Levels above the sea every tile of the district stands at; halves are
  // fine.
  height: number
  // Tiles it takes up however few its logos are.
  minTiles?: number
  // What grows or stands in the gaps its logos leave, in place of its
  // realm's usual country.
  cover?: HexCover
  // A ground color of its own, where its realm's would not suit it.
  ground?: string
  // The river leaves it over a dam: its fall toward the viewer is a spillway.
  dam?: boolean
  // A plank pier runs out from its shore (into a cove, if it is on one).
  pier?: boolean
  // Its logos may stand over the river (the castle's, over its moat).
  overWater?: boolean
  // Ringed by a wall of dark peaks along its edge (a forbidding country).
  walled?: boolean
  // Not land at all: its logos lie on open water (the closed orgs, as
  // sunken ships). Its tiles are not drawn and its height is 0.
  sunken?: boolean
  // Stands on the district's tile marked "!", which then holds no logos.
  landmark?: HexLandmarkArt
}

// A tile that is no district's: water inside the coast (a cove), scenery in
// the look of a realm (a peak), or the keep: the one tile the river circles
// as a moat and the road ends at.
export interface HexFeatureSpec {
  code: string
  kind: 'water' | 'scenery' | 'keep'
  realm?: string
  // Levels above the sea; 0 for water.
  height: number
  // On the feature's tiles marked "!"; on the keep itself.
  landmark?: HexLandmarkArt
}

export interface HexMapSpec {
  view: HexView
  tiles: string
  districts: HexDistrictSpec[]
  features: HexFeatureSpec[]
  // Widths as drawn, in map grid units. Where the river parts, each arm is
  // `branch` times as wide as the stream above.
  river: { width: number; branch: number }
  road: { width: number }
  // Every painted tile is land, needed or not: the coast is exactly as it is
  // painted, and a district gets room to grow by painting more tiles.
  // Without it a district takes only the tiles its logos need and the rest
  // stay sea, which leaves a ragged coast.
  takeAllTiles?: boolean
}

export interface HexLogo {
  id: string
  district: string
  // Map grid units.
  radius: number
  // Breaks ties between logos of one size, so the order never shuffles.
  name: string
}

export interface HexPackOptions {
  // Map grid units a logo keeps from the edge of its district, and from
  // other logos.
  margin: number
  gap: number
  // The lattice of spots.
  step: number
}
export const DEFAULT_HEX_PACKING: HexPackOptions = {
  margin: 0.2,
  gap: 0.1,
  step: 0.2,
}

export type HexTileState =
  // A district's tile in use.
  | 'used'
  // Painted for a district, not needed yet, and landlocked: bare land.
  | 'spare'
  // Open sea, or planned growth the sea still covers.
  | 'sea'
  | 'water'
  | 'scenery'
  | 'keep'

export interface HexLaidTile extends HexGridTile {
  // A name for the tile: its letters and its place in its district's order.
  ref: string | null
  // Levels above the sea as drawn: 0 for sea, whatever is planned there.
  height: number
  state: HexTileState
  // Open water with logos on it, not land (see HexDistrictSpec.sunken).
  sunken: boolean
  // Its district is ringed by peaks (see HexDistrictSpec.walled).
  walled: boolean
  // What its district is covered with (see HexDistrictSpec.cover).
  cover: HexCover | null
  // Its district's own ground color, if it has one.
  ground: string | null
  district: string | null
  realm: string | null
  // The district's place among its realm's districts, and how many those
  // are, to pick a tone of the realm's ground by.
  tone: number
  tones: number
  // As drawn: the middle and the six corners of the top (E, SE, SW, W, NW,
  // NE), at the tile's height.
  center: Point
  top: Point[]
  // Which of its sides (SE, S, SW, NW, N, NE, as the corners of `top` run)
  // are the edge of its district: the other sides join tiles of the same
  // district and carry no border.
  edges: boolean[]
  // Which of its sides face the sea.
  coast: boolean[]
  // Drawn once the tile named `after` is (the keep's stands behind its moat,
  // which lies partly on the tile in front).
  landmark: (HexLandmarkArt & { x: number; y: number; after: string }) | null
}

export interface HexPathPiece {
  kind: 'road' | 'river'
  width: number
  // Drawn once this tile is, clipped to the tops of the tiles in `clip`: its
  // own, and those of the same height it runs on into, so there is no seam
  // between them.
  tile: string
  clip: string[]
  points: Point[]
  closed?: boolean
  // Its width where it ends, if not the same as where it starts: the river
  // narrows toward an arm of the delta.
  widthEnd?: number
  // A road climbing to a higher tile: the side of each ramp, as a shape. A
  // ramp rises off its own tile's top, so the piece is not clipped to it.
  ramps?: Point[][]
  // The higher tiles its ramps climb to. Where such a tile is drawn after
  // this piece, the road is drawn again over the tile's edge.
  rampTo?: string[]
  // It runs into the moat, which is drawn later and over its end.
  joinsMoat?: boolean
}

// A road or river stepping down the side of a tile. `a` and `b` are the ends
// of its crossing of the higher tile's edge, `fall` how far down the face it
// drops (map grid units). Where the side faces away from the viewer only the
// lip shows.
export interface HexPathDrop {
  kind: 'road' | 'river'
  tile: string
  a: Point
  b: Point
  fall: number
  visible: boolean
  // A dam stands across it: the fall is its spillway.
  dam?: boolean
}

// Where a river runs out into the sea, a road out onto a pier, or a district's
// own pier stands: the point on the coast, at sea level, and the way out from
// the land.
export interface HexPathEnd {
  kind: 'road' | 'river' | 'pier'
  width: number
  at: Point
  toward: Point
}

export interface HexLayout {
  view: HexView
  // Every tile of the map, the farthest first.
  tiles: HexLaidTile[]
  columns: number
  rows: number
  positions: Map<string, { x: number; y: number }>
  // Logos no painted tile had room for, or whose district is not on the map.
  unplaced: string[]
  pieces: HexPathPiece[]
  drops: HexPathDrop[]
  ends: HexPathEnd[]
  // Where the river rises.
  springs: { tile: string; at: Point; width: number }[]
  // Planks where the road crosses the moat, drawn once `tile` is.
  bridges: { tile: string; a: Point; b: Point; width: number }[]
  districtAt: (x: number, y: number) => string | null
}

type PlannedTile = HexGridTile & {
  ref: string
  order: number
  height: number
}

interface Circle {
  x: number
  y: number
  radius: number
}

const CURVE_STEPS = 10
// Map grid units: how finely a plateau's spare depth is measured.
const CENTERING_STEP = 0.4
// Share of a tile's size a river's or road's bend is pushed off the straight
// line, so a run of tiles in a row does not look ruled.
const WANDER = 0.22
// The moat is this share of the river's width.
const MOAT_WIDTH = 0.8
const MOAT_POINTS = 48

// From a to b, leaving a along `ha` and arriving at b against `hb` (both of
// length 1), swaying by `sway` map units on the way: a smooth curve, as
// points. Where the two ends face each other it would be a ruled line, so it
// is led through a point pushed off to one side.
function course(
  a: Point,
  ha: Point,
  b: Point,
  hb: Point,
  sway: number
): Point[] {
  const span = Math.hypot(b[0] - a[0], b[1] - a[1])
  const cubic = (p0: Point, p1: Point, p2: Point, p3: Point): Point[] => {
    const points: Point[] = []
    for (let n = 0; n <= CURVE_STEPS; n++) {
      const t = n / CURVE_STEPS
      const u = 1 - t
      const weights = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t]
      points.push([
        weights[0] * p0[0] +
          weights[1] * p1[0] +
          weights[2] * p2[0] +
          weights[3] * p3[0],
        weights[0] * p0[1] +
          weights[1] * p1[1] +
          weights[2] * p2[1] +
          weights[3] * p3[1],
      ])
    }
    return points
  }
  const along = (p: Point, h: Point, k: number): Point => [
    p[0] + h[0] * k,
    p[1] + h[1] * k,
  ]
  if (ha[0] * hb[0] + ha[1] * hb[1] < -0.95) {
    const d: Point = [(b[0] - a[0]) / (span || 1), (b[1] - a[1]) / (span || 1)]
    const middle: Point = [
      (a[0] + b[0]) / 2 - d[1] * sway,
      (a[1] + b[1]) / 2 + d[0] * sway,
    ]
    const k = span * 0.22
    return [
      ...cubic(a, along(a, ha, k), along(middle, d, -k), middle),
      ...cubic(middle, along(middle, d, k), along(b, hb, k), b).slice(1),
    ]
  }
  // A bend: a longer reach out of one end than into the other.
  const k = span * 0.45
  const lopsided = sway / (span || 1)
  return cubic(
    a,
    along(a, ha, k * (1 + lopsided)),
    along(b, hb, k * (1 - lopsided)),
    b
  )
}

// The half of a drawn line toward one end lifted by `rise` at that end,
// easing in: a ramp. Changes `points`; returns the ramp's side, the lifted
// stretch and the ground under it, as a shape.
function raise(points: Point[], atStart: boolean, rise: number): Point[] {
  const span = Math.floor(points.length / 2)
  const lifted: Point[] = []
  const ground: Point[] = []
  for (let n = 0; n <= span; n++) {
    const index = atStart ? n : points.length - 1 - n
    const t = 1 - n / span
    const eased = t * t * (3 - 2 * t)
    ground.push([points[index][0], points[index][1]])
    points[index] = [points[index][0], points[index][1] - rise * eased]
    lifted.push(points[index])
  }
  return [...lifted, ...ground.reverse()]
}

// The sides of a tile in the order the corners of its top run.
const SIDES: HexDirection[] = ['SE', 'S', 'SW', 'NW', 'N', 'NE']

interface Plateau {
  // The tiles logos may stand on.
  tiles: { top: Point[]; center: Point }[]
  // The edge of the plateau, and how far a logo's rim keeps from each
  // stretch of it.
  edge: { a: Point; b: Point; clear: number }[]
  lines: { points: Point[]; halfWidth: number; closed?: boolean }[]
  // Ground a landmark that reaches past its own tile stands on.
  areas: { x: number; y: number; rx: number; ry: number }[]
}

// A plateau's lattice of spots, in the order they are tried, each with the
// clear ground it has whatever else is placed: the largest circle that could
// stand there.
interface PlateauSpots {
  spots: { at: Point; room: number }[]
  back: number
}

// Spots are a fixed lattice over each tile, tried from the back of the
// plateau forward and in each row from its middle out.
function plateauSpots(
  plateau: Plateau,
  { gap, step }: HexPackOptions
): PlateauSpots {
  const found: Point[] = []
  for (const { top, center } of plateau.tiles) {
    const xs = top.map(p => p[0])
    const ys = top.map(p => p[1])
    const across = Math.ceil((Math.max(...xs) - Math.min(...xs)) / 2 / step)
    const deep = Math.ceil((Math.max(...ys) - Math.min(...ys)) / 2 / step)
    for (let i = -across; i <= across; i++) {
      for (let j = -deep; j <= deep; j++) {
        const spot: Point = [center[0] + i * step, center[1] + j * step]
        if (insideConvex(spot, top)) found.push(spot)
      }
    }
  }
  if (found.length === 0) return { spots: [], back: 0 }
  const middle =
    plateau.tiles.reduce((sum, tile) => sum + tile.center[0], 0) /
    plateau.tiles.length
  const back = Math.min(...found.map(p => p[1]))
  const aside = (p: Point) => Math.abs(p[0] - middle)
  // Rows a whisker apart count as one row (tiles of odd and even columns
  // have lattices half a step out of line).
  const rowOf = (p: Point) => Math.round((p[1] - back) / (step / 2))
  found.sort(
    (a, b) => rowOf(a) - rowOf(b) || aside(a) - aside(b) || a[0] - b[0]
  )
  const roomAt = (spot: Point) => {
    let room = Infinity
    for (const { a, b, clear } of plateau.edge) {
      room = Math.min(room, distanceToStretch(spot, a, b) - clear)
    }
    for (const { points, halfWidth, closed } of plateau.lines) {
      const last = closed ? points.length : points.length - 1
      for (let n = 0; n < last; n++) {
        room = Math.min(
          room,
          distanceToStretch(spot, points[n], points[(n + 1) % points.length]) -
            halfWidth -
            gap / 2
        )
      }
    }
    for (const area of plateau.areas) {
      const reach = Math.hypot(
        (spot[0] - area.x) / area.rx,
        (spot[1] - area.y) / area.ry
      )
      room = Math.min(room, (reach - 1) * Math.min(area.rx, area.ry))
    }
    return room
  }
  return {
    spots: found.map(at => ({ at, room: roomAt(at) })).filter(s => s.room > 0),
    back,
  }
}

/**
 * A spot for each circle, in the order given (the largest first, so they
 * stand at the back and the smaller ones in rows in front of them, where
 * none hides another), or null where there is no room. `skip` leaves that
 * much of the back of the plateau empty.
 */
function packPlateau(
  { spots, back }: PlateauSpots,
  radii: number[],
  { gap }: HexPackOptions,
  skip = 0
): (Point | null)[] {
  const smallest = Math.min(...radii)
  // Spots still worth trying: a placed circle rules out those it covers.
  let open = spots.filter(
    spot => spot.at[1] >= back + skip && spot.room >= smallest
  )
  const placed: Circle[] = []
  return radii.map(radius => {
    const spot = open.find(({ at, room }) => {
      if (room < radius) return false
      for (const other of placed) {
        if (
          Math.hypot(other.x - at[0], other.y - at[1]) <
          other.radius + radius + gap
        ) {
          return false
        }
      }
      return true
    })
    if (!spot) return null
    const [x, y] = spot.at
    placed.push({ x, y, radius })
    open = open.filter(
      ({ at }) => Math.hypot(at[0] - x, at[1] - y) >= radius + smallest + gap
    )
    return spot.at
  })
}

export function layoutHexMap(
  spec: HexMapSpec,
  logos: HexLogo[],
  packing: HexPackOptions = DEFAULT_HEX_PACKING
): HexLayout {
  const { view } = spec
  const districtByCode = new Map(spec.districts.map(d => [d.code, d]))
  const featureByCode = new Map(spec.features.map(f => [f.code, f]))
  for (const { code, height, sunken } of spec.districts) {
    if (sunken ? height !== 0 : !(height > 0)) {
      throw new Error(
        sunken
          ? `Hex map: the sunken district "${code}" lies at height 0`
          : `Hex map: district "${code}" needs a height above 0`
      )
    }
  }
  const where = (tile: HexGridTile) => `column ${tile.col}, row ${tile.row}`

  const parsed = parseHexGrid(spec.tiles)
  const columns = Math.max(...parsed.map(tile => tile.col)) + 1
  const rows = Math.max(...parsed.map(tile => tile.row)) + 1
  for (const tile of parsed) {
    if (
      tile.code !== null &&
      !districtByCode.has(tile.code) &&
      !featureByCode.has(tile.code)
    ) {
      throw new Error(
        `Hex map: "${tile.code}" at ${where(tile)} is no district or feature in the spec`
      )
    }
  }
  const parsedByCell = new Map(parsed.map(tile => [hexKey(tile), tile]))
  const keepCell = parsed.find(
    tile => tile.code !== null && featureByCode.get(tile.code)?.kind === 'keep'
  )
  // What "inland" is measured from: the keep, or the middle of the map.
  const focus = hexCenter(
    keepCell ?? { col: (columns - 1) / 2, row: (rows - 1) / 2 },
    view.size
  )
  const inland = (tile: HexGridTile) => {
    const [x, y] = hexCenter(tile, view.size)
    return Math.hypot(x - focus[0], y - focus[1])
  }

  // Each district's tiles in the order it takes them up.
  const planned = new Map<string, PlannedTile>()
  const tilesOf = new Map<string, PlannedTile[]>()
  for (const { code, height } of spec.districts) {
    const own = parsed.filter(tile => tile.code === code)
    if (own.length === 0) {
      tilesOf.set(code, [])
      continue
    }
    // It starts on its most inland tile and grows tile by tile, always
    // onto the most inland tile that touches what it has: so the tiles it
    // does not need yet are the ones toward the coast.
    const byInland = (a: HexGridTile, b: HexGridTile) =>
      inland(a) - inland(b) || a.col - b.col || a.row - b.row
    const waiting = new Set(own)
    const ordered: HexGridTile[] = []
    const reachable: HexGridTile[] = [[...own].sort(byInland)[0]]
    while (reachable.length > 0) {
      const tile = reachable.sort(byInland).shift()!
      if (!waiting.delete(tile)) continue
      ordered.push(tile)
      for (const direction of HEX_DIRECTIONS) {
        const next = parsedByCell.get(hexKey(hexNeighbor(tile, direction)))
        if (next && waiting.has(next)) reachable.push(next)
      }
    }
    const [apart] = waiting
    if (apart) {
      throw new Error(
        `Hex map: district "${code}" is in more than one part: its tile at ${where(apart)} does not touch the rest`
      )
    }
    const tiles = ordered.map((tile, n) => ({
      ...tile,
      ref: `${code}${n + 1}`,
      order: n + 1,
      height,
    }))
    tiles.forEach(tile => planned.set(hexKey(tile), tile))
    tilesOf.set(code, tiles)
  }
  for (const { code, height } of spec.features) {
    parsed
      .filter(tile => tile.code === code)
      .forEach((tile, n) =>
        planned.set(hexKey(tile), {
          ...tile,
          ref: `${code}${n + 1}`,
          order: n + 1,
          height,
        })
      )
  }
  const neighborOf = (tile: HexGridTile, side: HexDirection) =>
    planned.get(hexKey(hexNeighbor(tile, side)))
  const kindOf = (tile: PlannedTile) => featureByCode.get(tile.code!)?.kind
  // Sea as the tile map paints it: open sea or a cove.
  const isWater = (tile: HexGridTile, side: HexDirection) => {
    const neighbor = neighborOf(tile, side)
    return !neighbor || kindOf(neighbor) === 'water'
  }
  const keep = [...planned.values()].find(tile => kindOf(tile) === 'keep')
  if (keep) {
    for (const side of HEX_DIRECTIONS) {
      const neighbor = neighborOf(keep, side)
      if (
        neighbor &&
        neighbor.height !== keep.height &&
        kindOf(neighbor) !== 'water'
      ) {
        throw new Error(
          `Hex map: the keep stands at height ${keep.height} but the tile "${neighbor.ref}" beside it at ${neighbor.height}; the moat needs them level`
        )
      }
    }
  }

  const flatCenter = (tile: HexGridTile) => hexCenter(tile, view.size)
  const drawn = (tile: PlannedTile, point: Point) =>
    projectPoint(view, point, tile.height)
  const topOf = (tile: PlannedTile, scale = 1) =>
    hexCorners(tile, view.size, scale).map(corner => drawn(tile, corner))

  // Landmarks: on a district's or feature's tiles marked "!", and on the keep.
  const landmarkOn = new Map<
    string,
    HexLandmarkArt & { x: number; y: number; after: string }
  >()
  for (const tile of planned.values()) {
    const art = (
      districtByCode.get(tile.code!) ?? featureByCode.get(tile.code!)
    )?.landmark
    if (!art || (tile.mark !== 'landmark' && tile !== keep)) continue
    const [cx, cy] = drawn(tile, flatCenter(tile))
    // Its foot just short of the front of the tile.
    const depth = (Math.sqrt(3) / 2) * view.size * view.squash
    const front = tile === keep ? neighborOf(tile, 'S') : undefined
    landmarkOn.set(tile.ref, {
      ...art,
      x: cx,
      y: cy + depth * 0.62 - art.height / 2,
      after: front && kindOf(front) !== 'water' ? front.ref : tile.ref,
    })
  }

  // The river and the road, joined up tile by tile.
  const pieces: HexPathPiece[] = []
  const drops: HexPathDrop[] = []
  const ends: HexPathEnd[] = []
  const springs: HexLayout['springs'] = []
  const bridges: HexLayout['bridges'] = []
  // A fixed number from -1 to 1 for a tile.
  const lean = (tile: HexGridTile) => {
    const n = Math.sin(tile.col * 127.1 + tile.row * 311.7) * 43758.5453
    return (n - Math.floor(n)) * 2 - 1
  }
  const joinUp = (kind: 'road' | 'river', width: number) => {
    const marked = [...planned.values()].filter(tile => tile.mark === kind)
    if (marked.length === 0) return
    const nodes = new Set(marked.map(tile => hexKey(tile)))
    if (
      keep &&
      HEX_DIRECTIONS.some(side => nodes.has(hexKey(hexNeighbor(keep, side))))
    ) {
      nodes.add(hexKey(keep))
    }
    const touching = (tile: PlannedTile) =>
      HEX_DIRECTIONS.filter(side => nodes.has(hexKey(hexNeighbor(tile, side))))
    // The river starts at its highest tile (of those, one at the end of a
    // run); the road at the keep, or at one end.
    const candidates = [...nodes].map(key => planned.get(key)!)
    const root =
      kind === 'road'
        ? (candidates.find(tile => tile === keep) ??
          candidates.find(tile => touching(tile).length === 1) ??
          candidates[0])
        : [...candidates].sort(
            (a, b) =>
              b.height - a.height || touching(a).length - touching(b).length
          )[0]

    const parent = new Map<string, PlannedTile | null>([[hexKey(root), null]])
    const widthAt = new Map<string, number>([[hexKey(root), width]])
    const children = new Map<string, PlannedTile[]>()
    const queue = [root]
    while (queue.length > 0) {
      const tile = queue.shift()!
      const next = touching(tile)
        .map(side => neighborOf(tile, side)!)
        .filter(neighbor => !parent.has(hexKey(neighbor)))
      children.set(hexKey(tile), next)
      for (const child of next) {
        if (kind === 'river' && child.height > tile.height) {
          throw new Error(
            `Hex map: the river runs uphill from "${tile.ref}" (height ${tile.height}) to "${child.ref}" (height ${child.height})`
          )
        }
        parent.set(hexKey(child), tile)
        widthAt.set(
          hexKey(child),
          widthAt.get(hexKey(tile))! *
            (kind === 'river' && next.length > 1 && tile !== keep
              ? spec.river.branch
              : 1)
        )
        queue.push(child)
      }
    }
    const stray = marked.find(tile => !parent.has(hexKey(tile)))
    if (stray) {
      throw new Error(
        `Hex map: the ${kind} tile "${stray.ref}" at ${where(stray)} does not touch the rest of the ${kind}`
      )
    }

    for (const key of nodes) {
      const tile = planned.get(key)!
      const own = widthAt.get(key)!
      const above = parent.get(key) ?? null
      const below = children.get(key)!
      const middle = flatCenter(tile)
      const sideTo = (other: PlannedTile) => directionBetween(tile, other)!
      const level = (other: PlannedTile) => other.height === tile.height

      if (tile === keep) {
        if (kind === 'river') {
          const ring = HEX_DIRECTIONS.map(side =>
            neighborOf(tile, side)
          ).filter(
            (neighbor): neighbor is PlannedTile =>
              !!neighbor && kindOf(neighbor) !== 'water'
          )
          const front = neighborOf(tile, 'S')
          pieces.push({
            kind,
            width: own * MOAT_WIDTH,
            tile: front && ring.includes(front) ? front.ref : tile.ref,
            clip: [tile.ref, ...ring.map(neighbor => neighbor.ref)],
            // A round through the middles of the six tiles about the keep:
            // they all lie one tile's width from its own middle.
            points: Array.from({ length: MOAT_POINTS }, (_, n): Point => {
              const angle = (n / MOAT_POINTS) * Math.PI * 2
              const reach = Math.sqrt(3) * view.size
              return drawn(tile, [
                middle[0] + reach * Math.cos(angle),
                middle[1] + reach * Math.sin(angle),
              ])
            }),
            closed: true,
          })
        }
        continue
      }

      // Where it comes in, and each way it goes out: a side, or the middle
      // of the tile where it starts or ends inland.
      const inSide = above ? sideTo(above) : null
      const outSides: (HexDirection | null)[] = below.map(sideTo)
      if (below.length === 0) {
        // The end of a run: out to the sea if it is at the coast, by the
        // side most nearly opposite the one it came in by.
        const turn = (side: HexDirection) =>
          inSide === null
            ? 0
            : Math.abs(
                ((HEX_DIRECTIONS.indexOf(side) -
                  HEX_DIRECTIONS.indexOf(inSide) +
                  9) %
                  6) -
                  3
              )
        // turn() is 3 for the side straight across, 0 for the side it came
        // in by.
        const out = HEX_DIRECTIONS.filter(side => isWater(tile, side)).sort(
          (a, b) => turn(b) - turn(a)
        )[0]
        outSides.push(out ?? null)
        if (out) {
          const from = projectPoint(view, middle, 0)
          const to = projectPoint(view, hexSideMiddle(tile, out, view.size), 0)
          const length = Math.hypot(to[0] - from[0], to[1] - from[1])
          if (kind === 'river' && SOUTH_FACING.includes(out)) {
            // Out over a side the viewer sees: it falls to the sea.
            const [c1, c2] = hexSide(tile, out, view.size)
            const share =
              Math.min(1, own / Math.hypot(c2[0] - c1[0], c2[1] - c1[1])) / 2
            const along = (t: number): Point => [
              c1[0] + (c2[0] - c1[0]) * t,
              c1[1] + (c2[1] - c1[1]) * t,
            ]
            drops.push({
              kind,
              tile: tile.ref,
              a: drawn(tile, along(0.5 - share)),
              b: drawn(tile, along(0.5 + share)),
              fall: tile.height * view.lift,
              visible: true,
            })
          }
          ends.push({
            kind,
            width: own,
            at: to,
            toward: [(to[0] - from[0]) / length, (to[1] - from[1]) / length],
          })
        }
      }
      // Toward the keep it runs only as far as the moat, which passes through
      // the middle of this tile.
      const inland = (side: HexDirection | null) =>
        side === null || neighborOf(tile, side) === keep
      const at = (side: HexDirection | null): Point =>
        inland(side) ? middle : hexSideMiddle(tile, side!, view.size)
      const clip = [
        tile.ref,
        ...[above, ...below]
          .filter((other): other is PlannedTile => !!other && level(other))
          .map(other => other.ref),
      ]
      const toward = (from: Point, to: Point): Point => {
        const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
        return [(to[0] - from[0]) / length, (to[1] - from[1]) / length]
      }
      outSides.forEach((outSide, n) => {
        const child: PlannedTile | undefined = below[n]
        const [a, b] = [at(inSide), at(outSide)]
        // It crosses a side square to it, so it runs on into the next tile
        // without a kink; between the two ends it wanders a little.
        const points = course(
          a,
          inland(inSide) ? toward(a, b) : toward(a, middle),
          b,
          inland(outSide) ? toward(b, a) : toward(b, middle),
          lean(tile) * WANDER * view.size
        ).map(point => drawn(tile, point))
        // A road climbs to a higher tile by a ramp on the lower one.
        const ramps: Point[][] = []
        const rampTo: string[] = []
        if (kind === 'road') {
          const climbs: [PlannedTile | null | undefined, boolean][] = [
            [above, true],
            [child, false],
          ]
          for (const [other, atStart] of climbs) {
            if (!other || other === keep || other.height <= tile.height)
              continue
            ramps.push(
              raise(points, atStart, (other.height - tile.height) * view.lift)
            )
            rampTo.push(other.ref)
          }
        }
        // Where the river runs into the moat, or out of it, it is no wider
        // than the moat, so its end lies wholly in the moat's water.
        const atMoat = (side: HexDirection | null) =>
          kind === 'river' && side !== null && neighborOf(tile, side) === keep
        const moat = own * MOAT_WIDTH * 0.9
        pieces.push({
          kind,
          width: atMoat(inSide) ? moat : own,
          widthEnd: atMoat(outSide)
            ? moat
            : child && child !== keep
              ? widthAt.get(hexKey(child))!
              : own,
          tile: tile.ref,
          clip,
          points,
          ...(ramps.length > 0 ? { ramps, rampTo } : {}),
          ...(kind === 'river' &&
          keep &&
          [inSide, outSide].some(
            side => side !== null && neighborOf(tile, side) === keep
          )
            ? { joinsMoat: true }
            : {}),
        })
      })
      if (kind === 'river' && inSide === null) {
        springs.push({ tile: tile.ref, at: drawn(tile, middle), width: own })
      }
      if (kind === 'road' && above === keep && keep) {
        // Planks over the moat in the middle of the tile, and the road on
        // from them to the castle's gate.
        const edge = hexSideMiddle(tile, sideTo(keep), view.size)
        const [ux, uy] = [edge[0] - middle[0], edge[1] - middle[1]]
        const length = Math.hypot(ux, uy)
        const reach = spec.river.width * MOAT_WIDTH * 0.75
        const front = neighborOf(keep, 'S')
        pieces.push({
          kind,
          width: own,
          tile: tile.ref,
          clip: [tile.ref],
          points: [drawn(tile, middle), drawn(tile, edge)],
        })
        bridges.push({
          tile: front && kindOf(front) !== 'water' ? front.ref : keep.ref,
          width: own,
          a: drawn(tile, [
            middle[0] - (ux / length) * reach,
            middle[1] - (uy / length) * reach,
          ]),
          b: drawn(tile, [
            middle[0] + (ux / length) * reach,
            middle[1] + (uy / length) * reach,
          ]),
        })
      }

      // The river's steps down to the tiles it runs on into. (The road
      // climbs by ramps.)
      for (const child of kind === 'river' ? below : []) {
        if (child === keep || child.height === tile.height) continue
        const [high, low] =
          tile.height > child.height ? [tile, child] : [child, tile]
        const face = directionBetween(high, low)!
        const [c1, c2] = hexSide(high, face, view.size)
        const length = Math.hypot(c2[0] - c1[0], c2[1] - c1[1])
        const share = Math.min(1, widthAt.get(hexKey(child))! / length) / 2
        const along = (t: number): Point => [
          c1[0] + (c2[0] - c1[0]) * t,
          c1[1] + (c2[1] - c1[1]) * t,
        ]
        drops.push({
          kind,
          tile: high.ref,
          a: drawn(high, along(0.5 - share)),
          b: drawn(high, along(0.5 + share)),
          fall: (high.height - low.height) * view.lift,
          visible: SOUTH_FACING.includes(face),
          ...(SOUTH_FACING.includes(face) && districtByCode.get(high.code!)?.dam
            ? { dam: true }
            : {}),
        })
      }
    }
  }
  joinUp('river', spec.river.width)
  joinUp('road', spec.road.width)

  // A district's pier: out from one of its shores, into a cove for choice,
  // and on a side the viewer sees for choice.
  for (const { code, pier } of spec.districts) {
    if (!pier) continue
    const shores = (tilesOf.get(code) ?? []).flatMap(tile =>
      HEX_DIRECTIONS.filter(side => isWater(tile, side)).map(side => ({
        tile,
        side,
        // Of equal shores, the one farthest out: it is the least likely to
        // lie hidden behind higher ground.
        worth:
          (neighborOf(tile, side) ? 2 : 0) +
          (SOUTH_FACING.includes(side) ? 1 : 0) +
          inland(tile) / 1000,
      }))
    )
    const best = shores.sort((a, b) => b.worth - a.worth)[0]
    if (!best) {
      throw new Error(
        `Hex map: district "${code}" is to have a pier but has no shore`
      )
    }
    const from = projectPoint(view, flatCenter(best.tile), 0)
    const to = projectPoint(
      view,
      hexSideMiddle(best.tile, best.side, view.size),
      0
    )
    const length = Math.hypot(to[0] - from[0], to[1] - from[1])
    ends.push({
      kind: 'pier',
      width: spec.road.width,
      at: to,
      toward: [(to[0] - from[0]) / length, (to[1] - from[1]) / length],
    })
  }

  // Each district's logos onto its plateau: its first tiles, then one more,
  // and so on until all its logos have room. Tiles the river, the road or a
  // landmark are on are part of the plateau from the start.
  const positions = new Map<string, { x: number; y: number }>()
  const unplaced: string[] = []
  const used = new Set<string>()
  const districtByName = new Map(spec.districts.map(d => [d.district, d]))
  for (const logo of logos) {
    if (!districtByName.has(logo.district)) unplaced.push(logo.id)
  }
  const plateauOf = (tiles: PlannedTile[], overWater = false): Plateau => {
    const open = tiles.filter(tile => !landmarkOn.has(tile.ref))
    const within = new Set(open.map(tile => hexKey(tile)))
    const refs = new Set(open.map(tile => tile.ref))
    return {
      tiles: open.map(tile => ({
        top: topOf(tile),
        center: drawn(tile, flatCenter(tile)),
      })),
      edge: open.flatMap(tile => {
        const top = topOf(tile)
        return SIDES.flatMap((side, n) => {
          const neighbor = neighborOf(tile, side)
          if (neighbor && within.has(hexKey(neighbor))) return []
          // A taller tile standing in front covers the ground behind it.
          const covered =
            neighbor && SOUTH_FACING.includes(side)
              ? Math.max(0, neighbor.height - tile.height) * view.lift
              : 0
          return [
            { a: top[n], b: top[(n + 1) % 6], clear: packing.margin + covered },
          ]
        })
      }),
      lines: pieces
        .filter(
          piece =>
            piece.clip.some(ref => refs.has(ref)) &&
            !(overWater && piece.kind === 'river')
        )
        .map(piece => ({
          points: piece.points,
          halfWidth: piece.width / 2,
          closed: piece.closed,
        })),
      // The castle is larger than the keep's tile.
      areas:
        keep && landmarkOn.has(keep.ref)
          ? [landmarkOn.get(keep.ref)!].map(mark => ({
              x: mark.x,
              y: mark.y + mark.height * 0.12,
              rx: mark.width * 0.47,
              ry: mark.height * 0.4,
            }))
          : [],
    }
  }
  for (const { code, district, minTiles = 1, overWater } of spec.districts) {
    const tiles = tilesOf.get(code)!
    const fixed = tiles.filter(tile => tile.mark !== null)
    const own = logos
      .filter(logo => logo.district === district)
      .sort(
        (a, b) =>
          b.radius - a.radius ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id)
      )
    const plateauTiles = (count: number) =>
      tiles.filter((tile, n) => n < count || fixed.includes(tile))
    if (own.length === 0) {
      // Nobody lives there yet, but its river, road and landmark stand.
      fixed.forEach(tile => used.add(tile.ref))
      continue
    }
    const radii = own.map(logo => logo.radius)
    const whole = (found: (Point | null)[]) =>
      found.every(spot => spot !== null)
    // Rows are filled from the back of the plateau, or from a little way
    // in (which can pack better, the back of a plateau being ragged). The
    // fewest tiles that hold everything win; of the starts that fit on them,
    // the middle one, so the logos stand in the middle of the plateau's
    // depth and not all at its back.
    let spots: (Point | null)[] = own.map(() => null)
    let taken = 0
    for (
      let count = spec.takeAllTiles
        ? tiles.length
        : Math.min(minTiles, tiles.length);
      count <= tiles.length;
      count++
    ) {
      taken = count
      const plateau = plateauSpots(
        plateauOf(plateauTiles(count), overWater),
        packing
      )
      const depth =
        Math.max(0, ...plateau.spots.map(spot => spot.at[1])) - plateau.back
      const fitting: (Point | null)[][] = []
      for (let skip = 0; skip <= depth; skip += CENTERING_STEP) {
        const found = packPlateau(plateau, radii, packing, skip)
        if (whole(found)) fitting.push(found)
      }
      if (fitting.length > 0) {
        spots = fitting[Math.floor((fitting.length - 1) / 2)]
        break
      }
      if (count === tiles.length) {
        spots = packPlateau(plateau, radii, packing)
      }
    }
    own.forEach((logo, n) => {
      const at = spots[n]
      if (at) positions.set(logo.id, { x: at[0], y: at[1] })
      else unplaced.push(logo.id)
    })
    plateauTiles(taken).forEach(tile => used.add(tile.ref))
  }

  // The sea comes in from the edge of the map over open sea and over planned
  // growth nobody needs yet.
  const floods = (tile: HexGridTile) => {
    const plan = planned.get(hexKey(tile))
    return !plan || (districtByCode.has(plan.code!) && !used.has(plan.ref))
  }
  const flooded = new Set<string>()
  const seaQueue = parsed.filter(
    tile =>
      floods(tile) &&
      (tile.col === 0 ||
        tile.row === 0 ||
        tile.col === columns - 1 ||
        tile.row === rows - 1)
  )
  seaQueue.forEach(tile => flooded.add(hexKey(tile)))
  while (seaQueue.length > 0) {
    const tile = seaQueue.pop()!
    for (const direction of HEX_DIRECTIONS) {
      const neighbor = parsedByCell.get(hexKey(hexNeighbor(tile, direction)))
      if (neighbor && floods(neighbor) && !flooded.has(hexKey(neighbor))) {
        flooded.add(hexKey(neighbor))
        seaQueue.push(neighbor)
      }
    }
  }

  const realmDistricts = new Map<string, string[]>()
  for (const { realm, district } of spec.districts) {
    realmDistricts.set(realm, [...(realmDistricts.get(realm) ?? []), district])
  }
  // The keep takes the tone of the district round it.
  const keepDistrict = keep
    ? HEX_DIRECTIONS.map(side => neighborOf(keep, side))
        .map(neighbor => neighbor && districtByCode.get(neighbor.code!))
        .find(found => !!found)
    : undefined
  const tiles: HexLaidTile[] = backToFront(parsed).map(tile => {
    const plan = planned.get(hexKey(tile))
    const district = plan ? districtByCode.get(plan.code!) : undefined
    const feature = plan ? featureByCode.get(plan.code!) : undefined
    const state: HexTileState = feature
      ? feature.kind
      : flooded.has(hexKey(tile)) || !district
        ? 'sea'
        : used.has(plan!.ref)
          ? 'used'
          : 'spare'
    // Sea lies flat at the level of the water, whatever height the land
    // planned there has.
    const laid: PlannedTile = {
      ...tile,
      ref: plan?.ref ?? '',
      order: plan?.order ?? 0,
      height: state === 'sea' || !plan ? 0 : plan.height,
    }
    const realm = district?.realm ?? feature?.realm ?? null
    return {
      ...laid,
      ref: plan?.ref ?? null,
      state,
      sunken: district?.sunken === true && state !== 'sea',
      walled: district?.walled === true && state !== 'sea',
      cover: state === 'sea' ? null : (district?.cover ?? null),
      ground: state === 'sea' ? null : (district?.ground ?? null),
      district: state === 'sea' ? null : (district?.district ?? null),
      realm: state === 'sea' ? null : realm,
      tone:
        realmDistricts
          .get(realm ?? '')
          ?.indexOf(
            (district ?? (feature?.kind === 'keep' ? keepDistrict : undefined))
              ?.district ?? ''
          ) ?? 0,
      tones: realm ? (realmDistricts.get(realm)?.length ?? 1) : 1,
      center: drawn(laid, flatCenter(tile)),
      top: topOf(laid),
      edges: [],
      coast: [],
      landmark: state === 'sea' ? null : (landmarkOn.get(laid.ref) ?? null),
    }
  })

  // A side is the edge of its district unless the tile across it is land of
  // the same district.
  const laidByCell = new Map(tiles.map(tile => [hexKey(tile), tile]))
  for (const tile of tiles) {
    tile.edges = SIDES.map(side => {
      const neighbor = laidByCell.get(hexKey(hexNeighbor(tile, side)))
      return !(
        neighbor &&
        neighbor.state !== 'sea' &&
        tile.district !== null &&
        neighbor.district === tile.district
      )
    })
  }

  for (const tile of tiles) {
    tile.coast = SIDES.map(side => {
      const neighbor = laidByCell.get(hexKey(hexNeighbor(tile, side)))
      return !neighbor || neighbor.state === 'sea' || neighbor.sunken
    })
  }

  // The nearest tile is looked at first: it covers the ones behind it.
  const frontToBack = [...tiles].reverse()
  const districtAt = (x: number, y: number) => {
    for (const tile of frontToBack) {
      if (tile.state === 'sea') continue
      if (insideConvex([x, y], tile.top)) return tile.district
    }
    return null
  }

  return {
    view,
    tiles,
    columns,
    rows,
    positions,
    unplaced,
    pieces,
    drops,
    ends,
    springs,
    bridges,
    districtAt,
  }
}

/** Every land tile is reached from every other without crossing the sea, but
 *  for the groups of tiles named as islands of their own (by district code).
 *  Returns the names of tiles cut off from the main land. */
export function strandedTiles(layout: HexLayout, islands: string[]): string[] {
  const land = layout.tiles.filter(
    tile =>
      tile.state !== 'sea' &&
      !(tile.code !== null && islands.includes(tile.code))
  )
  if (land.length === 0) return []
  const byCell = new Map(land.map(tile => [hexKey(tile), tile]))
  const reached = new Set<string>([hexKey(land[0])])
  const queue = [land[0]]
  while (queue.length > 0) {
    const tile = queue.pop()!
    for (const direction of HEX_DIRECTIONS) {
      const neighbor = byCell.get(hexKey(hexNeighbor(tile, direction)))
      if (neighbor && !reached.has(hexKey(neighbor))) {
        reached.add(hexKey(neighbor))
        queue.push(neighbor)
      }
    }
  }
  // The main land is the larger part.
  const cut = land.filter(tile => !reached.has(hexKey(tile)))
  const stranded =
    cut.length > land.length / 2
      ? land.filter(tile => reached.has(hexKey(tile)))
      : cut
  return stranded.map(tile => tile.ref!)
}
