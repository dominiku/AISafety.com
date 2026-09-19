// PROTOTYPE Map 3.5: a realm's open land divided among its districts by
// halving. The land is cut in two by a straight line, so that each side holds
// the districts anchored there and has land in proportion to them; each side
// is cut again the same way, until every district has a piece of its own.
// Of all the lines it could cut along, it takes the one that leaves both sides
// most compact.
//
// The cells of a power diagram (what map-realm-layout.ts used for every realm,
// and still uses beside a road and round the cove) give a small district in a
// long realm a strip right across it, or a wedge in a corner. Halving gives
// chunky four- and five-sided pieces with straight borders at different
// angles, which is how the classic map's regions are cut. Pure, no
// dependencies.

import type { Point } from './map-realm-layout'

export interface SplitPart {
  // Share of the land this part is to have; the shares need not add up to 1.
  share: number
  anchor: Point
}

// Directions a cut may run in: every 15 degrees.
const DIRECTIONS = 12
// What a cut costs for each anchor it leaves on the wrong side of it, against
// the stretch of the pieces (see `stretchOf`). High: where a district lies is
// the spec's to say, and a chunkier shape does not outweigh it.
const MISPLACED = 1.5
// And for the two sides' shares being uneven: a little, so that of two cuts
// that are much alike the more even one is taken.
const UNEVEN = 0.3

/** The part of a convex polygon where a·x + b·y <= c. */
function clipTo(polygon: Point[], a: number, b: number, c: number): Point[] {
  const kept: Point[] = []
  polygon.forEach((from, k) => {
    const to = polygon[(k + 1) % polygon.length]
    const fromIn = a * from[0] + b * from[1] <= c
    const toIn = a * to[0] + b * to[1] <= c
    if (fromIn) kept.push(from)
    if (fromIn !== toIn) {
      const t =
        (c - a * from[0] - b * from[1]) /
        (a * (to[0] - from[0]) + b * (to[1] - from[1]))
      kept.push([
        from[0] + t * (to[0] - from[0]),
        from[1] + t * (to[1] - from[1]),
      ])
    }
  })
  return kept
}

// How many times farther the points spread along their long direction than
// across it: 1 for a square or a disc, 3 for a strip three times as long as it
// is wide.
function stretchOf(points: Point[]): number {
  if (points.length < 3) return 1
  const n = points.length
  let meanX = 0
  let meanY = 0
  for (const [x, y] of points) {
    meanX += x / n
    meanY += y / n
  }
  let xx = 0
  let xy = 0
  let yy = 0
  for (const [x, y] of points) {
    xx += (x - meanX) ** 2
    xy += (x - meanX) * (y - meanY)
    yy += (y - meanY) ** 2
  }
  const middle = (xx + yy) / 2
  const swing = Math.hypot((xx - yy) / 2, xy)
  return Math.sqrt((middle + swing) / Math.max(middle - swing, 1e-9))
}

/**
 * A convex piece of `within` for each part, in the parts' order. `land` is the
 * land to share out, as points spread evenly over it (it need not be convex:
 * the pieces are cut to it when drawn); each piece holds its part's share of
 * those points.
 */
export function splitByHalves(
  land: Point[],
  parts: SplitPart[],
  within: Point[]
): Point[][] {
  if (parts.length === 0) return []
  if (parts.length === 1 || land.length < 2) return parts.map(() => within)
  const total = parts.reduce((sum, part) => sum + part.share, 0)

  let best: {
    cost: number
    normal: Point
    cut: number
    near: number[]
    far: number[]
  } | null = null
  for (let d = 0; d < DIRECTIONS; d++) {
    const angle = (d * Math.PI) / DIRECTIONS
    const nx = Math.cos(angle)
    const ny = Math.sin(angle)
    const ranked = land.map(([x, y]) => x * nx + y * ny).sort((a, b) => a - b)
    const order = parts
      .map((part, index) => ({
        index,
        at: part.anchor[0] * nx + part.anchor[1] * ny,
      }))
      .sort((a, b) => a.at - b.at || a.index - b.index)
    let running = 0
    for (let k = 1; k < order.length; k++) {
      running += parts[order[k - 1].index].share
      const share = running / total
      const last = Math.min(
        ranked.length - 1,
        Math.max(1, Math.round(share * ranked.length))
      )
      const cut = (ranked[last - 1] + ranked[last]) / 2
      const misplaced = order.filter(({ at }, n) => n < k !== at <= cut).length
      // A side that is still to be cut among several parts may be as long as
      // that many pieces in a row; only beyond that is it too long.
      const nearSide = land.filter(([x, y]) => x * nx + y * ny <= cut)
      const farSide = land.filter(([x, y]) => x * nx + y * ny > cut)
      const cost =
        Math.max(
          Math.max(1, stretchOf(nearSide) / k),
          Math.max(1, stretchOf(farSide) / (order.length - k))
        ) +
        MISPLACED * misplaced +
        UNEVEN * Math.abs(share - 0.5)
      if (!best || cost < best.cost - 1e-9) {
        best = {
          cost,
          normal: [nx, ny],
          cut,
          near: order.slice(0, k).map(({ index }) => index),
          far: order.slice(k).map(({ index }) => index),
        }
      }
    }
  }
  if (!best) return parts.map(() => within)

  const { normal, cut, near, far } = best
  const [nx, ny] = normal
  const nearPieces = splitByHalves(
    land.filter(([x, y]) => x * nx + y * ny <= cut),
    near.map(index => parts[index]),
    clipTo(within, nx, ny, cut)
  )
  const farPieces = splitByHalves(
    land.filter(([x, y]) => x * nx + y * ny > cut),
    far.map(index => parts[index]),
    clipTo(within, -nx, -ny, -cut)
  )
  const pieces: Point[][] = []
  near.forEach((index, n) => (pieces[index] = nearPieces[n]))
  far.forEach((index, n) => (pieces[index] = farPieces[n]))
  return pieces
}
