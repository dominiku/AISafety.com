// PROTOTYPE Map 3.5, "Hex work" view: the board of hexagonal tiles laid out
// by map-hex-layout.ts, drawn as a strategy board game seen from the south.
// Each tile is a slab in the classic map's palette: a top, and a darker face
// under each of its three sides that look toward the viewer. A district is
// one plateau: its tiles stand at one height and run into each other, a
// darker rim runs round the district, not round each tile, and each district
// has a tone of its own of its realm's ground. Tiles are drawn from the back
// of the board to the front, so a nearer, taller tile covers what is behind.
//
// The colors, the brown road with its pebbles, the streaked river, the
// terrain details and the landmark art are the Art work view's
// (realmArtBackdrop.ts). New here: the slabs, the river as a broad band that
// runs on from tile to tile without a seam, its falls (small and large) where
// it steps down toward the viewer, its mouths and the shallows off them, and
// the castle's moat.
//
// Built as SVG markup (hexBackdropMarkup) so it can be looked at outside the
// browser too; drawHexBackdrop puts it on the map.

import type * as d3 from 'd3'
import {
  hexCorners,
  hexKey,
  hexNeighbor,
  insetConvex,
  insideConvex,
  projectPoint,
  type Point,
} from '@/lib/data/map-hex'
import type {
  HexLaidTile,
  HexLayout,
  HexPathDrop,
  HexPathPiece,
} from '@/lib/data/map-hex-layout'
import { QUIET_REALM } from '@/lib/data/map-realms'
import { scatterSpots } from '@/lib/data/map-art-scatter'
import {
  BACK_ROW,
  LANDMARKS_URL,
  LINE,
  PLANK,
  PLANK_GAP,
  ROAD,
  ROAD_PEBBLE,
  SEA,
  SHALLOWS,
  SHELF_INNER,
  SHELF_OUTER,
  SNOW,
  TERRAIN_SCATTER,
  WATER,
  WATER_STREAK,
  terrainDetail,
  themeOf,
  type ArtPin,
  type RealmTheme,
} from './realmArtBackdrop'

// DESIGN REVIEW (Melissa): the closed orgs' islet, in the classic map's dark
// greens. Every other color of this view is the Art work view's, or a tone
// worked out from one (districtTone).
const QUIET_THEME: RealmTheme = {
  tones: ['#2f5650'],
  cliff: { lip: '#2f5650', face: '#21463f', foot: '#173633' },
}
// DESIGN REVIEW (Melissa): how far a district's tone may stray from its
// realm's ground, in lightness (of 1) and in hue (degrees). Each district of
// a realm gets its own step within that, so neighbors can be told apart while
// the realm still reads as one country.
const TONE_LIGHTNESS = 0.085
const TONE_HUE = 5
// DESIGN REVIEW (Melissa): the classic map's three greens are one hue, light,
// mid and dark, and side by side as whole realms they were hard to tell
// apart. Here the Talent pipeline's ground is turned (degrees of hue) toward
// a leafier, more verdant green; Media and discourse keeps the classic light
// wetland green for its delta; Policy and strategy becomes plains (below).
const REALM_HUE: Record<string, number> = { talent: -22 }
// DESIGN REVIEW (Melissa): Policy and strategy as open plains: a dry grass
// ground in place of the classic dark green, so that it reads apart from the
// Talent pipeline's and the delta's greens at a glance.
const POLICY_PLAINS: Partial<RealmTheme> = {
  tones: ['#b9c76a'],
  cliff: { lip: '#cdd884', face: '#8d9c47', foot: '#66742f' },
  growth: '#8d9c47',
}
const TURNED_SATURATION = 0.8
// DESIGN REVIEW (Melissa): the dam's stone, ripe crops and vines, all from
// the classic map's sands, oranges and dark greens.
const DAM = { stone: '#ffd1bc', cap: '#f6fbff', line: '#972f00' }
const FIELD_RIPE = '#ffd1bc'
const VINE = '#2f5650'
// The peaks that wall a forbidding district in.
const WALL = { lit: '#972f00', shade: '#571f02' }
// A thin dark line along the edge of every district, over its rim.
const BORDER_LINE = { width: 2.5, opacity: 0.55 }
// How much darker than the ground a district's rim is, and a tile's
// south-east face than the other two (the light comes from the west).
const RIM_SHADE = 0.22
const FACE_SHADE = 0.16
// Map grid units the rim reaches in from the edge of a district.
const RIM_WIDTH = 0.24
// Map grid units: the bright lip along the top of a face, and the dark foot
// where it meets the sea.
const FACE_LIP = 0.08
const FACE_FOOT = 0.12
// Pixels: the line of ground that seals the join of two tiles of a district.
const JOIN_SEAL = 3
// Pixels of darker bank either side of the water.
const BANK = 3
// Map grid units a river piece runs on past its ends, under the next piece.
// A tile's side lies at a slant on the screen while a piece ends square to
// its own line, so it has to reach well past the side, or a sliver of ground
// shows at one bank.
const SEAM_OVERLAP = 0.3
// Share of the next tile's side a district's rim is carried along past a
// corner: enough to draw the corner whole, and short of the middle of the
// side, where a river or road may cross.
const RIM_CARRY = 0.22
// A fall this high (map grid units) or more is a large one.
const LARGE_FALL = 0.55
// Map grid units the two bands of the border of shallows reach out from the
// coast.
const COAST_BORDER = { outer: 0.95, inner: 0.4 }
// Sea tiles are drawn this far past the board, so zooming out shows no edge.
const SEA_REACH = 8

const realmKey = (realm: string | null) =>
  (realm ?? '').split(' ')[0].toLowerCase()
const themeFor = (realm: string | null): RealmTheme =>
  realm === QUIET_REALM
    ? QUIET_THEME
    : realmKey(realm) === 'policy'
      ? { ...themeOf(realm ?? undefined), ...POLICY_PLAINS }
      : themeOf(realm ?? undefined)

// A color as hue (degrees), saturation and lightness (of 1), and back.
function toHsl(hex: string): [number, number, number] {
  const [r, g, b] = [1, 3, 5].map(n => parseInt(hex.slice(n, n + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  const h =
    max === r
      ? ((g - b) / d + 6) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4
  return [h * 60, s, l]
}
function toHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const [r, g, b] = [
    [c, x, 0],
    [x, c, 0],
    [0, c, x],
    [0, x, c],
    [x, 0, c],
    [c, 0, x],
  ][Math.floor((((h % 360) + 360) % 360) / 60)]
  return `#${[r, g, b]
    .map(v =>
      Math.round(Math.min(1, Math.max(0, v + m)) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

// One color laid over another at the given strength, as one solid color.
function mixHex(under: string, over: string, strength: number): string {
  const part = (hex: string, n: number) => parseInt(hex.slice(n, n + 2), 16)
  return `#${[1, 3, 5]
    .map(n =>
      Math.round(part(under, n) * (1 - strength) + part(over, n) * strength)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

// The sides of a tile in the order the corners of its top run.
const SIDE_NAMES = ['SE', 'S', 'SW', 'NW', 'N', 'NE'] as const

/** The ground of the `index`th of a realm's `count` districts: the realm's
 *  own ground, lighter or darker and a touch warmer or cooler by a step of
 *  its own. Steps alternate (0, +1, -1, +2, -2...) so that districts listed
 *  next to each other differ most. */
export function districtTone(
  base: string,
  index: number,
  count: number,
  turn = 0
) {
  const [h, full, l] = toHsl(base)
  // A turned green is calmed a little, or it glares.
  const s = turn === 0 ? full : full * TURNED_SATURATION
  if (count <= 1) return toHex(h + turn, s, l)
  const reach = Math.ceil((count - 1) / 2)
  const step = (index % 2 === 1 ? 1 : -1) * Math.ceil(index / 2)
  const share = step / reach
  return toHex(h + turn + share * TONE_HUE, s, l + share * TONE_LIGHTNESS)
}

export function hexBackdropMarkup(
  layout: HexLayout,
  gridSize: number,
  width: number,
  height: number,
  // With pins, the terrain details and the classic landmarks are drawn too
  // (the landmarks as <use> of the symbols in LANDMARKS_URL, which have to be
  // in the same document).
  pins?: ArtPin[]
): string {
  const g = gridSize
  const { view } = layout
  const xy = ([x, y]: Point) => `${(x * g).toFixed(1)},${(y * g).toFixed(1)}`
  const outline = (polygon: Point[]) => `M${polygon.map(xy).join('L')}Z`
  const out: string[] = []
  const clips: string[] = []
  const laidByCell = new Map(layout.tiles.map(tile => [hexKey(tile), tile]))
  const tileByRef = new Map(
    layout.tiles.flatMap(tile => (tile.ref ? [[tile.ref, tile] as const] : []))
  )

  out.push(
    `<rect x="${-width}" y="${-height}" width="${width * 3}" height="${height * 3}" fill="${SEA}"/>`
  )

  // The sea: a faint honeycomb, as on the land, and round the island a border
  // of shallower water that follows the coast, a wider dim band and a
  // narrower paler one inside it. Both are the island's own outline at sea
  // level drawn with a wide rounded line, so they keep the coast's shape.
  const seaHex = (cell: { col: number; row: number }, scale = 1) =>
    hexCorners(cell, view.size, scale).map(corner =>
      projectPoint(view, corner, 0)
    )
  // Sunken ships are not land: the sea and its border pass under them.
  const land = layout.tiles.filter(tile => tile.state !== 'sea' && !tile.sunken)
  const landCells = new Set(land.map(tile => hexKey(tile)))
  for (let col = -SEA_REACH; col < layout.columns + SEA_REACH; col++) {
    for (let row = -SEA_REACH; row < layout.rows + SEA_REACH; row++) {
      if (landCells.has(hexKey({ col, row }))) continue
      out.push(
        `<path d="${outline(seaHex({ col, row }, 0.95))}" fill="none" stroke="${SHELF_OUTER}" stroke-width="2"/>`
      )
    }
  }
  const coast = land.map(tile => outline(seaHex(tile))).join('')
  for (const [color, reach] of [
    [SHELF_INNER, COAST_BORDER.outer],
    [SHALLOWS, COAST_BORDER.inner],
  ] as const) {
    out.push(
      `<path d="${coast}" fill="${color}" stroke="${color}" stroke-width="${(reach * 2 * g).toFixed(1)}" stroke-linejoin="round"/>`
    )
  }
  // Coves and harbors: water inside the coast, under the piers and boats.
  for (const tile of land) {
    if (tile.state !== 'water') continue
    out.push(
      `<path d="${outline(tile.top)}" fill="${SHALLOWS}" stroke="${SHALLOWS}" stroke-width="2"/>`
    )
  }

  // Piers: out from the harbor where the road ends at the water, and from the
  // shore of a district that has one. (Where the river reaches the coast its
  // water simply ends at the edge of the land.)
  for (const end of layout.ends) {
    if (end.kind === 'river') continue
    const at = (along: number): Point => [
      end.at[0] + end.toward[0] * along,
      end.at[1] + end.toward[1] * along,
    ]
    const d = `M${xy(at(0.2))}L${xy(at(1.3))}`
    const across = (end.width * g * 0.8).toFixed(1)
    out.push(
      `<path d="${d}" fill="none" stroke="${PLANK_GAP}" stroke-width="${across}"/>`,
      `<path d="${d}" fill="none" stroke="${PLANK}" stroke-width="${across}" stroke-dasharray="7 3"/>`
    )
  }

  // Points no more than a third of a grid unit apart along a line.
  const alongLine = (line: Point[]): Point[] => {
    const points: Point[] = []
    for (let i = 0; i + 1 < line.length; i++) {
      const [ax, ay] = line[i]
      const [bx, by] = line[i + 1]
      const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.33))
      for (let s = 0; s < steps; s++) {
        points.push([
          ax + ((bx - ax) * s) / steps,
          ay + ((by - ay) * s) / steps,
        ])
      }
    }
    if (line.length > 0) points.push(line[line.length - 1])
    return points
  }
  // The stretch of a line between two shares of its length, moved `aside`.
  const beside = (line: Point[], from: number, to: number, aside: number) => {
    const first = Math.floor(from * (line.length - 1))
    const last = Math.ceil(to * (line.length - 1))
    return line.slice(first, last + 1).map(([x, y], n, part): Point => {
      const [px, py] = part[Math.max(0, n - 1)]
      const [qx, qy] = part[Math.min(part.length - 1, n + 1)]
      const length = Math.hypot(qx - px, qy - py) || 1
      return [
        x - ((qy - py) / length) * aside,
        y + ((qx - px) / length) * aside,
      ]
    })
  }

  // The two banks of a river piece: its line moved half its width to either
  // side, the width running from the piece's own to `widthEnd`. Both reach a
  // little past the ends, so that on tiles of one height the next piece
  // overlaps this one and no seam shows.
  const banksOf = (piece: HexPathPiece): [Point[], Point[]] => {
    const line = piece.points
    const last = line.length - 1
    const extend = (from: Point, to: Point): Point => {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
      return [
        to[0] + ((to[0] - from[0]) / length) * SEAM_OVERLAP,
        to[1] + ((to[1] - from[1]) / length) * SEAM_OVERLAP,
      ]
    }
    const path = [
      extend(line[1], line[0]),
      ...line,
      extend(line[last - 1], line[last]),
    ]
    const sides: [Point[], Point[]] = [[], []]
    path.forEach(([x, y], n) => {
      const [px, py] = path[Math.max(0, n - 1)]
      const [qx, qy] = path[Math.min(path.length - 1, n + 1)]
      const length = Math.hypot(qx - px, qy - py) || 1
      const share = Math.min(1, Math.max(0, (n - 1) / last))
      const half =
        (piece.width +
          ((piece.widthEnd ?? piece.width) - piece.width) * share) /
        2
      const [nx, ny] = [-(qy - py) / length, (qx - px) / length]
      sides[0].push([x + nx * half, y + ny * half])
      sides[1].push([x - nx * half, y - ny * half])
    })
    return sides
  }
  const clipFor = (piece: HexPathPiece, id: string) => {
    // A ramp rises off its tile's top, so a road with one is not clipped.
    if (piece.ramps) return ''
    const tops = piece.clip.flatMap(ref => {
      const tile = tileByRef.get(ref)
      return tile && tile.state !== 'sea' ? [outline(tile.top)] : []
    })
    clips.push(`<clipPath id="${id}"><path d="${tops.join('')}"/></clipPath>`)
    return ` clip-path="url(#${id})"`
  }
  const waterOf = (piece: HexPathPiece, clip: string) => {
    const [left, right] = banksOf(piece)
    return `<path${clip} d="${outline([...left, ...[...right].reverse()])}" fill="${WATER}"/>`
  }

  // The river and road pieces drawn once a tile is: every bank first, then
  // the water over them all, so that where the river parts no bank crosses
  // the water; then the road over the water.
  const drawPieces = (pieces: HexPathPiece[], id: string) => {
    if (pieces.length === 0) return
    const clipped = pieces.map((piece, n) => ({
      piece,
      clip: clipFor(piece, `${id}-${n}`),
    }))
    const line = (points: Point[], closed?: boolean) =>
      `M${points.map(xy).join('L')}${closed ? 'Z' : ''}`
    const stroke = (
      clip: string,
      d: string,
      color: string,
      across: number,
      extra = ''
    ) =>
      out.push(
        `<path${clip} d="${d}" fill="none" stroke="${color}" stroke-width="${across.toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"${extra}/>`
      )
    const rivers = clipped.filter(({ piece }) => piece.kind === 'river')
    for (const { piece, clip } of rivers) {
      if (piece.closed) {
        stroke(
          clip,
          line(piece.points, true),
          SHALLOWS,
          piece.width * g + BANK * 2
        )
      } else {
        // A bank is kept to the piece's own tile: carried on past the side
        // it would part from the next piece's bank, which bends its own way.
        const tile = tileByRef.get(piece.tile)
        const own = `${id}-bank-${pieces.indexOf(piece)}`
        if (tile) {
          clips.push(
            `<clipPath id="${own}"><path d="${outline(tile.top)}"/></clipPath>`
          )
        }
        for (const bank of banksOf(piece)) {
          out.push(
            `<path${tile ? ` clip-path="url(#${own})"` : clip} d="${line(bank)}" fill="none" stroke="${SHALLOWS}" stroke-width="${BANK * 2}" stroke-linejoin="round"/>`
          )
        }
      }
    }
    for (const { piece, clip } of rivers) {
      if (piece.closed)
        stroke(clip, line(piece.points, true), WATER, piece.width * g)
      else out.push(waterOf(piece, clip))
    }
    // The moat is drawn after the pieces that run into it, and its bank would
    // cross their mouths: their water goes over it again.
    if (rivers.some(({ piece }) => piece.closed)) {
      layout.pieces.forEach((piece, n) => {
        if (piece.joinsMoat)
          out.push(waterOf(piece, clipFor(piece, `${id}-join-${n}`)))
      })
    }
    for (const { piece, clip } of rivers) {
      // The light streaks the classic map draws on its river.
      const streaks = piece.closed
        ? [0.04, 0.29, 0.54, 0.79].map(from =>
            beside(piece.points, from, from + 0.12, 0)
          )
        : [
            beside(piece.points, 0.12, 0.42, piece.width * 0.2),
            beside(
              piece.points,
              0.55,
              0.9,
              -(piece.widthEnd ?? piece.width) * 0.22
            ),
          ]
      for (const streak of streaks) {
        stroke(clip, line(streak), WATER_STREAK, piece.width >= 0.6 ? 3 : 2.2)
      }
    }
    for (const { piece, clip } of clipped) {
      if (piece.kind !== 'road') continue
      // The side of a ramp, under the road that climbs it.
      for (const ramp of piece.ramps ?? []) {
        out.push(
          `<path d="${outline(ramp)}" fill="${ROAD_PEBBLE}" stroke="${ROAD_PEBBLE}" stroke-width="${(piece.width * g * 0.9).toFixed(1)}" stroke-linejoin="round"/>`
        )
      }
      // The classic brown road, but a worn one: its edge comes and goes, and
      // dark pebbles lie on it.
      stroke(clip, line(piece.points), ROAD, piece.width * g)
      out.push(`<g${clip}>`)
      alongLine(piece.points).forEach(([x, y], k) => {
        const roll =
          Math.sin((k + piece.points[0][0] * 3.1) * 12.9898) * 43758.5453
        const chance = roll - Math.floor(roll)
        const side = (chance - 0.5) * piece.width * g
        if (k % 2 === 0) {
          out.push(
            `<circle cx="${(x * g + side * 0.55).toFixed(1)}" cy="${(y * g + side * 0.33).toFixed(1)}" r="${k % 3 === 0 ? 3 : 2}" fill="${ROAD_PEBBLE}"/>`
          )
        } else if (chance < 0.3 || chance > 0.7) {
          // A bulge of the road's own brown at its edge.
          out.push(
            `<ellipse cx="${(x * g + Math.sign(side) * piece.width * g * 0.42).toFixed(1)}" cy="${(y * g + Math.sign(side) * piece.width * g * 0.25).toFixed(1)}" rx="${(piece.width * g * (0.22 + chance * 0.2)).toFixed(1)}" ry="${(piece.width * g * 0.16).toFixed(1)}" fill="${ROAD}"/>`
          )
        }
      })
      out.push('</g>')
    }
  }

  // The river or the road stepping down a face of a tile.
  const drawDrop = (drop: HexPathDrop) => {
    const [a, b] = [drop.a, drop.b].map(([x, y]): Point => [x * g, y * g])
    const fall = drop.fall * g
    const at = (t: number, down: number) =>
      `${(a[0] + (b[0] - a[0]) * t).toFixed(1)},${(a[1] + (b[1] - a[1]) * t + down).toFixed(1)}`
    // Over a far lip the river just runs out of sight; the road climbs by
    // ramps, not here.
    if (!drop.visible || drop.kind !== 'river') return
    const face = `M${at(0, 0)}L${at(1, 0)}L${at(1, fall)}L${at(0, fall)}Z`
    // The falls: the river's water down the face, streaked; foam where it
    // lands, and more of it, with spray, under a large fall.
    if (drop.dam) {
      // A dam across the river at the lip: a stone wall down the face, wider
      // than the river, with buttresses; the fall is its spillway.
      const wall = `M${at(-0.3, -6)}L${at(1.3, -6)}L${at(1.3, fall)}L${at(-0.3, fall)}Z`
      out.push(
        `<path d="${wall}" fill="${DAM.stone}" stroke="${DAM.line}" stroke-width="2"/>`
      )
      for (const t of [-0.22, -0.08, 1.08, 1.22]) {
        out.push(
          `<path d="M${at(t - 0.05, 0)}L${at(t + 0.05, 0)}L${at(t + 0.09, fall)}L${at(t - 0.09, fall)}Z" fill="${DAM.line}" fill-opacity="0.55"/>`
        )
      }
      out.push(
        `<path d="M${at(-0.3, -6)}L${at(1.3, -6)}" stroke="${DAM.cap}" stroke-width="5" stroke-linecap="round"/>`
      )
    }
    const large = drop.fall >= LARGE_FALL
    out.push(`<path d="${face}" fill="${WATER}"/>`)
    const streaks = large ? [0.14, 0.32, 0.5, 0.68, 0.86] : [0.25, 0.5, 0.75]
    streaks.forEach((t, n) =>
      out.push(
        `<path d="M${at(t, 2)}L${at(t, fall - 2)}" stroke="${WATER_STREAK}" stroke-width="2.4" stroke-dasharray="${7 + (n % 3) * 4} 6" stroke-dashoffset="${n * 5}" stroke-linecap="round"/>`
      )
    )
    const foam = large
      ? [
          [-0.05, 5],
          [0.15, 7],
          [0.38, 8.5],
          [0.62, 8],
          [0.85, 7],
          [1.05, 5],
        ]
      : [
          [0.1, 3.5],
          [0.4, 5],
          [0.7, 4.5],
          [0.95, 3.5],
        ]
    for (const [t, r] of foam) {
      const [x, y] = at(t, fall).split(',').map(Number)
      out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${SNOW}"/>`)
    }
    if (large) {
      for (const [t, up, r] of [
        [0.25, 12, 3],
        [0.55, 16, 2.5],
        [0.8, 11, 2.5],
      ]) {
        const [x, y] = at(t, fall - up)
          .split(',')
          .map(Number)
        out.push(
          `<circle cx="${x}" cy="${y}" r="${r}" fill="${SNOW}" fill-opacity="0.8"/>`
        )
      }
    }
  }

  // A slab: faces under the three sides toward the viewer, down to the sea
  // (nearer tiles cover what of them is out of sight), then the top.
  const drawSlab = (
    tile: HexLaidTile,
    tone: string,
    theme: RealmTheme,
    n: number
  ) => {
    const { top } = tile
    // Corners run E, SE, SW, W, NW, NE: the faces are E-SE, SE-SW and SW-W,
    // the sides toward the south-east, south and south-west.
    ;[0, 1, 2].forEach(k => {
      // A face shows only down to the top of the tile in front of it: none
      // at all where that tile is as high or higher. (A face drawn behind a
      // level neighbor would show through the join as a dark hairline.)
      const front = laidByCell.get(
        hexKey(hexNeighbor(tile, (['SE', 'S', 'SW'] as const)[k]))
      )
      const ground =
        front &&
        front.state !== 'sea' &&
        front.state !== 'water' &&
        !front.sunken
          ? front.height
          : 0
      const drop = (tile.height - ground) * view.lift
      if (drop <= 0) return
      const [a, b] = [top[k], top[k + 1]]
      const band = (from: number, to: number, color: string) =>
        out.push(
          `<path d="${outline([
            [a[0], a[1] + from],
            [b[0], b[1] + from],
            [b[0], b[1] + to],
            [a[0], a[1] + to],
          ])}" fill="${color}" stroke="${color}" stroke-width="1"/>`
        )
      band(0, drop, theme.cliff.face)
      band(0, Math.min(FACE_LIP, drop), theme.cliff.lip)
      // The dark foot is where a cliff meets the sea.
      if (ground === 0) {
        band(Math.max(0, drop - FACE_FOOT), drop, theme.cliff.foot)
      }
      if (k === 0) {
        out.push(
          `<path d="${outline([a, b, [b[0], b[1] + drop], [a[0], a[1] + drop]])}" fill="${LINE}" fill-opacity="${FACE_SHADE}"/>`
        )
      }
    })
    // A walled country's sea cliffs are dark crags: jagged shadows down the
    // faces, and rocks at their foot.
    if (tile.walled) {
      const drop = tile.height * view.lift
      ;[0, 1, 2].forEach(k => {
        if (!tile.coast[k]) return
        const [a, b] = [top[k], top[k + 1]]
        const at = (t: number, down: number): Point => [
          a[0] + (b[0] - a[0]) * t,
          a[1] + (b[1] - a[1]) * t + down,
        ]
        for (let n = 0; n < 7; n++) {
          const t = (n + 0.5) / 7
          const roll = Math.sin(
            (tile.col * 11 + tile.row * 17 + k * 3 + n) * 12.9898
          )
          const jitter = roll * 43758.5453 - Math.floor(roll * 43758.5453)
          const reach = drop * (0.45 + jitter * 0.5)
          out.push(
            `<path d="${outline([at(t - 0.06, 0), at(t + 0.06, 0), at(t + 0.01, reach)])}" fill="${WALL.shade}" fill-opacity="0.75"/>`,
            `<path d="${outline([at(t - 0.05, drop), at(t + 0.07, drop), at(t + 0.02, drop - drop * (0.12 + jitter * 0.16))])}" fill="${WALL.shade}"/>`
          )
        }
      })
    }
    // No outline in the ground's tone: along the edge of a district it would
    // lie over the neighbor's dark border as a bright hairline between the
    // two regions' shadows.
    out.push(`<path d="${outline(top)}" fill="${tone}"/>`)
    // Where two tiles of one district meet, the softened edges of their two
    // shapes let a hairline of what lies behind show through at any zoom. A
    // line of the ground's own tone along the join seals it. It is drawn by
    // the tile behind (along its three near sides, 0 to 2), so it lies under
    // the nearer tile's ground and over nothing that stands on either.
    const joins = tile.edges
      .flatMap((edge, k) =>
        edge || k > 2 ? [] : [`M${xy(top[k])}L${xy(top[k + 1])}`]
      )
      .join('')
    if (joins) {
      out.push(
        `<path d="${joins}" fill="none" stroke="${tone}" stroke-width="${JOIN_SEAL}" stroke-linecap="round"/>`
      )
    }
    // The rim: a darker band just inside the sides that are the edge of the
    // tile's district, with a thin dark line along the edge itself. Tiles of
    // one district run into each other without one. The edge of a district
    // is one unbroken line that turns a corner wherever it passes from one
    // tile to the next, so each run of edge sides is drawn as one line with
    // square, mitred corners, and carried one side further at either end,
    // along the next tile's stretch of the same edge. That way the corner at
    // the join is drawn whole (no gap in the dark line, no knuckle), and the
    // next tile draws the very same shape over it.
    const corner = (k: number) => top[((k % 6) + 6) % 6]
    // Past corner `at`, the third side that meets there: the two sides of
    // this tile at the corner and that one run off at even angles, so the
    // three of them, taken from the corner, add up to nothing.
    const onward = (at: number, from: number, other: number): Point => [
      corner(at)[0] +
        (corner(at)[0] * 2 - corner(from)[0] - corner(other)[0]) * RIM_CARRY,
      corner(at)[1] +
        (corner(at)[1] * 2 - corner(from)[1] - corner(other)[1]) * RIM_CARRY,
    ]
    // The runs of the sides picked out by `include`, each carried on past
    // its ends where the district's edge goes on along the next tile.
    const runsOf = (include: boolean[]): Point[][] => {
      if (include.every(Boolean)) return [[...top, top[0], top[1]]]
      const found: Point[][] = []
      for (let k = 0; k < 6; k++) {
        if (!include[k] || include[(k + 5) % 6]) continue
        const run: Point[] = [corner(k)]
        if (!tile.edges[(k + 5) % 6]) run.unshift(onward(k, k + 1, k - 1))
        let side = k
        while (include[side % 6] && side < k + 6) {
          run.push(corner(side + 1))
          side++
        }
        if (!tile.edges[side % 6]) run.push(onward(side, side - 1, side + 1))
        found.push(run)
      }
      return found
    }
    const runs = runsOf(tile.edges)
    // The thin dark line is left off along the foot of a higher neighbor: a
    // cliff marks that border itself, and the line would end in a stub where
    // the cliff hides it.
    const lineRuns = runsOf(
      tile.edges.map((edge, k) => {
        const beside = laidByCell.get(hexKey(hexNeighbor(tile, SIDE_NAMES[k])))
        const higher =
          beside !== undefined &&
          beside.state !== 'sea' &&
          beside.state !== 'water' &&
          !beside.sunken &&
          beside.height > tile.height
        return edge && !higher
      })
    )
    if (runs.length > 0) {
      // Kept to the top of this tile and of the tiles of its district beside
      // it, and in solid colors, not see-through ones, so that where this
      // tile's band and the next tile's overlap they look like one.
      const tops = [
        top,
        ...SIDE_NAMES.flatMap((side, k) => {
          const beside = laidByCell.get(hexKey(hexNeighbor(tile, side)))
          return !tile.edges[k] && beside ? [beside.top] : []
        }),
      ]
      clips.push(
        `<clipPath id="hex-top-${n}"><path d="${tops.map(outline).join('')}"/></clipPath>`
      )
      const pathOf = (all: Point[][]) =>
        all.map(run => `M${run.map(xy).join('L')}`).join('')
      const band = mixHex(tone, LINE, RIM_SHADE)
      const line = mixHex(band, LINE, BORDER_LINE.opacity)
      const stroke = (all: Point[][], color: string, across: number) =>
        `<path clip-path="url(#hex-top-${n})" d="${pathOf(all)}" fill="none" stroke="${color}" stroke-width="${across.toFixed(1)}" stroke-linejoin="miter" stroke-linecap="butt"/>`
      out.push(
        // A hairline of the border's own color right on this tile's edge
        // sides, unclipped, closes the softened gap between this region's
        // top and the next's.
        `<path d="${tile.edges
          .flatMap((edge, k) =>
            edge ? [`M${xy(top[k])}L${xy(top[(k + 1) % 6])}`] : []
          )
          .join(
            ''
          )}" fill="none" stroke="${line}" stroke-width="1.5" stroke-linecap="round"/>`,
        stroke(runs, band, RIM_WIDTH * 2 * g),
        ...(lineRuns.length > 0
          ? [stroke(lineRuns, line, BORDER_LINE.width * 2)]
          : [])
      )
    }
  }

  // What a district is covered with, where its spec says so, in place of its
  // realm's usual country: woodland, a pine thicket, crop fields, vines or a
  // hamlet. What can be walked between (fields, vines) lies under the logos;
  // trees and houses stand only in the gaps the logos leave, with a thin back
  // row under the logos so that a crowded wood still reads as a wood.
  const drawCover = (
    tile: HexLaidTile,
    cover: NonNullable<HexLaidTile['cover']>,
    tone: string,
    inTile: (x: number, y: number) => boolean,
    logos: ArtPin[],
    fixed: { x: number; y: number; radius: number }[]
  ) => {
    const extent = { width: width / g, height: height / g }
    const stamp = (
      symbol: string,
      x: number,
      y: number,
      w: number,
      h: number
    ) =>
      `<use href="#${symbol}" x="${((x - w / 2) * g).toFixed(1)}" y="${((y - h) * g).toFixed(1)}" width="${(w * g).toFixed(1)}" height="${(h * g).toFixed(1)}"/>`
    if (cover === 'fields' || cover === 'vineyard') {
      // A patchwork of plots over the whole tile, lying with the board's
      // grain (along the rows of tiles, and up the slant of a tile's side),
      // under the logos: furrows for a field, rows of vines for a vineyard.
      // Here and there a plot is left as grass, and none lies on the road or
      // the river.
      const across: Point = [1, 0]
      const up: Point = [0.5, -0.87 * view.squash]
      const [w, h] = [1.18, 0.5]
      const id = `hex-cover-${tile.col}-${tile.row}`
      clips.push(
        `<clipPath id="${id}"><path d="${outline(
          insetConvex(
            tile.top,
            tile.top.map((_, k) => (tile.edges[k] ? 0.3 : 0))
          )
        )}"/></clipPath>`
      )
      out.push(`<g clip-path="url(#${id})">`)
      for (let i = -3; i <= 3; i++) {
        for (let j = -4; j <= 4; j++) {
          const at = (di: number, dj: number): Point => [
            tile.center[0] + across[0] * w * (i + di) + up[0] * h * (j + dj),
            tile.center[1] + across[1] * w * (i + di) + up[1] * h * (j + dj),
          ]
          const [cx, cy] = at(0, 0)
          const roll = Math.sin(
            (tile.col * 31 + tile.row * 17 + i * 7 + j * 13) * 12.9898
          )
          const chance = roll * 43758.5453 - Math.floor(roll * 43758.5453)
          if (chance < 0.2) continue
          if (fixed.some(spot => Math.hypot(spot.x - cx, spot.y - cy) < 0.95)) {
            continue
          }
          const ripe = cover === 'fields' && chance > 0.62
          out.push(
            `<path d="${outline([at(-0.46, -0.44), at(0.46, -0.44), at(0.46, 0.44), at(-0.46, 0.44)])}" fill="${ripe ? FIELD_RIPE : districtTone(tone, chance > 0.4 ? 1 : 2, 3)}" fill-opacity="${ripe ? 0.8 : 1}" stroke="${LINE}" stroke-opacity="0.3" stroke-width="1.5"/>`
          )
          for (const row of [-0.26, -0.09, 0.09, 0.26]) {
            const d = `M${xy(at(-0.4, row))}L${xy(at(0.4, row))}`
            out.push(
              cover === 'vineyard'
                ? `<path d="${d}" stroke="${VINE}" stroke-width="3.2" stroke-dasharray="4 3" stroke-linecap="round"/>`
                : `<path d="${d}" stroke="${LINE}" stroke-opacity="0.28" stroke-width="1.5"/>`
            )
          }
        }
      }
      out.push('</g>')
      return
    }
    const wood = cover === 'forest' || cover === 'thicket' || cover === 'grove'
    const stand = wood
      ? cover === 'thicket'
        ? { spacing: 0.55, minRoom: 0.2, maxRoom: 0.5 }
        : cover === 'grove'
          ? { spacing: 0.95, minRoom: 0.3, maxRoom: 0.6 }
          : { spacing: 0.72, minRoom: 0.26, maxRoom: 0.6 }
      : { spacing: 1.25, minRoom: 0.5, maxRoom: 0.8 }
    const spots = [
      ...(wood
        ? scatterSpots(inTile, fixed, extent, {
            spacing:
              cover === 'thicket' ? 0.95 : cover === 'grove' ? 1.7 : 1.25,
            minRoom: 0.3,
            maxRoom: 0.6,
          })
        : []),
      ...scatterSpots(inTile, [...logos, ...fixed], extent, stand),
    ].sort((a, b) => a.y - b.y)
    for (const spot of spots) {
      if (wood) {
        const size = (cover === 'thicket' ? 0.8 : 1) * (0.8 + spot.roll * 0.35)
        out.push(stamp('tree', spot.x, spot.y + 0.3, 0.5 * size, 1 * size))
      } else {
        out.push(
          stamp(
            spot.roll < 0.5 ? 'house' : 'cottage',
            spot.x,
            spot.y + 0.35,
            0.8,
            1.03
          ),
          stamp('tree', spot.x + 0.55, spot.y + 0.3, 0.4, 0.8)
        )
      }
    }
  }

  // The details of a realm's country, in the gaps the logos, the river, the
  // road and a landmark leave on a tile.
  const drawCountry = (tile: HexLaidTile, theme: RealmTheme, tone: string) => {
    if (!pins || tile.landmark || !(theme.terrain || tile.cover)) return
    const ground = insetConvex(
      tile.top,
      tile.top.map(() => 0.22)
    )
    const inTile = (x: number, y: number) => insideConvex([x, y], ground)
    const xs = tile.top.map(p => p[0])
    const ys = tile.top.map(p => p[1])
    const near = (pin: { x: number; y: number }) =>
      pin.x > Math.min(...xs) - 2 &&
      pin.x < Math.max(...xs) + 2 &&
      pin.y > Math.min(...ys) - 2 &&
      pin.y < Math.max(...ys) + 2
    const fixed = layout.pieces
      .filter(piece => tile.ref !== null && piece.clip.includes(tile.ref))
      .flatMap(piece => alongLine(piece.points))
      .map(([x, y]) => ({ x, y, radius: 0.75 }))
    if (tile.cover) {
      drawCover(tile, tile.cover, tone, inTile, pins.filter(near), fixed)
      return
    }
    if (!theme.terrain) return
    const extent = { width: width / g, height: height / g }
    const backRow = BACK_ROW[theme.terrain]
    const spots = [
      // A back row the logos are drawn over (see realmArtBackdrop.ts).
      ...(backRow
        ? scatterSpots(
            inTile,
            fixed.map(spot => ({ ...spot, radius: 1.3 })),
            extent,
            backRow
          )
        : []),
      ...scatterSpots(
        inTile,
        [...pins.filter(near), ...fixed],
        extent,
        TERRAIN_SCATTER[theme.terrain]
      ),
    ].sort((a, b) => a.y - b.y)
    for (const spot of spots) out.push(terrainDetail(theme, spot, g, true))
  }

  // A wall of dark peaks along the landward sides of a tile that are the edge
  // of a walled district: the far sides' behind whatever stands on the tile,
  // the near sides' in front of it.
  const drawWall = (tile: HexLaidTile, sides: number[]) => {
    const poly = (points: Point[], fill: string) =>
      `<path d="M${points.map(xy).join('L')}Z" fill="${fill}"/>`
    for (const k of sides) {
      // The sea cliffs are wall enough.
      if (!tile.edges[k] || tile.coast[k]) continue
      const [a, b] = [tile.top[k], tile.top[(k + 1) % 6]]
      ;[0.14, 0.38, 0.62, 0.86].forEach((t, n) => {
        const roll = Math.sin(
          (tile.col * 7 + tile.row * 13 + k * 5 + n) * 12.9898
        )
        const jitter = roll * 43758.5453 - Math.floor(roll * 43758.5453)
        const x = a[0] + (b[0] - a[0]) * t
        const foot = a[1] + (b[1] - a[1]) * t + 0.12
        const w = 0.8 + jitter * 0.45
        const h = 0.95 + (1 - jitter) * 0.6
        const peak: Point = [x - w * 0.06, foot - h]
        const fold: Point = [x + w * 0.14, foot]
        out.push(
          poly([[x - w / 2, foot], peak, fold], WALL.lit),
          poly([peak, [x + w / 2, foot], fold], WALL.shade)
        )
      })
    }
  }

  layout.tiles.forEach((tile, n) => {
    if (tile.state === 'sea' || tile.ref === null) return
    const turn = REALM_HUE[realmKey(tile.realm)] ?? 0
    const ground = themeFor(tile.realm)
    // A realm whose ground is turned has its cliffs turned with it.
    const theme: RealmTheme =
      turn === 0
        ? ground
        : {
            ...ground,
            cliff: {
              lip: districtTone(ground.cliff.lip, 0, 1, turn),
              face: districtTone(ground.cliff.face, 0, 1, turn),
              foot: districtTone(ground.cliff.foot, 0, 1, turn),
            },
          }
    // Sunken ships lie on open water: no tile is drawn under them.
    const solid = tile.state !== 'water' && !tile.sunken
    const tone =
      tile.ground ?? districtTone(theme.tones[0], tile.tone, tile.tones, turn)
    if (solid) drawSlab(tile, tone, theme, n)
    // Corners run E, SE, SW, W, NW, NE: sides 3 to 5 are the far ones.
    if (tile.walled) drawWall(tile, [3, 4, 5])
    drawPieces(
      layout.pieces.filter(piece => piece.tile === tile.ref),
      `hex-path-${n}`
    )
    // A road that climbs to this tile by a ramp on a tile drawn before it:
    // its top end goes over this tile's edge again, or the edge would show
    // as a hairline across the road.
    for (const piece of layout.pieces) {
      if (!piece.rampTo?.includes(tile.ref)) continue
      out.push(
        `<path d="M${piece.points.map(xy).join('L')}" fill="none" stroke="${ROAD}" stroke-width="${(piece.width * g).toFixed(1)}" stroke-linejoin="round" stroke-linecap="round"/>`
      )
    }
    for (const spring of layout.springs) {
      if (spring.tile !== tile.ref) continue
      out.push(
        `<ellipse cx="${(spring.at[0] * g).toFixed(1)}" cy="${(spring.at[1] * g).toFixed(1)}" rx="${(spring.width * 0.95 * g).toFixed(1)}" ry="${(spring.width * 0.95 * view.squash * g).toFixed(1)}" fill="${WATER}" stroke="${SHALLOWS}" stroke-width="${BANK}"/>`
      )
    }
    for (const drop of layout.drops) if (drop.tile === tile.ref) drawDrop(drop)
    for (const bridge of layout.bridges) {
      if (bridge.tile !== tile.ref) continue
      const d = `M${xy(bridge.a)}L${xy(bridge.b)}`
      const across = (bridge.width * g * 1.15).toFixed(1)
      out.push(
        `<path d="${d}" fill="none" stroke="${PLANK_GAP}" stroke-width="${across}"/>`,
        `<path d="${d}" fill="none" stroke="${PLANK}" stroke-width="${across}" stroke-dasharray="7 3"/>`
      )
    }
    if (solid) drawCountry(tile, theme, tone)
    if (pins) {
      for (const other of layout.tiles) {
        const mark = other.landmark
        if (!mark || mark.after !== tile.ref) continue
        const stamp = (
          symbol: string,
          dx: number,
          dy: number,
          scale: number,
          tilt: number
        ) => {
          const [w, h] = [mark.width * scale * g, mark.height * scale * g]
          const [cx, cy] = [(mark.x + dx) * g, (mark.y + dy) * g]
          return `<use href="#${symbol}" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${tilt ? ` transform="rotate(${tilt} ${cx.toFixed(1)} ${cy.toFixed(1)})" opacity="0.8"` : ''}/>`
        }
        out.push(
          other.sunken
            ? // Wrecks: the art heeled over, half under.
              stamp(mark.symbol, -0.7, 0, 1, -28) +
                stamp(mark.symbol, 0.9, 0.35, 0.7, 152)
            : stamp(mark.symbol, 0, 0, 1, 0)
        )
      }
    }
    if (tile.walled) drawWall(tile, [0, 1, 2])
  })

  return `<defs>${clips.join('')}</defs>${out.join('')}`
}

export function drawHexBackdrop(
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  layout: HexLayout,
  gridSize: number,
  width: number,
  height: number,
  pins: ArtPin[]
) {
  const backdrop = group.append('g')
  backdrop.html(hexBackdropMarkup(layout, gridSize, width, height, pins))
  // The landmarks appear once their symbols arrive. Without them the map is
  // still whole, so a failed fetch is reported and not thrown.
  fetch(LANDMARKS_URL)
    .then(response => {
      if (!response.ok) throw new Error(`${response.status}`)
      return response.text()
    })
    .then(sprite => {
      const symbols = sprite.slice(
        sprite.indexOf('>') + 1,
        sprite.lastIndexOf('</svg>')
      )
      backdrop.insert('defs', ':first-child').html(symbols)
    })
    .catch(error =>
      console.warn(`Map art: could not load ${LANDMARKS_URL}`, error)
    )
}
