import { describe, expect, it } from 'vitest'
import {
  HEX_DIRECTIONS,
  backToFront,
  directionBetween,
  distanceToStretch,
  hexCenter,
  hexCorners,
  hexNeighbor,
  hexSideMiddle,
  insetConvex,
  insideConvex,
  oppositeDirection,
  parseHexGrid,
  projectPoint,
  type Point,
} from './map-hex'

describe('hex grid', () => {
  it('puts every neighbor one tile away, across the matching side', () => {
    for (const cell of [
      { col: 2, row: 3 },
      { col: 3, row: 3 },
    ]) {
      const [cx, cy] = hexCenter(cell, 1)
      for (const direction of HEX_DIRECTIONS) {
        const neighbor = hexNeighbor(cell, direction)
        const [nx, ny] = hexCenter(neighbor, 1)
        expect(Math.hypot(nx - cx, ny - cy)).toBeCloseTo(Math.sqrt(3))
        // The side they share has the same middle seen from either tile.
        const mine = hexSideMiddle(cell, direction, 1)
        const theirs = hexSideMiddle(neighbor, oppositeDirection(direction), 1)
        expect(mine[0]).toBeCloseTo(theirs[0])
        expect(mine[1]).toBeCloseTo(theirs[1])
        expect(directionBetween(cell, neighbor)).toBe(direction)
        expect(directionBetween(neighbor, cell)).toBe(
          oppositeDirection(direction)
        )
      }
    }
  })

  it('sets odd columns half a tile lower', () => {
    expect(hexCenter({ col: 1, row: 0 }, 2)[1]).toBeCloseTo(Math.sqrt(3))
    expect(hexCenter({ col: 2, row: 0 }, 2)[1]).toBe(0)
    expect(hexNeighbor({ col: 1, row: 4 }, 'SE')).toEqual({ col: 2, row: 5 })
    expect(hexNeighbor({ col: 2, row: 4 }, 'SE')).toEqual({ col: 3, row: 4 })
  })

  it('says when two tiles do not touch', () => {
    expect(directionBetween({ col: 0, row: 0 }, { col: 2, row: 0 })).toBeNull()
  })

  it('has flat tops: the corners run from the east point round by the south', () => {
    const corners = hexCorners({ col: 0, row: 0 }, 2)
    expect(corners[0][0]).toBeCloseTo(2)
    expect(corners[0][1]).toBeCloseTo(0)
    expect(corners[1][1]).toBeCloseTo(corners[2][1])
    expect(corners[1][1]).toBeGreaterThan(0)
    expect(hexCorners({ col: 0, row: 0 }, 2, 0.5)[0][0]).toBeCloseTo(1)
  })

  it('squashes the board and lifts a tile by its height only when drawing', () => {
    const view = { size: 2, squash: 0.5, lift: 0.4, origin: [10, 5] as Point }
    expect(projectPoint(view, [3, 4], 0)).toEqual([13, 7])
    expect(projectPoint(view, [3, 4], 2)[1]).toBeCloseTo(6.2)
  })

  it('draws the far tiles first', () => {
    const cells = [
      { col: 1, row: 1 },
      { col: 2, row: 2 },
      { col: 0, row: 1 },
      { col: 2, row: 1 },
    ]
    expect(backToFront(cells)).toEqual([
      { col: 0, row: 1 },
      { col: 2, row: 1 },
      { col: 1, row: 1 },
      { col: 2, row: 2 },
    ])
  })
})

describe('parseHexGrid', () => {
  it('reads tokens laid out as the tiles lie', () => {
    const grid = parseHexGrid(
      `# a note
       ..  Ab1
       cv1 Ab2`
    )
    expect(grid).toHaveLength(4)
    expect(grid[0]).toEqual({
      col: 0,
      row: 0,
      ref: null,
      code: null,
      order: null,
    })
    expect(grid[3]).toEqual({
      col: 1,
      row: 1,
      ref: 'Ab2',
      code: 'Ab',
      order: 2,
    })
  })

  it('throws on a slip of the hand', () => {
    expect(() => parseHexGrid('.. Ab1\n..')).toThrow(/row 1/)
    expect(() => parseHexGrid('Ab1 Ab1')).toThrow(/twice/)
    expect(() => parseHexGrid('.. Ab')).toThrow(/neither/)
    expect(() => parseHexGrid('  \n# only a note')).toThrow(/empty/)
  })
})

describe('shapes', () => {
  const square: Point[] = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ]

  it('knows what is inside a convex shape', () => {
    expect(insideConvex([2, 2], square)).toBe(true)
    expect(insideConvex([5, 2], square)).toBe(false)
  })

  it('moves each side in by its own amount', () => {
    const inner = insetConvex(square, [1, 0.5, 0, 0])
    const xs = inner.map(p => p[0])
    const ys = inner.map(p => p[1])
    expect(Math.min(...ys)).toBeCloseTo(1)
    expect(Math.max(...xs)).toBeCloseTo(3.5)
    expect(Math.max(...ys)).toBeCloseTo(4)
    expect(Math.min(...xs)).toBeCloseTo(0)
    expect(insetConvex(square, [3, 3, 3, 3])).toEqual([])
  })

  it('measures to the nearest point of a stretch', () => {
    expect(distanceToStretch([2, 3], [0, 0], [4, 0])).toBeCloseTo(3)
    expect(distanceToStretch([7, 4], [0, 0], [4, 0])).toBeCloseTo(5)
  })
})
