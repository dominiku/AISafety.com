import { describe, expect, it } from 'vitest'
import type { Point } from './map-realm-layout'
import { splitByHalves, type SplitPart } from './map-realm-split'

// A band of land 30 wide and 10 tall, as points a quarter of a unit apart.
const BAND: Point[] = []
for (let x = 0.125; x < 30; x += 0.25) {
  for (let y = 0.125; y < 10; y += 0.25) BAND.push([x, y])
}
const FRAME: Point[] = [
  [-5, -5],
  [35, -5],
  [35, 15],
  [-5, 15],
]

function inside([x, y]: Point, polygon: Point[]): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      hit = !hit
    }
  }
  return hit
}

// One big district, and two small ones anchored one above the other.
const PARTS: SplitPart[] = [
  { share: 0.6, anchor: [8, 5] },
  { share: 0.25, anchor: [25, 3] },
  { share: 0.15, anchor: [25, 8] },
]

describe('splitByHalves', () => {
  const pieces = splitByHalves(BAND, PARTS, FRAME)

  it('gives every part its share of the land, and every point to one part', () => {
    const held = pieces.map(piece => BAND.filter(p => inside(p, piece)).length)
    expect(held.reduce((sum, n) => sum + n, 0)).toBe(BAND.length)
    // To within the grain of the points: a slanting cut cannot split a grid
    // of them to the last one.
    held.forEach((n, i) => {
      expect(Math.abs(n / BAND.length - PARTS[i].share)).toBeLessThan(0.02)
    })
  })

  it('puts each part where its anchor is', () => {
    PARTS.forEach((part, i) => {
      expect(inside(part.anchor, pieces[i])).toBe(true)
    })
  })

  it('keeps small parts chunky, not strips right across the band', () => {
    // A strip across the band would be 10 tall and under 5 wide.
    for (const i of [1, 2]) {
      const land = BAND.filter(p => inside(p, pieces[i]))
      const xs = land.map(p => p[0])
      const ys = land.map(p => p[1])
      const wide = Math.max(...xs) - Math.min(...xs)
      const tall = Math.max(...ys) - Math.min(...ys)
      expect(Math.max(wide, tall) / Math.min(wide, tall)).toBeLessThan(2.5)
    }
  })

  it('cuts a long band across its length, not along it', () => {
    const [west, east] = splitByHalves(
      BAND,
      [
        { share: 0.5, anchor: [15, 2] },
        { share: 0.5, anchor: [15.5, 8] },
      ],
      FRAME
    )
    const xs = (piece: Point[]) =>
      BAND.filter(p => inside(p, piece)).map(p => p[0])
    expect(Math.max(...xs(west))).toBeLessThan(Math.min(...xs(east)) + 3)
  })

  it('gives one part the whole of the land, and no parts nothing', () => {
    expect(splitByHalves(BAND, [PARTS[0]], FRAME)).toEqual([FRAME])
    expect(splitByHalves(BAND, [], FRAME)).toEqual([])
  })

  it('gives the same pieces every time', () => {
    expect(splitByHalves(BAND, PARTS, FRAME)).toEqual(pieces)
  })
})
