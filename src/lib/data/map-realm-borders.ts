// PROTOTYPE Map 3.5: the long straight borders between a realm's districts
// get a jog: two more corners, one stepping each way off the old line, the way
// the realms' own borders run in a few stretches at different angles. Neither
// district gains or loses land by it. Pure, no dependencies.

import type { Point } from './map-realm-layout'

// Grid units. A border is jogged where this much of it, unbroken, can be seen.
const MIN_LENGTH = 5
// How far a jog's corners step off the line: this share of the stretch that
// can be seen, and no more than MAX_STEP.
const STEP_SHARE = 0.07
const MAX_STEP = 0.6
// Where along that stretch the two corners stand.
const FIRST_AT = 0.3
const SECOND_AT = 0.7
// How closely the stretch is looked along.
const LOOK = 0.25
const EPSILON = 1e-6

interface Jog {
  // Along the cell's own edge, from 0 at its start to 1 at its end.
  at: number
  point: Point
}

/**
 * The cells with every long border two of them share jogged, the same in
 * both. `seen` says where a border shows on the map (on the realm's own land,
 * not under a town): the jog goes in the longest stretch that does, and a
 * border with no long one is left alone. The cells must not overlap.
 */
export function jogSharedBorders(
  cells: Point[][],
  seen: (x: number, y: number) => boolean
): Point[][] {
  // Per cell and edge, the corners to put in.
  const jogs = cells.map(cell => cell.map((): Jog[] => []))

  cells.forEach((cell, i) => {
    cell.forEach((a, edge) => {
      const b = cell[(edge + 1) % cell.length]
      const length = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (length < MIN_LENGTH) return
      const tx = (b[0] - a[0]) / length
      const ty = (b[1] - a[1]) / length
      // How far along this edge a point is, and how far off its line.
      const along = (p: Point) => (p[0] - a[0]) * tx + (p[1] - a[1]) * ty
      const off = (p: Point) => (p[0] - a[0]) * ty - (p[1] - a[1]) * tx

      for (let j = i + 1; j < cells.length; j++) {
        cells[j].forEach((c, otherEdge) => {
          const d = cells[j][(otherEdge + 1) % cells[j].length]
          if (Math.abs(off(c)) > EPSILON || Math.abs(off(d)) > EPSILON) return
          // The stretch the two edges share.
          const from = Math.max(0, Math.min(along(c), along(d)))
          const to = Math.min(length, Math.max(along(c), along(d)))
          if (to - from < MIN_LENGTH) return

          // The longest run of it that can be seen.
          let best: [number, number] | null = null
          let start: number | null = null
          for (let u = from; u <= to + EPSILON; u += LOOK) {
            const shows = seen(a[0] + tx * u, a[1] + ty * u)
            if (shows && start === null) start = u
            const ends = !shows || u + LOOK > to + EPSILON
            if (start !== null && ends) {
              const end = shows ? u : u - LOOK
              if (!best || end - start > best[1] - best[0]) best = [start, end]
              start = null
            }
          }
          if (!best || best[1] - best[0] < MIN_LENGTH) return

          // Two corners in that run, stepping opposite ways off the line,
          // by amounts that leave the land either side of the shared stretch
          // what it was. The stretch's own ends become corners too where they
          // fall partway along an edge, so nothing beyond them moves: another
          // district may border that part.
          const run = best[1] - best[0]
          const first = best[0] + run * FIRST_AT
          const second = best[0] + run * SECOND_AT
          const step = Math.min(MAX_STEP, run * STEP_SHARE)
          const balance = (to - first) / Math.max(second - from, EPSILON)
          const corner = (u: number, side: number): Point => [
            a[0] + tx * u + ty * side,
            a[1] + ty * u - tx * side,
          ]
          const corners = [
            corner(from, 0),
            corner(first, balance > 1 ? step : step * balance),
            corner(second, balance > 1 ? -step / balance : -step),
            corner(to, 0),
          ]
          const otherLength = Math.hypot(d[0] - c[0], d[1] - c[1])
          for (const point of corners) {
            const at = along(point) / length
            if (at > EPSILON && at < 1 - EPSILON) {
              jogs[i][edge].push({ at, point })
            }
            const otherAt =
              ((point[0] - c[0]) * (d[0] - c[0]) +
                (point[1] - c[1]) * (d[1] - c[1])) /
              (otherLength * otherLength)
            if (otherAt > EPSILON && otherAt < 1 - EPSILON) {
              jogs[j][otherEdge].push({ at: otherAt, point })
            }
          }
        })
      }
    })
  })

  return cells.map((cell, i) => {
    if (jogs[i].every(onEdge => onEdge.length === 0)) return cell
    return cell.flatMap((corner, edge) => [
      corner,
      ...jogs[i][edge].sort((p, q) => p.at - q.at).map(jog => jog.point),
    ])
  })
}
