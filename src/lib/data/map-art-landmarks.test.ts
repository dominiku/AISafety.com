import { describe, expect, it } from 'vitest'
import { placeLandmarks, type ArtLandmark } from './map-art-landmarks'

// An island from x 0 to 20 and y 0 to 10: "West" up to x 10, "East" beyond.
const districtAt = (x: number, y: number) =>
  x < 0 || x > 20 || y < 0 || y > 10 ? null : x < 10 ? 'West' : 'East'
const EXTENT = { width: 30, height: 20 }
const tree = (district: string, more?: Partial<ArtLandmark>): ArtLandmark => ({
  symbol: 'tree',
  width: 2,
  height: 2,
  district,
  ...more,
})

describe('placeLandmarks', () => {
  it('keeps a landmark on land and away from the pins', () => {
    // Pins fill the west of "West", so the clear ground is toward x 10.
    const pins = [1, 3, 5].flatMap(x => [1, 3, 5, 7, 9].map(y => ({ x, y })))
    const [placed] = placeLandmarks([tree('West')], districtAt, pins, EXTENT)
    expect(placed.x).toBeGreaterThan(6)
    expect(placed.x).toBeLessThan(10)
    // All of its footprint is on the island.
    expect(placed.y - 0.8).toBeGreaterThanOrEqual(0)
    expect(placed.y + 0.8).toBeLessThanOrEqual(10)
  })

  it('stands a town landmark in the middle of its district', () => {
    const pins = [{ x: 15, y: 5 }]
    const [placed] = placeLandmarks(
      [tree('East', { center: true })],
      districtAt,
      pins,
      EXTENT
    )
    expect(placed.x).toBeCloseTo(15, 0)
    expect(placed.y).toBeCloseTo(5, 0)
  })

  it('keeps landmarks off each other and off the points to avoid', () => {
    const placed = placeLandmarks(
      [tree('East'), tree('East')],
      districtAt,
      [],
      EXTENT,
      [{ x: 15, y: 5, radius: 2 }]
    )
    expect(placed).toHaveLength(2)
    const [a, b] = placed
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(2)
    for (const p of placed) {
      expect(Math.hypot(p.x - 15, p.y - 5)).toBeGreaterThan(2)
    }
  })

  it('leaves out a landmark that does not fit on the land', () => {
    const placed = placeLandmarks(
      [tree('West', { width: 40 }), tree('Nowhere')],
      districtAt,
      [],
      EXTENT
    )
    expect(placed).toEqual([])
  })
})
