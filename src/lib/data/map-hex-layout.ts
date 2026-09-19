// PROTOTYPE Map 3.5, "Hex work" view: from the hand-made tile map and the
// logos to a laid-out board.
//
// The tile map (map-hex-spec.ts) says which tile is which district's, and in
// what order a district takes its tiles up. Here each district's logos are
// put into fixed spots on its tiles, the first tile first, and a district
// uses only as many tiles as its logos need. A listed tile nobody needs yet
// is planned growth: it is sea while the sea can reach it, and bare land if
// it is landlocked.
//
// Logos are upright circles on a squashed tile, so their spots are worked out
// on the tile's top as it is drawn: a fine fixed lattice over the top, tried
// from the back of the tile forward, the largest logos first. A spot has to keep clear
// of the tile's rim, of a taller tile standing in front, of the road or river
// crossing the tile, and of the landmark standing on it.
//
// Roads and rivers run tile to tile through the middle of the side two tiles
// share, bending through the middle of each tile. Where one steps down a side
// the viewer can see, the layout says so (a "drop"): a river falls there.
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
  hexSideMiddle,
  insetConvex,
  insideConvex,
  parseHexGrid,
  projectPoint,
  HEX_DIRECTIONS,
  type HexDirection,
  type HexGridTile,
  type HexView,
  type Point,
} from './map-hex'

export interface HexDistrictSpec {
  // The letters its tiles carry on the tile map.
  code: string
  // The District and Realm field values.
  district: string
  realm: string
}

// A tile that is no district's: water inside the coast (a cove), or scenery
// in the look of a realm (a peak nobody is listed on).
export interface HexFeatureSpec {
  code: string
  kind: 'water' | 'scenery'
  realm?: string
}

export interface HexLandmarkSpec {
  // The tile it stands on, by its name on the tile map.
  tile: string
  // The symbol's id in the landmarks sprite.
  symbol: string
  // Size as drawn, in map grid units.
  width: number
  height: number
  // 'none': the tile is the landmark's alone. 'around': it stands at the back
  // of the tile and logos take the rest.
  logos: 'none' | 'around'
}

export interface HexPathSpec {
  kind: 'road' | 'river'
  // As drawn, in map grid units.
  width: number
  // The tiles it runs through, in order, each touching the next.
  tiles: string[]
  // The side it comes in by on its first tile, or leaves by on its last (the
  // coast, say). Without one it starts or ends in the middle of the tile.
  enter?: HexDirection
  exit?: HexDirection
}

export interface HexMapSpec {
  view: HexView
  tiles: string
  heights: string
  districts: HexDistrictSpec[]
  features: HexFeatureSpec[]
  landmarks: HexLandmarkSpec[]
  paths: HexPathSpec[]
  // The tile a river circles as a moat instead of crossing.
  moat?: string
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
  // Map grid units a logo keeps from the tile's rim, and from other logos.
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
  // A district's tile with logos on it (or its landmark).
  | 'used'
  // Listed for a district, not needed yet, and landlocked: bare land.
  | 'spare'
  // Open sea, or planned growth the sea still covers.
  | 'sea'
  | 'water'
  | 'scenery'

export interface HexLaidTile extends HexGridTile {
  state: HexTileState
  district: string | null
  realm: string | null
  // The district's place among its realm's, to pick a tone of its ground by.
  tone: number
  // As drawn: the middle and the six corners of the top (E, SE, SW, W, NW,
  // NE), at the tile's height.
  center: Point
  top: Point[]
  landmark: (HexLandmarkSpec & { x: number; y: number }) | null
}

export interface HexPathPiece {
  kind: 'road' | 'river'
  width: number
  // The tile it lies on, and its line as drawn.
  tile: string
  points: Point[]
  closed?: boolean
  // Where a road crosses a moat.
  bridge?: [Point, Point]
}

// A road or river stepping down a side the viewer sees: drawn on that face of
// the higher tile, from `top` straight down to `bottom`.
export interface HexPathDrop {
  kind: 'road' | 'river'
  width: number
  tile: string
  top: Point
  bottom: Point
}

export interface HexLayout {
  view: HexView
  // Every tile of the map, the farthest first.
  tiles: HexLaidTile[]
  columns: number
  rows: number
  positions: Map<string, { x: number; y: number }>
  // Logos no listed tile had room for, or whose district is not on the map.
  unplaced: string[]
  pieces: HexPathPiece[]
  drops: HexPathDrop[]
  districtAt: (x: number, y: number) => string | null
}

interface Circle {
  x: number
  y: number
  radius: number
}
interface Ellipse {
  x: number
  y: number
  rx: number
  ry: number
}

// Share of a tile's size at which a moat circles it.
export const MOAT_RING = 0.76

const CURVE_STEPS = 8

// From a, bending through the control point, to b.
function bend(a: Point, control: Point, b: Point): Point[] {
  const points: Point[] = []
  for (let n = 0; n <= CURVE_STEPS; n++) {
    const t = n / CURVE_STEPS
    const u = 1 - t
    points.push([
      u * u * a[0] + 2 * u * t * control[0] + t * t * b[0],
      u * u * a[1] + 2 * u * t * control[1] + t * t * b[1],
    ])
  }
  return points
}

/**
 * Spots for the circles, in the order given, on a fixed lattice over the
 * convex `room`, from its back edge forward.
 * Returns a spot or null for each circle. `placed` is added to.
 */
export function packCircles(
  room: Point[],
  radii: number[],
  placed: Circle[],
  keepOff: {
    lines: { points: Point[]; halfWidth: number }[]
    areas: Ellipse[]
  },
  { gap, step }: HexPackOptions
): (Point | null)[] {
  if (room.length < 3) return radii.map(() => null)
  const xs = room.map(p => p[0])
  const ys = room.map(p => p[1])
  const middle: Point = [
    (Math.min(...xs) + Math.max(...xs)) / 2,
    (Math.min(...ys) + Math.max(...ys)) / 2,
  ]
  const spots: Point[] = []
  const across = Math.ceil((Math.max(...xs) - Math.min(...xs)) / 2 / step)
  const deep = Math.ceil((Math.max(...ys) - Math.min(...ys)) / 2 / step)
  for (let i = -across; i <= across; i++) {
    for (let j = -deep; j <= deep; j++) {
      const spot: Point = [middle[0] + i * step, middle[1] + j * step]
      if (insideConvex(spot, room)) spots.push(spot)
    }
  }
  // From the back of the tile forward, and in each row from the middle out:
  // the largest logos, which come first, stand in a row at the back, and the
  // smaller ones in rows in front of them, where none hides another.
  const aside = (p: Point) => Math.abs(p[0] - middle[0])
  spots.sort((a, b) => a[1] - b[1] || aside(a) - aside(b) || a[0] - b[0])

  const fits = (spot: Point, radius: number) => {
    for (let n = 0; n < room.length; n++) {
      if (
        distanceToStretch(spot, room[n], room[(n + 1) % room.length]) < radius
      ) {
        return false
      }
    }
    for (const other of placed) {
      if (
        Math.hypot(other.x - spot[0], other.y - spot[1]) <
        other.radius + radius + gap
      ) {
        return false
      }
    }
    for (const { points, halfWidth } of keepOff.lines) {
      for (let n = 0; n + 1 < points.length; n++) {
        if (
          distanceToStretch(spot, points[n], points[n + 1]) <
          radius + halfWidth + gap / 2
        ) {
          return false
        }
      }
    }
    for (const area of keepOff.areas) {
      const dx = (spot[0] - area.x) / (area.rx + radius)
      const dy = (spot[1] - area.y) / (area.ry + radius)
      if (dx * dx + dy * dy < 1) return false
    }
    return true
  }

  return radii.map(radius => {
    const spot = spots.find(candidate => fits(candidate, radius))
    if (!spot) return null
    placed.push({ x: spot[0], y: spot[1], radius })
    return spot
  })
}

export function layoutHexMap(
  spec: HexMapSpec,
  logos: HexLogo[],
  packing: HexPackOptions = DEFAULT_HEX_PACKING
): HexLayout {
  const { view } = spec
  const grid = parseHexGrid(spec.tiles, spec.heights)
  const columns = Math.max(...grid.map(tile => tile.col)) + 1
  const rows = Math.max(...grid.map(tile => tile.row)) + 1
  const byCell = new Map(grid.map(tile => [hexKey(tile), tile]))
  const byRef = new Map(
    grid.flatMap(tile => (tile.ref ? [[tile.ref, tile] as const] : []))
  )
  const districtByCode = new Map(spec.districts.map(d => [d.code, d]))
  const featureByCode = new Map(spec.features.map(f => [f.code, f]))

  for (const tile of grid) {
    if (
      tile.code !== null &&
      !districtByCode.has(tile.code) &&
      !featureByCode.has(tile.code)
    ) {
      throw new Error(
        `Hex map: tile "${tile.ref}" is of no district or feature in the spec`
      )
    }
    if (
      tile.code !== null &&
      tile.height === 0 &&
      districtByCode.has(tile.code)
    ) {
      throw new Error(`Hex map: land tile "${tile.ref}" has height 0`)
    }
  }
  const needTile = (ref: string, forWhat: string) => {
    const tile = byRef.get(ref)
    if (!tile)
      throw new Error(
        `Hex map: ${forWhat} names tile "${ref}", which is not on the map`
      )
    return tile
  }

  // Each district's tiles in its order, which must run 1, 2, 3...
  const tilesOf = new Map<string, HexGridTile[]>()
  for (const { code } of spec.districts) {
    const own = grid
      .filter(tile => tile.code === code)
      .sort((a, b) => a.order! - b.order!)
    own.forEach((tile, n) => {
      if (tile.order !== n + 1) {
        throw new Error(
          `Hex map: the tiles of "${code}" should be numbered 1 to ${own.length} with none missing; found "${tile.ref}"`
        )
      }
    })
    tilesOf.set(code, own)
  }

  const flatCenter = (tile: HexGridTile) => hexCenter(tile, view.size)
  const drawn = (tile: HexGridTile, point: Point) =>
    projectPoint(view, point, tile.height)
  const topOf = (tile: HexGridTile, scale = 1) =>
    hexCorners(tile, view.size, scale).map(corner => drawn(tile, corner))

  // Landmarks, standing at the back of their tile or alone in its middle.
  const landmarkOn = new Map<
    string,
    HexLandmarkSpec & { x: number; y: number }
  >()
  for (const landmark of spec.landmarks) {
    const tile = needTile(landmark.tile, `landmark "${landmark.symbol}"`)
    const [cx, cy] = drawn(tile, flatCenter(tile))
    // Its foot a little behind the middle of the tile, or a little in front
    // when the tile is its alone.
    const depth = (Math.sqrt(3) / 2) * view.size * view.squash
    const foot = cy + depth * (landmark.logos === 'none' ? 0.45 : -0.12)
    landmarkOn.set(landmark.tile, {
      ...landmark,
      x: cx,
      y: foot - landmark.height / 2,
    })
  }

  // Roads and rivers: a piece on each tile they cross, and the drops.
  const pieces: HexPathPiece[] = []
  const drops: HexPathDrop[] = []
  for (const path of spec.paths) {
    const tiles = path.tiles.map(ref => needTile(ref, `a ${path.kind}`))
    if (path.kind === 'river') {
      tiles.forEach((tile, n) => {
        if (n > 0 && tile.height > tiles[n - 1].height) {
          throw new Error(
            `Hex map: the river runs uphill from "${tiles[n - 1].ref}" to "${tile.ref}"`
          )
        }
      })
    }
    const sides = tiles.map((tile, n) => {
      const side = (other: HexGridTile | undefined) => {
        if (!other) return null
        const direction = directionBetween(tile, other)
        if (!direction) {
          throw new Error(
            `Hex map: a ${path.kind} runs from "${tile.ref}" to "${other.ref}", which do not touch`
          )
        }
        return direction
      }
      return {
        from: n === 0 ? (path.enter ?? null) : side(tiles[n - 1]),
        to: n === tiles.length - 1 ? (path.exit ?? null) : side(tiles[n + 1]),
      }
    })
    tiles.forEach((tile, n) => {
      const middle = drawn(tile, flatCenter(tile))
      const at = (direction: HexDirection | null, scale = 1) =>
        direction === null
          ? middle
          : drawn(tile, hexSideMiddle(tile, direction, view.size, scale))
      const { from, to } = sides[n]
      const base = { kind: path.kind, width: path.width, tile: tile.ref! }
      if (tile.ref === spec.moat && path.kind === 'river') {
        // In to the ring, round it, and out.
        if (from)
          pieces.push({ ...base, points: [at(from), at(from, MOAT_RING)] })
        pieces.push({ ...base, points: topOf(tile, MOAT_RING), closed: true })
        if (to) pieces.push({ ...base, points: [at(to, MOAT_RING), at(to)] })
      } else if (tile.ref === spec.moat) {
        const gate = from ?? to
        pieces.push({
          ...base,
          points: [at(from), at(to)],
          bridge: gate
            ? [at(gate, MOAT_RING + 0.14), at(gate, MOAT_RING - 0.14)]
            : undefined,
        })
      } else {
        pieces.push({ ...base, points: bend(at(from), middle, at(to)) })
      }

      // A step between this tile and the next, on a face the viewer sees.
      const next = tiles[n + 1]
      if (next && next.height !== tile.height) {
        const [high, low] =
          tile.height > next.height ? [tile, next] : [next, tile]
        const face = directionBetween(high, low)!
        if (SOUTH_FACING.includes(face)) {
          const edge = hexSideMiddle(high, face, view.size)
          drops.push({
            kind: path.kind,
            width: path.width,
            tile: high.ref!,
            top: projectPoint(view, edge, high.height),
            bottom: projectPoint(view, edge, low.height),
          })
        }
      }
    })
  }

  // Where logos may stand on a tile: its top, in from the rim, and in from
  // whatever a taller tile in front covers.
  const roomOf = (tile: HexGridTile) => {
    const sides: HexDirection[] = ['SE', 'S', 'SW', 'NW', 'N', 'NE']
    return insetConvex(
      topOf(tile),
      sides.map(side => {
        const neighbor = byCell.get(hexKey(hexNeighbor(tile, side)))
        const covered =
          neighbor && SOUTH_FACING.includes(side)
            ? Math.max(0, neighbor.height - tile.height) * view.lift
            : 0
        return packing.margin + covered
      })
    )
  }

  // Each district's logos onto its tiles: the largest first, each on the
  // first of the district's tiles that has room.
  const positions = new Map<string, { x: number; y: number }>()
  const unplaced: string[] = []
  const used = new Set<string>()
  const districtByName = new Map(spec.districts.map(d => [d.district, d]))
  for (const logo of logos) {
    if (!districtByName.has(logo.district)) unplaced.push(logo.id)
  }
  for (const { code, district } of spec.districts) {
    const own = logos
      .filter(logo => logo.district === district)
      .sort(
        (a, b) =>
          b.radius - a.radius ||
          a.name.localeCompare(b.name) ||
          a.id.localeCompare(b.id)
      )
    const tiles = tilesOf.get(code)!
    const state = tiles.map(tile => {
      const landmark = landmarkOn.get(tile.ref!)
      return {
        tile,
        open: landmark?.logos !== 'none',
        room: roomOf(tile),
        placed: [] as Circle[],
        keepOff: {
          lines: pieces
            .filter(piece => piece.tile === tile.ref)
            .map(piece => ({
              points: piece.points,
              halfWidth: piece.width / 2,
            })),
          areas: landmark
            ? [
                {
                  x: landmark.x,
                  y: landmark.y + landmark.height * 0.22,
                  rx: landmark.width * 0.42,
                  ry: landmark.height * 0.26,
                },
              ]
            : [],
        },
      }
    })
    let last = -1
    for (const logo of own) {
      let at: Point | null = null
      for (let n = 0; n < state.length && !at; n++) {
        if (!state[n].open) continue
        ;[at] = packCircles(
          state[n].room,
          [logo.radius],
          state[n].placed,
          state[n].keepOff,
          packing
        )
        if (at) last = Math.max(last, n)
      }
      if (at) positions.set(logo.id, { x: at[0], y: at[1] })
      else unplaced.push(logo.id)
    }
    // Every tile up to the last one needed is land, a landmark's own tile
    // among them.
    tiles.forEach((tile, n) => {
      const alone = landmarkOn.get(tile.ref!)?.logos === 'none'
      if (n <= last || (alone && own.length > 0 && n <= last + 1)) {
        used.add(tile.ref!)
      }
    })
  }

  // The sea comes in from the edge of the map over open sea and over planned
  // growth nobody needs yet.
  const floods = (tile: HexGridTile) =>
    tile.code === null ||
    (districtByCode.has(tile.code) && !used.has(tile.ref!))
  const flooded = new Set<string>()
  const queue = grid.filter(
    tile =>
      floods(tile) &&
      (tile.col === 0 ||
        tile.row === 0 ||
        tile.col === columns - 1 ||
        tile.row === rows - 1)
  )
  queue.forEach(tile => flooded.add(hexKey(tile)))
  while (queue.length > 0) {
    const tile = queue.pop()!
    for (const direction of HEX_DIRECTIONS) {
      const neighbor = byCell.get(hexKey(hexNeighbor(tile, direction)))
      if (neighbor && floods(neighbor) && !flooded.has(hexKey(neighbor))) {
        flooded.add(hexKey(neighbor))
        queue.push(neighbor)
      }
    }
  }

  const realmDistricts = new Map<string, string[]>()
  for (const { realm, district } of spec.districts) {
    realmDistricts.set(realm, [...(realmDistricts.get(realm) ?? []), district])
  }
  const tiles: HexLaidTile[] = backToFront(grid).map(tile => {
    const district = tile.code ? districtByCode.get(tile.code) : undefined
    const feature = tile.code ? featureByCode.get(tile.code) : undefined
    const sea = flooded.has(hexKey(tile))
    const state: HexTileState = feature
      ? feature.kind
      : sea || !district
        ? 'sea'
        : used.has(tile.ref!)
          ? 'used'
          : 'spare'
    // Sea lies flat at the level of the water, whatever height the land
    // planned there has.
    const level = state === 'sea' ? 0 : tile.height
    const laid = { ...tile, height: level }
    return {
      ...laid,
      state,
      district: state === 'sea' ? null : (district?.district ?? null),
      realm:
        state === 'sea' ? null : (district?.realm ?? feature?.realm ?? null),
      tone: district
        ? realmDistricts.get(district.realm)!.indexOf(district.district)
        : 0,
      center: drawn(laid, flatCenter(tile)),
      top: topOf(laid),
      landmark:
        state === 'sea' ? null : (landmarkOn.get(tile.ref ?? '') ?? null),
    }
  })

  // The nearest tile is looked at first: it covers the ones behind it.
  const frontToBack = [...tiles].reverse()
  const districtAt = (x: number, y: number) => {
    for (const tile of frontToBack) {
      if (tile.state === 'sea') continue
      if (insideConvex([x, y], tile.top)) return tile.district
    }
    return null
  }

  const land = new Set(
    tiles.filter(tile => tile.state !== 'sea').map(tile => tile.ref)
  )
  return {
    view,
    tiles,
    columns,
    rows,
    positions,
    unplaced,
    pieces: pieces.filter(piece => land.has(piece.tile)),
    drops: drops.filter(drop => land.has(drop.tile)),
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
