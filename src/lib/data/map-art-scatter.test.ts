import { describe, expect, it } from 'vitest'
import { scatterSpots } from './map-art-scatter'

const EXTENT = { width: 20, height: 10 }
const OPTIONS = { spacing: 2, minRoom: 0.5, maxRoom: 1.5 }
const inWest = (x: number, y: number) => x >= 0 && x < 10 && y >= 0 && y <= 10

describe('scatterSpots', () => {
  it('stays inside the area, clear of its edges', () => {
    const spots = scatterSpots(inWest, [], EXTENT, OPTIONS)
    expect(spots.length).toBeGreaterThan(10)
    for (const spot of spots) {
      expect(spot.x).toBeGreaterThanOrEqual(0.5)
      expect(spot.x).toBeLessThan(9.5)
      expect(spot.room).toBe(1.5)
      expect(spot.roll).toBeGreaterThanOrEqual(0)
      expect(spot.roll).toBeLessThan(1)
    }
  })

  it('keeps clear of what is already there and reports the room left', () => {
    const pin = { x: 5, y: 5, radius: 1 }
    const spots = scatterSpots(inWest, [pin], EXTENT, OPTIONS)
    for (const spot of spots) {
      const gap = Math.hypot(spot.x - pin.x, spot.y - pin.y) - pin.radius
      expect(gap).toBeGreaterThanOrEqual(0.5)
      expect(spot.room).toBeCloseTo(Math.min(1.5, gap))
    }
    expect(spots.length).toBeLessThan(
      scatterSpots(inWest, [], EXTENT, OPTIONS).length
    )
  })

  it('gives the same spots every time', () => {
    expect(scatterSpots(inWest, [], EXTENT, OPTIONS)).toEqual(
      scatterSpots(inWest, [], EXTENT, OPTIONS)
    )
  })
})
