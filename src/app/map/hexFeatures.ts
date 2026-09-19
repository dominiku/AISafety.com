// PROTOTYPE Map 3.5, "Hex work" view: the pieces of the board that are drawn
// by code and are no district's ordinary ground: a crater with its lake, the
// banded rock of an escarpment's cliff, and the planks of a pier. Each returns
// SVG markup for hexBackdrop.ts to place; sizes are in map grid units, `g` is
// the pixels in one.
//
// DESIGN REVIEW (Melissa): all three are stand-ins in the classic map's colors,
// until the artists draw them.

import type { Point } from '@/lib/data/map-hex'
import {
  LINE,
  PLANK,
  PLANK_GAP,
  SHALLOWS,
  WATER,
  WATER_STREAK,
} from './realmArtBackdrop'

// A fixed number from 0 to 1 for a whole number.
const roll = (n: number) => {
  const value = Math.sin(n * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

export interface CliffColors {
  lip: string
  face: string
  foot: string
}

/**
 * A crater on the top of a tile: the cone's last slope up to a rim of crags,
 * the dark wall inside the far rim, and the lake in the middle. The near rim
 * is a low lip, so that the lake is seen over it and the river can leave
 * across it.
 */
export function craterMarkup(
  center: Point,
  // Half the width of the crater, rim to rim.
  radius: number,
  squash: number,
  g: number,
  cliff: CliffColors
): string {
  const [cx, cy] = [center[0] * g, center[1] * g]
  const ring = (scale: number, down = 0) =>
    `cx="${cx.toFixed(1)}" cy="${(cy + down * g).toFixed(1)}" rx="${(radius * scale * g).toFixed(1)}" ry="${(radius * scale * squash * g).toFixed(1)}"`
  const out = [
    // The slope up to the rim, and the rim's own crest.
    `<ellipse ${ring(1.2)} fill="${cliff.face}"/>`,
    `<ellipse ${ring(1.06)} fill="${cliff.lip}"/>`,
    // The wall inside the rim: it shows at the back, where it faces the viewer.
    `<ellipse ${ring(0.94)} fill="${cliff.foot}"/>`,
    `<ellipse ${ring(0.8, 0.13)} fill="${WATER}" stroke="${SHALLOWS}" stroke-width="3"/>`,
  ]
  // Light on the water, as on the river.
  for (const [dx, dy, length] of [
    [-0.3, 0.02, 0.42],
    [0.2, 0.3, 0.3],
  ]) {
    const x = cx + dx * radius * g
    const y = cy + (0.13 + dy * squash) * radius * g
    out.push(
      `<path d="M${x.toFixed(1)},${y.toFixed(1)}h${(length * radius * g).toFixed(1)}" stroke="${WATER_STREAK}" stroke-width="3" stroke-linecap="round"/>`
    )
  }
  // Crags along the far rim, the tallest at the very back.
  const crags = 9
  for (let n = 0; n < crags; n++) {
    const angle = Math.PI * (1.04 + (0.92 * n) / (crags - 1))
    const x = cx + Math.cos(angle) * radius * 1.05 * g
    const foot = cy + Math.sin(angle) * radius * 1.05 * squash * g + 0.1 * g
    const back = Math.sin(angle) ** 2
    const w = (0.5 + roll(n + 3) * 0.2) * radius * 0.62 * g
    const h = (0.3 + back * 0.4 + roll(n) * 0.12) * radius * 0.62 * g
    const peak = `${(x - w * 0.06).toFixed(1)},${(foot - h).toFixed(1)}`
    const fold = `${(x + w * 0.14).toFixed(1)},${foot.toFixed(1)}`
    out.push(
      `<path d="M${(x - w / 2).toFixed(1)},${foot.toFixed(1)}L${peak}L${fold}Z" fill="${cliff.lip}"/>`,
      `<path d="M${peak}L${(x + w / 2).toFixed(1)},${foot.toFixed(1)}L${fold}Z" fill="${cliff.foot}"/>`
    )
  }
  return out.join('')
}

/**
 * The bare rock of an escarpment, over a cliff face already drawn from `a` to
 * `b` along its lip and `drop` deep: beds of rock in bands across it, cracks
 * down it, and scree where it has a foot on land.
 */
export function scarpFaceMarkup(
  a: Point,
  b: Point,
  drop: number,
  g: number,
  cliff: CliffColors,
  onLand: boolean,
  // Any whole number that differs from face to face.
  seed: number
): string {
  const at = (t: number, down: number) =>
    `${((a[0] + (b[0] - a[0]) * t) * g).toFixed(1)},${((a[1] + (b[1] - a[1]) * t + down) * g).toFixed(1)}`
  const out: string[] = []
  // Beds: a pale band and a dark line under it, about every third of a level.
  const beds = Math.max(2, Math.round(drop / 0.16))
  for (let n = 1; n < beds; n++) {
    const down = (drop * n) / beds
    const thick = Math.min(0.045, drop / beds / 2.5)
    out.push(
      `<path d="M${at(0, down - thick)}L${at(1, down - thick)}L${at(1, down)}L${at(0, down)}Z" fill="${cliff.lip}" fill-opacity="${n % 2 ? 0.75 : 0.4}"/>`,
      `<path d="M${at(0, down)}L${at(1, down)}" stroke="${cliff.foot}" stroke-width="1.5"/>`
    )
  }
  // Cracks from the lip down, none the same length.
  for (let n = 0; n < 4; n++) {
    const t = (n + 0.3 + roll(seed + n) * 0.5) / 4
    const reach = drop * (0.35 + roll(seed * 3 + n) * 0.6)
    out.push(
      `<path d="M${at(t, 0)}L${at(t + 0.015, reach * 0.5)}L${at(t - 0.01, reach)}" fill="none" stroke="${LINE}" stroke-opacity="0.45" stroke-width="1.6"/>`
    )
  }
  if (onLand) {
    for (let n = 0; n < 6; n++) {
      const t = (n + roll(seed * 7 + n)) / 6
      const r = (0.05 + roll(seed * 5 + n) * 0.06) * g
      const [x, y] = at(t, drop + 0.03)
        .split(',')
        .map(Number)
      out.push(
        `<ellipse cx="${x}" cy="${y}" rx="${r.toFixed(1)}" ry="${(r * 0.7).toFixed(1)}" fill="${n % 2 ? cliff.face : cliff.lip}" stroke="${cliff.foot}" stroke-width="1"/>`
      )
    }
  }
  return out.join('')
}

/**
 * A pier's deck on one tile: `shape` is the strip of planks (a convex shape, at
 * the height the pier stands at), `along` the way the pier runs. Planks lie
 * across it, a beam runs down each side, and mooring posts stand along the
 * beams.
 */
export function deckMarkup(
  shape: Point[],
  along: Point,
  // How far above the water the deck stands.
  drop: number,
  g: number
): string {
  const xy = ([x, y]: Point) => `${(x * g).toFixed(1)},${(y * g).toFixed(1)}`
  const outline = `M${shape.map(xy).join('L')}Z`
  const across: Point = [-along[1], along[0]]
  const measure = (axis: Point) =>
    shape.map(p => p[0] * axis[0] + p[1] * axis[1])
  const [from, to] = [Math.min(...measure(along)), Math.max(...measure(along))]
  const sides = measure(across)
  const [left, right] = [Math.min(...sides), Math.max(...sides)]
  const point = (s: number, t: number): Point => [
    along[0] * s + across[0] * t,
    along[1] * s + across[1] * t,
  ]
  const id = `hex-deck-${xy(shape[0]).replace(/[.,]/g, '_')}`
  // Under the deck, along each side of it that faces the viewer: the posts it
  // stands on, down to the water, and the shadow between them.
  const under: string[] = []
  shape.forEach((a, n) => {
    const b = shape[(n + 1) % shape.length]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    // Corners run clockwise on the screen, so a side faces the viewer where
    // it runs from right to left.
    if (length < 0.3 || a[0] - b[0] < 0.2) return
    under.push(
      `<path d="M${xy(a)}L${xy(b)}L${xy([b[0], b[1] + drop * 0.55])}L${xy([a[0], a[1] + drop * 0.55])}Z" fill="${PLANK_GAP}" fill-opacity="0.55"/>`
    )
    for (let d = 0.15; d < length; d += 0.55) {
      const x = a[0] + ((b[0] - a[0]) * d) / length
      const y = a[1] + ((b[1] - a[1]) * d) / length
      under.push(
        `<path d="M${xy([x, y])}L${xy([x, y + drop])}" stroke="${PLANK_GAP}" stroke-width="4.5" stroke-linecap="round"/>`
      )
    }
  })
  const out = [
    ...under,
    `<clipPath id="${id}"><path d="${outline}"/></clipPath>`,
    `<path d="${outline}" fill="${PLANK}"/>`,
    `<g clip-path="url(#${id})">`,
  ]
  for (let s = from + 0.24; s < to; s += 0.24) {
    out.push(
      `<path d="M${xy(point(s, left))}L${xy(point(s, right))}" stroke="${PLANK_GAP}" stroke-width="1.6"/>`
    )
  }
  for (const t of [left, right]) {
    out.push(
      `<path d="M${xy(point(from, t))}L${xy(point(to, t))}" stroke="${PLANK_GAP}" stroke-width="7"/>`
    )
  }
  out.push('</g>')
  // Mooring posts, a little in from each beam.
  for (let s = from + 0.35; s < to - 0.1; s += 0.85) {
    for (const t of [left + 0.06, right - 0.06]) {
      const [x, y] = point(s, t)
      out.push(
        `<path d="M${xy([x, y])}L${xy([x, y - 0.26])}" stroke="${PLANK_GAP}" stroke-width="5" stroke-linecap="round"/>`,
        `<circle cx="${(x * g).toFixed(1)}" cy="${((y - 0.26) * g).toFixed(1)}" r="2.6" fill="${PLANK}" stroke="${PLANK_GAP}" stroke-width="1.5"/>`
      )
    }
  }
  return out.join('')
}
