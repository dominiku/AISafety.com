import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZOOM_TIER_CONFIG,
  countOverlaps,
  pinMapScale,
  pinRevealZooms,
  pinScreenScale,
  type TierPin,
  type ZoomTierConfig,
} from './map-zoom-tiers'

const config: ZoomTierConfig = {
  ...DEFAULT_ZOOM_TIER_CONFIG,
  overviewBoost: 1.5,
  growthExponent: 0.5,
  minPinScale: 0.5,
  maxPinScale: 4,
  mediumZoom: 2,
  smallZoom: 4,
  minPerArea: 0,
  avoidOverlaps: true,
  showAllZoom: 6,
}

let nextId = 0
function pin(
  scale: string | null,
  x: number,
  y: number,
  area: string | null = 'Area',
  title?: string
): TierPin {
  const id = `pin${nextId++}`
  return {
    id,
    title: title ?? id,
    scale,
    area,
    x,
    y,
    halfWidth: 20,
    top: -20,
    bottom: 40,
  }
}

describe('pinScreenScale', () => {
  it('is the overview boost at z = 1', () => {
    expect(pinScreenScale(1, config)).toBe(1.5)
  })

  it('grows with the square root of z at exponent 0.5', () => {
    expect(pinScreenScale(4, config)).toBe(3)
  })

  it('matches how the map draws pins today at boost 1, exponent 1', () => {
    const today = { ...config, overviewBoost: 1, growthExponent: 1 }
    expect(pinScreenScale(2.5, today)).toBe(2.5)
    expect(pinMapScale(2.5, today)).toBe(1)
  })

  it('stays inside the clamp', () => {
    expect(pinScreenScale(0.01, config)).toBe(0.5)
    expect(pinScreenScale(100, config)).toBe(4)
  })
})

describe('pinMapScale', () => {
  it('shrinks pins against the map as z grows, so zooming in makes room', () => {
    const scales = [0.1, 0.5, 1, 2, 4, 8, 16].map(z => pinMapScale(z, config))
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]).toBeLessThan(scales[i - 1])
    }
  })
})

describe('pinRevealZooms', () => {
  it('shows Large at once, Medium and Small from their thresholds', () => {
    const large = pin('Large', 0, 0)
    const medium = pin('Medium', 1000, 0)
    const small = pin('Small', 2000, 0)
    const unknown = pin(null, 3000, 0)
    const zooms = pinRevealZooms([small, medium, large, unknown], config, 1)
    expect(zooms.get(large.id)).toBe(0)
    expect(zooms.get(medium.id)).toBe(2)
    expect(zooms.get(small.id)).toBe(4)
    // No Scale set: the map draws it Medium, so it appears with the Mediums.
    expect(zooms.get(unknown.id)).toBe(2)
  })

  it('always shows map furniture, which has no area', () => {
    const furniture = pin('Small', 0, 0, null)
    expect(pinRevealZooms([furniture], config, 1).get(furniture.id)).toBe(0)
  })

  it('tops an area with no Large orgs up to the minimum', () => {
    const pins = [
      pin('Small', 0, 0, 'Forecasting', 'Small one'),
      pin('Medium', 1000, 0, 'Forecasting', 'B'),
      pin('Medium', 2000, 0, 'Forecasting', 'A'),
      pin('Medium', 3000, 0, 'Forecasting', 'C'),
    ]
    const zooms = pinRevealZooms(pins, { ...config, minPerArea: 2 }, 1)
    const atRest = pins.filter(p => zooms.get(p.id)! <= 1).map(p => p.title)
    // Medium before Small, then by name.
    expect(atRest.sort()).toEqual(['A', 'B'])
  })

  it('leaves an area that already meets the minimum alone', () => {
    const pins = [
      pin('Large', 0, 0, 'Funding'),
      pin('Large', 1000, 0, 'Funding'),
      pin('Medium', 2000, 0, 'Funding'),
    ]
    const zooms = pinRevealZooms(pins, { ...config, minPerArea: 2 }, 1)
    expect(zooms.get(pins[2].id)).toBe(2)
  })

  it('holds a pin back until it clears a more important one', () => {
    const large = pin('Large', 0, 0)
    // 30px apart with 20px half-widths: overlapping until pins have shrunk
    // to under 0.75 of their map size.
    const medium = pin('Medium', 30, 0)
    const zooms = pinRevealZooms([large, medium], config, 1)
    const z = zooms.get(medium.id)!
    expect(z).toBeGreaterThan(config.mediumZoom)
    expect(z).toBeLessThan(config.showAllZoom)
    expect(countOverlaps([large, medium], z, config)).toBe(0)
    expect(countOverlaps([large, medium], z * 0.95, config)).toBe(1)
  })

  it('ignores a clash that is over before the other pin appears', () => {
    // The two only overlap below z ≈ 1.8; the Medium is not showing until 2,
    // so the Small is not held past its own threshold.
    const medium = pin('Medium', 0, 0)
    const small = pin('Small', 44, 0)
    expect(countOverlaps([medium, small], 1, config)).toBe(1)
    expect(countOverlaps([medium, small], 2, config)).toBe(0)
    expect(pinRevealZooms([medium, small], config, 1).get(small.id)).toBe(4)
  })

  it('shows every pin by showAllZoom, even ones that still overlap', () => {
    const large = pin('Large', 0, 0)
    const stacked = pin('Small', 1, 0)
    const zooms = pinRevealZooms([large, stacked], config, 1)
    expect(zooms.get(stacked.id)).toBe(config.showAllZoom)
  })

  it('applies the size tiers alone when overlap avoidance is off', () => {
    const large = pin('Large', 0, 0)
    const medium = pin('Medium', 1, 0)
    const zooms = pinRevealZooms(
      [large, medium],
      { ...config, avoidOverlaps: false },
      1
    )
    expect(zooms.get(medium.id)).toBe(2)
  })

  it('does not top up with a pin that has no room at the resting view', () => {
    const large = pin('Large', 0, 0, 'Podcast')
    const crowded = pin('Medium', 5, 0, 'Podcast', 'A')
    const free = pin('Medium', 1000, 0, 'Podcast', 'B')
    const zooms = pinRevealZooms(
      [large, crowded, free],
      { ...config, minPerArea: 2 },
      1
    )
    expect(zooms.get(free.id)).toBe(0)
    expect(zooms.get(crowded.id)!).toBeGreaterThan(1)
  })
})
