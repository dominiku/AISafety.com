// PROTOTYPE Map 3.5, "Hex work" view: the pieces of the board that are drawn
// by code and are no district's ordinary ground: a volcano, the
// leaning slopes of an escarpment and a volcano, the planks of a pier, dunes
// and meadow grass. Each returns
// SVG markup for hexBackdrop.ts to place; sizes are in map grid units, `g` is
// the pixels in one.
//
// DESIGN REVIEW (Melissa): all three are stand-ins in the classic map's colors,
// until the artists draw them.

import type { Point } from '@/lib/data/map-hex'
import { LINE, PLANK, PLANK_GAP, WATER, WATER_STREAK } from './realmArtBackdrop'

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
  // Planks lie on one grid for the whole board, so that they run on from
  // tile to tile of a platform.
  for (let s = Math.ceil(from / 0.24) * 0.24; s < to; s += 0.24) {
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

/** A low rounded hill of grass, lit from the left, now and then with a
 *  smaller one at its shoulder. */
export function hillMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  lit: string,
  shade: string,
  seed: number
): string {
  const mound = (cx: number, cy: number, w: number) => {
    const h = w * 0.4
    const p = (dx: number, dy: number) =>
      `${(cx + dx * w).toFixed(1)},${(cy - dy * h).toFixed(1)}`
    const dome = `C${p(-0.36, 0.72)} ${p(-0.16, 1)} ${p(0.02, 1)}C${p(0.2, 1)} ${p(0.38, 0.7)} ${p(0.5, 0)}`
    return [
      // The whole hill in shade, then its lit side over that.
      `<path d="M${p(-0.5, 0)}${dome}Q${p(0, -0.16)} ${p(-0.5, 0)}Z" fill="${shade}"/>`,
      `<path d="M${p(-0.5, 0)}C${p(-0.36, 0.72)} ${p(-0.16, 1)} ${p(0.02, 1)}Q${p(0.2, 0.5)} ${p(0.12, -0.1)}Q${p(-0.2, -0.14)} ${p(-0.5, 0)}Z" fill="${lit}"/>`,
      // The lie of the grass on the lit side.
      `<path d="M${p(-0.28, 0.3)}Q${p(-0.16, 0.5)} ${p(-0.02, 0.42)}" fill="none" stroke="${shade}" stroke-opacity="0.45" stroke-width="1.6" stroke-linecap="round"/>`,
    ].join('')
  }
  const [cx, cy, w] = [x * g, y * g, size * g]
  const side = roll(seed + 3) > 0.5 ? 1 : -1
  return (
    (roll(seed) > 0.45
      ? mound(cx + side * w * 0.34, cy - w * 0.07, w * 0.58)
      : '') + mound(cx, cy, w)
  )
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

// The classic art's own colors for what grows and what is built.
const LEAF = { lit: '#00ae85', shade: '#008969' }
const BUILT = { roof: '#d53d00', wall: '#ffa777', trim: '#ff7c25' }
// Thatch, and the pale ash round a volcano's top.
const THATCH = { lit: '#ffd1bc', shade: '#ffa777' }
const SNOW_ASH = '#ffd1bc'
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

/**
 * A hot spring: bright water in a crust of sulphur. No two are one shape: a
 * round pool, a pool of two or three lobes run together, or a long one;
 * `size` is about its width in map grid units.
 */
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
  // Each lobe: how far from the middle, as shares of the pool's radius, and
  // how large.
  const shapes: [number, number, number][][] = [
    [[0, 0, 1]],
    [
      [-0.42, 0.05, 0.78],
      [0.4, -0.1, 0.62],
    ],
    [
      [-0.5, 0.1, 0.6],
      [0.05, -0.12, 0.72],
      [0.55, 0.12, 0.5],
    ],
    [
      [-0.3, 0, 0.7],
      [0.3, 0, 0.7],
    ],
  ]
  const lobes = shapes[Math.floor(roll(seed + 5) * shapes.length)]
  const ring = (scale: number, fill: string) =>
    lobes
      .map(
        ([dx, dy, part]) =>
          `<ellipse cx="${(cx + dx * r).toFixed(1)}" cy="${(cy + dy * r * squash).toFixed(1)}" rx="${(r * part * scale).toFixed(1)}" ry="${(r * part * scale * squash).toFixed(1)}" fill="${fill}"/>`
      )
      .join('')
  const markup = [
    ring(1.18, SULPHUR.crust),
    ring(1, SULPHUR.pale),
    ring(0.8, WATER),
    ring(0.42, WATER_STREAK),
  ]
  if (steam && roll(seed) > 0.4) {
    markup.push(steamMarkup(cx, cy - r * 0.2, r * 0.9, 0.6))
  }
  return markup.join('')
}

/** A geyser going off: a low cone of sulphur-stained rock, a jet of water
 *  straight up from it, spray falling away to both sides at the top, and the
 *  steam above. `size` is its height in map grid units. */
export function geyserMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  rock: string,
  seed = 0
): string {
  const [cx, fy, h] = [x * g, y * g, size * g]
  const w = h * 0.5
  const top = fy - h * 0.82
  const markup = [
    `<path d="M${(cx - w / 2).toFixed(1)},${fy.toFixed(1)}L${(cx - w * 0.14).toFixed(1)},${(fy - h * 0.2).toFixed(1)}H${(cx + w * 0.14).toFixed(1)}L${(cx + w / 2).toFixed(1)},${fy.toFixed(1)}Z" fill="${rock}"/>`,
    `<path d="M${(cx - w * 0.14).toFixed(1)},${(fy - h * 0.2).toFixed(1)}H${(cx + w * 0.14).toFixed(1)}L${(cx + w * 0.3).toFixed(1)},${(fy - h * 0.07).toFixed(1)}H${(cx - w * 0.3).toFixed(1)}Z" fill="${SULPHUR.crust}"/>`,
    // The jet, narrow at the vent and wider where it breaks.
    `<path d="M${(cx - w * 0.06).toFixed(1)},${(fy - h * 0.2).toFixed(1)}L${(cx - w * 0.17).toFixed(1)},${top.toFixed(1)}H${(cx + w * 0.17).toFixed(1)}L${(cx + w * 0.06).toFixed(1)},${(fy - h * 0.2).toFixed(1)}Z" fill="${WATER_STREAK}"/>`,
    `<path d="M${cx.toFixed(1)},${(fy - h * 0.24).toFixed(1)}V${(top + 3).toFixed(1)}" stroke="${WATER}" stroke-width="2.4"/>`,
  ]
  // Spray: streams arching over and falling back, and drops beyond them.
  for (const side of [-1, 1]) {
    for (const [reach, fall] of [
      [0.34, 0.3],
      [0.56, 0.5],
    ]) {
      markup.push(
        `<path d="M${cx.toFixed(1)},${(top + 2).toFixed(1)}Q${(cx + side * reach * w).toFixed(1)},${(top - h * 0.16).toFixed(1)} ${(cx + side * reach * w * 1.5).toFixed(1)},${(top + fall * h).toFixed(1)}" fill="none" stroke="${WATER_STREAK}" stroke-width="${(h * 0.04).toFixed(1)}" stroke-linecap="round"/>`
      )
    }
    for (let n = 0; n < 3; n++) {
      const out = (0.55 + roll(seed + n * 3 + side) * 0.5) * w * side
      const down = (0.1 + roll(seed * 7 + n + side) * 0.45) * h
      markup.push(
        `<circle cx="${(cx + out).toFixed(1)}" cy="${(top + down).toFixed(1)}" r="${(h * 0.022).toFixed(1)}" fill="${WATER_STREAK}"/>`
      )
    }
  }
  markup.push(steamMarkup(cx, top + h * 0.12, h * 0.4, 0.9))
  return markup.join('')
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

// DESIGN REVIEW (Melissa): lava, and the smoke of a live volcano.
const LAVA = { edge: '#ff7c25', core: '#f2c84b' }
const SMOKE = { dark: '#5f7370', light: '#d9e2df' }

/**
 * A live volcano rising out of its tile. The tile's ground is its
 * neighbors' (it is drawn as part of their plateau), so the cone has no base
 * to sit on: a skirt of scree the shape of the tile fades into that ground,
 * and the flanks go up from a foot a little inside it to a rim the same shape,
 * smaller and higher. `top` is the tile's top (corners E, SE, SW, W, NW, NE):
 * the flanks toward the viewer stand on its sides SE, S and SW, lit from the
 * left. Gullies run down them and ash lies pale round the rim; lava glows in
 * the crater and runs down one flank; smoke drifts off downwind. `height` is
 * how far up the screen the rim stands (map grid units).
 */
export function volcanoMarkup(
  top: Point[],
  height: number,
  g: number,
  cliff: CliffColors
): string {
  const middle: Point = [
    top.reduce((sum, point) => sum + point[0], 0) / 6,
    top.reduce((sum, point) => sum + point[1], 0) / 6,
  ]
  const ring = (scale: number, up: number) =>
    top.map(
      ([x, y]): Point => [
        middle[0] + (x - middle[0]) * scale,
        middle[1] + (y - middle[1]) * scale - up,
      ]
    )
  const foot = ring(0.9, 0)
  const rim = ring(0.3, height)
  const xy = ([x, y]: Point) => `${(x * g).toFixed(1)},${(y * g).toFixed(1)}`
  const path = (points: Point[]) => `M${points.map(xy).join('L')}Z`
  const between = (a: Point, b: Point, t: number): Point => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ]
  const markup: string[] = [
    // The skirt of scree: two soft rings out to the tile's own outline.
    `<path d="${path(ring(1, 0))}" fill="${cliff.face}" fill-opacity="0.22"/>`,
    `<path d="${path(ring(0.96, 0))}" fill="${cliff.face}" fill-opacity="0.3"/>`,
  ]
  // The three flanks toward the viewer: SE in shade, S, SW in the light.
  const tones = [cliff.foot, cliff.face, cliff.lip]
  ;[0, 1, 2].forEach(k => {
    const [a, b, c, d] = [foot[k], foot[k + 1], rim[k + 1], rim[k]]
    markup.push(
      `<path d="${path([a, b, c, d])}" fill="${cliff.face}" stroke="${cliff.face}" stroke-width="1" stroke-linejoin="round"/>`,
      `<path d="${path([a, b, c, d])}" fill="${tones[k]}" fill-opacity="${k === 1 ? 0 : 0.55}"/>`,
      `<path d="${path([between(d, a, 0.2), between(c, b, 0.2), c, d])}" fill="${SNOW_ASH}" fill-opacity="0.75"/>`
    )
    for (let n = 0; n < 3; n++) {
      const t = (n + 0.5 + (roll(k * 5 + n) - 0.5) * 0.4) / 3
      const from = between(between(d, c, t), between(a, b, t), 0.28)
      const to = between(
        between(d, c, t),
        between(a, b, t),
        0.72 + roll(k * 7 + n) * 0.25
      )
      markup.push(
        `<path d="M${xy(from)}L${xy(to)}" stroke="${cliff.foot}" stroke-opacity="0.6" stroke-width="2.2" stroke-linecap="round"/>`
      )
    }
  })
  // Lava down the front flank, from a notch in the rim.
  const notch = between(rim[1], rim[2], 0.4)
  const run = [
    notch,
    between(notch, between(foot[1], foot[2], 0.3), 0.3),
    between(notch, between(foot[1], foot[2], 0.5), 0.55),
    between(notch, between(foot[1], foot[2], 0.42), 0.8),
  ]
  const flow = `M${run.map(xy).join('L')}`
  markup.push(
    `<path d="${flow}" fill="none" stroke="${LAVA.edge}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<path d="${flow}" fill="none" stroke="${LAVA.core}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`
  )
  // The crater: the dark wall inside the far rim, the lava, the rim's lip.
  const rimMiddle: Point = [middle[0], middle[1] - height]
  const pool = (scale: number): Point[] =>
    rim.map(([x, y]) => [
      rimMiddle[0] + (x - rimMiddle[0]) * scale,
      rimMiddle[1] +
        (y - rimMiddle[1]) * scale * 0.75 +
        (rim[1][1] - rimMiddle[1]) * 0.28,
    ])
  markup.push(
    `<path d="${path(rim)}" fill="${cliff.foot}"/>`,
    `<path d="${path(pool(0.8))}" fill="${LAVA.edge}" stroke="${LAVA.edge}" stroke-width="3" stroke-linejoin="round"/>`,
    `<path d="${path(pool(0.45))}" fill="${LAVA.core}"/>`,
    `<path d="${path(rim)}" fill="none" stroke="${cliff.lip}" stroke-width="3" stroke-linejoin="round"/>`
  )
  ;[3, 4, 5].forEach(k => {
    const at = between(rim[k], rim[(k + 1) % 6], 0.5)
    const w = Math.abs(rim[0][0] - rim[3][0]) * 0.22
    const h = w * (0.9 + roll(k + 41) * 0.6)
    markup.push(
      `<path d="${path([
        [at[0] - w / 2, at[1]],
        [at[0] - w * 0.05, at[1] - h],
        [at[0] + w / 2, at[1]],
      ])}" fill="${cliff.lip}"/>`,
      `<path d="${path([
        [at[0] - w * 0.05, at[1] - h],
        [at[0] + w / 2, at[1]],
        [at[0] + w * 0.12, at[1]],
      ])}" fill="${cliff.foot}"/>`
    )
  })
  // Smoke: puffs going up and off downwind, larger and paler as they go.
  const across = Math.abs(rim[0][0] - rim[3][0])
  ;[
    [0.05, 0.22, 0.3],
    [0.4, 0.55, 0.4],
    [0.95, 0.85, 0.5],
    [1.6, 1.05, 0.58],
    [2.3, 1.2, 0.62],
    [3, 1.28, 0.52],
  ].forEach(([dx, up, r], n) => {
    const [x, y] = [rimMiddle[0] + dx * across, rimMiddle[1] - up * across]
    markup.push(
      `<circle cx="${(x * g).toFixed(1)}" cy="${(y * g).toFixed(1)}" r="${(r * across * g).toFixed(1)}" fill="${n < 3 ? SMOKE.dark : SMOKE.light}" fill-opacity="${(0.85 - n * 0.11).toFixed(2)}"/>`,
      `<circle cx="${((x - r * across * 0.25) * g).toFixed(1)}" cy="${((y - r * across * 0.25) * g).toFixed(1)}" r="${(r * across * 0.55 * g).toFixed(1)}" fill="${SMOKE.light}" fill-opacity="${(0.5 - n * 0.05).toFixed(2)}"/>`
    )
  })
  return markup.join('')
}

/**
 * A house of timber and thatch, as they stand along tropical rivers and
 * shores, on posts of its own (`raised`) or straight on a deck that is: `kind` 0 a small hut with a steep thatched roof and a
 * ladder, 1 a long house with a low roof and a veranda, 2 a tall-roofed house
 * whose ridge sweeps up at both ends. `size` is its width in map grid units;
 * its posts stand at x, y.
 */
export function thatchHouseMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  kind: number,
  raised: boolean
): string {
  const w = size * g * (kind === 1 ? 1.45 : 1)
  const [cx, fy] = [x * g, y * g]
  const px = (dx: number) => (cx + dx * w).toFixed(1)
  const py = (up: number) => (fy - up * size * g).toFixed(1)
  const rect = (
    left: number,
    bottom: number,
    across: number,
    up: number,
    fill: string
  ) =>
    `<rect x="${px(left)}" y="${py(bottom + up)}" width="${(across * w).toFixed(1)}" height="${(up * size * g).toFixed(1)}" fill="${fill}"/>`
  const poly = (points: [number, number][], fill: string) =>
    `<path d="M${points.map(([dx, up]) => `${px(dx)},${py(up)}`).join('L')}Z" fill="${fill}"/>`
  const floor = raised ? 0.26 : 0.04
  const wall = kind === 2 ? 0.24 : 0.34
  const eaves = floor + wall
  const markup = [
    // Posts, the floor they carry, and the timber walls with their boards.
    ...(raised ? [-0.4, -0.13, 0.13, 0.4] : []).map(
      dx =>
        `<path d="M${px(dx)},${py(floor)}V${py(0)}" stroke="${PLANK_GAP}" stroke-width="2.6"/>`
    ),
    rect(-0.5, floor - 0.05, 1, 0.06, PLANK_GAP),
    rect(-0.42, floor, 0.84, wall, PLANK),
    rect(0.16, floor, 0.26, wall, PLANK_GAP),
    ...[0.33, 0.66].map(
      share =>
        `<path d="M${px(-0.42)},${py(floor + wall * share)}H${px(0.16)}" stroke="${PLANK_GAP}" stroke-width="1.2"/>`
    ),
    rect(-0.09, floor, 0.16, wall * 0.78, LINE),
  ]
  if (kind === 1) {
    // Windows along the long house, and the rail of its veranda.
    markup.push(
      rect(-0.34, floor + wall * 0.4, 0.1, wall * 0.34, LINE),
      rect(0.24, floor + wall * 0.4, 0.1, wall * 0.34, LINE),
      `<path d="M${px(-0.5)},${py(floor + 0.13)}H${px(0.5)}" stroke="${THATCH.shade}" stroke-width="2"/>`
    )
  }
  // The thatch: lit on the left, in shade on the right, a fringe at the eaves.
  const ridge = eaves + (kind === 1 ? 0.3 : kind === 2 ? 0.62 : 0.5)
  const roof: [number, number][] =
    kind === 2
      ? [
          [-0.56, eaves - 0.04],
          [-0.34, ridge + 0.08],
          [0, ridge - 0.1],
          [0.34, ridge + 0.08],
          [0.56, eaves - 0.04],
        ]
      : kind === 1
        ? [
            [-0.58, eaves - 0.04],
            [-0.3, ridge],
            [0.3, ridge],
            [0.58, eaves - 0.04],
          ]
        : [
            [-0.56, eaves - 0.05],
            [0, ridge],
            [0.56, eaves - 0.05],
          ]
  markup.push(
    poly(roof, THATCH.shade),
    poly(
      [...roof.filter(([dx]) => dx <= 0), [0, eaves - 0.04]] as [
        number,
        number,
      ][],
      THATCH.lit
    )
  )
  // A dark line under the eaves sets the pale thatch off from the deck.
  markup.push(
    `<path d="M${px(roof[0][0])},${py(eaves - 0.05)}H${px(-roof[0][0])}" stroke="${PLANK_GAP}" stroke-width="2"/>`
  )
  for (let k = 0; k < 6; k++) {
    const dx = -0.5 + k * 0.2
    markup.push(
      `<path d="M${px(dx)},${py(eaves - 0.04)}v${(size * g * 0.06).toFixed(1)}" stroke="${THATCH.shade}" stroke-width="2"/>`
    )
  }
  if (kind === 0 && raised) {
    // The ladder up to the door.
    markup.push(
      `<path d="M${px(-0.08)},${py(floor)}L${px(-0.2)},${py(0)}M${px(0.06)},${py(floor)}L${px(-0.06)},${py(0)}" stroke="${THATCH.shade}" stroke-width="1.6"/>`,
      ...[0.3, 0.6].map(
        share =>
          `<path d="M${px(-0.08 - 0.12 * share)},${py(floor * (1 - share))}h${(w * 0.14).toFixed(1)}" stroke="${THATCH.shade}" stroke-width="1.6"/>`
      )
    )
  }
  return markup.join('')
}

/** A beach parasol with a towel laid out beside it. `size` is the parasol's
 *  width in map grid units; its pole stands at x, y. */
export function parasolMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  seed: number
): string {
  const [cx, fy, w] = [x * g, y * g, size * g]
  const top = fy - w * 0.95
  const side = roll(seed) > 0.5 ? 1 : -1
  const towel = [
    [0.25, 0.04],
    [0.95, -0.02],
    [1.05, 0.2],
    [0.35, 0.26],
  ]
    .map(
      ([dx, dy]) =>
        `${(cx + side * dx * w).toFixed(1)},${(fy + dy * w).toFixed(1)}`
    )
    .join('L')
  const canopy = (from: number, to: number, fill: string) =>
    `<path d="M${(cx + from * w).toFixed(1)},${(top + w * 0.32).toFixed(1)}Q${(cx + ((from + to) / 2) * w * 0.4).toFixed(1)},${(top - w * 0.2).toFixed(1)} ${cx.toFixed(1)},${top.toFixed(1)}Q${(cx + ((from + to) / 2) * w * 0.9).toFixed(1)},${(top + w * 0.02).toFixed(1)} ${(cx + to * w).toFixed(1)},${(top + w * 0.32).toFixed(1)}Z" fill="${fill}"/>`
  return [
    `<path d="M${towel}Z" fill="${roll(seed + 1) > 0.5 ? WATER : BUILT.trim}"/>`,
    `<path d="M${cx.toFixed(1)},${fy.toFixed(1)}V${top.toFixed(1)}" stroke="${PLANK_GAP}" stroke-width="2.4"/>`,
    `<path d="M${(cx - w / 2).toFixed(1)},${(top + w * 0.32).toFixed(1)}Q${cx.toFixed(1)},${(top - w * 0.34).toFixed(1)} ${(cx + w / 2).toFixed(1)},${(top + w * 0.32).toFixed(1)}Z" fill="${BUILT.roof}"/>`,
    canopy(-0.3, -0.1, SNOW_ASH),
    canopy(0.1, 0.3, SNOW_ASH),
  ].join('')
}

// ---------------------------------------------------------------------------
// Natural water: shapes with no straight side and no perfect curve.

interface Lobe {
  x: number
  y: number
  rx: number
  ry: number
}

/**
 * The shore of a lake made of several lobes run together: one outline round
 * them all, seen from their middle, with the cusps between lobes rounded off
 * and the whole a little irregular. Points in map grid units.
 */
export function lakeShore(lobes: Lobe[], seed = 0): Point[] {
  const heart: Point = [
    lobes.reduce((sum, lobe) => sum + lobe.x, 0) / lobes.length,
    lobes.reduce((sum, lobe) => sum + lobe.y, 0) / lobes.length,
  ]
  const steps = 72
  const reach = Array.from({ length: steps }, (_, n) => {
    const angle = (n / steps) * Math.PI * 2
    const [dx, dy] = [Math.cos(angle), Math.sin(angle)]
    let far = 0
    for (const { x, y, rx, ry } of lobes) {
      // Where the ray from the heart leaves this lobe.
      const [px, py] = [(heart[0] - x) / rx, (heart[1] - y) / ry]
      const [qx, qy] = [dx / rx, dy / ry]
      const a = qx * qx + qy * qy
      const b = 2 * (px * qx + py * qy)
      const c = px * px + py * py - 1
      const root = b * b - 4 * a * c
      if (root < 0) continue
      far = Math.max(far, (-b + Math.sqrt(root)) / (2 * a))
    }
    return far
  })
  const floor = Math.min(...lobes.map(lobe => Math.min(lobe.rx, lobe.ry))) * 0.5
  return reach.map((_, n): Point => {
    // Rounded: the mean of the reach over a few steps to either side.
    let sum = 0
    for (let k = -3; k <= 3; k++) sum += reach[(n + k + steps) % steps]
    const angle = (n / steps) * Math.PI * 2
    const wobble =
      1 +
      0.07 * Math.sin(angle * 3 + seed * 1.7 + 0.6) +
      0.05 * Math.sin(angle * 5 + seed * 2.9 + 2.1)
    const r = Math.max(floor, (sum / 7) * wobble)
    return [heart[0] + Math.cos(angle) * r, heart[1] + Math.sin(angle) * r]
  })
}

/** A closed smooth curve through the middles of a shape's sides. */
export function smoothClosedPath(points: Point[], g: number): string {
  const at = (n: number) => points[(n + points.length) % points.length]
  const middle = (a: Point, b: Point) =>
    `${(((a[0] + b[0]) / 2) * g).toFixed(1)},${(((a[1] + b[1]) / 2) * g).toFixed(1)}`
  let d = `M${middle(at(-1), at(0))}`
  points.forEach((point, n) => {
    d += `Q${(point[0] * g).toFixed(1)},${(point[1] * g).toFixed(1)} ${middle(point, at(n + 1))}`
  })
  return `${d}Z`
}

/** The shape of `points` grown (or shrunk) about their middle. */
export function scaledAbout(points: Point[], scale: number): Point[] {
  const middle: Point = [
    points.reduce((sum, point) => sum + point[0], 0) / points.length,
    points.reduce((sum, point) => sum + point[1], 0) / points.length,
  ]
  return points.map(([x, y]) => [
    middle[0] + (x - middle[0]) * scale,
    middle[1] + (y - middle[1]) * scale,
  ])
}

/**
 * The hot spring a river rises from: an irregular pool in its crust of
 * sulphur, longer toward `toward` (the way the river leaves it), so that the
 * river runs out of its water. Layer "bed" is the crust and the water, drawn
 * under the river; "water" is the water alone, drawn over the river's first
 * stretch so that no river bank crosses the pool.
 */
export function thermalSpringMarkup(
  at: Point,
  toward: Point,
  size: number,
  squash: number,
  g: number,
  layer: 'bed' | 'water',
  // How far from the pool's middle the river starts: its tongue reaches there.
  reach = size * 0.375
): string {
  const [dx, dy] = [toward[0] - at[0], toward[1] - at[1]]
  const length = Math.hypot(dx, dy) || 1
  const [ux, uy] = [dx / length, dy / length]
  const r = size / 2
  const shore = lakeShore(
    [
      { x: at[0], y: at[1], rx: r, ry: r * squash },
      {
        x: at[0] - ux * r * 0.55 + uy * r * 0.35,
        y: at[1] - uy * r * 0.4 - ux * r * 0.2,
        rx: r * 0.7,
        ry: r * 0.62 * squash,
      },
      // The tongue of water the river leaves by.
      {
        x: at[0] + ux * Math.max(r * 0.75, reach - r * 0.2),
        y: at[1] + uy * Math.max(r * 0.75, reach - r * 0.2),
        rx: Math.max(r * 0.6, reach * 0.55),
        ry: r * 0.42 * squash + 0.12,
      },
    ],
    3
  )
  const ring = (scale: number, fill: string) =>
    `<path d="${smoothClosedPath(scaledAbout(shore, scale), g)}" fill="${fill}"/>`
  if (layer === 'water') {
    // (A little over the bed's water, to take in the stream's banks.)
    return ring(0.87, WATER) + ring(0.42, WATER_STREAK)
  }
  return (
    ring(1.2, SULPHUR.crust) +
    ring(1.03, SULPHUR.pale) +
    ring(0.8, WATER) +
    steamMarkup(at[0] * g, (at[1] - r * 0.2) * g, r * 0.8 * g, 0.55)
  )
}

/**
 * A barn on farming country: face-on and flat, as the map's other buildings
 * are, wider and lower than a house, with the big doors in its gable end and
 * a hay hatch above them. `x, y` is the middle of its foot, `size` its width,
 * in map grid units.
 */
export function barnMarkup(
  x: number,
  y: number,
  size: number,
  g: number
): string {
  const [cx, fy, w] = [x * g, y * g, size * g]
  const [eaves, ridge] = [fy - w * 0.46, fy - w * 0.88]
  const [left, right] = [cx - w / 2, cx + w / 2]
  return [
    `<rect x="${left.toFixed(1)}" y="${eaves.toFixed(1)}" width="${w.toFixed(1)}" height="${(fy - eaves).toFixed(1)}" fill="${BUILT.wall}"/>`,
    `<path d="M${(left - w * 0.07).toFixed(1)},${eaves.toFixed(1)}L${cx.toFixed(1)},${ridge.toFixed(1)}L${(right + w * 0.07).toFixed(1)},${eaves.toFixed(1)}Z" fill="${BUILT.roof}"/>`,
    // The hay hatch in the gable, and the big doors below it.
    `<rect x="${(cx - w * 0.08).toFixed(1)}" y="${(eaves - w * 0.22).toFixed(1)}" width="${(w * 0.16).toFixed(1)}" height="${(w * 0.16).toFixed(1)}" fill="${PLANK_GAP}"/>`,
    `<rect x="${(cx - w * 0.21).toFixed(1)}" y="${(fy - w * 0.33).toFixed(1)}" width="${(w * 0.42).toFixed(1)}" height="${(w * 0.33).toFixed(1)}" fill="${PLANK_GAP}"/>`,
    `<path d="M${cx.toFixed(1)},${(fy - w * 0.33).toFixed(1)}V${fy.toFixed(1)}" stroke="${BUILT.wall}" stroke-width="1.4"/>`,
    // A board along each side of the wall, as the barns of the classic map.
    `<path d="M${left.toFixed(1)},${(eaves + (fy - eaves) * 0.55).toFixed(1)}H${right.toFixed(1)}" stroke="${BUILT.trim}" stroke-width="${Math.max(1.5, w * 0.05).toFixed(1)}"/>`,
  ].join('')
}

/**
 * A haystack: a round rick with a pointed top, as the classic map's small
 * things are drawn. `x, y` is its foot, `size` its width, in map grid units.
 */
export function haystackMarkup(
  x: number,
  y: number,
  size: number,
  g: number
): string {
  const [cx, fy, w] = [x * g, y * g, size * g]
  const top = fy - w * 1.05
  return (
    `<path d="M${(cx - w / 2).toFixed(1)},${fy.toFixed(1)}Q${(cx - w * 0.42).toFixed(1)},${(fy - w * 0.62).toFixed(1)} ${cx.toFixed(1)},${top.toFixed(1)}Q${(cx + w * 0.42).toFixed(1)},${(fy - w * 0.62).toFixed(1)} ${(cx + w / 2).toFixed(1)},${fy.toFixed(1)}Z" fill="${THATCH.lit}"/>` +
    `<path d="M${cx.toFixed(1)},${top.toFixed(1)}Q${(cx + w * 0.42).toFixed(1)},${(fy - w * 0.62).toFixed(1)} ${(cx + w / 2).toFixed(1)},${fy.toFixed(1)}L${cx.toFixed(1)},${fy.toFixed(1)}Z" fill="${THATCH.shade}"/>`
  )
}

/**
 * A bed of reeds on an estuary's wet ground: one bold clump, its blades
 * fanning out of a low base, about half of them carrying a seed head. `x, y`
 * is the foot of the clump, `size` its width, in map grid units.
 */
export function reedBedMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  blade: string,
  head: string,
  wet: string,
  seed: number
): string {
  const [cx, cy, w] = [x * g, y * g, size * g]
  const markup = [
    // The wet ground it stands in.
    `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(w * 0.46).toFixed(1)}" ry="${(w * 0.11).toFixed(1)}" fill="${wet}" fill-opacity="0.5"/>`,
  ]
  const blades = 9 + Math.floor(roll(seed) * 4)
  for (let n = 0; n < blades; n++) {
    const lean = n / (blades - 1) - 0.5
    const tall = w * (0.95 + roll(seed * 3 + n) * 0.55)
    const [footX, tipX] = [cx + lean * w * 0.6, cx + lean * w * 1.5]
    const tip = cy - tall
    markup.push(
      `<path d="M${footX.toFixed(1)},${cy.toFixed(1)}Q${(footX + (tipX - footX) * 0.35).toFixed(1)},${(cy - tall * 0.62).toFixed(1)} ${tipX.toFixed(1)},${tip.toFixed(1)}" fill="none" stroke="${blade}" stroke-width="${Math.max(1.6, w * 0.055).toFixed(1)}" stroke-linecap="round"/>`
    )
    if (roll(seed * 7 + n) > 0.5) {
      // A seed head, lying along the way its blade leans.
      const tilt = (Math.atan2(tipX - footX, tall) * 180) / Math.PI
      const [hx, hy] = [tipX, tip + w * 0.11]
      markup.push(
        `<ellipse cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" rx="${(w * 0.055).toFixed(1)}" ry="${(w * 0.14).toFixed(1)}" fill="${head}" transform="rotate(${tilt.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)})"/>`
      )
    }
  }
  return markup.join('')
}

/**
 * A fisherman's net hung out to dry: two leaning poles, the spar they carry
 * and the net sagging from it. `x, y` is the foot of the frame, `size` its
 * width, in map grid units.
 */
export function netFrameMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  net: string,
  seed: number
): string {
  const [cx, cy, w] = [x * g, y * g, size * g]
  const h = w * 0.95
  const top = cy - h
  const [left, right] = [cx - w * 0.5, cx + w * 0.5]
  const [hangLeft, hangRight] = [cx - w * 0.38, cx + w * 0.38]
  // How far the net's belly hangs below its straight sides.
  const hang = h * (0.3 + roll(seed) * 0.1)
  const pole = Math.max(3, w * 0.085).toFixed(1)
  const markup = [
    // The two poles and the spar they carry.
    `<path d="M${left.toFixed(1)},${cy.toFixed(1)}L${(cx - w * 0.42).toFixed(1)},${(top - h * 0.09).toFixed(1)}" stroke="${PLANK_GAP}" stroke-width="${pole}" stroke-linecap="round"/>`,
    `<path d="M${right.toFixed(1)},${cy.toFixed(1)}L${(cx + w * 0.42).toFixed(1)},${(top - h * 0.09).toFixed(1)}" stroke="${PLANK_GAP}" stroke-width="${pole}" stroke-linecap="round"/>`,
    `<path d="M${(cx - w * 0.46).toFixed(1)},${top.toFixed(1)}L${(cx + w * 0.46).toFixed(1)},${top.toFixed(1)}" stroke="${PLANK}" stroke-width="${pole}" stroke-linecap="round"/>`,
    // The net itself, hanging from the spar with a belly in it.
    `<path d="M${hangLeft.toFixed(1)},${top.toFixed(1)}L${hangLeft.toFixed(1)},${(top + hang * 0.5).toFixed(1)}Q${cx.toFixed(1)},${(top + hang * 1.6).toFixed(1)} ${hangRight.toFixed(1)},${(top + hang * 0.5).toFixed(1)}L${hangRight.toFixed(1)},${top.toFixed(1)}Z" fill="${net}" fill-opacity="0.75"/>`,
  ]
  // Its mesh: threads down and two ropes across.
  const mesh = (d: string) =>
    `<path d="${d}" fill="none" stroke="${PLANK_GAP}" stroke-opacity="0.5" stroke-width="1.4"/>`
  for (let n = 1; n < 5; n++) {
    const t = n / 5
    const sx = hangLeft + (hangRight - hangLeft) * t
    const dip = top + hang * (0.5 + Math.sin(Math.PI * t) * 0.72)
    markup.push(
      mesh(
        `M${sx.toFixed(1)},${top.toFixed(1)}L${sx.toFixed(1)},${dip.toFixed(1)}`
      )
    )
  }
  for (const down of [0.18, 0.4]) {
    markup.push(
      mesh(
        `M${hangLeft.toFixed(1)},${(top + hang * down).toFixed(1)}Q${cx.toFixed(1)},${(top + hang * (down + 1.05)).toFixed(1)} ${hangRight.toFixed(1)},${(top + hang * down).toFixed(1)}`
      )
    )
  }
  return markup.join('')
}

// The light a lighthouse burns, in the classic map's warm yellows.
// DESIGN REVIEW (Melissa): both tones are picked to match the lava and
// sulphur already on the board.
const BEACON = { light: '#fbe9a6', core: '#f2c84b' }

/**
 * A lighthouse's beacon, lit: a cone of light thrown from the lantern at `at`
 * across the water to `toward`, and the lantern's own glow. The cone's sides
 * bow out and it fades away along its length, so that it ends in light and
 * not in an edge. Both points are in map grid units.
 */
export function beaconMarkup(at: Point, toward: Point, g: number): string {
  const [dx, dy] = [toward[0] - at[0], toward[1] - at[1]]
  const reach = Math.hypot(dx, dy)
  if (reach === 0) return ''
  const [ux, uy] = [dx / reach, dy / reach]
  // Across the beam, to spread its far end.
  const [px, py] = [-uy, ux]
  const point = (along: number, across: number): Point => [
    at[0] + ux * along + px * across,
    at[1] + uy * along + py * across,
  ]
  const xy = (along: number, across: number) => {
    const [x, y] = point(along, across)
    return `${(x * g).toFixed(1)},${(y * g).toFixed(1)}`
  }
  // One gradient for both cones: bright at the lantern, gone by the end.
  const id = `hex-beacon-${at[0].toFixed(2)}-${at[1].toFixed(2)}`.replace(
    /\./g,
    '_'
  )
  const [tipX, tipY] = point(reach * 1.3, 0)
  const cone = (throwTo: number, spread: number, opacity: number) =>
    // Down one bowed side, round the far end, back up the other.
    `<path d="M${xy(0, -0.06)}Q${xy(throwTo * 0.5, -spread * 0.42)} ${xy(throwTo, -spread)}Q${xy(throwTo * 1.14, 0)} ${xy(throwTo, spread)}Q${xy(throwTo * 0.5, spread * 0.42)} ${xy(0, 0.06)}Z" fill="url(#${id})" fill-opacity="${opacity}"/>`
  return (
    `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${(at[0] * g).toFixed(1)}" y1="${(at[1] * g).toFixed(1)}" x2="${(tipX * g).toFixed(1)}" y2="${(tipY * g).toFixed(1)}">` +
    `<stop offset="0" stop-color="${BEACON.core}" stop-opacity="0.85"/>` +
    `<stop offset="0.3" stop-color="${BEACON.light}" stop-opacity="0.5"/>` +
    `<stop offset="1" stop-color="${BEACON.light}" stop-opacity="0"/>` +
    `</linearGradient></defs>` +
    cone(reach * 1.3, reach * 0.24, 0.5) +
    cone(reach * 1.1, reach * 0.1, 0.55) +
    // The lantern: a soft halo round a bright eye.
    `<circle cx="${(at[0] * g).toFixed(1)}" cy="${(at[1] * g).toFixed(1)}" r="${(0.42 * g).toFixed(1)}" fill="${BEACON.light}" fill-opacity="0.3"/>` +
    `<circle cx="${(at[0] * g).toFixed(1)}" cy="${(at[1] * g).toFixed(1)}" r="${(0.24 * g).toFixed(1)}" fill="${BEACON.light}" fill-opacity="0.55"/>` +
    `<circle cx="${(at[0] * g).toFixed(1)}" cy="${(at[1] * g).toFixed(1)}" r="${(0.12 * g).toFixed(1)}" fill="${BEACON.core}"/>`
  )
}

/**
 * A ship standing out to sea: the classic sailboat with a pennant at its
 * masthead, and its wake curving back to `from`, the mouth it came out of.
 * The art has one broadside and cannot be turned to point out of a bay, so
 * the hull stays sideways-on and the wake is what says where the ship has
 * come from: it runs straight out of the mouth and then turns along the
 * coast, so the ship must lie to the east of its mouth and above it. `x, y`
 * is the middle of its waterline, `size` its width, in map grid units.
 */
export function departingShipMarkup(
  x: number,
  y: number,
  size: number,
  from: Point,
  g: number
): string {
  const [cx, cy, w] = [x * g, y * g, size * g]
  const h = w * 0.82
  const [mx, my] = [from[0] * g, from[1] * g]
  // The stern, and how far the mouth lies astern of it and below it.
  const [sx, sy] = [cx - w * 0.42, cy]
  const [back, down] = [sx - mx, my - sy]
  if (Math.hypot(back, down) === 0) return ''
  // The track the ship has come along, read backwards from its stern: astern
  // a while, then a bend down into the mouth, which it leaves going straight
  // out of the bay. The two control points are what make that corner.
  const hold: Point = [sx - back * 0.5, sy + down * 0.06]
  const turn: Point = [mx + back * 0.14, my - down * 0.62]
  // The track does not stop at the mouth: it carries on down into the bay,
  // where she lay, so that she reads as having come out of it however near
  // the mouth she still is.
  const tail: Point = [mx, my + w * 0.8]
  const onTrack = (t: number): Point => {
    const u = 1 - t
    const mix = (a: number, b: number, c: number, d: number) =>
      u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d
    return [
      mix(sx, hold[0], turn[0], tail[0]),
      mix(sy, hold[1], turn[1], tail[1]),
    ]
  }
  const xy = ([px, py]: Point) => `${px.toFixed(1)},${py.toFixed(1)}`
  const markup: string[] = []
  // The wake opens out astern: at the stern its width shows across the track,
  // at the mouth, where the track runs straight up, it shows to either side.
  for (const side of [-1, 1]) {
    markup.push(
      `<path d="M${xy([sx, sy + side * 2])}C${xy([hold[0], hold[1] + side * w * 0.1])} ${xy([turn[0] + side * w * 0.3, turn[1]])} ${xy([tail[0] + side * w * 0.36, tail[1]])}" fill="none" stroke="${WATER_STREAK}" stroke-opacity="0.75" stroke-width="2.4" stroke-linecap="round"/>`,
      // A fainter line inside it, fading out before the mouth.
      `<path d="M${xy([sx - w * 0.12, sy + side * 1])}Q${xy([hold[0], hold[1] + side * w * 0.05])} ${xy(onTrack(0.55))}" fill="none" stroke="${WATER_STREAK}" stroke-opacity="0.45" stroke-width="2" stroke-linecap="round"/>`
    )
  }
  // The churned water along the track, just astern of her.
  for (const t of [0.12, 0.24, 0.36]) {
    markup.push(
      `<path d="M${xy(onTrack(t))}L${xy(onTrack(t + 0.05))}" stroke="${WATER_STREAK}" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>`
    )
  }
  markup.push(
    `<use href="#sailboat" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h * 0.92).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`,
    // The pennant, streaming aft from the masthead.
    `<path d="M${cx.toFixed(1)},${(cy - h * 0.9).toFixed(1)}V${(cy - h * 1.12).toFixed(1)}" stroke="${PLANK_GAP}" stroke-width="2"/>`,
    `<path d="M${cx.toFixed(1)},${(cy - h * 1.12).toFixed(1)}L${(cx - w * 0.3).toFixed(1)},${(cy - h * 1.06).toFixed(1)}L${cx.toFixed(1)},${(cy - h * 1).toFixed(1)}Z" fill="${BUILT.roof}"/>`
  )
  return markup.join('')
}

/**
 * A ship coming in: the classic sailboat with a pennant at its masthead, and
 * behind it (to the west: it sails east, into the bay) the spreading lines of
 * its wake. `x, y` is the middle of its waterline, `size` its width, in map
 * grid units.
 */
export function arrivalShipMarkup(
  x: number,
  y: number,
  size: number,
  g: number
): string {
  const [cx, cy, w] = [x * g, y * g, size * g]
  const h = w * 0.82
  const markup: string[] = []
  // The wake: two lines opening out astern, and the churned water between.
  // It runs far enough back to leave the harbor by its mouth, so the ship
  // reads as having come in off the open sea.
  for (const side of [-1, 1]) {
    markup.push(
      `<path d="M${(cx - w * 0.3).toFixed(1)},${(cy + side * 2).toFixed(1)}Q${(cx - w * 1.6).toFixed(1)},${(cy + side * w * 0.14).toFixed(1)} ${(cx - w * 2.3).toFixed(1)},${(cy + side * w * 0.46).toFixed(1)}" fill="none" stroke="${WATER_STREAK}" stroke-opacity="0.8" stroke-width="2.4" stroke-linecap="round"/>`,
      `<path d="M${(cx - w * 0.5).toFixed(1)},${(cy + side * 1).toFixed(1)}Q${(cx - w * 1.4).toFixed(1)},${(cy + side * w * 0.06).toFixed(1)} ${(cx - w * 1.8).toFixed(1)},${(cy + side * w * 0.2).toFixed(1)}" fill="none" stroke="${WATER_STREAK}" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round"/>`
    )
  }
  for (const back of [0.7, 1.05, 1.4, 1.75]) {
    markup.push(
      `<path d="M${(cx - w * back).toFixed(1)},${cy.toFixed(1)}h${(-w * 0.16).toFixed(1)}" stroke="${WATER_STREAK}" stroke-opacity="0.6" stroke-width="2" stroke-linecap="round"/>`
    )
  }
  markup.push(
    `<use href="#sailboat" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h * 0.92).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`,
    // The pennant, streaming aft from the masthead.
    `<path d="M${cx.toFixed(1)},${(cy - h * 0.9).toFixed(1)}V${(cy - h * 1.12).toFixed(1)}" stroke="${PLANK_GAP}" stroke-width="2"/>`,
    `<path d="M${cx.toFixed(1)},${(cy - h * 1.12).toFixed(1)}L${(cx - w * 0.3).toFixed(1)},${(cy - h * 1.06).toFixed(1)}L${cx.toFixed(1)},${(cy - h * 1).toFixed(1)}Z" fill="${BUILT.roof}"/>`
  )
  return markup.join('')
}

/**
 * Where a stream leaves a hot spring: the pool narrows into it. `course` is
 * the stream's first stretch, from inside the pool outward; the water is
 * `wide` across (half of it) at the pool and the stream's own half-width,
 * `narrow`, at the far end, and the pool's crust of sulphur thins out along
 * it. Layers as for the spring itself.
 */
export function springOutflowMarkup(
  course: Point[],
  wide: number,
  narrow: number,
  g: number,
  layer: 'bed' | 'water'
): string {
  if (course.length < 3) return ''
  const band = (extra: number, fade: boolean) => {
    const side = (turn: number) =>
      course.map((point, k): Point => {
        const before = course[Math.max(0, k - 1)]
        const after = course[Math.min(course.length - 1, k + 1)]
        const run = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1
        const t = k / (course.length - 1)
        // Narrowing fast at first, then slowly: the neck of a funnel.
        const ease = (1 - t) * (1 - t)
        const half =
          narrow + (wide - narrow) * ease + extra * (fade ? 1 - t : 1)
        return [
          point[0] - ((after[1] - before[1]) / run) * half * turn,
          point[1] + ((after[0] - before[0]) / run) * half * turn,
        ]
      })
    return `M${[...side(1), ...side(-1).reverse()]
      .map(([x, y]) => `${(x * g).toFixed(1)},${(y * g).toFixed(1)}`)
      .join('L')}Z`
  }
  const shape = (extra: number, fade: boolean, fill: string) =>
    `<path d="${band(extra, fade)}" fill="${fill}" stroke="${fill}" stroke-width="1" stroke-linejoin="round"/>`
  if (layer === 'water') return shape(0, false, WATER)
  return (
    shape(0.3, true, SULPHUR.crust) +
    shape(0.16, true, SULPHUR.pale) +
    shape(0, false, WATER)
  )
}
