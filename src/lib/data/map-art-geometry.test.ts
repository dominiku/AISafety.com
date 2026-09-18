import { describe, expect, it } from 'vitest'
import { cliffFaces, roundCorners } from './map-art-geometry'
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
