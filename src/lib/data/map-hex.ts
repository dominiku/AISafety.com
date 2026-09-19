// PROTOTYPE Map 3.5, "Hex work" view: the maths of a hexagonal board.
//
// The board is a plain flat grid of flat-topped hexagons (points to the east
// and west, flat edges to the north and south), in columns: every odd column
// sits half a tile lower than the even ones beside it. All the logic of the
// map (which tiles touch, which district a tile is, where logos go) is worked
// out on this flat grid. Only drawing tilts it: projectPoint squashes the
// board toward the viewer, who looks from the south, and lifts a tile by its
// height.
//
// Also here: reading the hand-editable tile map (parseHexGrid), two blocks of
// text with one token per tile, laid out the way the tiles lie.
//
// Dependency-free, so it can be unit tested.

export type Point = [number, number]

export interface HexCell {
  col: number
  row: number
}

// The six sides of a flat-topped tile, clockwise from the top.
export type HexDirection = 'N' | 'NE' | 'SE' | 'S' | 'SW' | 'NW'
export const HEX_DIRECTIONS: HexDirection[] = ['N', 'NE', 'SE', 'S', 'SW', 'NW']
// The sides whose faces a viewer in the south sees.
export const SOUTH_FACING: HexDirection[] = ['SW', 'S', 'SE']

const OPPOSITE: Record<HexDirection, HexDirection> = {
  N: 'S',
  NE: 'SW',
  SE: 'NW',
  S: 'N',
  SW: 'NE',
  NW: 'SE',
}
export const oppositeDirection = (direction: HexDirection) =>
  OPPOSITE[direction]

export const hexKey = ({ col, row }: HexCell) => `${col},${row}`

const isOdd = (col: number) => Math.abs(col) % 2 === 1

/** The tile across the given side. */
export function hexNeighbor(cell: HexCell, direction: HexDirection): HexCell {
  const { col, row } = cell
  // An odd column sits half a tile lower, so its sideways neighbors are the
  // same row and the one below; an even column's are the row above and the
  // same row.
  const upper = isOdd(col) ? row : row - 1
  switch (direction) {
    case 'N':
      return { col, row: row - 1 }
    case 'S':
      return { col, row: row + 1 }
    case 'NE':
      return { col: col + 1, row: upper }
    case 'SE':
      return { col: col + 1, row: upper + 1 }
    case 'NW':
      return { col: col - 1, row: upper }
    case 'SW':
      return { col: col - 1, row: upper + 1 }
  }
}

/** The side of `from` that `to` lies across, or null if they don't touch. */
export function directionBetween(
  from: HexCell,
  to: HexCell
): HexDirection | null {
  for (const direction of HEX_DIRECTIONS) {
    const neighbor = hexNeighbor(from, direction)
    if (neighbor.col === to.col && neighbor.row === to.row) return direction
  }
  return null
}

/** The middle of a tile on the flat board; `size` is middle to corner. */
export function hexCenter({ col, row }: HexCell, size: number): Point {
  return [
    1.5 * size * col,
    Math.sqrt(3) * size * (row + (isOdd(col) ? 0.5 : 0)),
  ]
}

/** A tile's corners on the flat board, clockwise from the east point:
 *  E, SE, SW, W, NW, NE. `scale` under 1 gives a smaller hexagon about the
 *  same middle. */
export function hexCorners(cell: HexCell, size: number, scale = 1): Point[] {
  const [cx, cy] = hexCenter(cell, size)
  return [0, 1, 2, 3, 4, 5].map((n): Point => {
    const angle = (Math.PI / 3) * n
    return [
      cx + size * scale * Math.cos(angle),
      cy + size * scale * Math.sin(angle),
    ]
  })
}

// Which two corners (as hexCorners numbers them) each side runs between.
const SIDE_CORNERS: Record<HexDirection, [number, number]> = {
  SE: [0, 1],
  S: [1, 2],
  SW: [2, 3],
  NW: [3, 4],
  N: [4, 5],
  NE: [5, 0],
}

/** The two ends of a tile's side on the flat board. */
export function hexSide(
  cell: HexCell,
  direction: HexDirection,
  size: number,
  scale = 1
): [Point, Point] {
  const corners = hexCorners(cell, size, scale)
  const [a, b] = SIDE_CORNERS[direction]
  return [corners[a], corners[b]]
}

/** The middle of a tile's side: where a road or river crosses to the next. */
export function hexSideMiddle(
  cell: HexCell,
  direction: HexDirection,
  size: number,
  scale = 1
): Point {
  const [a, b] = hexSide(cell, direction, size, scale)
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

// How the flat board is shown: squashed toward the viewer and each tile
// lifted by its height.
export interface HexView {
  // Middle to corner of a tile, in map grid units.
  size: number
  // Share of its flat depth a tile keeps on screen (1 = seen from above).
  squash: number
  // Map grid units a tile rises per level of height.
  lift: number
  // Where the middle of tile 0,0 is drawn.
  origin: Point
}

/** A flat-board point, standing at `level`, as drawn. */
export function projectPoint(
  view: HexView,
  [x, y]: Point,
  level: number
): Point {
  return [
    view.origin[0] + x,
    view.origin[1] + y * view.squash - level * view.lift,
  ]
}

/** Tiles in the order to draw them, the farthest first, so a nearer tile
 *  (and whatever stands on it) covers the ones behind it. */
export function backToFront<T extends HexCell>(cells: T[]): T[] {
  const depth = (cell: HexCell) => cell.row + (isOdd(cell.col) ? 0.5 : 0)
  return [...cells].sort((a, b) => depth(a) - depth(b) || a.col - b.col)
}

export interface HexGridTile extends HexCell {
  // The tile's name on the tile map, e.g. "Gm2"; null for open sea.
  ref: string | null
  // The letters of the name: which district or feature the tile is.
  code: string | null
  // The number of the name: the tile's place in its district's order.
  order: number | null
  // Levels above the sea; 0 for open sea.
  height: number
}

const SEA_TOKEN = '..'

function gridRows(text: string, what: string): string[][] {
  const rows = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line !== '' && !line.startsWith('#'))
    .map(line => line.split(/\s+/))
  if (rows.length === 0) throw new Error(`Hex map: the ${what} block is empty`)
  const width = rows[0].length
  rows.forEach((row, n) => {
    if (row.length !== width) {
      throw new Error(
        `Hex map: row ${n} of the ${what} block has ${row.length} tiles, the first row has ${width}`
      )
    }
  })
  return rows
}

/**
 * Reads the tile map: `tiles` has one token per tile ("..": open sea, or
 * letters and a number such as "Gm2"), `heights` one whole number per tile, in
 * rows of the same length. Lines starting with # are notes. Anything malformed
 * throws, so a slip of the hand is caught when the map is built.
 */
export function parseHexGrid(tiles: string, heights: string): HexGridTile[] {
  const tokens = gridRows(tiles, 'tiles')
  const levels = gridRows(heights, 'heights')
  if (
    tokens.length !== levels.length ||
    tokens[0].length !== levels[0].length
  ) {
    throw new Error(
      `Hex map: the tiles block is ${tokens[0].length} by ${tokens.length}, the heights block ${levels[0].length} by ${levels.length}`
    )
  }
  const seen = new Set<string>()
  const grid: HexGridTile[] = []
  tokens.forEach((line, row) => {
    line.forEach((token, col) => {
      const height = Number(levels[row][col])
      if (!Number.isInteger(height) || height < 0) {
        throw new Error(
          `Hex map: height "${levels[row][col]}" at column ${col}, row ${row} is not a whole number`
        )
      }
      if (token === SEA_TOKEN) {
        if (height !== 0) {
          throw new Error(
            `Hex map: open sea at column ${col}, row ${row} has height ${height}`
          )
        }
        grid.push({ col, row, ref: null, code: null, order: null, height: 0 })
        return
      }
      const match = /^([A-Za-z]+)(\d+)$/.exec(token)
      if (!match) {
        throw new Error(
          `Hex map: "${token}" at column ${col}, row ${row} is neither ".." nor letters and a number`
        )
      }
      if (seen.has(token)) {
        throw new Error(`Hex map: tile "${token}" is on the map twice`)
      }
      seen.add(token)
      grid.push({
        col,
        row,
        ref: token,
        code: match[1],
        order: Number(match[2]),
        height,
      })
    })
  })
  return grid
}

// ---------------------------------------------------------------------------
// Shapes on the screen: the top of a tile as a logo sees it.

/** Whether the point is inside the convex polygon (or on its edge). */
export function insideConvex(point: Point, polygon: Point[]): boolean {
  let sign = 0
  for (let n = 0; n < polygon.length; n++) {
    const [ax, ay] = polygon[n]
    const [bx, by] = polygon[(n + 1) % polygon.length]
    const cross = (bx - ax) * (point[1] - ay) - (by - ay) * (point[0] - ax)
    if (Math.abs(cross) < 1e-9) continue
    if (sign !== 0 && Math.sign(cross) !== sign) return false
    sign = Math.sign(cross)
  }
  return true
}

/**
 * The convex polygon with each side moved inward by its own amount (`insets`
 * has one per side, the side from corner n to corner n + 1). Empty if nothing
 * is left.
 */
export function insetConvex(polygon: Point[], insets: number[]): Point[] {
  const middle: Point = [
    polygon.reduce((sum, p) => sum + p[0], 0) / polygon.length,
    polygon.reduce((sum, p) => sum + p[1], 0) / polygon.length,
  ]
  let kept = polygon
  polygon.forEach((from, n) => {
    const to = polygon[(n + 1) % polygon.length]
    const length = Math.hypot(to[0] - from[0], to[1] - from[1])
    // The side's normal, pointing inward.
    let nx = -(to[1] - from[1]) / length
    let ny = (to[0] - from[0]) / length
    if ((middle[0] - from[0]) * nx + (middle[1] - from[1]) * ny < 0) {
      nx = -nx
      ny = -ny
    }
    const depth = (p: Point) =>
      (p[0] - from[0]) * nx + (p[1] - from[1]) * ny - insets[n]
    const next: Point[] = []
    kept.forEach((a, i) => {
      const b = kept[(i + 1) % kept.length]
      const da = depth(a)
      const db = depth(b)
      if (da >= 0) next.push(a)
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db)
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
      }
    })
    kept = next
  })
  return kept
}

/** How far the point is from the stretch between a and b. */
export function distanceToStretch(point: Point, a: Point, b: Point): number {
  const [abx, aby] = [b[0] - a[0], b[1] - a[1]]
  const lengthSquared = abx * abx + aby * aby
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((point[0] - a[0]) * abx + (point[1] - a[1]) * aby) / lengthSquared
          )
        )
  return Math.hypot(point[0] - (a[0] + abx * t), point[1] - (a[1] + aby * t))
}
