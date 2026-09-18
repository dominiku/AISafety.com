// PROTOTYPE Map 3.5, "Art work" view: the geometry the classic art style needs
// on top of the computed layout. Pure functions, no drawing.

import type { Point } from './map-realm-layout'

function signedArea(polygon: Point[]): number {
  let sum = 0
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i]
    const [bx, by] = polygon[(i + 1) % polygon.length]
    sum += ax * by - bx * ay
  }
  return sum / 2
}

/**
 * The polygon with every corner eased into a short curve, as a denser polygon
 * of straight stretches. The classic coast is faceted like the layout's, but
 * no corner of it is sharp. A corner never uses more than half of either
 * stretch beside it, so short stretches keep their shape.
 */
export function roundCorners(
  polygon: Point[],
  radius: number,
  steps = 6
): Point[] {
  if (polygon.length < 3 || radius <= 0) return polygon
  const out: Point[] = []
  const n = polygon.length
  for (let i = 0; i < n; i++) {
    const prev = polygon[(i + n - 1) % n]
    const corner = polygon[i]
    const next = polygon[(i + 1) % n]
    const toPrev = Math.hypot(prev[0] - corner[0], prev[1] - corner[1])
    const toNext = Math.hypot(next[0] - corner[0], next[1] - corner[1])
    if (toPrev === 0 || toNext === 0) continue
    const cut = Math.min(radius, toPrev / 2, toNext / 2)
    const start: Point = [
      corner[0] + ((prev[0] - corner[0]) / toPrev) * cut,
      corner[1] + ((prev[1] - corner[1]) / toPrev) * cut,
    ]
    const end: Point = [
      corner[0] + ((next[0] - corner[0]) / toNext) * cut,
      corner[1] + ((next[1] - corner[1]) / toNext) * cut,
    ]
    // A quadratic curve from start to end, pulled toward the corner.
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const a = (1 - t) * (1 - t)
      const b = 2 * (1 - t) * t
      const c = t * t
      out.push([
        a * start[0] + b * corner[0] + c * end[0],
        a * start[1] + b * corner[1] + c * end[1],
      ])
    }
  }
  return out
}

export interface CoastStretch {
  from: Point
  to: Point
  middle: Point
  // Unit vector pointing out to sea.
  outward: Point
}

/** Every stretch of the coast with the direction the sea lies in. */
export function coastStretches(polygon: Point[]): CoastStretch[] {
  const stretches: CoastStretch[] = []
  // With y downward a positive area means the polygon runs clockwise on the
  // page, which puts the sea on the left of each stretch.
  const clockwise = signedArea(polygon) > 0
  for (let i = 0; i < polygon.length; i++) {
    const from = polygon[i]
    const to = polygon[(i + 1) % polygon.length]
    const dx = to[0] - from[0]
    const dy = to[1] - from[1]
    const length = Math.hypot(dx, dy)
    if (length === 0) continue
    stretches.push({
      from,
      to,
      middle: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2],
      outward: [
        ((clockwise ? 1 : -1) * dy) / length,
        ((clockwise ? -1 : 1) * dx) / length,
      ],
    })
  }
  return stretches
}

export interface CliffFace {
  // The face itself: the stretch of coast, and the same stretch `height` lower.
  quad: [Point, Point, Point, Point]
  // A point just inside the land behind the face, to ask what lies there.
  inland: Point
}

/**
 * The cliff faces of an island seen from the south, the way the classic map
 * is drawn: every stretch of coast that faces down the page drops `height`
 * (y runs downward) to the sea. Stretches facing north or straight east and
 * west show no face.
 */
export function cliffFaces(polygon: Point[], height: number): CliffFace[] {
  const faces: CliffFace[] = []
  for (const { from: a, to: b, middle, outward } of coastStretches(polygon)) {
    if (outward[1] <= 0.05) continue
    const inset = Math.min(0.4, height)
    faces.push({
      quad: [a, b, [b[0], b[1] + height], [a[0], a[1] + height]],
      inland: [middle[0] - outward[0] * inset, middle[1] - outward[1] * inset],
    })
  }
  return faces
}

/**
 * A river delta: one stream from `source` that forks part of the way to the
 * sea and reaches each of the `mouths`, every arm bowing a little its own
 * way. The first channel is the stream down to the fork, the rest the arms
 * from the fork; each is a list of points to draw one curve through.
 */
export function deltaChannels(
  source: Point,
  mouths: Point[],
  bow = 0.12
): Point[][] {
  if (mouths.length === 0) return []
  const toward: Point = [
    mouths.reduce((sum, m) => sum + m[0], 0) / mouths.length,
    mouths.reduce((sum, m) => sum + m[1], 0) / mouths.length,
  ]
  const fork: Point = [
    source[0] + (toward[0] - source[0]) * 0.3,
    source[1] + (toward[1] - source[1]) * 0.3,
  ]
  const arms = mouths.map((mouth, i): Point[] => {
    const dx = mouth[0] - fork[0]
    const dy = mouth[1] - fork[1]
    const side = i % 2 === 0 ? 1 : -1
    const bend: Point = [
      fork[0] + dx * 0.55 - dy * bow * side,
      fork[1] + dy * 0.55 + dx * bow * side,
    ]
    return [fork, bend, mouth]
  })
  return [[source, fork], ...arms]
}
