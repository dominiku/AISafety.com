// PROTOTYPE Map 3.5, "Hex work" view: the pieces of the board that are drawn
// by code and are no district's ordinary ground: a crater with its lake, the
// leaning slopes of an escarpment and a volcano, the planks of a pier, dunes
// and meadow grass. Each returns
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
      `<path d="M${xy(point(from, t))}L${xy(point(to, t))}" stroke="${PLANK_GAP}" stroke-width="4"/>`
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

/**
 * A slope in place of a sheer cliff: from the lip of a tile's side (`a` to
 * `b`) it leans out over the land or water in front as it drops. `out` is the
 * way the side faces on the ground (a unit vector), `run` how far the foot
 * stands out from under the lip on the ground, `drop` how far down the screen
 * the foot lies. With `beds`, the bare banded rock of an escarpment; without,
 * the smooth flank of a volcano. `shade` darkens the side turned from the
 * light.
 */
export function slopeMarkup(
  a: Point,
  b: Point,
  out: Point,
  run: number,
  drop: number,
  squash: number,
  g: number,
  cliff: CliffColors,
  beds: boolean,
  shade: number,
  seed: number
): string {
  const reach: Point = [out[0] * run, out[1] * run * squash + drop]
  const at = (t: number, down: number) =>
    `${((a[0] + (b[0] - a[0]) * t + reach[0] * down) * g).toFixed(1)},${((a[1] + (b[1] - a[1]) * t + reach[1] * down) * g).toFixed(1)}`
  const face = `M${at(0, 0)}L${at(1, 0)}L${at(1, 1)}L${at(0, 1)}Z`
  const markup = [
    `<path d="${face}" fill="${cliff.face}" stroke="${cliff.face}" stroke-width="1" stroke-linejoin="round"/>`,
  ]
  if (beds) {
    // As the classic map draws its escarpment: broad flat bands of a lighter
    // orange slanting down the dark slope, no two the same width, and a few
    // sharp rocks fallen at its foot.
    const slant = 0.16
    const clamp = (t: number) => Math.min(1, Math.max(0, t))
    let from = -slant + roll(seed) * 0.12
    for (let n = 0; from < 1; n++) {
      const width = 0.16 + roll(seed * 5 + n) * 0.14
      const to = from + width
      markup.push(
        `<path d="M${at(clamp(from), 0)}L${at(clamp(to), 0)}L${at(clamp(to + slant), 1)}L${at(clamp(from + slant), 1)}Z" fill="${cliff.lip}" fill-opacity="0.8"/>`
      )
      from = to + 0.14 + roll(seed * 9 + n) * 0.16
    }
    for (let n = 0; n < 2; n++) {
      const t = 0.18 + n * 0.5 + roll(seed * 7 + n) * 0.2
      const size = (0.16 + roll(seed * 11 + n) * 0.12) * g
      const [x, y] = at(t, 1).split(',').map(Number)
      const foot = y + size * 0.35
      markup.push(
        `<path d="M${(x - size * 0.6).toFixed(1)},${foot.toFixed(1)}L${(x - size * 0.1).toFixed(1)},${(foot - size).toFixed(1)}L${(x + size * 0.15).toFixed(1)},${foot.toFixed(1)}Z" fill="${cliff.lip}"/>`,
        `<path d="M${(x - size * 0.1).toFixed(1)},${(foot - size).toFixed(1)}L${(x + size * 0.7).toFixed(1)},${(foot - size * 0.25).toFixed(1)}L${(x + size * 0.15).toFixed(1)},${foot.toFixed(1)}Z" fill="${cliff.foot}"/>`
      )
    }
  } else {
    // Runnels of old lava, fanning a little toward the foot.
    for (let n = 0; n < 5; n++) {
      const t = (n + 0.5) / 5
      const lean = (t - 0.5) * 0.08
      markup.push(
        `<path d="M${at(t, 0.04)}L${at(t + lean, 0.55 + roll(seed + n) * 0.4)}" fill="none" stroke="${cliff.foot}" stroke-opacity="0.55" stroke-width="2"/>`
      )
    }
  }
  markup.push(
    `<path d="M${at(0, 0)}L${at(1, 0)}" stroke="${cliff.lip}" stroke-width="3" stroke-linecap="round"/>`
  )
  if (shade > 0) {
    markup.push(`<path d="${face}" fill="${LINE}" fill-opacity="${shade}"/>`)
  }
  return markup.join('')
}

/** The piece of slope round a corner, between the slopes of two sides that
 *  meet there: `first` and `second` are how far each side's foot lies from
 *  its lip, as drawn. */
export function slopeCornerMarkup(
  corner: Point,
  first: Point,
  second: Point,
  g: number,
  cliff: CliffColors,
  shade: number
): string {
  const xy = (p: Point, by: Point = [0, 0]) =>
    `${((p[0] + by[0]) * g).toFixed(1)},${((p[1] + by[1]) * g).toFixed(1)}`
  const d = `M${xy(corner)}L${xy(corner, first)}L${xy(corner, second)}Z`
  return (
    `<path d="${d}" fill="${cliff.face}" stroke="${cliff.face}" stroke-width="1" stroke-linejoin="round"/>` +
    (shade > 0 ? `<path d="${d}" fill="${LINE}" fill-opacity="${shade}"/>` : '')
  )
}

/** A dune: a low hump of sand with its lee side in shade, and marram grass on
 *  its crest. `size` is its width in map grid units. */
export function duneMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  lit: string,
  shade: string,
  grass: string,
  seed: number
): string {
  const [cx, cy, w] = [x * g, y * g, size * g]
  const h = w * 0.3
  const hump = `M${(cx - w / 2).toFixed(1)},${cy.toFixed(1)}Q${(cx - w * 0.15).toFixed(1)},${(cy - h * 1.9).toFixed(1)} ${(cx + w * 0.12).toFixed(1)},${(cy - h).toFixed(1)}T${(cx + w / 2).toFixed(1)},${cy.toFixed(1)}Z`
  const lee = `M${(cx + w * 0.12).toFixed(1)},${(cy - h).toFixed(1)}Q${(cx + w * 0.34).toFixed(1)},${(cy - h * 0.55).toFixed(1)} ${(cx + w / 2).toFixed(1)},${cy.toFixed(1)}L${(cx + w * 0.05).toFixed(1)},${cy.toFixed(1)}Z`
  const markup = [
    `<path d="${hump}" fill="${lit}"/>`,
    `<path d="${lee}" fill="${shade}" fill-opacity="0.55"/>`,
  ]
  if (roll(seed) > 0.35) {
    const [gx, gy] = [cx - w * 0.12, cy - h * 1.05]
    for (const lean of [-5, 0, 5]) {
      markup.push(
        `<path d="M${gx.toFixed(1)},${gy.toFixed(1)}l${lean},-9" stroke="${grass}" stroke-width="1.8" stroke-linecap="round"/>`
      )
    }
  }
  return markup.join('')
}

/** A tuft of meadow grass, with a flower in it now and then. */
export function tuftMarkup(
  x: number,
  y: number,
  g: number,
  grass: string,
  flower: string,
  seed: number
): string {
  const [cx, cy] = [x * g, y * g]
  const markup = [-6, -2, 2, 6].map(
    (lean, n) =>
      `<path d="M${(cx + lean * 0.6).toFixed(1)},${cy.toFixed(1)}l${lean * 0.7},${-(7 + (n % 2) * 3)}" stroke="${grass}" stroke-width="1.8" stroke-linecap="round"/>`
  )
  if (roll(seed) > 0.6) {
    markup.push(
      `<circle cx="${(cx + 7).toFixed(1)}" cy="${(cy - 4).toFixed(1)}" r="2.4" fill="${flower}"/>`
    )
  }
  return markup.join('')
}

/**
 * A beach in place of a sea cliff: from the edge of a tile's side (`a` to
 * `b`) the sand runs gently down and out to the water, `reach` away as drawn.
 * Dry sand, then a band of wet sand, a line of foam where the sea meets it,
 * and a little clear shallow water beyond. Drawn in two layers, so that where
 * two beaches overlap in a bay of the coast the dry sand of both lies over
 * the wet: "under" is the water, the wet sand and the foam, "over" the dry.
 */
export function beachMarkup(
  a: Point,
  b: Point,
  reach: Point,
  g: number,
  sand: string,
  wet: string,
  layer: 'under' | 'over'
): string {
  const at = (t: number, down: number) =>
    `${((a[0] + (b[0] - a[0]) * t + reach[0] * down) * g).toFixed(1)},${((a[1] + (b[1] - a[1]) * t + reach[1] * down) * g).toFixed(1)}`
  const band = (from: number, to: number) =>
    `M${at(0, from)}L${at(1, from)}L${at(1, to)}L${at(0, to)}Z`
  if (layer === 'over') {
    return `<path d="${band(0, BEACH_DRY)}" fill="${sand}" stroke="${sand}" stroke-width="1" stroke-linejoin="round"/>`
  }
  return [
    `<path d="${band(1, 1.22)}" fill="${WATER}" fill-opacity="0.35"/>`,
    `<path d="${band(0, 1)}" fill="${wet}" stroke="${wet}" stroke-width="1" stroke-linejoin="round"/>`,
    `<path d="M${at(0, 1)}L${at(1, 1)}" stroke="${WATER_STREAK}" stroke-width="3.5" stroke-linecap="round"/>`,
    `<path d="M${at(0.05, 1.12)}L${at(0.95, 1.12)}" stroke="${WATER_STREAK}" stroke-opacity="0.7" stroke-width="2" stroke-dasharray="14 9" stroke-linecap="round"/>`,
  ].join('')
}

// The share of a beach, from the land out, that is dry sand.
const BEACH_DRY = 0.68

/** The beach round a corner, between the beaches of two sides that meet
 *  there. */
export function beachCornerMarkup(
  corner: Point,
  first: Point,
  second: Point,
  g: number,
  sand: string,
  wet: string,
  layer: 'under' | 'over'
): string {
  const xy = (by: Point, share: number) =>
    `${((corner[0] + by[0] * share) * g).toFixed(1)},${((corner[1] + by[1] * share) * g).toFixed(1)}`
  const fan = (share: number) =>
    `M${xy(first, 0)}L${xy(first, share)}L${xy(second, share)}Z`
  if (layer === 'over') {
    return `<path d="${fan(BEACH_DRY)}" fill="${sand}" stroke="${sand}" stroke-width="1" stroke-linejoin="round"/>`
  }
  return [
    `<path d="${fan(1.22)}" fill="${WATER}" fill-opacity="0.35"/>`,
    `<path d="${fan(1)}" fill="${wet}" stroke="${wet}" stroke-width="1" stroke-linejoin="round"/>`,
    `<path d="M${xy(first, 1)}L${xy(second, 1)}" stroke="${WATER_STREAK}" stroke-width="3.5" stroke-linecap="round"/>`,
  ].join('')
}
