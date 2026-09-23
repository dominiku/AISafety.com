import { describe, expect, it } from 'vitest'
import {
  cliffFaces,
  coastStretches,
  deltaArms,
  roundCorners,
} from './map-art-geometry'
import type { Point } from './map-realm-layout'

// Clockwise on the page (y downward): top-left, top-right, bottom-right,
// bottom-left.
const SQUARE: Point[] = [
  [0, 0],
  [10, 0],
  [10, 10],
  [0, 10],
]

describe('roundCorners', () => {
  it('replaces each corner with a curve that stays inside the polygon', () => {
    const rounded = roundCorners(SQUARE, 2, 4)
    expect(rounded).toHaveLength(4 * 5)
    for (const [x, y] of rounded) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(10)
      expect(y).toBeGreaterThanOrEqual(0)
      expect(y).toBeLessThanOrEqual(10)
    }
    // No point of the result is a sharp corner of the square.
    expect(rounded.some(([x, y]) => x === 0 && y === 0)).toBe(false)
  })

  it('never uses more than half of a short stretch', () => {
    const rounded = roundCorners(SQUARE, 50, 2)
    // Every curve starts and ends at the middle of a side.
    expect(rounded[0]).toEqual([0, 5])
    expect(rounded[2]).toEqual([5, 0])
  })

  it('leaves the polygon alone with no radius', () => {
    expect(roundCorners(SQUARE, 0)).toBe(SQUARE)
  })
})

describe('cliffFaces', () => {
  it('drops a face only from the coast that faces south', () => {
    const faces = cliffFaces(SQUARE, 2)
    expect(faces).toHaveLength(1)
    expect(faces[0].quad).toEqual([
      [10, 10],
      [0, 10],
      [0, 12],
      [10, 12],
    ])
    // The point behind the face is on the land.
    expect(faces[0].inland[1]).toBeLessThan(10)
    expect(faces[0].inland[1]).toBeGreaterThan(0)
  })

  it('does not care which way round the polygon runs', () => {
    const faces = cliffFaces([...SQUARE].reverse(), 2)
    expect(faces).toHaveLength(1)
    expect(faces[0].inland[1]).toBeLessThan(10)
  })
})

describe('coastStretches', () => {
  it('points out to sea whichever way round the polygon runs', () => {
    for (const polygon of [SQUARE, [...SQUARE].reverse()]) {
      for (const { middle, outward } of coastStretches(polygon)) {
        const [x, y] = [middle[0] + outward[0], middle[1] + outward[1]]
        expect(x < 0 || x > 10 || y < 0 || y > 10).toBe(true)
      }
    }
  })
})

describe('deltaArms', () => {
  const mouths: Point[] = [
    [0, 10],
    [4, 12],
    [8, 12],
    [12, 10],
  ]

  it('splits in two, and each arm in two again, down to every mouth', () => {
    const arms = deltaArms([6, 0], mouths)
    // Two arms from the head, each splitting into two that reach the sea.
    expect(arms.filter(arm => arm.depth === 0)).toHaveLength(2)
    const reaching = arms.filter(arm => arm.depth === 1)
    expect(reaching.map(arm => arm.points[arm.points.length - 1])).toEqual(
      mouths
    )
    // Every deeper arm starts where a shallower one ends.
    for (const arm of reaching) {
      expect(
        arms.some(
          other =>
            other.depth === 0 &&
            other.points[other.points.length - 1] === arm.points[0]
        )
      ).toBe(true)
    }
    for (const arm of arms.filter(a => a.depth === 0)) {
      expect(arm.points[0]).toEqual([6, 0])
    }
  })

  it('runs one bowed arm to a single mouth, and none to no mouths', () => {
    const [arm] = deltaArms([0, 0], [[0, 10]])
    expect(arm.points).toHaveLength(3)
    expect(arm.points[1][0]).not.toBe(0)
    expect(deltaArms([0, 0], [])).toEqual([])
  })
})
