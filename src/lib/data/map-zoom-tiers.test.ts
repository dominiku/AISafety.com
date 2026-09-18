import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZOOM_TIER_CONFIG,
  countOverlaps,
  layoutPins,
  pinMapScale,
  pinPositionAt,
  pinScreenScale,
  type MapObstacle,
  type PinLayout,
  type TierPin,
  type ZoomTierConfig,
} from './map-zoom-tiers'

// maxShift 0: pins never slide, only wait. The sliding tests turn it on.
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
  maxShift: 0,
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

/** The pins showing at zoom z, where they are drawn, for countOverlaps. */
function drawnAt(pins: TierPin[], layout: PinLayout, z: number): TierPin[] {
  return pins
    .filter(p => layout.reveal.get(p.id)! <= z)
    .map(p => ({ ...p, ...pinPositionAt(layout, p.id, z) }))
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

describe('layoutPins: which pins show', () => {
  it('shows Large at once, Medium and Small from their thresholds', () => {
    const large = pin('Large', 0, 0)
    const medium = pin('Medium', 1000, 0)
    const small = pin('Small', 2000, 0)
    const unknown = pin(null, 3000, 0)
    const { reveal } = layoutPins(
      [small, medium, large, unknown],
      [],
      config,
      1
    )
    expect(reveal.get(large.id)).toBe(0)
    expect(reveal.get(medium.id)).toBe(2)
    expect(reveal.get(small.id)).toBe(4)
    // No Scale set: the map draws it Medium, so it appears with the Mediums.
    expect(reveal.get(unknown.id)).toBe(2)
  })

  it('always shows map furniture, which has no area', () => {
    const furniture = pin('Small', 0, 0, null)
    const { reveal } = layoutPins([furniture], [], config, 1)
    expect(reveal.get(furniture.id)).toBe(0)
  })

  it('shows the most important pins of an area with no Large orgs', () => {
    const pins = [
      pin('Small', 0, 0, 'Forecasting', 'Small one'),
      pin('Medium', 1000, 0, 'Forecasting', 'B'),
      pin('Medium', 2000, 0, 'Forecasting', 'A'),
      pin('Medium', 3000, 0, 'Forecasting', 'C'),
    ]
    const { reveal } = layoutPins(pins, [], { ...config, minPerArea: 2 }, 1)
    const atRest = pins.filter(p => reveal.get(p.id)! <= 1).map(p => p.title)
    // Medium before Small, then by name.
    expect(atRest.sort()).toEqual(['A', 'B'])
  })

  it('counts Large orgs toward the minimum', () => {
    const pins = [
      pin('Large', 0, 0, 'Funding'),
      pin('Large', 1000, 0, 'Funding'),
      pin('Medium', 2000, 0, 'Funding'),
    ]
    const { reveal } = layoutPins(pins, [], { ...config, minPerArea: 2 }, 1)
    expect(reveal.get(pins[2].id)).toBe(2)
  })

  it('applies the size tiers alone when overlap avoidance is off', () => {
    const large = pin('Large', 0, 0)
    const medium = pin('Medium', 1, 0)
    const layout = layoutPins(
      [large, medium],
      [],
      { ...config, avoidOverlaps: false, maxShift: 60 },
      1
    )
    expect(layout.reveal.get(medium.id)).toBe(2)
    expect(pinPositionAt(layout, medium.id, 1)).toEqual({ x: 1, y: 0 })
  })
})

describe('layoutPins: holding pins back (maxShift 0)', () => {
  it('holds a pin back until it clears a more important one', () => {
    const large = pin('Large', 0, 0)
    // 30px apart with 20px half-widths: overlapping until pins have shrunk
    // to under 0.75 of their map size, which is at z = 4.
    const medium = pin('Medium', 30, 0)
    const layout = layoutPins([large, medium], [], config, 1)
    const z = layout.reveal.get(medium.id)!
    expect(z).toBeGreaterThanOrEqual(4)
    expect(z).toBeLessThan(config.showAllZoom)
    const drawn = drawnAt([large, medium], layout, z)
    expect(drawn).toHaveLength(2)
    expect(countOverlaps(drawn, [], z, config).pairs).toBe(0)
    expect(pinPositionAt(layout, medium.id, z)).toEqual({ x: 30, y: 0 })
  })

  it('shows every pin by showAllZoom, even ones that still overlap', () => {
    const large = pin('Large', 0, 0)
    const stacked = pin('Small', 1, 0)
    const { reveal } = layoutPins([large, stacked], [], config, 1)
    expect(reveal.get(stacked.id)).toBe(config.showAllZoom)
  })

  it('never hides a pin again as the zoom grows', () => {
    const pins = [
      pin('Large', 0, 0),
      pin('Large', 25, 10),
      pin('Medium', 50, 0),
      pin('Medium', 60, 30),
      pin('Small', 20, 40),
    ]
    const layout = layoutPins(pins, [], { ...config, maxShift: 15 }, 1)
    // reveal is a single threshold per pin, so showing is monotonic as long
    // as every pin has one inside the ladder.
    for (const p of pins) {
      const from = layout.reveal.get(p.id)!
      expect(from).toBeGreaterThanOrEqual(0)
      expect(from).toBeLessThanOrEqual(config.showAllZoom)
    }
    // And whatever shows at a level does not overlap there, short of the
    // level where everything shows regardless.
    for (const z of layout.levels.filter(l => l < config.showAllZoom)) {
      expect(countOverlaps(drawnAt(pins, layout, z), [], z, config).pairs).toBe(
        0
      )
    }
  })
})

describe('layoutPins: sliding pins apart', () => {
  const sliding = { ...config, maxShift: 60 }

  it('slides two Large pins apart rather than hiding one', () => {
    const a = pin('Large', 0, 0, 'Area', 'A')
    const b = pin('Large', 30, 0, 'Area', 'B')
    const layout = layoutPins([a, b], [], sliding, 1)
    const drawn = drawnAt([a, b], layout, 1)
    expect(drawn).toHaveLength(2)
    expect(countOverlaps(drawn, [], 1, sliding).pairs).toBe(0)
  })

  it('brings pins home again once zooming in has made room', () => {
    const a = pin('Large', 0, 0, 'Area', 'A')
    const b = pin('Large', 30, 0, 'Area', 'B')
    const layout = layoutPins([a, b], [], sliding, 1)
    const apartAt = (z: number) =>
      pinPositionAt(layout, b.id, z).x - pinPositionAt(layout, a.id, z).x
    expect(apartAt(0.5)).toBeGreaterThan(apartAt(3))
    // From z = 4 they fit where they are, bar the gap kept between pins.
    expect(apartAt(6)).toBeLessThan(32)
  })

  it('moves the smaller org further than the bigger one', () => {
    const large = pin('Large', 0, 0)
    const small = pin('Small', 30, 0)
    const layout = layoutPins(
      [large, small],
      [],
      { ...sliding, smallZoom: 0 },
      1
    )
    const largeMoved = Math.abs(pinPositionAt(layout, large.id, 1).x)
    const smallMoved = Math.abs(pinPositionAt(layout, small.id, 1).x - 30)
    expect(smallMoved).toBeGreaterThan(largeMoved)
  })

  const crowd = () =>
    Array.from({ length: 8 }, (_, i) => pin('Large', i * 3, 0, 'Area', `P${i}`))

  it('never slides a pin further than maxShift', () => {
    const pins = crowd()
    const layout = layoutPins(pins, [], { ...sliding, maxShift: 25 }, 1)
    for (const p of pins) {
      for (const z of layout.levels) {
        const at = pinPositionAt(layout, p.id, z)
        expect(Math.hypot(at.x - p.x, at.y - p.y)).toBeLessThanOrEqual(25.001)
      }
    }
  })

  it('holds a pin back when sliding cannot make room', () => {
    const pins = crowd()
    const { reveal } = layoutPins(pins, [], { ...sliding, maxShift: 25 }, 1)
    const atRest = pins.filter(p => reveal.get(p.id)! <= 1)
    expect(atRest.length).toBeGreaterThan(0)
    expect(atRest.length).toBeLessThan(pins.length)
  })

  it('slides a pin off an area name, and never hides it for one', () => {
    const label: MapObstacle = { x: -50, y: -10, width: 100, height: 20 }
    const onLabel = pin('Large', 0, 0)
    const layout = layoutPins([onLabel], [label], sliding, 1)
    expect(layout.reveal.get(onLabel.id)).toBe(0)
    const drawn = drawnAt([onLabel], layout, 1)
    expect(countOverlaps(drawn, [label], 1, sliding).onObstacles).toBe(0)

    // With no sliding allowed it stays put, on the name, and still shows.
    const fixed = layoutPins([onLabel], [label], config, 1)
    expect(fixed.reveal.get(onLabel.id)).toBe(0)
    const stuck = drawnAt([onLabel], fixed, 1)
    expect(countOverlaps(stuck, [label], 1, config).onObstacles).toBe(1)
  })
})

describe('pinPositionAt', () => {
  it('throws for a pin the layout does not know', () => {
    const layout = layoutPins([pin('Large', 0, 0)], [], config, 1)
    expect(() => pinPositionAt(layout, 'nope', 1)).toThrow('nope')
  })
})
