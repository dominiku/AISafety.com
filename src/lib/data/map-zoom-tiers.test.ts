import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ZOOM_TIER_CONFIG,
  countOverlaps,
  labelMapScale,
  labelScaleCap,
  labelShowsAt,
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
  groundFill: 0,
  mediumShare: 0,
  avoidOverlaps: true,
  maxShift: 0,
  spreadStrength: 0,
  labelMode: 'map',
  labelBoost: 1,
  subLabelZoom: 0,
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
    regions: area === null ? [] : [area],
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

  it('fills an area with few Medium orgs part-way at the Medium zoom', () => {
    // Like Advocacy Anchorage: mostly Small, so without this nearly all of
    // it would arrive at once at the Small zoom.
    const pins = [
      pin('Large', 0, 0, 'Advocacy', 'L'),
      pin('Medium', 1000, 0, 'Advocacy', 'M'),
      ...['A', 'B', 'C', 'D', 'E', 'F'].map((t, i) =>
        pin('Small', 2000 + i * 1000, 0, 'Advocacy', t)
      ),
    ]
    const { reveal } = layoutPins(pins, [], { ...config, mediumShare: 0.5 }, 1)
    const byMedium = pins.filter(p => reveal.get(p.id)! <= 2).map(p => p.title)
    // Half of eight: the Large, the Medium, then Small orgs by name.
    expect(byMedium.sort()).toEqual(['A', 'B', 'L', 'M'])
    expect(reveal.get(pins[2].id)).toBe(2)
    expect(reveal.get(pins[7].id)).toBe(4)
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

  it('shows a focused area early, from the focus zoom, and no other', () => {
    const pickedSmall = pin('Small', 0, 0, 'Blog')
    const pickedMedium = pin('Medium', 500, 0, 'Blog')
    const other = pin('Small', 1000, 0, 'Video')
    const focus = { areas: ['Blog'], fromZoom: 2.5 }
    const { reveal } = layoutPins(
      [pickedSmall, pickedMedium, other],
      [],
      config,
      1,
      focus
    )
    expect(reveal.get(pickedSmall.id)).toBe(2.5)
    // Already due earlier than the focus zoom: left as it was, so zooming
    // out from a picked area thins it exactly like any other.
    expect(reveal.get(pickedMedium.id)).toBe(2)
    expect(reveal.get(other.id)).toBe(4)
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

describe('layoutPins: filling areas out by their ground', () => {
  // Two areas with one Large org each. 'Big' covers a 1000 x 1000 square,
  // 'Tiny' a 100 x 100 one; Medium orgs mark out the corners.
  const square = (area: string, at: number, size: number) => [
    pin('Large', at, 0, area, `${area} L`),
    pin('Medium', at + size, 0, area, `${area} M1`),
    pin('Medium', at, size, area, `${area} M2`),
    pin('Medium', at + size, size, area, `${area} M3`),
  ]
  const filling = { ...config, groundFill: 0.01 }

  it('shows more of a big area than of a small one', () => {
    const pins = [...square('Big', 0, 1000), ...square('Tiny', 5000, 100)]
    const { reveal } = layoutPins(pins, [], filling, 1)
    const atRest = (area: string) =>
      pins.filter(p => p.regions[0] === area && reveal.get(p.id)! <= 1).length
    // 1% of Big is 10,000 sq px, more than one 5,400 sq px pin covers; 1% of
    // Tiny is 100 sq px, which its Large org alone covers.
    expect(atRest('Big')).toBe(2)
    expect(atRest('Tiny')).toBe(1)
  })

  it('leaves quiet pins out', () => {
    const pins = square('Big', 0, 1000).map(p => ({ ...p, quiet: true }))
    const { reveal } = layoutPins(pins, [], filling, 1)
    expect(pins.filter(p => reveal.get(p.id)! <= 1)).toHaveLength(1)
  })

  it('fills a sub-area by its own ground, not its parent by the gaps', () => {
    // Two tiny sub-areas 5000px apart: their parent's outline is enormous,
    // but it is nearly all gap, and must not be filled.
    const pins = [...square('A', 0, 100), ...square('B', 5000, 100)].map(p => ({
      ...p,
      regions: ['Parent', p.regions[0]],
    }))
    const { reveal } = layoutPins(pins, [], filling, 1)
    expect(pins.filter(p => reveal.get(p.id)! <= 1)).toHaveLength(2)
  })

  it('does nothing at 0', () => {
    const pins = square('Big', 0, 1000)
    const { reveal } = layoutPins(pins, [], config, 1)
    expect(pins.filter(p => reveal.get(p.id)! <= 1)).toHaveLength(1)
  })
})

describe('layoutPins: areas inside areas', () => {
  const inside = (sub: string, scale: string, x: number, title: string) => ({
    ...pin(scale, x, 0, sub, title),
    regions: ['Media', sub],
  })

  it('holds the per-area minimum for a sub-area and for its parent', () => {
    const pins = [
      inside('Podcasts', 'Large', 0, 'P Large'),
      inside('Podcasts', 'Small', 1000, 'P Small'),
      inside('Forums', 'Small', 2000, 'F Small a'),
      inside('Forums', 'Small', 3000, 'F Small b'),
    ]
    const { reveal } = layoutPins(pins, [], { ...config, minPerArea: 1 }, 1)
    const atRest = pins.filter(p => reveal.get(p.id)! <= 1).map(p => p.title)
    // Media's one is its Large org; Forums has no Large org and still gets
    // one of its own.
    expect(atRest.sort()).toEqual(['F Small a', 'P Large'])
  })

  it('focuses a parent area by showing the pins of all its sub-areas', () => {
    const pins = [
      inside('Podcasts', 'Small', 0, 'P'),
      inside('Forums', 'Small', 1000, 'F'),
      pin('Small', 2000, 0, 'Elsewhere'),
    ]
    const focus = { areas: ['Media'], fromZoom: 2.5 }
    const { reveal } = layoutPins(pins, [], config, 1, focus)
    expect(reveal.get(pins[0].id)).toBe(2.5)
    expect(reveal.get(pins[1].id)).toBe(2.5)
    expect(reveal.get(pins[2].id)).toBe(4)
  })

  it('evens pins out within their own sub-area, not across the parent', () => {
    // Podcasts covers x 0 to 400, Forums x 5000 to 5400. The showing Podcasts
    // pin heads for the middle of Podcasts, not toward Forums.
    const pins = [
      inside('Podcasts', 'Large', 0, 'P Large'),
      inside('Podcasts', 'Small', 200, 'P a'),
      inside('Podcasts', 'Small', 400, 'P b'),
      inside('Forums', 'Large', 5000, 'F Large'),
      inside('Forums', 'Small', 5200, 'F a'),
      inside('Forums', 'Small', 5400, 'F b'),
    ]
    const layout = layoutPins(pins, [], { ...config, spreadStrength: 1 }, 1)
    expect(pinPositionAt(layout, pins[0].id, 1).x).toBeCloseTo(200, 0)
    expect(pinPositionAt(layout, pins[3].id, 1).x).toBeCloseTo(5200, 0)
  })
})

describe('labelShowsAt', () => {
  const top = { depth: 0, isParent: false }
  const parent = { depth: 0, isParent: true }
  const sub = { depth: 1, isParent: false }

  it('shows every name at every zoom by default', () => {
    for (const label of [top, parent, sub]) {
      expect(labelShowsAt(label, 0.5, config)).toBe(true)
      expect(labelShowsAt(label, 5, config)).toBe(true)
    }
  })

  it('swaps a parent name for its sub-areas at the sub-label zoom', () => {
    const tiered = { ...config, subLabelZoom: 2 }
    expect(labelShowsAt(parent, 1, tiered)).toBe(true)
    expect(labelShowsAt(sub, 1, tiered)).toBe(false)
    expect(labelShowsAt(parent, 2, tiered)).toBe(false)
    expect(labelShowsAt(sub, 2, tiered)).toBe(true)
    // An area with nothing inside it is unaffected.
    expect(labelShowsAt(top, 1, tiered)).toBe(true)
    expect(labelShowsAt(top, 3, tiered)).toBe(true)
  })

  it('stops pins sliding off a name that is not showing', () => {
    const hiddenName: MapObstacle = {
      x: -50,
      y: -10,
      width: 100,
      height: 20,
      anchorX: 0,
      anchorY: 0,
      depth: 1,
      isParent: false,
    }
    const onIt = pin('Large', 0, 0)
    const tiered = { ...config, maxShift: 60, subLabelZoom: 2 }
    const layout = layoutPins([onIt], [hiddenName], tiered, 1)
    // Further in, where the name shows, the pin is pushed off it; by the
    // resting view it has settled back on its own spot.
    expect(pinPositionAt(layout, onIt.id, 3).y).not.toBeCloseTo(0, 0)
    expect(pinPositionAt(layout, onIt.id, 1).x).toBeCloseTo(0, 3)
    expect(pinPositionAt(layout, onIt.id, 1).y).toBeCloseTo(0, 3)
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
    const label: MapObstacle = {
      x: -50,
      y: -10,
      width: 100,
      height: 20,
      anchorX: 0,
      anchorY: 0,
      depth: 0,
      isParent: false,
    }
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

describe('layoutPins: evening pins out', () => {
  // An area 1000px wide whose two Large orgs sit together at its left end,
  // with Small orgs (hidden until z = 4) tracing out the rest of it.
  const area = () => [
    pin('Large', 0, 0, 'Area', 'L1'),
    pin('Large', 100, 0, 'Area', 'L2'),
    ...[200, 400, 600, 800, 1000].map(x => pin('Small', x, 0, 'Area')),
  ]
  const spreading = { ...config, spreadStrength: 1 }

  it('spreads the showing pins over the ground their area covers', () => {
    const pins = area()
    const layout = layoutPins(pins, [], spreading, 1)
    const l1 = pinPositionAt(layout, pins[0].id, 1).x
    const l2 = pinPositionAt(layout, pins[1].id, 1).x
    // 100px apart at home; now sharing out the whole 1000px between them.
    expect(l2 - l1).toBeGreaterThan(400)
    expect(l1).toBeGreaterThanOrEqual(0)
    expect(l2).toBeLessThanOrEqual(1000)
  })

  it('puts every pin back on its own spot once all are showing', () => {
    const pins = area()
    const layout = layoutPins(pins, [], spreading, 1)
    for (const p of pins) {
      const at = pinPositionAt(layout, p.id, 4)
      expect(at.x).toBeCloseTo(p.x, 6)
      expect(at.y).toBeCloseTo(p.y, 6)
    }
  })

  it('moves pins part of the way at part strength', () => {
    const pins = area()
    const full = layoutPins(pins, [], spreading, 1)
    const half = layoutPins(pins, [], { ...config, spreadStrength: 0.5 }, 1)
    const moved = (l: PinLayout) => pinPositionAt(l, pins[1].id, 1).x - 100
    expect(moved(half)).toBeCloseTo(moved(full) / 2, 0)
  })

  it('leaves a pin placed far from its area where it was put', () => {
    const pins = [
      ...area(),
      pin('Small', 300, 0, 'Area'),
      pin('Large', 9000, 0, 'Area', 'Stray'),
    ]
    const layout = layoutPins(pins, [], spreading, 1)
    expect(pinPositionAt(layout, pins[8].id, 1)).toEqual({ x: 9000, y: 0 })
    // And it does not drag the others toward it.
    expect(pinPositionAt(layout, pins[1].id, 1).x).toBeLessThanOrEqual(1000)
  })

  it('leaves another area alone', () => {
    const pins = [...area(), pin('Large', 5000, 0, 'Elsewhere')]
    const layout = layoutPins(pins, [], spreading, 1)
    expect(pinPositionAt(layout, pins[7].id, 1)).toEqual({ x: 5000, y: 0 })
  })

  it('does nothing at strength 0', () => {
    const pins = area()
    const layout = layoutPins(pins, [], config, 1)
    expect(pinPositionAt(layout, pins[1].id, 1)).toEqual({ x: 100, y: 0 })
  })
})

describe('labelMapScale', () => {
  it("keeps today's size on the map in map mode", () => {
    expect(labelMapScale(4, config, Infinity)).toBe(1)
  })

  it('keeps one size on screen in fixed mode', () => {
    const fixed = { ...config, labelMode: 'fixed' as const, labelBoost: 1.2 }
    // On screen = map scale times z.
    expect(labelMapScale(0.5, fixed, Infinity) * 0.5).toBeCloseTo(1.2)
    expect(labelMapScale(4, fixed, Infinity) * 4).toBeCloseTo(1.2)
  })

  it('grows the way pins grow in pins mode', () => {
    const likePins = { ...config, labelMode: 'pins' as const }
    expect(labelMapScale(1, likePins, Infinity)).toBe(1)
    expect(labelMapScale(4, likePins, Infinity) * 4).toBeCloseTo(2)
  })

  it('never draws a name bigger on the map than the cap', () => {
    const fixed = { ...config, labelMode: 'fixed' as const }
    // Zoomed far out, one size on screen would be 10 times today's size on
    // the map; the cap holds it, so from there it shrinks with the map.
    expect(labelMapScale(0.1, fixed, 1.5)).toBe(1.5)
    expect(labelMapScale(2, fixed, 1.5)).toBe(0.5)
  })

  it('resizes the obstacle about its anchor', () => {
    // A name 100 wide anchored at its middle, shrunk to a quarter at z = 4:
    // a pin 20px from the anchor is clear of it, where at full size it is on
    // it.
    const label: MapObstacle = {
      x: -50,
      y: -10,
      width: 100,
      height: 20,
      anchorX: 0,
      anchorY: 0,
      depth: 0,
      isParent: false,
    }
    const near = { ...pin('Large', 40, 0), halfWidth: 5, top: -5, bottom: 5 }
    const fixed = { ...config, labelMode: 'fixed' as const }
    expect(countOverlaps([near], [label], 4, config).onObstacles).toBe(1)
    expect(countOverlaps([near], [label], 4, fixed).onObstacles).toBe(0)
  })
})

describe('labelScaleCap', () => {
  const name = (x: number): MapObstacle => ({
    x: x - 50,
    y: -10,
    width: 100,
    height: 20,
    anchorX: x,
    anchorY: 0,
    depth: 0,
    isParent: false,
  })

  it('is the size at which two names would touch', () => {
    // 100 wide and 300 apart: they meet at three times the size, less the
    // gap kept between them.
    const cap = labelScaleCap([name(0), name(300)])
    expect(cap).toBeGreaterThan(2.9)
    expect(cap).toBeLessThan(3)
  })

  it("is never below today's size, even for names that already touch", () => {
    expect(labelScaleCap([name(0), name(60)])).toBe(1)
  })

  it('tops out for names that are nowhere near each other', () => {
    expect(labelScaleCap([name(0), name(100000)])).toBe(4)
    expect(labelScaleCap([name(0)])).toBe(4)
  })
})

describe('pinPositionAt', () => {
  it('throws for a pin the layout does not know', () => {
    const layout = layoutPins([pin('Large', 0, 0)], [], config, 1)
    expect(() => pinPositionAt(layout, 'nope', 1)).toThrow('nope')
  })
})

describe('layoutPins: keeping to a district', () => {
  it('never slides a pin off the ground it stands on', () => {
    // Two Large pins on the same spot push each other 40 or so apart. The
    // first may not leave x <= 5, so it stays and the other gives way.
    const fenced = { ...pin('Large', 0, 0), within: (x: number) => x <= 5 }
    const free = pin('Large', 0, 0)
    const layout = layoutPins(
      [fenced, free],
      [],
      { ...config, maxShift: 60 },
      1
    )
    const xs = layout.positions.get(fenced.id)!.x
    for (const x of xs) expect(x).toBeLessThanOrEqual(5)
    const apart = layout.positions
      .get(free.id)!
      .x.map((x, level) => Math.abs(x - xs[level]))
    expect(Math.max(...apart)).toBeGreaterThan(10)
  })
})
