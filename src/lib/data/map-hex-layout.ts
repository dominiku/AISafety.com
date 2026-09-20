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
  clipConvex,
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
  // Moved this far from its usual place on its tile (map grid units).
  shift?: [number, number]
  // A light that burns in the art (a lighthouse's lantern): where it sits
  // inside the symbol's box, as a share of its width and its height.
  lit?: [number, number]
}

export type HexCover =
  | 'forest'
  | 'grove'
  | 'thicket'
  | 'fields'
  | 'vineyard'
  | 'hamlet'
  | 'dunes'
  | 'hills'
  | 'meadow'
  | 'tropical'
  | 'oasis'
  | 'huts'
  | 'thermals'

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
  // It has no tiles of its own: its logos stand on the slopes of the
  // escarpment (the tiles marked "^") of the district with this code.
  onSlopesOf?: string
  // A village on stilts: its ground is a deck of planks, and what shows
  // under its edges toward the viewer is not cliff but the posts it stands on.
  stilts?: boolean
  // Pieces of scenery (hot springs, geysers) spread out over its ground,
  // this many: each has a place of its own, and the logos stand round them.
  scenery?: number
  // A building of its own stands in the middle of its most central tile,
  // and its logos round it.
  building?: 'capitol' | 'school' | 'forum'
  // A footpath leads from its building to the landmark of the district
  // with this code.
  pathTo?: string
  // A beach: along its sides to the sea its top has a band of damp sand in
  // place of a rim, and its face is wet sand with foam at the waterline. It
  // keeps to its tiles' outlines, as every district does.
  beach?: boolean
  // The flank of a volcano: its sides toward the viewer slope, more gently
  // than an escarpment's, and smooth.
  cone?: boolean
  // Not land at all: its logos lie on open water (the closed orgs, as
  // sunken ships). Its tiles are not drawn and its height is 0.
  sunken?: boolean
  // Stands on the district's tile marked "!", which then holds no logos.
  landmark?: HexLandmarkArt
}

// A tile that is no district's: water inside the coast (a cove), scenery in
// the look of a realm (a peak), a crater (the top of a volcano, with a lake
// in it), or the keep: the one tile the river circles as a moat and the road
// ends at.
export interface HexFeatureSpec {
  code: string
  kind: 'water' | 'scenery' | 'crater' | 'keep'
  realm?: string
  // Levels above the sea; 0 for water.
  height: number
  // On the feature's tiles marked "!"; on the keep itself.
  landmark?: HexLandmarkArt
  // Water a ship is sailing into from the west (the harbor newcomers
  // arrive at).
  arrival?: boolean
}

export interface HexMapSpec {
  view: HexView
  tiles: string
  districts: HexDistrictSpec[]
  features: HexFeatureSpec[]
  // Widths as drawn, in map grid units. Where the river parts, each arm is
  // `branch` times as wide as the stream above.
  // `headwater`: how wide the river is, as a share of its width, from its
  // source down to the first lake it runs into (a stream, not yet a river).
  river: { width: number; branch: number; headwater?: number }
  road: { width: number }
  // Lakes on a district's ground (a reservoir): each lies over part of each
  // of its cells (column, row), a lobe to a cell, all run together; the
  // district's logos stand round it. `dam` names the sides of cells (toward
  // the viewer) where a dam holds it back: the lake reaches that side, the
  // cliff under it is the dam's wall, and a river leaving over it goes down
  // a spillway.
  lakes?: {
    cells: [number, number][]
    // The lake's oval on each cell, for a lake shaped by hand: how far its
    // middle lies from the cell's (across, down) and how large it is (across,
    // deep), in tile sizes. Without it a cell's oval is worked out.
    ovals?: { shift: [number, number]; size: [number, number] }[]
    // The lake covers the whole of its cells, edge to edge: no logo stands
    // on them, and its shore is their outline.
    whole?: boolean
    dam: [number, number, HexDirection][]
  }[]
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
  | 'crater'
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
  // An escarpment (marked "^"): its sides toward the viewer lean out as
  // slopes of bare banded rock down onto the land in front.
  scarp: boolean
  // Its district is a village on stilts (see HexDistrictSpec.stilts).
  stilts: boolean
  // Its district meets the sea with a beach (see HexDistrictSpec.beach).
  beach: boolean
  // How far its sides toward the viewer lean out for each level they drop
  // (map grid units on the ground): an escarpment's, a volcano's, or 0 for
  // sheer cliffs.
  slope: number
  // A tile of a pier (marked "+"): its state is 'water' and it lies at sea
  // level, with this strip of planks over it at its district's height, which
  // is all of the tile a logo may stand on; `along` is the way the pier runs,
  // toward the land.
  deck: { shape: Point[]; along: Point; height: number } | null
  // Its district's building (see HexDistrictSpec.building).
  building: 'capitol' | 'school' | 'forum' | null
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
  // `pond`: where a district with scenery of its own has the great pond its
  // river rises from: back from the middle of the tile, away from the side
  // the stream leaves by. Logos keep off it.
  springs: {
    tile: string
    at: Point
    width: number
    pond?: { x: number; y: number; rx: number; ry: number }
  }[]
  // Planks where the road crosses the moat, drawn once `tile` is.
  bridges: { tile: string; a: Point; b: Point; width: number }[]
  // Districts' own buildings: the middle of the foot, the width, and the
  // level the building stands at.
  buildings: {
    district: string
    kind: 'capitol' | 'school' | 'forum'
    x: number
    y: number
    width: number
    height: number
  }[]
  // Lakes: their lobes as drawn (ellipses), the level they lie at, a tile
  // of the plateau they lie on; and the sides of tiles that are dam walls
  // (`side` counts as the corners of a tile's top run: 0 SE, 1 S, 2 SW).
  lakes: {
    tile: string
    height: number
    lobes: { x: number; y: number; rx: number; ry: number }[]
    // For a lake that covers the whole of its tiles: those tiles.
    whole: string[] | null
  }[]
  dams: { tile: string; side: number }[]
  // Places kept for scenery (see HexDistrictSpec.scenery): every second
  // one is for something tall (a geyser), with clear air above it.
  scenery: { district: string; x: number; y: number; tall: boolean }[]
  // Where a ship is coming in (see HexFeatureSpec.arrival): the middle of
  // its waterline, in the middle of the harbor's water.
  arrivals: Point[]
  // Footpaths from a building to another district's landmark.
  paths: { points: Point[]; width: number }[]
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

// How far a slope leans out for each level it drops (map grid units on the
// ground): an escarpment's, and a volcano's.
const SCARP_RUN = 0.45
const CONE_RUN = 0.35

// The great pond a river rises from: how wide, and how far back from the
// middle of its tile (map grid units).
const POND_SIZE = 3
const POND_BACK = 1
const POND_CLEAR = 0.72

// The clear ground a piece of scenery needs, and how far apart pieces keep
// (map grid units).
const SCENERY_ROOM = 0.7
const SCENERY_APART = 2.2

// How far a logo keeps in from the edge of a slope it stands on.
const SLOPE_MARGIN = 0.1

// How wide a district's building stands, and a footpath (map grid units).
const BUILDING_WIDTH = { capitol: 1.7, school: 1.7, forum: 1.1 }
const PATH_WIDTH = 0.26

// A pier's deck: half its width, and how far past the middle of its last tile
// its head reaches (map grid units).
const DECK_HALF_WIDTH = 0.3
const DECK_HEAD = 1.1

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
  const slopeOf = (tile: PlannedTile) => {
    const district = districtByCode.get(tile.code!)
    if (tile.mark === 'scarp') return SCARP_RUN
    return district?.cone || kindOf(tile) === 'crater' ? CONE_RUN : 0
  }
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
      x: cx + (art.shift?.[0] ?? 0),
      y: cy + depth * 0.62 - art.height / 2 + (art.shift?.[1] ?? 0),
      after: front && kindOf(front) !== 'water' ? front.ref : tile.ref,
    })
  }

  // Decks: a district's tiles marked "+" are a pier. Each is water with a
  // strip of planks over it, running straight between the sides it shares
  // with the rest of its district; on a pier's last tile it ends a little
  // past the middle, so that open water lies beyond the pier's head.
  const deckOn = new Map<string, NonNullable<HexLaidTile['deck']>>()
  for (const tile of planned.values()) {
    if (tile.mark !== 'deck') continue
    if (!districtByCode.has(tile.code!)) {
      throw new Error(
        `Hex map: the deck at ${where(tile)} belongs to no district`
      )
    }
    const touching = SIDES.map((side, n) => ({ side, n })).filter(
      ({ side }) => neighborOf(tile, side)?.code === tile.code
    )
    // It runs between two opposite sides where it can (whatever else of its
    // district it brushes past), and otherwise out from the one side.
    const through = touching.filter(({ n }) =>
      touching.some(other => other.n === (n + 3) % 6)
    )
    const joined = through.length === 2 ? through : touching
    if (joined.length !== through.length && joined.length !== 1) {
      throw new Error(
        `Hex map: the deck "${tile.ref}" at ${where(tile)} touches ${joined.length} tiles of its district, no two of them on opposite sides; a pier runs straight`
      )
    }
    const center = drawn(tile, flatCenter(tile))
    const middle = drawn(tile, hexSideMiddle(tile, joined[0].side, view.size))
    const reach = Math.hypot(middle[0] - center[0], middle[1] - center[1])
    const along: Point = [
      (middle[0] - center[0]) / reach,
      (middle[1] - center[1]) / reach,
    ]
    const across: Point = [-along[1], along[0]]
    const aside = (sign: number): Point => [
      center[0] + across[0] * DECK_HALF_WIDTH * sign,
      center[1] + across[1] * DECK_HALF_WIDTH * sign,
    ]
    let shape = clipConvex(topOf(tile), aside(1), [-across[0], -across[1]])
    shape = clipConvex(shape, aside(-1), across)
    if (joined.length === 1) {
      shape = clipConvex(
        shape,
        [center[0] - along[0] * DECK_HEAD, center[1] - along[1] * DECK_HEAD],
        along
      )
    }
    deckOn.set(tile.ref, {
      shape,
      along,
      height: tile.height,
    })
  }
  for (const { code } of spec.districts) {
    const tiles = tilesOf.get(code) ?? []
    if (tiles.length > 0 && tiles.every(tile => tile.mark === 'deck')) {
      throw new Error(
        `Hex map: district "${code}" is all deck; a pier starts from a tile of solid ground`
      )
    }
  }

  // Lakes: a lobe over part of each cell, drawn toward the middle of the
  // lake, or toward a dam where the cell has one.
  const damSides = new Set<string>()
  const lakeCells = new Set<string>()
  // Tiles wholly under a lake: no logo stands on them.
  const drowned = new Set<string>()
  // The tile below each dam, and the lake tile whose water comes down to it.
  const damFed = new Map<string, string>()
  const lakes: HexLayout['lakes'] = []
  const lakeAreas = new Map<string, HexLayout['lakes'][number]['lobes']>()
  for (const lake of spec.lakes ?? []) {
    const cells = lake.cells.map(([col, row]) => {
      const tile = planned.get(hexKey({ col, row }))
      if (!tile || !districtByCode.has(tile.code!)) {
        throw new Error(
          `Hex map: a lake lies at column ${col}, row ${row}, which is no district's tile`
        )
      }
      return tile
    })
    if (new Set(cells.map(tile => tile.code)).size !== 1) {
      throw new Error('Hex map: a lake lies on one district, not across two')
    }
    for (const [col, row, side] of lake.dam) {
      damSides.add(`${hexKey({ col, row })}|${side}`)
      const below = hexKey(hexNeighbor({ col, row }, side))
      if (!damFed.has(below)) damFed.set(below, hexKey({ col, row }))
    }
    const centers = cells.map(tile => drawn(tile, flatCenter(tile)))
    const heart: Point = [
      centers.reduce((sum, point) => sum + point[0], 0) / centers.length,
      centers.reduce((sum, point) => sum + point[1], 0) / centers.length,
    ]
    const lobes = cells.map((tile, n) => {
      const oval = lake.ovals?.[n]
      if (oval) {
        return {
          x: centers[n][0] + oval.shift[0] * view.size,
          y: centers[n][1] + oval.shift[1] * view.size * view.squash,
          rx: oval.size[0] * view.size,
          ry: oval.size[1] * view.size * view.squash,
        }
      }
      const dammed = lake.dam.filter(
        ([col, row]) => col === tile.col && row === tile.row
      )
      // Toward its dam (far enough to reach that side), or toward the heart.
      const toward: Point =
        dammed.length > 0
          ? (() => {
              const middles = dammed.map(([, , side]) =>
                drawn(tile, hexSideMiddle(tile, side, view.size))
              )
              return [
                middles.reduce((sum, point) => sum + point[0], 0) /
                  middles.length,
                middles.reduce((sum, point) => sum + point[1], 0) /
                  middles.length,
              ] as Point
            })()
          : heart
      const pull = dammed.length > 0 ? 0.5 : 0.45
      // No two lobes quite one size.
      const rx =
        view.size *
        (0.62 + 0.1 * Math.abs(Math.sin(tile.col * 127.1 + tile.row * 311.7)))
      return {
        x: centers[n][0] + (toward[0] - centers[n][0]) * pull,
        y: centers[n][1] + (toward[1] - centers[n][1]) * pull,
        rx,
        ry: rx * view.squash * 0.95,
      }
    })
    cells.forEach(tile => lakeCells.add(hexKey(tile)))
    lakes.push({
      tile: cells[0].ref,
      height: cells[0].height,
      lobes,
      whole: lake.whole ? cells.map(tile => tile.ref) : null,
    })
    if (lake.whole) {
      cells.forEach(tile => drowned.add(tile.ref))
    } else {
      lakeAreas.set(cells[0].code!, [
        ...(lakeAreas.get(cells[0].code!) ?? []),
        ...lobes,
      ])
    }
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
    // The river's source is a stream, where the spec says so, down to the
    // first lake.
    const headwaters = new Set<string>()
    const stream =
      kind === 'river' &&
      spec.river.headwater !== undefined &&
      !lakeCells.has(hexKey(root))
    if (stream) headwaters.add(hexKey(root))
    const widthAt = new Map<string, number>([
      [hexKey(root), stream ? width * spec.river.headwater! : width],
    ])
    const children = new Map<string, PlannedTile[]>()
    const queue = [root]
    while (queue.length > 0) {
      const tile = queue.shift()!
      const next = touching(tile)
        .map(side => neighborOf(tile, side)!)
        .filter(neighbor => !parent.has(hexKey(neighbor)))
        // Water below a dam comes over that dam, and from nowhere else.
        .filter(
          neighbor =>
            kind !== 'river' ||
            (damFed.get(hexKey(neighbor)) ?? hexKey(tile)) === hexKey(tile)
        )
      children.set(hexKey(tile), next)
      for (const child of next) {
        if (kind === 'river' && child.height > tile.height) {
          throw new Error(
            `Hex map: the river runs uphill from "${tile.ref}" (height ${tile.height}) to "${child.ref}" (height ${child.height})`
          )
        }
        parent.set(hexKey(child), tile)
        // A stream above the first lake; the full river from the lake on.
        const stream =
          headwaters.has(hexKey(tile)) && !lakeCells.has(hexKey(child))
        if (stream) headwaters.add(hexKey(child))
        widthAt.set(
          hexKey(child),
          headwaters.has(hexKey(tile)) && !stream
            ? width
            : widthAt.get(hexKey(tile))! *
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
        // (Round the keep it runs on as the moat, which is joined up apart.)
        const byKeep = (at: PlannedTile) =>
          !!keep && HEX_DIRECTIONS.some(side => neighborOf(at, side) === keep)
        const intoMoat =
          byKeep(tile) ||
          HEX_DIRECTIONS.some(side => {
            const next = neighborOf(tile, side)
            return !!next && next.mark === 'river' && byKeep(next)
          })
        // (Or it ends in the pool of an oasis.)
        const intoOasis = districtByCode.get(tile.code!)?.cover === 'oasis'
        if (!out && kind === 'river' && !intoMoat && !intoOasis) {
          throw new Error(
            `Hex map: the river tile "${tile.ref}" at ${where(tile)} is a dead end inland: an arm of the river leads there and nowhere on. Mark the tiles on to the coast, or take its mark away`
          )
        }
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
          // Over a dam it goes down a spillway.
          ...(SOUTH_FACING.includes(face) &&
          (districtByCode.get(high.code!)?.dam ||
            damSides.has(`${hexKey(high)}|${face}`))
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
        // ...and not into water that high ground in front of it hides.
        worth:
          (neighborOf(tile, side) ? 2 : 0) +
          (SOUTH_FACING.includes(side) ? 1 : 0) -
          (planned.get(hexKey(hexNeighbor(hexNeighbor(tile, side), 'S')))
            ?.height ?? 0) /
            2 +
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

  const sceneryOf = new Map<string, HexLayout['scenery']>()
  // A district's building stands in the middle of a tile: the one nearest
  // the middle of the district (of the tiles with no river, road or
  // landmark) that leaves all its logos room.
  const buildingOf = new Map<string, HexLayout['buildings'][number]>()
  // Where it might stand: the middle of each such tile, the most central
  // first. It takes the first where all the district's logos still fit.
  const sitesOf = new Map<string, HexLayout['buildings']>()
  for (const { code, district, building } of spec.districts) {
    const tiles = tilesOf.get(code) ?? []
    if (!building || tiles.length === 0) continue
    const free = tiles.filter(tile => tile.mark === null)
    if (free.length === 0) {
      throw new Error(
        `Hex map: district "${code}" has no tile free of river, road and landmark for its ${building}`
      )
    }
    const centers = tiles.map(tile => drawn(tile, flatCenter(tile)))
    const heart: Point = [
      centers.reduce((sum, point) => sum + point[0], 0) / centers.length,
      centers.reduce((sum, point) => sum + point[1], 0) / centers.length,
    ]
    const away = (tile: PlannedTile) => {
      const [x, y] = drawn(tile, flatCenter(tile))
      return Math.hypot(x - heart[0], y - heart[1])
    }
    const width = BUILDING_WIDTH[building]
    sitesOf.set(
      code,
      [...free]
        .sort((a, b) => away(a) - away(b))
        .map(site => {
          const [x, y] = drawn(site, flatCenter(site))
          return {
            district,
            kind: building,
            x,
            y: y + width * 0.24,
            width,
            height: site.height,
          }
        })
    )
    buildingOf.set(code, sitesOf.get(code)![0])
  }
  // A footpath from a building to another district's landmark, in an easy
  // curve. Logos of both districts keep off it.
  const paths: (HexLayout['paths'][number] & { codes: string[] })[] = []
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
    const open = tiles.filter(
      tile => !landmarkOn.has(tile.ref) && !drowned.has(tile.ref)
    )
    const within = new Set(open.map(tile => hexKey(tile)))
    const refs = new Set(open.map(tile => tile.ref))
    return {
      tiles: open.map(tile => ({
        top: deckOn.get(tile.ref)?.shape ?? topOf(tile),
        center: drawn(tile, flatCenter(tile)),
      })),
      edge: open.flatMap(tile => {
        const top = topOf(tile)
        const deck = deckOn.get(tile.ref)?.shape
        if (deck) {
          // A logo keeps to the planks: clear of every side of the strip but
          // where it runs on onto the next tile of the district.
          const runsOn = (a: Point, b: Point) =>
            SIDES.some((side, n) => {
              const neighbor = neighborOf(tile, side)
              return (
                !!neighbor &&
                within.has(hexKey(neighbor)) &&
                [a, b].every(
                  point =>
                    distanceToStretch(point, top[n], top[(n + 1) % 6]) < 1e-6
                )
              )
            })
          return deck.flatMap((a, n) => {
            const b = deck[(n + 1) % deck.length]
            return runsOn(a, b) ? [] : [{ a, b, clear: packing.margin }]
          })
        }
        return SIDES.flatMap((side, n) => {
          const neighbor = neighborOf(tile, side)
          if (neighbor && within.has(hexKey(neighbor))) return []
          // A taller tile standing in front covers the ground behind it.
          const covered =
            neighbor && SOUTH_FACING.includes(side)
              ? Math.max(0, neighbor.height - tile.height) * view.lift
              : 0
          // A slope leaning out from a higher tile behind lies on this one.
          // (As drawn, its reach is squashed straight toward the viewer, and
          // less so to either side.)
          const under = side === 'N' ? view.squash : 0.8
          const foot =
            neighbor && ['NW', 'N', 'NE'].includes(side)
              ? slopeOf(neighbor) *
                Math.max(0, neighbor.height - tile.height) *
                under
              : 0
          return [
            {
              a: top[n],
              b: top[(n + 1) % 6],
              clear: packing.margin + covered + foot,
            },
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
        }))
        .concat(
          paths
            .filter(path => path.codes.includes(tiles[0]?.code ?? ''))
            .map(path => ({
              points: path.points,
              halfWidth: path.width / 2,
              closed: undefined,
            }))
        ),
      // The castle is larger than the keep's tile; and a district's building
      // stands among its logos.
      areas: [
        ...(keep && landmarkOn.has(keep.ref)
          ? [landmarkOn.get(keep.ref)!].map(mark => ({
              x: mark.x,
              y: mark.y + mark.height * 0.12,
              rx: mark.width * 0.47,
              ry: mark.height * 0.4,
            }))
          : []),
        // Logos stand clear of the pool a river rises from, where the
        // district has scenery of its own (its spring is a large hot one).
        ...(sceneryOf.has(tiles[0]?.code ?? '')
          ? springs
              .filter(spring => refs.has(spring.tile))
              // (Off its water; its crust of sulphur may run under them.)
              .flatMap(spring =>
                spring.pond
                  ? [
                      {
                        ...spring.pond,
                        rx: spring.pond.rx * POND_CLEAR,
                        ry: spring.pond.ry * POND_CLEAR,
                      },
                    ]
                  : []
              )
          : []),
        // Logos stand clear of scenery: of all of something tall.
        ...(sceneryOf.get(tiles[0]?.code ?? '') ?? []).map(site =>
          site.tall
            ? { x: site.x, y: site.y - 0.45, rx: 0.45, ry: 0.8 }
            : { x: site.x, y: site.y, rx: 0.62, ry: 0.42 }
        ),
        // Logos stand round a lake, not on it.
        ...(lakeAreas.get(tiles[0]?.code ?? '') ?? []).map(lobe => ({
          x: lobe.x,
          y: lobe.y,
          rx: lobe.rx + 0.12,
          ry: lobe.ry + 0.12,
        })),
        ...[buildingOf.get(tiles[0]?.code ?? '')].flatMap(building =>
          building
            ? [
                {
                  x: building.x,
                  y: building.y - building.width * 0.22,
                  rx: building.width * 0.5,
                  ry: building.width * 0.3,
                },
              ]
            : []
        ),
      ],
    }
  }
  // The slopes of a district's escarpment, as they are drawn: each side of a
  // tile marked "^" that looks toward the viewer over lower land leans out
  // from its lip to its foot on that land. Another district's logos may
  // stand on them.
  const SLOPE_OUT: Point[] = [
    [0.866, 0.5],
    [0, 1],
    [-0.866, 0.5],
  ]
  const slopesOf = (code: string): Point[][] =>
    (tilesOf.get(code) ?? [])
      .filter(tile => tile.mark === 'scarp')
      .flatMap(tile => {
        const top = topOf(tile)
        return (['SE', 'S', 'SW'] as const).flatMap((side, k) => {
          const front = neighborOf(tile, side)
          const ground =
            front && kindOf(front) !== 'water' && !deckOn.has(front.ref)
              ? front.height
              : 0
          if (ground <= 0 || ground >= tile.height) return []
          const run = SCARP_RUN * (tile.height - ground)
          const reach: Point = [
            SLOPE_OUT[k][0] * run,
            SLOPE_OUT[k][1] * run * view.squash +
              (tile.height - ground) * view.lift,
          ]
          const [a, b] = [top[k], top[k + 1]]
          return [
            [
              a,
              b,
              [b[0] + reach[0], b[1] + reach[1]],
              [a[0] + reach[0], a[1] + reach[1]],
            ] as Point[],
          ]
        })
      })
  const slopeGround = new Map<string, Point[][]>()
  for (const { code, district, onSlopesOf } of spec.districts) {
    if (!onSlopesOf) continue
    const slopes = slopesOf(onSlopesOf)
    if (slopes.length === 0) {
      throw new Error(
        `Hex map: district "${code}" is to stand on the slopes of "${onSlopesOf}", which has no tile marked "^" with lower land in front`
      )
    }
    slopeGround.set(district, slopes)
    slopeGround.set(code, slopes)
  }
  const slopePlateau = (slopes: Point[][]): Plateau => ({
    tiles: slopes.map(slope => ({
      top: slope,
      center: [
        slope.reduce((sum, point) => sum + point[0], 0) / slope.length,
        slope.reduce((sum, point) => sum + point[1], 0) / slope.length,
      ],
    })),
    edge: slopes.flatMap(slope =>
      slope.map((a, n) => ({
        a,
        b: slope[(n + 1) % slope.length],
        clear: SLOPE_MARGIN,
      }))
    ),
    lines: [],
    areas: [],
  })

  // The great pond a river rises from, in a district with scenery of its own.
  for (const spring of springs) {
    const tile = [...planned.values()].find(at => at.ref === spring.tile)
    if (!tile || !districtByCode.get(tile.code!)?.scenery) continue
    const first = pieces.find(
      piece => piece.kind === 'river' && piece.tile === spring.tile
    )
    const toward = first
      ? first.points[Math.floor(first.points.length / 2)]
      : ([spring.at[0] - 1, spring.at[1]] as Point)
    const [dx, dy] = [toward[0] - spring.at[0], toward[1] - spring.at[1]]
    const length = Math.hypot(dx, dy) || 1
    spring.pond = {
      x: spring.at[0] - (dx / length) * POND_BACK,
      y: spring.at[1] - (dy / length) * POND_BACK * 0.35 + 0.32,
      rx: POND_SIZE / 2,
      ry: (POND_SIZE / 2) * view.squash,
    }
  }

  // Scenery: places spread as far from each other (and from the spring a
  // river rises at) as the district's ground allows, each with room round it.
  const scenery: HexLayout['scenery'] = []
  for (const { code, district, scenery: count } of spec.districts) {
    const tiles = tilesOf.get(code) ?? []
    if (!count || tiles.length === 0) continue
    const refs = new Set(tiles.map(tile => tile.ref))
    const open = plateauSpots(plateauOf(tiles), packing).spots.filter(
      spot => spot.room >= SCENERY_ROOM
    )
    const taken: Point[] = springs
      .filter(spring => refs.has(spring.tile))
      .map(spring =>
        spring.pond ? ([spring.pond.x, spring.pond.y] as Point) : spring.at
      )
    const apart = (at: Point) =>
      Math.min(
        ...taken.map(other =>
          // Depth counts for more than breadth on a board seen at a slant.
          Math.hypot(other[0] - at[0], (other[1] - at[1]) / view.squash)
        )
      )
    const sites: HexLayout['scenery'] = []
    for (let n = 0; n < count && open.length > 0; n++) {
      const best =
        taken.length === 0
          ? open[Math.floor(open.length / 2)]
          : open.reduce((far, spot) =>
              apart(spot.at) > apart(far.at) ? spot : far
            )
      if (taken.length > 0 && apart(best.at) < SCENERY_APART) break
      taken.push(best.at)
      sites.push({ district, x: best.at[0], y: best.at[1], tall: n % 2 === 1 })
    }
    if (sites.length < count) {
      console.warn(
        `Hex map: district "${code}" has room for ${sites.length} of its ${count} pieces of scenery`
      )
    }
    scenery.push(...sites)
    sceneryOf.set(code, sites)
  }

  const packDistrict = ({
    code,
    district,
    minTiles = 1,
    overWater,
  }: HexDistrictSpec) => {
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
      return { own, spots: [] as (Point | null)[], tiles: fixed }
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
      const slopes = slopeGround.get(code)
      const plateau = plateauSpots(
        slopes
          ? slopePlateau(slopes)
          : plateauOf(plateauTiles(count), overWater),
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
    return { own, spots, tiles: plateauTiles(taken) }
  }
  // Buildings first: each tries its sites until its district's logos all fit
  // (and keeps the most central if none does; the logos left over are
  // reported as unplaced).
  for (const district of spec.districts) {
    const sites = sitesOf.get(district.code)
    if (!sites) continue
    const fits = sites.find(site => {
      buildingOf.set(district.code, site)
      return packDistrict(district).spots.every(spot => spot !== null)
    })
    buildingOf.set(district.code, fits ?? sites[0])
  }
  const buildings = [...buildingOf.values()]
  for (const { code, pathTo } of spec.districts) {
    if (!pathTo) continue
    const from = buildingOf.get(code)
    const target = (tilesOf.get(pathTo) ?? []).find(tile =>
      landmarkOn.has(tile.ref)
    )
    if (!from || !target) {
      throw new Error(
        `Hex map: district "${code}" has a path to "${pathTo}", which needs a building here and a landmark there`
      )
    }
    const mark = landmarkOn.get(target.ref)!
    // It ends at the landmark's near corner, on the side it comes from.
    const side = Math.sign(from.x - mark.x) || 1
    const to: Point = [
      mark.x + side * mark.width * 0.42,
      mark.y + mark.height * 0.42,
    ]
    const [dx, dy] = [to[0] - from.x, to[1] - from.y]
    const length = Math.hypot(dx, dy)
    const points = Array.from({ length: 13 }, (_, n): Point => {
      const t = n / 12
      const sway = Math.sin(t * Math.PI * 2) * 0.18
      return [
        from.x + dx * t - (dy / length) * sway,
        from.y + dy * t + (dx / length) * sway,
      ]
    })
    paths.push({ points, width: PATH_WIDTH, codes: [code, pathTo] })
  }

  for (const district of spec.districts) {
    const { own, spots, tiles } = packDistrict(district)
    own.forEach((logo, n) => {
      const at = spots[n]
      if (at) positions.set(logo.id, { x: at[0], y: at[1] })
      else unplaced.push(logo.id)
    })
    tiles.forEach(tile => used.add(tile.ref))
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
      : plan && deckOn.has(plan.ref)
        ? 'water'
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
      height:
        state === 'sea' || !plan || deckOn.has(plan.ref) ? 0 : plan.height,
    }
    const realm = district?.realm ?? feature?.realm ?? null
    return {
      ...laid,
      ref: plan?.ref ?? null,
      state,
      sunken: district?.sunken === true && state !== 'sea',
      walled: district?.walled === true && state !== 'sea',
      stilts: district?.stilts === true && state !== 'sea',
      building: state === 'sea' ? null : (district?.building ?? null),
      scarp: plan?.mark === 'scarp' && state !== 'sea',
      beach: district?.beach === true && state !== 'sea',
      slope: state === 'sea' || !plan ? 0 : slopeOf(plan),
      deck: state === 'sea' ? null : (deckOn.get(laid.ref) ?? null),
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
    // A slope lies in front of everything it leans over.
    for (const { district, onSlopesOf } of spec.districts) {
      if (!onSlopesOf) continue
      const on = slopeGround.get(district) ?? []
      if (on.some(slope => insideConvex([x, y], slope))) return district
    }
    for (const tile of frontToBack) {
      if (tile.state === 'sea') continue
      if (insideConvex([x, y], tile.deck?.shape ?? tile.top)) {
        return tile.district
      }
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
    scenery,
    arrivals: spec.features
      .filter(feature => feature.arrival)
      .flatMap(feature => {
        const water = [...planned.values()].filter(
          tile => tile.code === feature.code
        )
        if (water.length === 0) return []
        // Well inside the harbor, making for the road's end, so that it
        // reads as coming in and not as a boat on the open sea: the middle
        // of the water, its wake trailing back out through the mouth.
        const middles = water.map(tile =>
          projectPoint(view, flatCenter(tile), 0)
        )
        return [
          [
            middles.reduce((sum, point) => sum + point[0], 0) / middles.length,
            middles.reduce((sum, point) => sum + point[1], 0) / middles.length,
          ] as Point,
        ]
      }),
    lakes,
    dams: [...damSides].map(key => {
      const [cell, side] = key.split('|')
      return {
        tile: planned.get(cell)!.ref,
        side: ['SE', 'S', 'SW'].indexOf(side),
      }
    }),
    buildings,
    paths: paths.map(({ points, width }) => ({ points, width })),
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
