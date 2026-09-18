// PROTOTYPE: which pins the Field map (/map) shows at each zoom level, and how
// big they are drawn. Zoomed out, only the major orgs show; zooming in reveals
// the rest, the way place names appear on Google Maps. Dependency-free so the
// rules can be unit tested.
//
// "Zoom" here is z, not d3's k: z is screen pixels per map pixel, divided by
// REFERENCE_SCREEN_SCALE. A desktop window at rest is z ≈ 1 and a phone at
// rest is z ≈ 0.3, so one set of thresholds works on both.
export const REFERENCE_SCREEN_SCALE = 0.5

// Lowest z the map can reach (a phone, zoomed all the way out).
const MIN_ZOOM = 0.05

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
  /** Every area shows at least this many pins at the resting view, topped up
   *  from its Medium then Small orgs. */
  minPerArea: number
  /** Hold a pin back until it no longer overlaps a more important one. */
  avoidOverlaps: boolean
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
  showAllZoom: 6,
}

/** A pin's footprint in map pixels at today's size: the logo disc plus the
 *  name label under it, measured from the pin's center (x, y). */
export interface TierPin {
  id: string
  title: string
  /** 'Large' | 'Medium' | 'Small'; anything else ranks as Medium, the size
   *  the map draws it at. */
  scale: string | null
  /** The area the pin is drawn in, or null for map furniture, which always
   *  shows and is never topped up. */
  area: string | null
  x: number
  y: number
  halfWidth: number
  top: number
  bottom: number
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

function overlapsAt(a: TierPin, b: TierPin, s: number): boolean {
  if (Math.abs(a.x - b.x) >= s * (a.halfWidth + b.halfWidth)) return false
  return (
    a.y + s * a.top < b.y + s * b.bottom && b.y + s * b.top < a.y + s * a.bottom
  )
}

/** Smallest z from which two pins no longer overlap: 0 if they never do,
 *  Infinity if they still do at showAllZoom. Pins shrink against the map as z
 *  grows (pinMapScale falls), so once clear they stay clear. */
function clearZoom(a: TierPin, b: TierPin, config: ZoomTierConfig): number {
  if (!overlapsAt(a, b, pinMapScale(MIN_ZOOM, config))) return 0
  if (overlapsAt(a, b, pinMapScale(config.showAllZoom, config))) return Infinity
  let lo = MIN_ZOOM
  let hi = config.showAllZoom
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2
    if (overlapsAt(a, b, pinMapScale(mid, config))) lo = mid
    else hi = mid
  }
  return hi
}

function tierZoom(pin: TierPin, config: ZoomTierConfig): number {
  if (pin.area === null) return 0
  const rank = scaleRank(pin.scale)
  return rank === 0 ? 0 : rank === 1 ? config.mediumZoom : config.smallZoom
}

/**
 * The z at which each pin first appears, keyed by pin id. A pin shows from
 * its size tier's threshold, held back further while it would overlap a more
 * important pin that is already showing. Then every area with fewer than
 * minPerArea pins at the resting view (restingZoom, the z of the map before
 * any zooming) is topped up from its next most important pins, where they fit.
 * A pin never disappears again as z grows.
 */
export function pinRevealZooms(
  pins: TierPin[],
  config: ZoomTierConfig,
  restingZoom: number
): Map<string, number> {
  const ordered = [...pins].sort(byPriority)
  const n = ordered.length

  // clear[i][j] for j < i, computed once: it does not depend on the tiers.
  const clear: number[][] = ordered.map((pin, i) =>
    config.avoidOverlaps
      ? ordered.slice(0, i).map(other => clearZoom(pin, other, config))
      : []
  )

  const tiers = ordered.map(pin => tierZoom(pin, config))

  const reveal = (): number[] => {
    const zooms: number[] = new Array(n)
    for (let i = 0; i < n; i++) {
      let z = tiers[i]
      for (let j = 0; j < clear[i].length; j++) {
        // Only a clash that is still going on once j is showing matters.
        if (clear[i][j] > zooms[j]) z = Math.max(z, clear[i][j])
      }
      zooms[i] = Math.min(z, config.showAllZoom)
    }
    return zooms
  }

  let zooms = reveal()

  const indicesByArea = new Map<string, number[]>()
  ordered.forEach((pin, i) => {
    if (pin.area === null) return
    const list = indicesByArea.get(pin.area) ?? []
    list.push(i)
    indicesByArea.set(pin.area, list)
  })

  for (const indices of indicesByArea.values()) {
    let showing = indices.filter(i => zooms[i] <= restingZoom).length
    for (const i of indices) {
      if (showing >= config.minPerArea) break
      if (zooms[i] <= restingZoom) continue
      const previous = tiers[i]
      tiers[i] = 0
      const next = reveal()
      if (next[i] <= restingZoom) {
        zooms = next
        showing++
      } else {
        // No room for it at the resting view; leave it in its own tier.
        tiers[i] = previous
      }
    }
  }

  return new Map(ordered.map((pin, i) => [pin.id, zooms[i]]))
}

/** How many pairs of the given pins overlap at zoom z. The tuning panel shows
 *  this for the pins currently on screen. */
export function countOverlaps(
  pins: TierPin[],
  z: number,
  config: ZoomTierConfig
): number {
  const s = pinMapScale(z, config)
  let count = 0
  for (let i = 0; i < pins.length; i++) {
    for (let j = 0; j < i; j++) {
      if (overlapsAt(pins[i], pins[j], s)) count++
    }
  }
  return count
}
