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

/**
 * A volcano standing on its tile: a cone from a wide foot up to a broken rim,
 * lit from the left, gullies down its flanks, ash pale round its top, a lake
 * in the crater seen over the near lip, and steam rising from it. `foot` is
 * the middle of its base, `radius` half the width of the base, `height` how
 * far up the screen the rim stands (map grid units).
 */
export function volcanoMarkup(
  foot: Point,
  radius: number,
  height: number,
  squash: number,
  g: number,
  cliff: CliffColors
): string {
  const [cx, cy] = [foot[0] * g, foot[1] * g]
  const [rx, ry] = [radius * g, radius * squash * g]
  const top = cy - height * g
  const [tx, ty] = [rx * 0.42, ry * 0.42]
  const n = (value: number) => value.toFixed(1)
  // The flank between two shares of the way from the rim (0) to the foot (1),
  // from the left edge across to `right` (-1 the left edge, 1 the right).
  const flank = (from: number, to: number, right: number) => {
    const half = (t: number) => tx + (rx - tx) * t
    const level = (t: number) => top + (cy - top) * t
    const bulge = (t: number) => (ty + (ry - ty) * t) * (1 - Math.abs(right))
    return `M${n(cx - half(from))},${n(level(from))}L${n(cx + right * half(from))},${n(level(from) + bulge(from))}L${n(cx + right * half(to))},${n(level(to) + bulge(to))}L${n(cx - half(to))},${n(level(to))}Z`
  }
  const body = `M${n(cx - rx)},${n(cy)}L${n(cx - tx)},${n(top)}L${n(cx + tx)},${n(top)}L${n(cx + rx)},${n(cy)}A${n(rx)},${n(ry)} 0 0 1 ${n(cx - rx)},${n(cy)}Z`
  const markup = [
    `<path d="${body}" fill="${cliff.face}"/>`,
    // The lit side: from the left edge to a little short of the middle.
    `<path d="${flank(0, 1, -0.12)}" fill="${cliff.lip}" fill-opacity="0.55"/>`,
    // Ash round the top, paler.
    `<path d="M${n(cx - tx)},${n(top)}L${n(cx + tx)},${n(top)}L${n(cx + tx + (rx - tx) * 0.2)},${n(top + (cy - top) * 0.2)}L${n(cx + tx * 0.5)},${n(top + (cy - top) * 0.13 + ty)}L${n(cx)},${n(top + (cy - top) * 0.24 + ty)}L${n(cx - tx * 0.6)},${n(top + (cy - top) * 0.14 + ty)}L${n(cx - tx - (rx - tx) * 0.2)},${n(top + (cy - top) * 0.2)}Z" fill="${SNOW_ASH}" fill-opacity="0.85"/>`,
  ]
  // Gullies, fanning out toward the foot.
  for (let k = 0; k < 7; k++) {
    const across = (k + 0.5) / 7 - 0.5
    const start = 0.2 + roll(k + 11) * 0.12
    const end = 0.7 + roll(k + 23) * 0.28
    const at = (t: number): [number, number] => [
      cx + across * 2 * (tx + (rx - tx) * t),
      top +
        (cy - top) * t +
        (ty + (ry - ty) * t) * (1 - Math.abs(across * 2)) * 0.9,
    ]
    const [a, b] = [at(start), at(end)]
    markup.push(
      `<path d="M${n(a[0])},${n(a[1])}L${n(b[0])},${n(b[1])}" stroke="${cliff.foot}" stroke-opacity="0.6" stroke-width="2.2" stroke-linecap="round"/>`
    )
  }
  // The crater: the far wall inside the rim, the lake, and the rim's lip. A
  // few crags stand on the far rim.
  markup.push(
    `<ellipse cx="${n(cx)}" cy="${n(top)}" rx="${n(tx)}" ry="${n(ty)}" fill="${cliff.foot}"/>`,
    `<ellipse cx="${n(cx)}" cy="${n(top + ty * 0.3)}" rx="${n(tx * 0.78)}" ry="${n(ty * 0.62)}" fill="${WATER}"/>`,
    `<path d="M${n(cx - tx * 0.4)},${n(top + ty * 0.3)}h${n(tx * 0.45)}" stroke="${WATER_STREAK}" stroke-width="2.4" stroke-linecap="round"/>`,
    `<ellipse cx="${n(cx)}" cy="${n(top)}" rx="${n(tx)}" ry="${n(ty)}" fill="none" stroke="${cliff.lip}" stroke-width="3"/>`
  )
  for (let k = 0; k < 5; k++) {
    const angle = Math.PI * (1.12 + (0.76 * k) / 4)
    const px = cx + Math.cos(angle) * tx
    const py = top + Math.sin(angle) * ty
    const w = tx * (0.3 + roll(k + 31) * 0.14)
    const h = ty * (0.55 + roll(k + 41) * 0.5)
    markup.push(
      `<path d="M${n(px - w / 2)},${n(py)}L${n(px - w * 0.05)},${n(py - h)}L${n(px + w / 2)},${n(py)}Z" fill="${cliff.lip}"/>`,
      `<path d="M${n(px - w * 0.05)},${n(py - h)}L${n(px + w / 2)},${n(py)}L${n(px + w * 0.12)},${n(py)}Z" fill="${cliff.foot}"/>`
    )
  }
  markup.push(steamMarkup(cx + tx * 0.15, top - ty * 0.2, tx * 1.5, 0.75))
  return markup.join('')
}

/**
 * A house on stilts, of timber and thatch, as they stand along tropical
 * rivers and shores: `kind` 0 a small hut with a steep thatched roof and a
 * ladder, 1 a long house with a low roof and a veranda, 2 a tall-roofed house
 * whose ridge sweeps up at both ends. `size` is its width in map grid units;
 * its posts stand at x, y.
 */
export function stiltHouseMarkup(
  x: number,
  y: number,
  size: number,
  g: number,
  kind: number
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
  const floor = 0.26
  const wall = kind === 2 ? 0.24 : 0.34
  const eaves = floor + wall
  const markup = [
    // Posts, the floor they carry, and the timber walls with their boards.
    ...[-0.4, -0.13, 0.13, 0.4].map(
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
  if (kind === 0) {
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
