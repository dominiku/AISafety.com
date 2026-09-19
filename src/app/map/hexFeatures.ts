// PROTOTYPE Map 3.5, "Hex work" view: the pieces of the board that are drawn
// by code and are no district's ordinary ground: a crater with its lake, the
// leaning slopes of an escarpment and a volcano, the planks of a pier, dunes
// and meadow grass. Each returns
// SVG markup for hexBackdrop.ts to place; sizes are in map grid units, `g` is
// the pixels in one.
//
// DESIGN REVIEW (Melissa): all three are stand-ins in the classic map's colors,
// until the artists draw them.

import { distanceToStretch, type Point } from '@/lib/data/map-hex'
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
  g: number,
  // Mooring posts and side beams (a pier's; a platform has none).
  moorings = true,
  wood: string = PLANK,
  // Where a platform runs on onto the next tile's: no edge is drawn there,
  // and nothing under it.
  joins: [Point, Point][] = []
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
  const joined = (a: Point, b: Point) => {
    const middle: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    return joins.some(
      ([from, to]) => distanceToStretch(middle, from, to) < 0.05
    )
  }
  const under: string[] = []
  shape.forEach((a, n) => {
    const b = shape[(n + 1) % shape.length]
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    // Corners run clockwise on the screen, so a side faces the viewer where
    // it runs from right to left.
    if (length < 0.3 || a[0] - b[0] < 0.2 || joined(a, b)) return
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
    `<path d="${outline}" fill="${wood}"/>`,
    `<g clip-path="url(#${id})">`,
  ]
  // Planks lie on one grid for the whole board, so that they run on from
  // tile to tile of a platform.
  for (let s = Math.ceil(from / 0.24) * 0.24; s < to; s += 0.24) {
    out.push(
      `<path d="M${xy(point(s, left))}L${xy(point(s, right))}" stroke="${PLANK_GAP}" stroke-width="1.6"/>`
    )
  }
  for (const t of moorings ? [left, right] : []) {
    out.push(
      `<path d="M${xy(point(from, t))}L${xy(point(to, t))}" stroke="${PLANK_GAP}" stroke-width="4"/>`
    )
  }
  out.push('</g>')
  // A platform's edge, where it does not run on.
  if (!moorings) {
    shape.forEach((a, n) => {
      const b = shape[(n + 1) % shape.length]
      if (joined(a, b)) return
      out.push(
        `<path d="M${xy(a)}L${xy(b)}" stroke="${PLANK_GAP}" stroke-width="3.5" stroke-linecap="round"/>`
      )
    })
  }
  // Mooring posts, a little in from each beam.
  for (let s = from + 0.35; moorings && s < to - 0.1; s += 0.85) {
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

/**
 * A dune: a crescent of sand with a sharp crest, its windward side lit and
 * its slip face in shade, ripples on the lit side and marram grass at its
 * foot. `size` is its width in map grid units.
 */
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
  const h = w * 0.42
  const p = (dx: number, dy: number) =>
    `${(cx + dx * w).toFixed(1)},${(cy - dy * h).toFixed(1)}`
  // The crest runs in an S from the left foot over the top to the right horn.
  const crest = `C${p(-0.3, 0.55)} ${p(-0.12, 1.05)} ${p(0.08, 1)}C${p(0.24, 0.95)} ${p(0.36, 0.4)} ${p(0.5, 0)}`
  const markup = [
    // The whole dune in shade, then its lit windward side over that.
    `<path d="M${p(-0.5, 0)}${crest}Q${p(0.2, -0.22)} ${p(-0.5, 0)}Z" fill="${shade}"/>`,
    `<path d="M${p(-0.5, 0)}C${p(-0.3, 0.55)} ${p(-0.12, 1.05)} ${p(0.08, 1)}Q${p(0.02, 0.35)} ${p(0.22, -0.1)}Q${p(-0.1, -0.2)} ${p(-0.5, 0)}Z" fill="${lit}"/>`,
  ]
  for (const [dx, dy, length] of [
    [-0.3, 0.16, 0.26],
    [-0.2, 0.4, 0.2],
  ]) {
    markup.push(
      `<path d="M${p(dx, dy)}q${(length * w * 0.5).toFixed(1)},-3 ${(length * w).toFixed(1)},0" fill="none" stroke="${shade}" stroke-opacity="0.6" stroke-width="1.6" stroke-linecap="round"/>`
    )
  }
  if (roll(seed) > 0.3) {
    const gx = cx - w * 0.42
    for (const lean of [-5, 0, 5]) {
      markup.push(
        `<path d="M${gx.toFixed(1)},${(cy + 1).toFixed(1)}l${lean},-10" stroke="${grass}" stroke-width="1.8" stroke-linecap="round"/>`
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

// A beach is drawn in layers, each for every beach on a level before the
// next, so that where two beaches meet or overlap (round a corner, in a bay of
// the coast) they read as one: first the clear shallows and then the foam,
// both as an outline round the beach's shape; then the wet sand over the
// inner half of those outlines; and last the dry sand.
export type BeachLayer = 'shallows' | 'foam' | 'wet' | 'dry'

// The share of a beach, from the land out, that is dry sand.
const BEACH_DRY = 0.68

function beachLayerMarkup(
  // The whole beach, and its dry part, as closed paths.
  whole: string,
  dry: string,
  g: number,
  sand: string,
  wet: string,
  shallows: string,
  layer: BeachLayer
): string {
  const line = (color: string, across: number) =>
    `<path d="${whole}" fill="${color}" stroke="${color}" stroke-width="${(across * g).toFixed(1)}" stroke-linejoin="round"/>`
  if (layer === 'shallows') return line(shallows, 0.5)
  if (layer === 'foam') return line(WATER_STREAK, 0.17)
  if (layer === 'wet') return line(wet, 0.02)
  return `<path d="${dry}" fill="${sand}" stroke="${sand}" stroke-width="1" stroke-linejoin="round"/>`
}

/**
 * A beach in place of a sea cliff: from the edge of a tile's side (`a` to
 * `b`) the sand runs gently down and out to the water, `reach` away as drawn:
 * dry sand, a band of wet sand, a line of foam where the sea meets it, and a
 * little clear shallow water beyond.
 */
export function beachMarkup(
  a: Point,
  b: Point,
  reach: Point,
  g: number,
  sand: string,
  wet: string,
  shallows: string,
  layer: BeachLayer
): string {
  const at = (t: number, down: number) =>
    `${((a[0] + (b[0] - a[0]) * t + reach[0] * down) * g).toFixed(1)},${((a[1] + (b[1] - a[1]) * t + reach[1] * down) * g).toFixed(1)}`
  const band = (to: number) =>
    `M${at(0, 0)}L${at(1, 0)}L${at(1, to)}L${at(0, to)}Z`
  return beachLayerMarkup(
    band(1),
    band(BEACH_DRY),
    g,
    sand,
    wet,
    shallows,
    layer
  )
}

/** The beach round a corner, between the beaches of two sides that meet
 *  there. */
export function beachCornerMarkup(
  corner: Point,
  first: Point,
  second: Point,
  g: number,
  sand: string,
  wet: string,
  shallows: string,
  layer: BeachLayer
): string {
  const xy = (by: Point, share: number) =>
    `${((corner[0] + by[0] * share) * g).toFixed(1)},${((corner[1] + by[1] * share) * g).toFixed(1)}`
  const fan = (share: number) =>
    `M${xy(first, 0)}L${xy(first, share)}L${xy(second, share)}Z`
  return beachLayerMarkup(fan(1), fan(BEACH_DRY), g, sand, wet, shallows, layer)
}

// The classic art's own colors for what grows and what is built.
const LEAF = { lit: '#00ae85', shade: '#008969' }
const BUILT = { roof: '#d53d00', wall: '#ffa777', trim: '#ff7c25' }
// DESIGN REVIEW (Melissa): sulphur is the one yellow on the map.
const SULPHUR = { crust: '#f2c84b', pale: '#fbe9a6' }

/** A palm: a leaning trunk and a crown of drooping fronds. `size` is its
 *  height in map grid units; its foot stands at x, y. */
export function palmMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  seed: number
): string {
  const [fx, fy, h] = [x * g, y * g, size * g]
  const lean = (roll(seed) - 0.5) * 0.5 * h
  const [tx, ty] = [fx + lean, fy - h * 0.78]
  const markup = [
    `<path d="M${fx.toFixed(1)},${fy.toFixed(1)}Q${(fx + lean * 0.2).toFixed(1)},${(fy - h * 0.45).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}" fill="none" stroke="${PLANK}" stroke-width="${(h * 0.085).toFixed(1)}" stroke-linecap="round"/>`,
  ]
  // Fronds: leaf shapes arching out from the top and drooping at the tip.
  const fronds: [number, number, string][] = [
    [-0.62, 0.1, LEAF.shade],
    [0.62, 0.1, LEAF.shade],
    [-0.42, -0.2, LEAF.lit],
    [0.42, -0.2, LEAF.lit],
    [0, -0.34, LEAF.lit],
  ]
  for (const [dx, dy, color] of fronds) {
    const [ex, ey] = [tx + dx * h, ty + dy * h]
    const [mx, my] = [tx + dx * h * 0.55, ty + dy * h - h * 0.26]
    markup.push(
      `<path d="M${tx.toFixed(1)},${ty.toFixed(1)}Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}Q${mx.toFixed(1)},${(my + h * 0.2).toFixed(1)} ${tx.toFixed(1)},${ty.toFixed(1)}Z" fill="${color}"/>`
    )
  }
  markup.push(
    `<circle cx="${tx.toFixed(1)}" cy="${(ty + h * 0.03).toFixed(1)}" r="${(h * 0.05).toFixed(1)}" fill="${PLANK_GAP}"/>`
  )
  return markup.join('')
}

/** A beach hut on short stilts: striped walls, a pitched roof, a dark door.
 *  `size` is its width in map grid units; its foot stands at x, y. */
export function beachHutMarkup(
  x: number,
  y: number,
  size: number,
  g: number
): string {
  const [cx, fy, w] = [x * g, y * g, size * g]
  const [left, floor, eaves, ridge] = [
    cx - w / 2,
    fy - w * 0.14,
    fy - w * 0.72,
    fy - w * 1.12,
  ]
  const markup = [-0.36, 0.36].map(
    dx =>
      `<path d="M${(cx + dx * w).toFixed(1)},${floor.toFixed(1)}V${fy.toFixed(1)}" stroke="${PLANK_GAP}" stroke-width="3"/>`
  )
  markup.push(
    `<rect x="${left.toFixed(1)}" y="${eaves.toFixed(1)}" width="${w.toFixed(1)}" height="${(floor - eaves).toFixed(1)}" fill="${BUILT.wall}"/>`
  )
  for (let n = 0; n < 5; n += 2) {
    markup.push(
      `<rect x="${(left + (w * n) / 5).toFixed(1)}" y="${eaves.toFixed(1)}" width="${(w / 5).toFixed(1)}" height="${(floor - eaves).toFixed(1)}" fill="${BUILT.trim}"/>`
    )
  }
  markup.push(
    `<rect x="${(cx - w * 0.11).toFixed(1)}" y="${(floor - w * 0.4).toFixed(1)}" width="${(w * 0.22).toFixed(1)}" height="${(w * 0.4).toFixed(1)}" fill="${PLANK_GAP}"/>`,
    `<path d="M${(left - w * 0.1).toFixed(1)},${eaves.toFixed(1)}L${cx.toFixed(1)},${ridge.toFixed(1)}L${(left + w * 1.1).toFixed(1)},${eaves.toFixed(1)}Z" fill="${BUILT.roof}"/>`,
    `<path d="M${cx.toFixed(1)},${ridge.toFixed(1)}L${(left + w * 1.1).toFixed(1)},${eaves.toFixed(1)}L${(cx + w * 0.12).toFixed(1)},${eaves.toFixed(1)}Z" fill="${PLANK}"/>`
  )
  return markup.join('')
}

// Puffs of steam rising from a point, the higher the smaller and fainter.
function steamMarkup(cx: number, cy: number, reach: number, opacity: number) {
  return [
    [0, 0.5, 0.3],
    [0.22, 1, 0.24],
    [-0.1, 1.5, 0.17],
  ]
    .map(
      ([dx, up, r], n) =>
        `<circle cx="${(cx + dx * reach).toFixed(1)}" cy="${(cy - up * reach).toFixed(1)}" r="${(r * reach).toFixed(1)}" fill="${WATER_STREAK}" fill-opacity="${(opacity - n * 0.15).toFixed(2)}"/>`
    )
    .join('')
}

/** A hot spring: a pool of bright water in a crust of sulphur, with a wisp
 *  of steam. `size` is its width in map grid units. */
export function sulphurPoolMarkup(
  x: number,
  y: number,
  size: number,
  squash: number,
  g: number,
  seed: number,
  steam = true
): string {
  const [cx, cy, r] = [x * g, y * g, (size / 2) * g]
  const ring = (scale: number, fill: string) =>
    `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(r * scale).toFixed(1)}" ry="${(r * scale * squash).toFixed(1)}" fill="${fill}"/>`
  const markup = [
    ring(1, SULPHUR.crust),
    ring(0.8, SULPHUR.pale),
    ring(0.62, WATER),
    ring(0.3, WATER_STREAK),
  ]
  if (steam && roll(seed) > 0.4)
    markup.push(steamMarkup(cx, cy - r * 0.2, r * 0.9, 0.6))
  return markup.join('')
}

/** A geyser: a low cone of sulphur-stained rock with a column of water and
 *  steam going up from it. `size` is its height in map grid units. */
export function geyserMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  rock: string
): string {
  const [cx, fy, h] = [x * g, y * g, size * g]
  const w = h * 0.5
  return [
    `<path d="M${(cx - w / 2).toFixed(1)},${fy.toFixed(1)}L${(cx - w * 0.14).toFixed(1)},${(fy - h * 0.22).toFixed(1)}H${(cx + w * 0.14).toFixed(1)}L${(cx + w / 2).toFixed(1)},${fy.toFixed(1)}Z" fill="${rock}"/>`,
    `<path d="M${(cx - w * 0.14).toFixed(1)},${(fy - h * 0.22).toFixed(1)}H${(cx + w * 0.14).toFixed(1)}L${(cx + w * 0.3).toFixed(1)},${(fy - h * 0.08).toFixed(1)}H${(cx - w * 0.3).toFixed(1)}Z" fill="${SULPHUR.crust}"/>`,
    // The jet, wider toward the top, and the steam it goes up into.
    `<path d="M${(cx - w * 0.07).toFixed(1)},${(fy - h * 0.22).toFixed(1)}L${(cx - w * 0.2).toFixed(1)},${(fy - h * 0.8).toFixed(1)}H${(cx + w * 0.2).toFixed(1)}L${(cx + w * 0.07).toFixed(1)},${(fy - h * 0.22).toFixed(1)}Z" fill="${WATER_STREAK}"/>`,
    `<path d="M${cx.toFixed(1)},${(fy - h * 0.25).toFixed(1)}V${(fy - h * 0.78).toFixed(1)}" stroke="${WATER}" stroke-width="2"/>`,
    steamMarkup(cx, fy - h * 0.62, h * 0.42, 0.95),
  ].join('')
}

/** The crown of a forest tree seen from above: a round of leaves, lit on one
 *  side. `size` is its width in map grid units. */
export function canopyMarkup(
  x: number,
  y: number,
  size: number,
  squash: number,
  g: number,
  lit: string,
  shade: string
): string {
  const [cx, cy, r] = [x * g, y * g, (size / 2) * g]
  return (
    `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * (squash + 0.2)).toFixed(1)}" fill="${shade}"/>` +
    `<ellipse cx="${(cx - r * 0.18).toFixed(1)}" cy="${(cy - r * 0.2).toFixed(1)}" rx="${(r * 0.62).toFixed(1)}" ry="${(r * 0.5).toFixed(1)}" fill="${lit}"/>`
  )
}
