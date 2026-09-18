// PROTOTYPE: which pins the Field map (/map) shows at each zoom level, how big
// they are drawn, and where. Zoomed out, only the major orgs show; zooming in
// reveals the rest, the way place names appear on Google Maps. Pins that would
// overlap slide apart, and slide home again as zooming in makes room.
// Dependency-free so the rules can be unit tested.
//
// "Zoom" here is z, not d3's k: z is screen pixels per map pixel, divided by
// REFERENCE_SCREEN_SCALE. A desktop window at rest is z ≈ 1 and a phone at
// rest is z ≈ 0.3, so one set of thresholds works on both.
export const REFERENCE_SCREEN_SCALE = 0.5

// The layout is worked out at a ladder of zoom levels from MIN_LEVEL_ZOOM up
// to showAllZoom, each LEVEL_RATIO further in than the last, and read off in
// between by interpolation.
const MIN_LEVEL_ZOOM = 0.12
const LEVEL_RATIO = 1.25

// Sliding pins apart: rounds of nudging per level, the share of those rounds
// in which pins are also drawn back toward home, and how strongly.
const RELAX_ROUNDS = 48
const HOMING_SHARE = 0.6
const HOMING_PULL = 0.15
// Map pixels of clear space kept between two pins, and around an area name.
const PIN_GAP = 2

export interface ZoomTierConfig {
  /** Pin size at z = 1, as a multiple of the size the map draws today. */
  overviewBoost: number
  /** How fast pins grow on screen as the map zooms: 0 keeps them a constant
   *  size, 1 grows them with the map (today's behavior). */
  growthExponent: number
  /** Clamp on the on-screen size multiplier, so pins are never specks and
   *  never fill the screen. */
  minPinScale: number
  maxPinScale: number
  /** z at which Medium and Small orgs start to appear. Large always show. */
  mediumZoom: number
  smallZoom: number
  /** Each area's most important pins, this many, show from the start
   *  whatever their size, so no area is empty zoomed out. */
  minPerArea: number
  /** Keep overlapping pins apart: by sliding them (maxShift) and, where that
   *  is not enough, by holding the less important one back until it fits. */
  avoidOverlaps: boolean
  /** How far a pin may slide from its own spot, in map pixels (one grid
   *  square is about 41). 0 never moves a pin, only holds it back. */
  maxShift: number
  /** From this z on, every pin shows, overlapping or not. */
  showAllZoom: number
}

export const DEFAULT_ZOOM_TIER_CONFIG: ZoomTierConfig = {
  overviewBoost: 1.6,
  growthExponent: 0.5,
  minPinScale: 0.8,
  maxPinScale: 5,
  mediumZoom: 1.8,
  smallZoom: 3,
  minPerArea: 3,
  avoidOverlaps: true,
  maxShift: 60,
  showAllZoom: 6,
}

/** A pin's footprint in map pixels at today's size: the logo disc plus the
 *  name label under it, measured from the pin's own spot (x, y). */
export interface TierPin {
  id: string
  title: string
  /** 'Large' | 'Medium' | 'Small'; anything else ranks as Medium, the size
   *  the map draws it at. */
  scale: string | null
  /** The area the pin is drawn in, or null for map furniture, which always
   *  shows. */
  area: string | null
  x: number
  y: number
  halfWidth: number
  top: number
  bottom: number
}

/** Something pins slide off but that never moves or hides a pin itself: an
 *  area's name. In map pixels; unlike a pin it keeps its size on the map. */
export interface MapObstacle {
  x: number
  y: number
  width: number
  height: number
}

/** On-screen size of a pin at zoom z, as a multiple of its size today at
 *  z = 1. */
export function pinScreenScale(z: number, config: ZoomTierConfig): number {
  const grown = config.overviewBoost * Math.pow(z, config.growthExponent)
  return Math.min(config.maxPinScale, Math.max(config.minPinScale, grown))
}

/** The scale to draw a pin at inside the zoomed map group. The group already
 *  magnifies everything by z, so this divides that back out. */
export function pinMapScale(z: number, config: ZoomTierConfig): number {
  return pinScreenScale(z, config) / z
}

function scaleRank(scale: string | null): number {
  if (scale === 'Large') return 0
  if (scale === 'Small') return 2
  return 1
}

/** Most important first: Large, Medium, Small, then by name. The name
 *  tie-break is a placeholder; an editorial "featured" order could replace
 *  it. */
export function byPriority(a: TierPin, b: TierPin): number {
  return (
    scaleRank(a.scale) - scaleRank(b.scale) || a.title.localeCompare(b.title)
  )
}

interface Box {
  cx: number
  cy: number
  halfW: number
  halfH: number
}

function pinBox(pin: TierPin, x: number, y: number, s: number): Box {
  return {
    cx: x,
    cy: y + (s * (pin.top + pin.bottom)) / 2,
    halfW: s * pin.halfWidth,
    halfH: (s * (pin.bottom - pin.top)) / 2,
  }
}

function obstacleBox(o: MapObstacle): Box {
  return {
    cx: o.x + o.width / 2,
    cy: o.y + o.height / 2,
    halfW: o.width / 2,
    halfH: o.height / 2,
  }
}

/** How far two boxes reach into each other on each axis, plus `gap`; both
 *  positive means they overlap. */
function overlap(a: Box, b: Box, gap: number): { x: number; y: number } {
  return {
    x: a.halfW + b.halfW + gap - Math.abs(a.cx - b.cx),
    y: a.halfH + b.halfH + gap - Math.abs(a.cy - b.cy),
  }
}

function boxesOverlap(a: Box, b: Box): boolean {
  const o = overlap(a, b, 0)
  return o.x > 0 && o.y > 0
}

export interface PinLayout {
  /** The zoom levels the layout was worked out at, zoomed-out first. */
  levels: number[]
  /** Each pin's position at each of those levels, by pin id. */
  positions: Map<string, { x: number[]; y: number[] }>
  /** The z from which each pin shows, by pin id. */
  reveal: Map<string, number>
}

function zoomLevels(config: ZoomTierConfig, restingZoom: number): number[] {
  const levels = new Set<number>([config.showAllZoom])
  for (let z = MIN_LEVEL_ZOOM; z < config.showAllZoom; z *= LEVEL_RATIO) {
    levels.add(z)
  }
  // The thresholds people set, and the view the map opens at, are levels of
  // their own so the layout is exact there, not interpolated.
  for (const z of [config.mediumZoom, config.smallZoom, restingZoom]) {
    if (z > 0 && z < config.showAllZoom) levels.add(z)
  }
  return [...levels].sort((a, b) => a - b)
}

/**
 * Where every pin sits and from which z it shows.
 *
 * A pin is due from its size tier's threshold; each area's minPerArea most
 * important pins, and map furniture, are due from the start. Level by level
 * from fully zoomed in to fully zoomed out, the pins due at that level slide
 * apart (and off the obstacles) by up to maxShift, heavier for bigger orgs so
 * a Large pin moves least. A pin still overlapping a more important one after
 * that is held back at that level and every level further out, so a pin never
 * disappears as z grows. At showAllZoom and beyond, everything shows.
 */
export function layoutPins(
  pins: TierPin[],
  obstacles: MapObstacle[],
  config: ZoomTierConfig,
  restingZoom: number
): PinLayout {
  const ordered = [...pins].sort(byPriority)
  const n = ordered.length
  const levels = zoomLevels(config, restingZoom)
  const obstacleBoxes = obstacles.map(obstacleBox)

  const due = ordered.map(pin => {
    if (pin.area === null) return 0
    const rank = scaleRank(pin.scale)
    return rank === 0 ? 0 : rank === 1 ? config.mediumZoom : config.smallZoom
  })
  const seenInArea = new Map<string, number>()
  ordered.forEach((pin, i) => {
    if (pin.area === null) return
    const seen = seenInArea.get(pin.area) ?? 0
    if (seen < config.minPerArea) due[i] = 0
    seenInArea.set(pin.area, seen + 1)
  })

  // Heavier pins give way less when two are pushed apart.
  const weight = ordered.map(pin => 3 - scaleRank(pin.scale))

  const xs: number[][] = ordered.map(() => new Array(levels.length))
  const ys: number[][] = ordered.map(() => new Array(levels.length))
  const reveal: number[] = new Array(n).fill(config.showAllZoom)

  let x = ordered.map(pin => pin.x)
  let y = ordered.map(pin => pin.y)
  let shownFurtherIn: boolean[] = new Array(n).fill(true)

  const relax = (active: number[], s: number): void => {
    const reach = 2 * config.maxShift + PIN_GAP
    const pairs: [number, number][] = []
    for (let a = 0; a < active.length; a++) {
      for (let b = 0; b < a; b++) {
        const i = active[a]
        const j = active[b]
        const pi = ordered[i]
        const pj = ordered[j]
        if (
          Math.abs(pi.x - pj.x) < s * (pi.halfWidth + pj.halfWidth) + reach &&
          Math.abs(pi.y - pj.y) <
            s * (pi.bottom - pi.top + pj.bottom - pj.top) + reach
        ) {
          pairs.push([i, j])
        }
      }
    }

    const clampToHome = (i: number): void => {
      const dx = x[i] - ordered[i].x
      const dy = y[i] - ordered[i].y
      const moved = Math.hypot(dx, dy)
      if (moved > config.maxShift) {
        x[i] = ordered[i].x + (dx / moved) * config.maxShift
        y[i] = ordered[i].y + (dy / moved) * config.maxShift
      }
    }

    for (let round = 0; round < RELAX_ROUNDS; round++) {
      const homing = round < RELAX_ROUNDS * HOMING_SHARE
      let pushed = false
      if (homing) {
        for (const i of active) {
          x[i] += (ordered[i].x - x[i]) * HOMING_PULL
          y[i] += (ordered[i].y - y[i]) * HOMING_PULL
        }
      }
      for (const [i, j] of pairs) {
        const a = pinBox(ordered[i], x[i], y[i], s)
        const b = pinBox(ordered[j], x[j], y[j], s)
        const o = overlap(a, b, PIN_GAP)
        if (o.x <= 0 || o.y <= 0) continue
        pushed = true
        const shareI = weight[j] / (weight[i] + weight[j])
        // Apart along whichever axis needs the smaller move. Pins on the
        // very same spot part by their order, so the result is repeatable.
        if (o.x < o.y) {
          const dir = a.cx === b.cx ? (i < j ? -1 : 1) : Math.sign(a.cx - b.cx)
          x[i] += dir * o.x * shareI
          x[j] -= dir * o.x * (1 - shareI)
        } else {
          const dir = a.cy === b.cy ? (i < j ? -1 : 1) : Math.sign(a.cy - b.cy)
          y[i] += dir * o.y * shareI
          y[j] -= dir * o.y * (1 - shareI)
        }
      }
      for (const i of active) {
        const a = pinBox(ordered[i], x[i], y[i], s)
        for (const b of obstacleBoxes) {
          const o = overlap(a, b, PIN_GAP)
          if (o.x <= 0 || o.y <= 0) continue
          pushed = true
          if (o.x < o.y) x[i] += (a.cx < b.cx ? -1 : 1) * o.x
          else y[i] += (a.cy < b.cy ? -1 : 1) * o.y
          a.cx = x[i]
          a.cy = y[i] + (s * (ordered[i].top + ordered[i].bottom)) / 2
        }
        clampToHome(i)
      }
      // Settled: nothing is being drawn home and nothing needed a push.
      if (!homing && !pushed) break
    }
  }

  for (let level = levels.length - 1; level >= 0; level--) {
    const z = levels[level]
    const s = pinMapScale(z, config)
    const everything = z >= config.showAllZoom
    let active: number[] = []
    for (let i = 0; i < n; i++) {
      if (everything || (due[i] <= z && shownFurtherIn[i])) active.push(i)
    }

    if (config.avoidOverlaps) {
      // Warm start from the level further in, so positions change smoothly
      // from one level to the next.
      const startX = [...x]
      const startY = [...y]
      if (config.maxShift > 0) relax(active, s)

      if (!everything) {
        const kept: number[] = []
        for (const i of active) {
          const a = pinBox(ordered[i], x[i], y[i], s)
          const clash = kept.some(j =>
            boxesOverlap(a, pinBox(ordered[j], x[j], y[j], s))
          )
          if (!clash) kept.push(i)
        }
        if (kept.length < active.length && config.maxShift > 0) {
          // Settle again without the pins that were held back, so nothing is
          // left pushed aside by a pin that is not there.
          x = startX
          y = startY
          relax(kept, s)
        }
        active = kept
      }
    }

    const shown: boolean[] = new Array(n).fill(false)
    for (const i of active) {
      shown[i] = true
      reveal[i] = z
    }
    // At the outermost level a pin that shows, shows however far out.
    if (level === 0) for (const i of active) reveal[i] = 0
    shownFurtherIn = shown
    for (let i = 0; i < n; i++) {
      xs[i][level] = x[i]
      ys[i][level] = y[i]
    }
  }

  return {
    levels,
    positions: new Map(
      ordered.map((pin, i) => [pin.id, { x: xs[i], y: ys[i] }])
    ),
    reveal: new Map(ordered.map((pin, i) => [pin.id, reveal[i]])),
  }
}

/** A pin's position at zoom z: read between the two nearest levels, evenly
 *  in zoom steps (so by the logarithm of z). */
export function pinPositionAt(
  layout: PinLayout,
  id: string,
  z: number
): { x: number; y: number } {
  const position = layout.positions.get(id)
  if (!position) throw new Error(`No layout for map pin "${id}"`)
  const { levels } = layout
  const last = levels.length - 1
  if (z <= levels[0]) return { x: position.x[0], y: position.y[0] }
  if (z >= levels[last]) return { x: position.x[last], y: position.y[last] }
  let upper = 1
  while (levels[upper] < z) upper++
  const lower = upper - 1
  const t =
    (Math.log(z) - Math.log(levels[lower])) /
    (Math.log(levels[upper]) - Math.log(levels[lower]))
  return {
    x: position.x[lower] + (position.x[upper] - position.x[lower]) * t,
    y: position.y[lower] + (position.y[upper] - position.y[lower]) * t,
  }
}

/** How many pairs of the given pins overlap at zoom z, and how many of the
 *  pins sit on an obstacle. Pass pins at the positions they are drawn at.
 *  The tuning panel shows both for the pins currently on screen. */
export function countOverlaps(
  pins: TierPin[],
  obstacles: MapObstacle[],
  z: number,
  config: ZoomTierConfig
): { pairs: number; onObstacles: number } {
  const s = pinMapScale(z, config)
  const boxes = pins.map(pin => pinBox(pin, pin.x, pin.y, s))
  const obstacleBoxes = obstacles.map(obstacleBox)
  let pairs = 0
  let onObstacles = 0
  for (let i = 0; i < boxes.length; i++) {
    for (let j = 0; j < i; j++) {
      if (boxesOverlap(boxes[i], boxes[j])) pairs++
    }
    if (obstacleBoxes.some(o => boxesOverlap(boxes[i], o))) onObstacles++
  }
  return { pairs, onObstacles }
}
