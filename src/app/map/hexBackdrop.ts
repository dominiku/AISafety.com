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
import { buildingMarkup } from './hexBuildings'
import {
  barnMarkup,
  beaconMarkup,
  departingShipMarkup,
  haystackMarkup,
  netFrameMarkup,
  reedBedMarkup,
  deckMarkup,
  duneMarkup,
  hillMarkup,
  geyserMarkup,
  palmMarkup,
  parasolMarkup,
  thatchHouseMarkup,
  volcanoMarkup,
  arrivalShipMarkup,
  lakeShore,
  scaledAbout,
  smoothClosedPath,
  thermalSpringMarkup,
  springOutflowMarkup,
  beachHutMarkup,
  sulphurPoolMarkup,
  slopeCornerMarkup,
  slopeMarkup,
  tuftMarkup,
} from './hexFeatures'

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
// A dam is masonry: the warm cream stone of the castle and the map's other
// buildings, with their dark brown for its buttresses and sluice gates.
const DAM = {
  stone: '#ffd1bc',
  cap: '#f6fbff',
  line: '#972f00',
  gate: '#571f02',
}
const FIELD_RIPE = '#ffd1bc'
// DESIGN REVIEW (Melissa): an oasis's grass, from the classic trees' greens.
const OASIS = { grass: '#9ccf8f', lush: '#00ae85' }
// DESIGN REVIEW (Melissa): the foothills' greens, from the oasis's grass and
// the forest's shade.
const HILL = { lit: '#9ccf8f', shade: '#008969' }
// The hot pond a river rises from: how wide it is, and how far back from the
// middle of its tile it lies (map grid units). How near a dam a lake's shore
// has to come to be drawn on to it.
const DAM_REACH = 1.6
// A river's mouth into a lake: how far back up the stream the widening
// starts, and half the width it opens to (map grid units).
const MOUTH_BACK = 1.9
const MOUTH_WIDTH = 0.72
const MOUTH_CLEAR = 0.26
// How far along its stream a spring's pool narrows into it (map grid units).
const OUTFLOW_REACH = 1.5
const FOREST = { lit: '#00ae85', shade: '#008969' }
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
// Pixels of darker bank either side of the water: none. (Robert, 20
// September 2026: water has no dark outline, as on the classic map.)
const BANK = 0
// A fading road narrows to this share of its width, a track, as it pales.
const FADE_TRACK = 0.3
// Map grid units a river piece runs on past its ends, under the next piece.
// A tile's side lies at a slant on the screen while a piece ends square to
// its own line, so it has to reach well past the side, or a sliver of ground
// shows at one bank.
const SEAM_OVERLAP = 0.3
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
  // Nor is a pier: it stands out in open water.
  const land = layout.tiles.filter(
    tile => tile.state !== 'sea' && !tile.sunken && !tile.deck
  )
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
  // (A pier whose deck stands level with high land is drawn later, with the
  // ground of that level, or the land drawn after it here would cover it.)
  const raisedPiers: { up: number; markup: string }[] = []
  for (const end of layout.ends) {
    if (end.kind === 'river') continue
    const up = end.deck ?? 0
    const at = (along: number): Point => [
      end.at[0] + end.toward[0] * along,
      end.at[1] + end.toward[1] * along - up,
    ]
    // A district's pier is an L: a short arm at its head, turned toward the
    // viewer, for boats to lie along.
    const [tx, ty] = end.toward
    const turn: Point = tx > 0 ? [-ty, tx] : [ty, -tx]
    const head = at(end.kind === 'pier' ? 1.7 : 1.3)
    const arm =
      end.kind === 'pier'
        ? `L${xy([head[0] + turn[0] * 0.75, head[1] + turn[1] * 0.75])}`
        : ''
    const d = `M${xy(at(up > 0 ? -0.05 : 0.2))}L${xy(head)}${arm}`
    const across = (end.width * g * 0.8).toFixed(1)
    const deck = [
      `<path d="${d}" fill="none" stroke="${PLANK_GAP}" stroke-width="${across}"/>`,
      `<path d="${d}" fill="none" stroke="${PLANK}" stroke-width="${across}" stroke-dasharray="7 3"/>`,
    ]
    if (up > 0) {
      // Posts from the deck down to the water, a pair every so often.
      const half = end.width * 0.3
      const posts = [0.55, 1.1, 1.65]
        .filter(along => along <= (end.kind === 'pier' ? 1.7 : 1.3))
        .flatMap(along =>
          [-half, half].map(aside => {
            const [x, y] = at(along)
            const [px, py] = [x + turn[0] * aside, y + turn[1] * aside]
            return `<path d="M${xy([px, py])}L${xy([px, py + up])}" stroke="${PLANK_GAP}" stroke-width="3" stroke-linecap="round"/>`
          })
        )
      raisedPiers.push({
        up,
        markup: [...posts, ...deck].join(''),
      })
    } else {
      out.push(...deck)
    }
    // A rowboat tied up in the crook of the L.
    if (end.kind === 'pier' && pins) {
      const [w, h] = [0.95, 0.42]
      const x = head[0] - tx * 0.55 + turn[0] * 0.5
      const y = head[1] - ty * 0.55 + turn[1] * 0.5 + up
      out.push(
        `<use href="#rowboat" x="${((x - w / 2) * g).toFixed(1)}" y="${((y - h / 2) * g).toFixed(1)}" width="${(w * g).toFixed(1)}" height="${(h * g).toFixed(1)}"/>`
      )
    }
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
  const banksOf = (piece: HexPathPiece, runOn = true): [Point[], Point[]] => {
    const line = piece.points
    const last = line.length - 1
    const extend = (from: Point, to: Point): Point => {
      const length = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
      return [
        to[0] + ((to[0] - from[0]) / length) * SEAM_OVERLAP,
        to[1] + ((to[1] - from[1]) / length) * SEAM_OVERLAP,
      ]
    }
    const path = runOn
      ? [extend(line[1], line[0]), ...line, extend(line[last - 1], line[last])]
      : [line[0], ...line, line[last]]
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
    // Without the run-on, the doubled end points are dropped again.
    return runOn ? sides : [sides[0].slice(1, -1), sides[1].slice(1, -1)]
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

  // A road that leads on to nowhere in particular: it narrows to a track and
  // pales into the ground over the length of the piece, its pebbles thinning
  // out with it.
  let fadeCount = 0
  const fadingRoad = (piece: HexPathPiece, clip: string) => {
    const id = `hex-road-fade-${fadeCount++}`
    const [left, right] = banksOf(
      { ...piece, widthEnd: piece.width * FADE_TRACK },
      false
    )
    const [from, to] = [piece.points[0], piece.points[piece.points.length - 1]]
    const dots = alongLine(piece.points)
    const pebbles = dots.flatMap(([x, y], k) => {
      const share = k / (dots.length - 1)
      if (k % 2 === 1 || share > 0.7) return []
      const roll = Math.sin((k + from[0] * 3.1) * 12.9898) * 43758.5453
      const side =
        (roll - Math.floor(roll) - 0.5) * piece.width * g * (1 - share)
      return [
        `<circle cx="${(x * g + side * 0.55).toFixed(1)}" cy="${(y * g + side * 0.33).toFixed(1)}" r="${k % 3 === 0 ? 3 : 2}" fill="${ROAD_PEBBLE}" opacity="${(1 - share / 0.7).toFixed(2)}"/>`,
      ]
    })
    return [
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${(from[0] * g).toFixed(1)}" y1="${(from[1] * g).toFixed(1)}" x2="${(to[0] * g).toFixed(1)}" y2="${(to[1] * g).toFixed(1)}"><stop offset="0" stop-color="${ROAD}"/><stop offset="0.25" stop-color="${ROAD}"/><stop offset="1" stop-color="${ROAD}" stop-opacity="0"/></linearGradient>`,
      `<g${clip}><path d="${outline([...left, ...[...right].reverse()])}" fill="url(#${id})"/>${pebbles.join('')}</g>`,
    ].join('')
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
        // A bank ends where its piece does: the next piece's bank starts at
        // the very same point, heading the same way.
        for (const bank of banksOf(piece, false)) {
          stroke(clip, line(bank), SHALLOWS, BANK * 2)
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
      // The classic brown road, with dark pebbles lying on it. (Its edge is
      // clean: bulges along it read as knobs sticking out of the road.)
      if (piece.fade) {
        out.push(fadingRoad(piece, clip))
        continue
      }
      const narrows =
        piece.widthEnd !== undefined && piece.widthEnd !== piece.width
      if (narrows) {
        // Narrowing to a street of the art it runs into.
        const [left, right] = banksOf(piece)
        out.push(
          `<path${clip} d="${outline([...left, ...[...right].reverse()])}" fill="${ROAD}"/>`
        )
        continue
      }
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
    if (drop.dam) {
      const chute = `M${at(0, 0)}L${at(1, 0)}L${at(1.12, fall)}L${at(-0.12, fall)}Z`
      out.push(
        `<path d="${chute}" fill="${WATER}" stroke="${DAM.line}" stroke-width="3" stroke-linejoin="round"/>`
      )
      for (const t of [0.2, 0.5, 0.8]) {
        out.push(
          `<path d="M${at(t, 4)}L${at(t + (t - 0.5) * 0.24, fall - 3)}" stroke="${WATER_STREAK}" stroke-width="2" stroke-linecap="round"/>`
        )
      }
      // The sluice gates along the crest, and the foam at the foot.
      for (const t of [0.17, 0.5, 0.83]) {
        out.push(
          `<path d="M${at(t - 0.13, -7)}L${at(t + 0.13, -7)}L${at(t + 0.13, 3)}L${at(t - 0.13, 3)}Z" fill="${DAM.gate}"/>`
        )
      }
      for (const [t, r] of [
        [0.1, 3],
        [0.5, 4],
        [0.9, 3],
      ]) {
        const [x, y] = at(t, fall).split(',').map(Number)
        out.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${SNOW}"/>`)
      }
      return
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

  // Land a cliff can stand on or be hidden by: not sea, a cove or a wreck.
  const isGround = (tile: HexLaidTile | undefined): tile is HexLaidTile =>
    tile !== undefined &&
    tile.state !== 'sea' &&
    tile.state !== 'water' &&
    !tile.sunken
  // How far the face under each of a tile's three near sides drops: to the
  // top of the tile across that side, or to the sea.
  const faceDrops = (tile: HexLaidTile) =>
    ([0, 1, 2] as const).map(k => {
      const front = laidByCell.get(hexKey(hexNeighbor(tile, SIDE_NAMES[k])))
      const ground = isGround(front) ? front.height : 0
      return { k, ground, drop: (tile.height - ground) * view.lift }
    })
  const faceShape = (tile: HexLaidTile, k: number, drop: number): Point[] => {
    const [a, b] = [tile.top[k], tile.top[k + 1]]
    return [a, b, [b[0], b[1] + drop], [a[0], a[1] + drop]]
  }
  // A slanted face drops straight down the screen, where other tiles stand:
  // a lower tile nearer the viewer hides the foot of it. Lower land is drawn
  // before higher, so a face is cut to leave out the tops and faces of the
  // lower tiles in front of it. (Higher ones are drawn later, over it.)
  const depthOf = (tile: HexLaidTile) =>
    tile.row + (Math.abs(tile.col) % 2 === 1 ? 0.5 : 0)
  const faceMasks = new Map<string, string>()
  layout.tiles.forEach((tile, n) => {
    if (!isGround(tile) || tile.ref === null) return
    const drops = faceDrops(tile).filter(face => face.drop > 0)
    if (drops.length === 0) return
    const reach = Math.max(...drops.map(face => face.drop))
    const xs = tile.top.map(point => point[0])
    const ys = tile.top.map(point => point[1])
    const box = {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys) + reach,
    }
    const hiding = layout.tiles.filter(other => {
      if (!isGround(other) || other === tile) return false
      if (depthOf(other) <= depthOf(tile) || other.height >= tile.height) {
        return false
      }
      const oxs = other.top.map(point => point[0])
      const oys = other.top.map(point => point[1])
      return (
        Math.max(...oxs) > box.left &&
        Math.min(...oxs) < box.right &&
        Math.max(...oys) + other.height * view.lift > box.top &&
        Math.min(...oys) < box.bottom
      )
    })
    if (hiding.length === 0) return
    const id = `hex-face-${n}`
    const pad = 8
    clips.push(
      `<mask id="${id}" maskUnits="userSpaceOnUse" x="${((box.left - 1) * g).toFixed(1)}" y="${((box.top - 1) * g).toFixed(1)}" width="${((box.right - box.left + 2) * g).toFixed(1)}" height="${((box.bottom - box.top + 2) * g + pad).toFixed(1)}"><rect x="${((box.left - 1) * g).toFixed(1)}" y="${((box.top - 1) * g).toFixed(1)}" width="${((box.right - box.left + 2) * g).toFixed(1)}" height="${((box.bottom - box.top + 2) * g + pad).toFixed(1)}" fill="#fff"/><path d="${hiding
        .flatMap(other => [
          outline(other.top),
          ...faceDrops(other)
            .filter(face => face.drop > 0)
            .map(face => outline(faceShape(other, face.k, face.drop))),
        ])
        .join('')}" fill="#000"/></mask>`
    )
    faceMasks.set(tile.ref, id)
  })
  const maskedBy = (ref: string | null, draw: () => void) => {
    const id = ref === null ? undefined : faceMasks.get(ref)
    if (id) out.push(`<g mask="url(#${id})">`)
    draw()
    if (id) out.push('</g>')
  }

  const damSides = new Set(layout.dams.map(dam => `${dam.tile}|${dam.side}`))
  // A tile's cliff faces: under its three sides toward the viewer, each down
  // to the top of the tile in front of it.
  const drawFaces = (tile: HexLaidTile, theme: RealmTheme) => {
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
      // A side that slopes down onto land is drawn by drawSlopes, not as a
      // sheer face. (Down to the sea it stays a cliff.)
      if (drop <= 0 || (tile.slope > 0 && ground > 0)) return
      const [a, b] = [top[k], top[k + 1]]
      const face = (from: number, to: number) =>
        outline([
          [a[0], a[1] + from],
          [b[0], b[1] + from],
          [b[0], b[1] + to],
          [a[0], a[1] + to],
        ])
      const shade = () => {
        if (k !== 0) return
        out.push(
          `<path d="${face(0, drop)}" fill="${LINE}" fill-opacity="${FACE_SHADE}"/>`
        )
      }
      if (damSides.has(`${tile.ref}|${k}`)) {
        // The dam that holds a lake back: a wall of pale stone with
        // buttresses down it and a cap along its top.
        out.push(
          `<path d="${face(0, drop)}" fill="${DAM.stone}" stroke="${DAM.line}" stroke-width="2" stroke-linejoin="round"/>`
        )
        for (let n = 1; n < 6; n++) {
          const x = a[0] + ((b[0] - a[0]) * n) / 6
          const y = a[1] + ((b[1] - a[1]) * n) / 6
          out.push(
            `<path d="M${xy([x - 0.05, y])}L${xy([x + 0.05, y])}L${xy([x + 0.1, y + drop])}L${xy([x - 0.1, y + drop])}Z" fill="${DAM.line}" fill-opacity="0.5"/>`
          )
        }
        shade()
        out.push(
          `<path d="M${xy(a)}L${xy(b)}" stroke="${DAM.cap}" stroke-width="6" stroke-linecap="round"/>`
        )
        return
      }
      if (tile.state === 'crater') {
        // A volcano's flanks run on down its tile's sides: one slope, in the
        // flank's own tones, with no lip between them.
        const tones = [theme.cliff.foot, theme.cliff.face, theme.cliff.lip]
        out.push(
          `<path d="${face(-0.02, drop)}" fill="${theme.cliff.face}" stroke="${theme.cliff.face}" stroke-width="1" stroke-linejoin="bevel"/>`,
          `<path d="${face(-0.02, drop)}" fill="${tones[k]}" fill-opacity="${k === 1 ? 0 : 0.55}"/>`
        )
        return
      }
      if (tile.stilts) {
        // A village on stilts: no cliff under its edge but the shadow under
        // the deck, the posts it stands on, and the deck's own edge beam.
        out.push(
          `<path d="${face(0, drop)}" fill="${PLANK_GAP}" fill-opacity="0.5"/>`
        )
        for (let n = 0; n <= 4; n++) {
          const x = a[0] + ((b[0] - a[0]) * n) / 4
          const y = a[1] + ((b[1] - a[1]) * n) / 4
          out.push(
            `<path d="M${xy([x, y])}L${xy([x, y + drop])}" stroke="${PLANK_GAP}" stroke-width="5" stroke-linecap="round"/>`
          )
        }
        out.push(
          `<path d="${face(0, Math.min(FACE_LIP * 1.5, drop))}" fill="${PLANK}"/>`
        )
        return
      }
      if (tile.beach && ground === 0) {
        // A beach's side to the sea: wet sand, and a line of foam where the
        // water meets it.
        const wet = mixHex(styleOf(tile).tone, SHALLOWS, 0.4)
        out.push(
          `<path d="${face(0, drop)}" fill="${wet}" stroke="${wet}" stroke-width="1" stroke-linejoin="bevel"/>`
        )
        shade()
        out.push(
          `<path d="M${xy([a[0], a[1] + drop])}L${xy([b[0], b[1] + drop])}" stroke="${WATER_STREAK}" stroke-width="4" stroke-linecap="round"/>`
        )
        return
      }
      const band = (from: number, to: number, color: string) =>
        out.push(
          `<path d="${outline([
            [a[0], a[1] + from],
            [b[0], b[1] + from],
            [b[0], b[1] + to],
            [a[0], a[1] + to],
          ])}" fill="${color}" stroke="${color}" stroke-width="1" stroke-linejoin="bevel"/>`
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
  }

  // The sides of an escarpment or a volcano toward the viewer: not sheer
  // faces but slopes, leaning out over the lower land (or the sea) in front
  // of them, which is drawn already. The ways the three near sides face on
  // the ground, as the corners of a tile's top run: south-east, south,
  // south-west.
  const SLOPE_OUT: Point[] = [
    [0.866, 0.5],
    [0, 1],
    [-0.866, 0.5],
  ]
  const drawSlopes = (tile: HexLaidTile) => {
    if (!(tile.slope > 0)) return
    const { cliff } = styleOf(tile).theme
    const sides = faceDrops(tile)
      .filter(face => face.drop > 0 && face.ground > 0)
      .map(face => {
        const run = tile.slope * (tile.height - face.ground)
        const reach: Point = [
          SLOPE_OUT[face.k][0] * run,
          SLOPE_OUT[face.k][1] * run * view.squash + face.drop,
        ]
        return { ...face, run, reach }
      })
    const shadeOf = (k: number) => (k === 0 ? FACE_SHADE : 0)
    // Round each corner between two sloping sides first, then the sides.
    sides.forEach(side => {
      const next = sides.find(other => other.k === side.k + 1)
      if (!next) return
      out.push(
        slopeCornerMarkup(
          tile.top[next.k],
          side.reach,
          next.reach,
          g,
          cliff,
          shadeOf(side.k) / 2
        )
      )
    })
    for (const side of sides) {
      out.push(
        slopeMarkup(
          tile.top[side.k],
          tile.top[side.k + 1],
          SLOPE_OUT[side.k],
          side.run,
          side.drop,
          view.squash,
          g,
          cliff,
          tile.scarp,
          shadeOf(side.k),
          tile.col * 31 + tile.row * 7 + side.k
        )
      )
    }
  }

  // A beach district's top, along its sides to the sea: in place of the dark
  // rim, a band of damp sand. It keeps to the tile's own outline, as a rim
  // does.
  const STRAND_WIDTH = 0.42
  const drawStrand = (tile: HexLaidTile) => {
    if (!tile.beach || !tile.coast.some(Boolean)) return
    const damp = mixHex(styleOf(tile).tone, SHALLOWS, 0.14)
    const id = `hex-strand-${tile.col}-${tile.row}`
    clips.push(
      `<clipPath id="${id}"><path d="${outline(tile.top)}"/></clipPath>`
    )
    const sides = tile.coast
      .map((coast, k) =>
        coast ? `M${xy(tile.top[k])}L${xy(tile.top[(k + 1) % 6])}` : ''
      )
      .join('')
    out.push(
      `<path clip-path="url(#${id})" d="${sides}" fill="none" stroke="${damp}" stroke-width="${(STRAND_WIDTH * 2 * g).toFixed(1)}" stroke-linecap="round"/>`
    )
  }

  // DECORATION. A region is decorated as one canvas, not tile by tile: its
  // fields are one patchwork, its woods one wood, laid out over the whole
  // plateau and cut off only at the plateau's own edge. (Tile by tile, the
  // plots of one tile did not line up with the next tile's, and nothing grew
  // along the joins.)
  //
  // What lies flat (fields, vines) is drawn with the ground. What stands up
  // (trees, houses, peaks, dunes, tufts) is gathered with everything else that
  // stands, and drawn from the back of the board to the front.
  const standing: { depth: number; markup: string }[] = []
  // How far back something stands: its foot as drawn, with its tile's lift
  // taken off again, so that height does not count as distance.
  const stand = (y: number, level: number, markup: string) =>
    standing.push({ depth: y + level * view.lift, markup })

  // Where on a plateau decoration may go: its tiles without the ones a
  // landmark, a crater or an escarpment takes up; in from the plateau's edge,
  // and from ground a taller tile in front covers; clear of river and road.
  const canvasOf = (plateau: { tiles: HexLaidTile[] }) => {
    const open = plateau.tiles.filter(
      tile =>
        !tile.landmark &&
        tile.state !== 'crater' &&
        !drowned.has(tile.ref ?? '') &&
        // Nothing stands on an escarpment's top to hide its slope.
        !tile.scarp
    )
    const grounds = open.map(tile =>
      insetConvex(
        tile.top,
        tile.top.map((_, k) => {
          // No edge between two tiles of the plateau: nothing to keep in from.
          if (!tile.edges[k]) return 0
          const front = laidByCell.get(hexKey(hexNeighbor(tile, SIDE_NAMES[k])))
          const covered =
            k <= 2 && front && front.state !== 'sea' && !front.sunken
              ? Math.max(0, front.height - tile.height) * view.lift
              : 0
          // (For a far side, `front` is the tile behind.) Where that tile's
          // slope leans out onto this one, nothing stands on the slope's foot.
          const foot =
            k > 2 && front && front.slope > 0
              ? front.slope * Math.max(0, front.height - tile.height) + 0.25
              : 0
          return 0.22 + covered + foot
        })
      )
    )
    const refs = new Set(plateau.tiles.map(tile => tile.ref))
    const xs = plateau.tiles.flatMap(tile => tile.top.map(p => p[0]))
    const ys = plateau.tiles.flatMap(tile => tile.top.map(p => p[1]))
    const box = {
      left: Math.min(...xs),
      right: Math.max(...xs),
      top: Math.min(...ys),
      bottom: Math.max(...ys),
    }
    return {
      box,
      inside: (x: number, y: number) =>
        grounds.some(ground => insideConvex([x, y], ground)),
      logos: (pins ?? []).filter(
        pin =>
          pin.x > box.left - 2 &&
          pin.x < box.right + 2 &&
          pin.y > box.top - 2 &&
          pin.y < box.bottom + 2
      ),
      fixed: layout.pieces
        .filter(piece => piece.clip.some(ref => refs.has(ref)))
        .flatMap(piece => alongLine(piece.points))
        .map(([x, y]) => ({ x, y, radius: 0.75 }))
        // Nor does anything stand in a lake.
        .concat(
          layout.lakes
            .filter(lake => refs.has(lake.tile))
            .flatMap(lake =>
              lake.lobes.flatMap(({ x, y, rx, ry }) =>
                [-0.5, 0, 0.5].map(across => ({
                  x: x + across * rx,
                  y,
                  radius: ry + 0.35,
                }))
              )
            )
        ),
    }
  }

  // Fields and vines: one patchwork of plots over the whole plateau, lying
  // with the board's grain (along the rows of tiles, and up the slant of a
  // tile's side), under the logos: furrows for a field, rows of vines for a
  // vineyard. Here and there a plot is left as grass, and none lies on the
  // road or the river. The plateau's rim is drawn over its edge afterward.
  const drawPlots = (
    plateau: { tiles: HexLaidTile[]; height: number },
    tone: string,
    clip: string
  ) => {
    const cover = plateau.tiles[0].cover
    if (!pins || (cover !== 'fields' && cover !== 'vineyard')) return
    const { box, inside, fixed } = canvasOf(plateau)
    const across: Point = [1, 0]
    const up: Point = [0.5, -0.87 * view.squash]
    const [w, h] = [1.18, 0.5]
    // One lattice for the whole board, so plots line up from tile to tile.
    const origin = projectPoint(view, [0, 0], plateau.height)
    out.push(`<g clip-path="url(#${clip})">`)
    const rows = Math.ceil((box.bottom - box.top) / (h * -up[1])) + 2
    const first = Math.floor((origin[1] - box.bottom) / (h * -up[1])) - 1
    for (let j = first; j <= first + rows; j++) {
      const shift = up[0] * h * j
      const from = Math.floor((box.left - origin[0] - shift) / w) - 1
      const to = Math.ceil((box.right - origin[0] - shift) / w) + 1
      for (let i = from; i <= to; i++) {
        const at = (di: number, dj: number): Point => [
          origin[0] + across[0] * w * (i + di) + up[0] * h * (j + dj),
          origin[1] + across[1] * w * (i + di) + up[1] * h * (j + dj),
        ]
        const [cx, cy] = at(0, 0)
        if (!inside(cx, cy)) continue
        const roll = Math.sin((i * 7 + j * 13) * 12.9898)
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
  }

  // The hot spring a river rises from: toward the way the river leaves it.
  const plateauClip = new Map<string, string>()
  const thermalSpring = (
    spring: HexLayout['springs'][number],
    layer: 'bed' | 'water'
  ) => {
    const first = layout.pieces.find(
      piece => piece.kind === 'river' && piece.tile === spring.tile
    )
    const toward = first
      ? first.points[Math.floor(first.points.length / 2)]
      : ([spring.at[0] - 1, spring.at[1]] as Point)
    // (map-hex-layout says where the pond lies, and keeps the logos off it.)
    const pond = spring.pond ?? {
      x: spring.at[0],
      y: spring.at[1],
      rx: spring.width * 1.35,
      ry: 0,
    }
    const clip = plateauClip.get(spring.tile)
    return (
      `<g${clip ? ` clip-path="url(#${clip})"` : ''}>` +
      thermalSpringMarkup(
        [pond.x, pond.y],
        toward,
        pond.rx * 2,
        view.squash,
        g,
        layer,
        Math.hypot(spring.at[0] - pond.x, spring.at[1] - pond.y)
      ) +
      // The pool narrows into its stream: no square-ended river laid on it.
      (first
        ? springOutflowMarkup(
            // From inside the pool, out along the stream.
            [
              [
                (pond.x + spring.at[0]) / 2,
                (pond.y + spring.at[1]) / 2,
              ] as Point,
              ...lastStretch([...first.points].reverse(), 99)
                .reverse()
                .filter(
                  point =>
                    Math.hypot(
                      point[0] - spring.at[0],
                      point[1] - spring.at[1]
                    ) < OUTFLOW_REACH
                ),
            ],
            pond.rx * 0.34,
            first.width / 2,
            g,
            layer
          )
        : '') +
      '</g>'
    )
  }
  // A lake's shore as drawn: where it comes near a dam it runs on to the
  // dam (and past it: the plateau's edge cuts it off there), so that the
  // water stands against the wall.
  const lakeOutline = (lake: HexLayout['lakes'][number]): Point[] => {
    const shore = lakeShore(lake.lobes, 1)
    const walls = layout.dams.flatMap(dam => {
      const tile = tileByRef.get(dam.tile)
      return tile
        ? [[tile.top[dam.side], tile.top[(dam.side + 1) % 6]] as [Point, Point]]
        : []
    })
    return shore.map(point => {
      // Straight to the nearest wall it is near, and a little past it.
      let best: { away: number; to: Point } | null = null
      for (const [a, b] of walls) {
        const [wx, wy] = [b[0] - a[0], b[1] - a[1]]
        const along =
          ((point[0] - a[0]) * wx + (point[1] - a[1]) * wy) /
          (wx * wx + wy * wy)
        // Not past the ends of the wall, where the edge is no dam.
        if (along < 0.04 || along > 0.96) continue
        const foot: Point = [a[0] + wx * along, a[1] + wy * along]
        const away = Math.hypot(point[0] - foot[0], point[1] - foot[1])
        if (away >= DAM_REACH || (best && best.away <= away)) continue
        const over = 1 + 0.4 / Math.max(away, 0.05)
        best = {
          away,
          to: [
            point[0] + (foot[0] - point[0]) * over,
            point[1] + (foot[1] - point[1]) * over,
          ],
        }
      }
      return best ? best.to : point
    })
  }
  // The last `reach` (map grid units) of a line, in order, with points that
  // lie on top of each other dropped (they have no direction).
  const lastStretch = (points: Point[], reach: number): Point[] => {
    const kept: Point[] = []
    let gone = 0
    for (let k = points.length - 1; k >= 0 && gone <= reach; k--) {
      const last = kept[0]
      if (last) {
        const step = Math.hypot(points[k][0] - last[0], points[k][1] - last[1])
        if (step < 0.02) continue
        gone += step
      }
      kept.unshift(points[k])
    }
    return kept
  }
  // A lake as a path: its smooth shore, or, where it covers the whole of its
  // tiles, their outlines.
  const lakeShape = (lake: HexLayout['lakes'][number]) =>
    lake.whole
      ? lake.whole
          .flatMap(ref => {
            const tile = tileByRef.get(ref)
            return tile ? [outline(tile.top)] : []
          })
          .join('')
      : smoothClosedPath(lakeOutline(lake), g)
  const drowned = new Set(layout.lakes.flatMap(lake => lake.whole ?? []))
  // A district's places for scenery (map-hex-layout keeps the logos off them).
  const sceneryOn = (plateau: { tiles: HexLaidTile[] }) =>
    layout.scenery.filter(site => site.district === plateau.tiles[0].district)

  // What lies under the logos, so that it reads however crowded the
  // district: a forest's canopy, or hot springs.
  const drawRelief = (
    plateau: { tiles: HexLaidTile[]; height: number },
    tone: string,
    clip: string
  ) => {
    const cover = plateau.tiles[0].cover
    if (cover === 'oasis') {
      // Green banks along the water, under the river itself.
      const refs = new Set(plateau.tiles.map(tile => tile.ref))
      out.push(`<g clip-path="url(#${clip})">`)
      for (const piece of layout.pieces) {
        if (piece.kind !== 'river' || !refs.has(piece.tile)) continue
        const d = `M${piece.points.map(xy).join('L')}`
        out.push(
          `<path d="${d}" fill="none" stroke="${OASIS.grass}" stroke-width="${((piece.width + 1.5) * g).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`,
          `<path d="${d}" fill="none" stroke="${OASIS.lush}" stroke-width="${((piece.width + 0.7) * g).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`
        )
      }
      // Where the stream ends, the oasis's pool, in its ring of green.
      for (const piece of layout.pieces) {
        if (piece.kind !== 'river' || !refs.has(piece.tile)) continue
        const [x, y] = piece.points[piece.points.length - 1]
        const pool = (rx: number, fill: string, extra = '') =>
          `<ellipse cx="${(x * g).toFixed(1)}" cy="${(y * g).toFixed(1)}" rx="${(rx * g).toFixed(1)}" ry="${(rx * view.squash * g).toFixed(1)}" fill="${fill}"${extra}/>`
        out.push(
          pool(1.35, OASIS.grass),
          pool(1.1, OASIS.lush),
          pool(0.85, WATER, ` stroke="${SHALLOWS}" stroke-width="${BANK}"`)
        )
      }
      out.push('</g>')
    }
    if (plateau.tiles[0].stilts) {
      // Boards across the whole deck, on one grid for the whole board, their
      // ends staggered from one board to the next.
      const xs = plateau.tiles.flatMap(tile => tile.top.map(point => point[0]))
      const ys = plateau.tiles.flatMap(tile => tile.top.map(point => point[1]))
      const [left, right] = [Math.min(...xs), Math.max(...xs)]
      const [top, bottom] = [Math.min(...ys), Math.max(...ys)]
      const width = 0.22
      out.push(`<g clip-path="url(#${clip})">`)
      for (let row = Math.floor(top / width); row * width < bottom; row++) {
        const y = row * width
        out.push(
          `<path d="M${xy([left, y])}L${xy([right, y])}" stroke="${PLANK_GAP}" stroke-opacity="0.75" stroke-width="1.5"/>`
        )
        const first = Math.floor(left / 1.7) * 1.7 + ((row * 0.77) % 1.7)
        for (let x = first; x < right; x += 1.7) {
          out.push(
            `<path d="M${xy([x, y])}L${xy([x, y + width])}" stroke="${PLANK_GAP}" stroke-opacity="0.75" stroke-width="1.5"/>`
          )
        }
      }
      out.push('</g>')
    }
    if (cover === 'thermals' && pins) {
      out.push(`<g clip-path="url(#${clip})">`)
      sceneryOn(plateau).forEach((site, n) => {
        if (site.tall) return
        out.push(
          sulphurPoolMarkup(
            site.x,
            site.y,
            1.25 + ((n * 0.37) % 0.4),
            view.squash,
            g,
            n,
            true
          )
        )
      })
      out.push('</g>')
    }
  }

  // What stands on a plateau: its district's cover where the spec gives one
  // (woodland, a pine thicket, a hamlet, dunes, meadow), or else its realm's
  // usual country; in the gaps the logos leave, with a thin back row under
  // the logos where a wood or a range should still read as one when crowded.
  const gatherStanding = (
    plateau: { tiles: HexLaidTile[]; height: number },
    theme: RealmTheme,
    tone: string,
    seed: number
  ) => {
    const cover = plateau.tiles[0].cover
    if (!pins || cover === 'vineyard') return
    if (!(theme.terrain || cover)) return
    const { inside, logos, fixed } = canvasOf(plateau)
    const extent = { width: width / g, height: height / g }
    const stamp = (
      symbol: string,
      x: number,
      y: number,
      w: number,
      h: number
    ) =>
      `<use href="#${symbol}" x="${((x - w / 2) * g).toFixed(1)}" y="${((y - h) * g).toFixed(1)}" width="${(w * g).toFixed(1)}" height="${(h * g).toFixed(1)}"/>`
    const level = plateau.height

    if (cover === 'dunes') {
      // Great dunes, wherever the river and the road leave room, whatever
      // logos stand there (the logos are drawn over them). Each stands whole
      // on its district's ground: far enough in from the edge that none is
      // cut off by it, and, standing up, in front of the foot of whatever
      // rises behind.
      scatterSpots(inside, fixed, extent, {
        spacing: 1.45,
        minRoom: 0.55,
        maxRoom: 1.2,
      }).forEach((spot, n) =>
        stand(
          spot.y + 0.2,
          level,
          duneMarkup(
            spot.x,
            spot.y + 0.2,
            1.25 + spot.roll * 0.45,
            g,
            mixHex(tone, '#ffffff', 0.38),
            mixHex(tone, LINE, 0.3),
            VINE,
            seed * 97 + n
          )
        )
      )
      return
    }
    if (cover === 'hills') {
      // Low green hills, in ones and twos, all over the district's ground
      // whatever logos stand there (the logos are drawn over them), each
      // whole on its own ground as the dunes are.
      scatterSpots(inside, fixed, extent, {
        spacing: 1,
        minRoom: 0.5,
        maxRoom: 1.2,
      }).forEach((spot, n) =>
        stand(
          spot.y + 0.2,
          level,
          hillMarkup(
            spot.x,
            spot.y + 0.2,
            0.95 + spot.roll * 0.4,
            g,
            mixHex(tone, HILL.lit, 0.6),
            mixHex(tone, HILL.shade, 0.55),
            seed * 97 + n
          )
        )
      )
      return
    }
    if (cover === 'huts') {
      // A stilt village's houses of timber and thatch, of three kinds.
      scatterSpots(inside, [...logos, ...fixed], extent, {
        spacing: 0.95,
        minRoom: 0.34,
        maxRoom: 0.8,
      }).forEach(spot => {
        const foot = spot.y + 0.38
        const kind =
          spot.room > 0.5 && spot.roll > 0.55 ? 1 : spot.roll > 0.3 ? 0 : 2
        stand(
          foot,
          level,
          thatchHouseMarkup(spot.x, foot, 0.98, g, kind, false)
        )
      })
      return
    }
    if (cover === 'oasis') {
      // Palms in twos and threes, the most of them by the water, and open
      // sand between the clumps.
      const water = fixed.map(spot => ({ ...spot, radius: 0.5 }))
      scatterSpots(inside, [...logos, ...water], extent, {
        spacing: 0.95,
        minRoom: 0.16,
        maxRoom: 0.8,
      }).forEach((spot, n) => {
        const near = fixed.some(
          point => Math.hypot(point.x - spot.x, point.y - spot.y) < 1.5
        )
        const palms = near ? 3 : spot.roll > 0.3 ? 2 : 1
        for (let k = 0; k < palms; k++) {
          const x = spot.x + (k - (palms - 1) / 2) * 0.34
          const foot = spot.y + 0.25 + (k % 2) * 0.12
          stand(
            foot,
            level,
            palmMarkup(
              x,
              foot,
              0.7 + ((spot.roll * 7 + k) % 1) * 0.4,
              g,
              seed * 97 + n * 3 + k
            )
          )
        }
      })
      return
    }
    if (cover === 'tropical') {
      // A tropical beach: palms in plenty, parasols and towels, a rowboat
      // drawn up on the sand, and a beach hut or two where there is room.
      let huts = 0
      scatterSpots(inside, [...logos, ...fixed], extent, {
        spacing: 0.72,
        minRoom: 0.2,
        maxRoom: 0.8,
      }).forEach((spot, n) => {
        const foot = spot.y + 0.25
        const hut = huts < 2 && spot.room > 0.55 && spot.roll > 0.45
        if (hut) huts++
        stand(
          foot,
          level,
          hut
            ? beachHutMarkup(spot.x, foot, 0.8, g)
            : spot.roll < 0.2 && spot.room > 0.3
              ? parasolMarkup(spot.x, foot, 0.5, g, seed * 97 + n)
              : spot.roll < 0.28 && spot.room > 0.45
                ? stamp('rowboat', spot.x, foot, 0.85, 0.38)
                : palmMarkup(
                    spot.x,
                    foot,
                    0.72 + spot.roll * 0.4,
                    g,
                    seed * 97 + n
                  )
        )
      })
      return
    }
    if (cover === 'fields') {
      // Farming country: a farmstead here and there among the plots, no two
      // of them the same — a house on its own, a house with its barn, a barn
      // and a rick, a pair of cottages. Well spread out, and standing
      // whatever logos are over it, so the fields still read as fields.
      const farm = (n: number) => {
        const value = Math.sin(n * 12.9898) * 43758.5453
        return value - Math.floor(value)
      }
      scatterSpots(inside, fixed, extent, {
        spacing: 2.3,
        minRoom: 0.55,
        maxRoom: 1.2,
      }).forEach((spot, n) => {
        const foot = spot.y + 0.2
        const kind = Math.floor(farm(seed * 31 + n) * 5)
        const away = 0.7 + farm(seed * 53 + n) * 0.5
        const side = farm(seed * 71 + n) > 0.5 ? 1 : -1
        const parts =
          kind === 0
            ? // A house on its own, a tree at its shoulder.
              stamp('tree', spot.x - 0.66 * side, foot, 0.34, 0.68) +
              stamp('house', spot.x, foot, 0.92, 1.2)
            : kind === 1
              ? // A house and its barn.
                stamp('house', spot.x, foot, 0.88, 1.15) +
                barnMarkup(spot.x + away * side, foot + 0.06, 0.86, g)
              : kind === 2
                ? // A barn and a rick beside it.
                  barnMarkup(spot.x, foot, 0.95, g) +
                  haystackMarkup(spot.x + away * side, foot + 0.04, 0.46, g)
                : kind === 3
                  ? // A cottage with a small shed behind it.
                    stamp(
                      'house',
                      spot.x + away * side * 0.7,
                      foot - 0.22,
                      0.56,
                      0.73
                    ) + stamp('cottage', spot.x, foot, 0.9, 1.17)
                  : // Two cottages, a little apart.
                    stamp('cottage', spot.x, foot, 0.85, 1.11) +
                    stamp(
                      'cottage',
                      spot.x + away * side * 1.15,
                      foot + 0.1,
                      0.7,
                      0.91
                    )
        stand(foot, level, parts)
      })
      return
    }
    if (cover === 'reeds') {
      // An estuary's shore. Reeds stand in the wet ground, smaller than the
      // trees of the country round about; on the strand there is a fishing
      // village, a net hung out to dry and a boat drawn up; and out on the
      // water off the coast a few boats are working.
      const shoreRoll = (n: number) => {
        const value = Math.sin(n * 12.9898) * 43758.5453
        return value - Math.floor(value)
      }
      const edges = plateau.tiles.flatMap(tile =>
        tile.coast.flatMap((coast, k) => (coast ? [{ tile, k }] : []))
      )
      const strand = edges.map(
        ({ tile, k }) =>
          [
            (tile.top[k][0] + tile.top[(k + 1) % 6][0]) / 2,
            (tile.top[k][1] + tile.top[(k + 1) % 6][1]) / 2,
          ] as Point
      )
      // Boats out on the water: off about half the stretches of coast, pushed
      // out from the shore and dropped to sea level, a ripple under each.
      edges.forEach(({ tile }, n) => {
        if (shoreRoll(seed * 13 + n) > 0.5) return
        const [mx, my] = strand[n]
        const [dx, dy] = [mx - tile.center[0], my - tile.center[1]]
        const reach = Math.hypot(dx, dy) || 1
        const x = mx + (dx / reach) * 1.15
        const y = my + (dy / reach) * 1.15 + level * view.lift
        stand(
          y,
          0,
          `<path d="M${((x - 0.55) * g).toFixed(1)},${((y + 0.2) * g).toFixed(1)}q${(0.55 * g).toFixed(1)},${(0.12 * g).toFixed(1)} ${(1.1 * g).toFixed(1)},0" fill="none" stroke="${WATER_STREAK}" stroke-opacity="0.5" stroke-width="2" stroke-linecap="round"/>` +
            stamp('rowboat', x, y + 0.18, 0.78, 0.35)
        )
      })
      const reed = mixHex(tone, FOREST.shade, 0.72)
      const spots = scatterSpots(inside, fixed, extent, {
        spacing: 0.72,
        minRoom: 0.24,
        maxRoom: 1,
      })
      // The fishing village stands on the roomiest place on the strand.
      const onStrand = (spot: (typeof spots)[number]) =>
        strand.some(([x, y]) => Math.hypot(x - spot.x, y - spot.y) < 1.15)
      const village = spots
        .filter(spot => onStrand(spot) && spot.room > 0.42)
        .sort((a, b) => b.room - a.room)[0]
      // Whatever logos stand there: this coast is crowded, and the reeds are
      // its country, as the dunes are the dunes' (the logos are drawn over
      // them).
      spots.forEach((spot, n) => {
        const foot = spot.y + 0.2
        if (spot === village) {
          // Four small houses in a huddle, the way a fishing village sits.
          stand(
            foot,
            level,
            (
              [
                ['cottage', -0.72, -0.24, 0.52],
                ['house', 0.02, -0.18, 0.5],
                ['house', -0.4, 0.06, 0.6],
                ['cottage', 0.42, 0.1, 0.58],
              ] as [string, number, number, number][]
            )
              // No house of it may straddle the sea: one whose ground is not
              // the district's is left out.
              .filter(([, dx, dy]) => inside(spot.x + dx, foot + dy))
              .map(([symbol, dx, dy, scale]) =>
                stamp(
                  symbol,
                  spot.x + dx,
                  foot + dy,
                  scale * 0.95,
                  scale * 1.24
                )
              )
              .join('')
          )
          return
        }
        const shore = onStrand(spot)
        stand(
          foot,
          level,
          shore && spot.roll > 0.5
            ? stamp('rowboat', spot.x, foot, 0.72, 0.32)
            : shore && spot.roll > 0.2
              ? netFrameMarkup(
                  spot.x,
                  foot,
                  0.62,
                  g,
                  mixHex(tone, '#ffffff', 0.62),
                  seed * 97 + n
                )
              : reedBedMarkup(
                  spot.x,
                  foot,
                  0.3 + spot.roll * 0.14,
                  g,
                  reed,
                  PLANK,
                  mixHex(tone, SHALLOWS, 0.45),
                  seed * 97 + n
                )
        )
      })
      return
    }
    if (cover === 'thermals') {
      // Geysers going off, where the plan found them clear air.
      sceneryOn(plateau).forEach((site, n) => {
        if (!site.tall) return
        stand(
          site.y + 0.2,
          level,
          geyserMarkup(
            site.x,
            site.y + 0.2,
            1.35 + ((n * 0.29) % 0.3),
            g,
            theme.cliff.foot,
            seed * 97 + n
          )
        )
      })
      return
    }
    if (cover === 'meadow') {
      // The grass of a valley floor, with a tree here and there.
      scatterSpots(inside, [...logos, ...fixed], extent, {
        spacing: 0.7,
        minRoom: 0.15,
        maxRoom: 0.7,
      }).forEach((spot, n) => {
        stand(
          spot.y,
          level,
          spot.roll > 0.82 && spot.room > 0.4
            ? stamp('tree', spot.x, spot.y + 0.3, 0.45, 0.9)
            : tuftMarkup(spot.x, spot.y, g, VINE, FIELD_RIPE, seed * 97 + n)
        )
      })
      return
    }
    if (cover) {
      const wood =
        cover === 'forest' || cover === 'thicket' || cover === 'grove'
      const gaps = wood
        ? cover === 'thicket'
          ? { spacing: 0.55, minRoom: 0.2, maxRoom: 0.5 }
          : cover === 'grove'
            ? { spacing: 0.95, minRoom: 0.3, maxRoom: 0.6 }
            : { spacing: 0.4, minRoom: 0.16, maxRoom: 0.6 }
        : { spacing: 1.25, minRoom: 0.5, maxRoom: 0.8 }
      const spots = [
        ...(wood
          ? scatterSpots(inside, fixed, extent, {
              spacing:
                cover === 'thicket' ? 0.95 : cover === 'grove' ? 1.7 : 0.6,
              minRoom: 0.3,
              maxRoom: 0.6,
            })
          : []),
        ...scatterSpots(inside, [...logos, ...fixed], extent, gaps),
      ]
      for (const spot of spots) {
        if (wood) {
          const size =
            (cover === 'thicket' ? 0.8 : 1) * (0.8 + spot.roll * 0.35)
          stand(
            spot.y,
            level,
            stamp('tree', spot.x, spot.y + 0.3, 0.5 * size, 1 * size)
          )
        } else {
          stand(
            spot.y,
            level,
            stamp(
              spot.roll < 0.5 ? 'house' : 'cottage',
              spot.x,
              spot.y + 0.35,
              0.8,
              1.03
            ) + stamp('tree', spot.x + 0.55, spot.y + 0.3, 0.4, 0.8)
          )
        }
      }
      return
    }
    if (!theme.terrain) return
    const backRow = BACK_ROW[theme.terrain]
    const spots = [
      // A back row the logos are drawn over (see realmArtBackdrop.ts).
      ...(backRow
        ? scatterSpots(
            inside,
            fixed.map(spot => ({ ...spot, radius: 1.3 })),
            extent,
            backRow
          )
        : []),
      ...scatterSpots(
        inside,
        [...logos, ...fixed],
        extent,
        TERRAIN_SCATTER[theme.terrain]
      ),
    ]
    for (const spot of spots) {
      stand(spot.y, level, terrainDetail(theme, spot, g, true))
    }
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
        stand(
          foot,
          tile.height,
          poly([[x - w / 2, foot], peak, fold], WALL.lit) +
            poly([peak, [x + w / 2, foot], fold], WALL.shade)
        )
      })
    }
  }

  // How a tile is colored: its realm's look (with the realm's turn of hue
  // carried to its cliffs) and its district's own tone of the ground.
  const styleOf = (tile: HexLaidTile) => {
    const turn = REALM_HUE[realmKey(tile.realm)] ?? 0
    const ground = themeFor(tile.realm)
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
    // A district with a ground color of its own has cliffs of that color
    // too, or they would be its realm's under a top that is not.
    if (tile.ground) {
      return {
        theme: {
          ...theme,
          cliff: {
            lip: mixHex(tile.ground, '#ffffff', 0.25),
            face: mixHex(tile.ground, LINE, 0.35),
            foot: mixHex(tile.ground, LINE, 0.6),
          },
        },
        tone: tile.ground,
      }
    }
    return {
      theme,
      tone: districtTone(theme.tones[0], tile.tone, tile.tones, turn),
    }
  }

  // THE FLAT OF THE LAND. A district is one plateau, so it is drawn as one:
  // its ground is a single shape (the outline of all its tiles together), its
  // rim and its border are that outline drawn as a line, and the river and
  // the road on it are drawn over the whole of it at once. Nothing is pieced
  // together tile by tile, so there are no joins to show. Plateaus are drawn
  // from the lowest to the highest: a higher one hides what it stands in
  // front of, and two of one height never overlap.
  interface Plateau {
    height: number
    tiles: HexLaidTile[]
    // The outline, as closed loops of corners (a hole is a loop of its own).
    loops: Point[][]
  }
  const solid = (tile: HexLaidTile) =>
    tile.state !== 'sea' &&
    tile.state !== 'water' &&
    tile.ref !== null &&
    !tile.sunken
  const plateauKey = (tile: HexLaidTile) => {
    if (tile.district !== null) return `d:${tile.district}`
    if (tile.state === 'crater') {
      // A volcano rises out of the ground beside it: its tile is drawn as
      // part of the neighboring district's plateau of the same height.
      const beside = SIDE_NAMES.map(side =>
        laidByCell.get(hexKey(hexNeighbor(tile, side)))
      ).find(
        next => next && next.district !== null && next.height === tile.height
      )
      if (beside) return `d:${beside.district}`
    }
    return `t:${tile.ref}`
  }
  const grouped = new Map<string, HexLaidTile[]>()
  for (const tile of layout.tiles) {
    if (!solid(tile)) continue
    grouped.set(plateauKey(tile), [
      ...(grouped.get(plateauKey(tile)) ?? []),
      tile,
    ])
  }
  const plateaus: Plateau[] = [...grouped.values()].map(group => {
    // A district's own tiles first: the plateau takes its look from them.
    const tiles = [...group].sort(
      (a, b) => Number(a.district === null) - Number(b.district === null)
    )
    const within = new Set(tiles.map(tile => hexKey(tile)))
    // Every side with no tile of the plateau across it, as a step from one
    // corner to the next; corners run the same way round on every tile, so
    // the steps join up head to tail into loops.
    const steps = new Map<string, Point[]>()
    const name = ([x, y]: Point) => `${x.toFixed(4)},${y.toFixed(4)}`
    for (const tile of tiles) {
      SIDE_NAMES.forEach((side, k) => {
        if (within.has(hexKey(hexNeighbor(tile, side)))) return
        steps.set(name(tile.top[k]), [tile.top[k], tile.top[(k + 1) % 6]])
      })
    }
    const loops: Point[][] = []
    while (steps.size > 0) {
      const [first] = steps.keys()
      const loop: Point[] = []
      let at = first
      while (steps.has(at)) {
        const [from, to] = steps.get(at)!
        steps.delete(at)
        loop.push(from)
        at = name(to)
      }
      loops.push(loop)
    }
    return { height: tiles[0].height, tiles, loops }
  })
  // The lowest first; of one height, a lone feature (the keep) before the
  // districts, so that the moat, which is the district's, lies over it.
  plateaus.sort(
    (a, b) =>
      a.height - b.height ||
      Number(a.tiles[0].district !== null) -
        Number(b.tiles[0].district !== null)
  )
  const heightOfRef = (ref: string) => tileByRef.get(ref)?.height ?? 0

  const heights = [...new Set(plateaus.map(plateau => plateau.height))]
  for (const height of heights) {
    const level = plateaus.filter(plateau => plateau.height === height)
    level.forEach((plateau, n) => {
      const id = `hex-plateau-${height}-${n}`.replace('.', '_')
      for (const tile of plateau.tiles) {
        if (tile.ref) plateauClip.set(tile.ref, id)
      }
    })
    // Cliff faces, then the ground with its cover, rim and border.
    for (const plateau of level) {
      for (const tile of plateau.tiles) {
        maskedBy(tile.ref, () => drawFaces(tile, styleOf(tile).theme))
      }
    }
    for (const plateau of level) {
      for (const tile of plateau.tiles) drawSlopes(tile)
    }
    level.forEach((plateau, n) => {
      const { tone } = styleOf(plateau.tiles[0])
      const shape = plateau.loops.map(outline).join('')
      const id = `hex-plateau-${height}-${n}`.replace('.', '_')
      clips.push(
        `<clipPath id="${id}"><path d="${shape}" clip-rule="evenodd"/></clipPath>`
      )
      out.push(`<path d="${shape}" fill="${tone}" fill-rule="evenodd"/>`)
      drawPlots(plateau, tone, id)
      drawRelief(plateau, tone, id)
      for (const tile of plateau.tiles) {
        if (tile.state === 'crater') {
          // The cone stands on the whole of its tile, so it is drawn with
          // what stands, at the depth of the tile's near side.
          stand(
            tile.top[1][1],
            height,
            volcanoMarkup(
              tile.top,
              view.size * 0.8,
              g,
              styleOf(tile).theme.cliff
            )
          )
        }
      }
      // The rim: a darker band just inside the plateau's edge. The outline
      // is drawn as a wide line and the outer half clipped away.
      const band = mixHex(tone, LINE, RIM_SHADE)
      const line = mixHex(band, LINE, BORDER_LINE.opacity)
      out.push(
        // A hairline right on the edge, unclipped, closes the softened gap
        // between this plateau's ground and whatever it meets.
        `<path d="${shape}" fill="none" stroke="${line}" stroke-width="1.5" stroke-linejoin="miter"/>`,
        `<path clip-path="url(#${id})" d="${shape}" fill="none" stroke="${band}" stroke-width="${(RIM_WIDTH * 2 * g).toFixed(1)}" stroke-linejoin="miter"/>`
      )
      // The thin dark border along the edge, left off along the foot of a
      // higher neighbor: a cliff marks that border itself. Each loop is cut
      // into the stretches that remain.
      for (const loop of plateau.loops) {
        const keep = loop.map(from => {
          // The tile this step is a side of, and the tile across it.
          const owner = plateau.tiles.find(tile => tile.top.includes(from))
          if (!owner) return true
          const side = SIDE_NAMES[owner.top.indexOf(from)]
          const across = laidByCell.get(hexKey(hexNeighbor(owner, side)))
          return !(across && solid(across) && across.height > height)
        })
        const closed = keep.every(Boolean)
        const stretches: Point[][] = []
        if (closed) {
          stretches.push(loop)
        } else {
          const start = keep.findIndex(
            (kept, k) => kept && !keep[(k + loop.length - 1) % loop.length]
          )
          let run: Point[] = []
          for (let step = 0; step < loop.length; step++) {
            const k = (start + step) % loop.length
            if (keep[k]) {
              if (run.length === 0) run.push(loop[k])
              run.push(loop[(k + 1) % loop.length])
            } else if (run.length > 0) {
              stretches.push(run)
              run = []
            }
          }
          if (run.length > 0) stretches.push(run)
        }
        if (stretches.length === 0) continue
        out.push(
          `<path clip-path="url(#${id})" d="${stretches
            .map(run => `M${run.map(xy).join('L')}${closed ? 'Z' : ''}`)
            .join(
              ''
            )}" fill="none" stroke="${line}" stroke-width="${BORDER_LINE.width * 2}" stroke-linejoin="miter" stroke-linecap="butt"/>`
        )
      }
    })
    // The river and the road on this level, over all its ground. A road that
    // climbs by a ramp is drawn with the level it climbs to, so that level's
    // cliff does not cover the ramp.
    for (const plateau of level) {
      for (const tile of plateau.tiles) drawStrand(tile)
    }
    // Lakes on this level: one irregular shore round all of a lake's lobes;
    // cut off at the plateau's edge, where a dam holds the lake back.
    level.forEach((plateau, n) => {
      const id = `hex-plateau-${height}-${n}`.replace('.', '_')
      for (const lake of layout.lakes) {
        if (!plateau.tiles.some(tile => tile.ref === lake.tile)) continue
        const shore = lakeShape(lake)
        out.push(
          `<g clip-path="url(#${id})">`,
          `<path d="${shore}" fill="${WATER}" stroke="${SHALLOWS}" stroke-width="${BANK * 2}"/>`,
          '</g>'
        )
      }
    })
    // The hot spring a river rises from lies under the river.
    for (const spring of layout.springs) {
      if (
        level.some(plateau =>
          plateau.tiles.some(tile => tile.ref === spring.tile)
        ) &&
        tileByRef.get(spring.tile)?.cover === 'thermals'
      ) {
        out.push(thermalSpring(spring, 'bed'))
      }
    }
    // The piers that stand at this height, over the water of their tiles.
    for (const tile of layout.tiles) {
      if (tile.deck?.height !== height) continue
      const { shape, along } = tile.deck
      out.push(deckMarkup(shape, along, height * view.lift, g))
    }
    const refs = new Set(
      level.flatMap(plateau => plateau.tiles.map(t => t.ref))
    )
    const drawnHere = (piece: HexPathPiece) =>
      Math.max(
        heightOfRef(piece.tile),
        ...(piece.rampTo ?? []).map(heightOfRef)
      ) === height &&
      (refs.has(piece.tile) || (piece.rampTo ?? []).some(ref => refs.has(ref)))
    drawPieces(
      layout.pieces.filter(drawnHere),
      `hex-path-${height}`.replace('.', '_')
    )
    // Where the river meets a lake that fills its tiles, on the lake's own
    // level, it does not run square into the tile's side: it widens into the
    // lake, its banks curving apart.
    level.forEach((plateau, n) => {
      const id = `hex-plateau-${height}-${n}`.replace('.', '_')
      const refs = new Set(plateau.tiles.map(tile => tile.ref))
      const sides = plateau.tiles
        .filter(tile => drowned.has(tile.ref ?? ''))
        .flatMap(tile =>
          tile.top.map((a, k): [Point, Point] => [a, tile.top[(k + 1) % 6]])
        )
      if (sides.length === 0) return
      const shoreAt = (point: Point) =>
        sides.find(([a, b]) => {
          const [wx, wy] = [b[0] - a[0], b[1] - a[1]]
          const along =
            ((point[0] - a[0]) * wx + (point[1] - a[1]) * wy) /
            (wx * wx + wy * wy)
          return (
            along > 0.05 &&
            along < 0.95 &&
            Math.hypot(
              point[0] - (a[0] + wx * along),
              point[1] - (a[1] + wy * along)
            ) < 0.02
          )
        })
      for (const piece of layout.pieces) {
        if (
          piece.kind !== 'river' ||
          piece.closed ||
          !refs.has(piece.tile) ||
          drowned.has(piece.tile)
        ) {
          continue
        }
        for (const points of [piece.points, [...piece.points].reverse()]) {
          const mouth = points[points.length - 1]
          const shore = shoreAt(mouth)
          if (!shore) continue
          // The mouth lies along the lake's side (whatever way the stream
          // wanders up to it), no wider than the side has room for, so that
          // no corner of it sticks out past the lake.
          const [a, b] = shore
          const side = Math.hypot(b[0] - a[0], b[1] - a[1])
          const along: Point = [(b[0] - a[0]) / side, (b[1] - a[1]) / side]
          // How far the mouth may open toward each end of the side: well
          // short of an end that is a corner of the plateau's own edge (the
          // water would stand against the cliff there), nearly up to one
          // that lies inland.
          const opens = (end: Point) => {
            const outer = plateau.loops.some(loop =>
              loop.some(
                corner =>
                  Math.hypot(corner[0] - end[0], corner[1] - end[1]) < 0.02
              )
            )
            return Math.min(
              MOUTH_WIDTH,
              Math.hypot(mouth[0] - end[0], mouth[1] - end[1]) -
                (outer ? MOUTH_CLEAR : 0.12)
            )
          }
          // The banks follow the stream's own course over its last stretch,
          // drawing apart faster and faster, and end on the lake's side.
          const course = lastStretch(points, MOUTH_BACK)
          // Half the river's own width at a point of its course (it may
          // taper along a piece).
          const riverHalf = (point: Point) => {
            const at = piece.points.indexOf(point)
            const share = at < 0 ? 1 : at / (piece.points.length - 1)
            return (
              (piece.width +
                ((piece.widthEnd ?? piece.width) - piece.width) * share) /
              2
            )
          }
          const first = course[0]
          const second = course[1] ?? mouth
          // Which way along the side lies to the stream's left.
          const left =
            -(second[1] - first[1]) * along[0] +
              (second[0] - first[0]) * along[1] >
            0
              ? 1
              : -1
          const bank = (turn: number): Point[] => {
            const sign = turn * left
            const wide = opens(sign > 0 ? b : a)
            return course.map((point, k): Point => {
              if (k === course.length - 1) {
                return [
                  mouth[0] + along[0] * wide * sign,
                  mouth[1] + along[1] * wide * sign,
                ]
              }
              const before = course[Math.max(0, k - 1)]
              const after = course[k + 1]
              const run =
                Math.hypot(after[0] - before[0], after[1] - before[1]) || 1
              const t = k / (course.length - 1)
              const narrow = riverHalf(point)
              const half = narrow + Math.max(0, wide - narrow) * t * t
              return [
                point[0] - ((after[1] - before[1]) / run) * half * turn,
                point[1] + ((after[0] - before[0]) / run) * half * turn,
              ]
            })
          }
          out.push(
            `<path clip-path="url(#${id})" d="M${[...bank(1), ...bank(-1).reverse()].map(xy).join('L')}Z" fill="${WATER}" stroke="${WATER}" stroke-width="1" stroke-linejoin="round"/>`
          )
        }
      }
    })
    level.forEach((plateau, n) => {
      const id = `hex-plateau-${height}-${n}`.replace('.', '_')
      for (const lake of layout.lakes) {
        if (!plateau.tiles.some(tile => tile.ref === lake.tile)) continue
        // The lake's water again, over the river: no river bank shows in
        // it, and the river runs into it and out of it at its shore.
        const shore = lakeOutline(lake)
        const water = lakeShape(lake)
        out.push(
          `<g clip-path="url(#${id})">`,
          `<path d="${water}" fill="${WATER}"/>`,
          ...scaledAbout(shore, 0.55)
            .filter((_, k) => k % 24 === 6)
            .map(
              point =>
                `<path d="M${xy(point)}h${(0.7 * g).toFixed(1)}" stroke="${WATER_STREAK}" stroke-width="3" stroke-linecap="round"/>`
            ),
          '</g>'
        )
      }
    })
    for (const spring of layout.springs) {
      if (!refs.has(spring.tile)) continue
      if (tileByRef.get(spring.tile)?.cover === 'thermals') {
        out.push(thermalSpring(spring, 'water'))
        continue
      }
      out.push(
        `<ellipse cx="${(spring.at[0] * g).toFixed(1)}" cy="${(spring.at[1] * g).toFixed(1)}" rx="${(spring.width * 0.95 * g).toFixed(1)}" ry="${(spring.width * 0.95 * view.squash * g).toFixed(1)}" fill="${WATER}" stroke="${SHALLOWS}" stroke-width="${BANK}"/>`
      )
    }
    for (const drop of layout.drops) if (refs.has(drop.tile)) drawDrop(drop)
    // A pier level with this ground: after it, and before the higher ground
    // that may stand in front of it.
    for (const pier of raisedPiers) {
      if (Math.abs(pier.up - height * view.lift) < 1e-6) out.push(pier.markup)
    }
    for (const bridge of layout.bridges) {
      if (!refs.has(bridge.tile)) continue
      const d = `M${xy(bridge.a)}L${xy(bridge.b)}`
      const across = (bridge.width * g * 1.15).toFixed(1)
      out.push(
        `<path d="${d}" fill="none" stroke="${PLANK_GAP}" stroke-width="${across}"/>`,
        `<path d="${d}" fill="none" stroke="${PLANK}" stroke-width="${across}" stroke-dasharray="7 3"/>`
      )
    }
  }

  // WHAT STANDS ON THE LAND: each plateau's trees, houses, peaks and dunes,
  // the landmarks and the wall of a walled district, all gathered and drawn
  // from the back of the board to the front, so that what is nearer stands in
  // front of what is farther whichever tile or region it belongs to.
  plateaus.forEach((plateau, n) => {
    const { theme, tone } = styleOf(plateau.tiles[0])
    gatherStanding(plateau, theme, tone, n)
  })
  for (const tile of layout.tiles) {
    if (tile.state === 'sea' || tile.ref === null) continue
    if (tile.walled) drawWall(tile, [0, 1, 2, 3, 4, 5])
    const mark = tile.landmark
    if (!mark || !pins) continue
    const stamp = (
      symbol: string,
      dx: number,
      dy: number,
      scale: number,
      tilt: number
    ) => {
      const [w, h] = [mark.width * scale * g, mark.height * scale * g]
      const [cx, cy] = [(mark.x + dx) * g, (mark.y + dy) * g]
      const art = `<use href="#${symbol}" x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${tilt ? ` transform="rotate(${tilt} ${cx.toFixed(1)} ${cy.toFixed(1)})" opacity="0.8"` : ''}/>`
      if (!mark.crop) return art
      // Keep the top of the art and drop it by what was cut, so that what is
      // left still stands on the same ground.
      const id = `hex-crop-${tile.col}-${tile.row}`
      clips.push(
        `<clipPath id="${id}"><rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${(h * (1 - mark.crop)).toFixed(1)}"/></clipPath>`
      )
      return `<g transform="translate(0 ${(h * mark.crop).toFixed(1)})"><g clip-path="url(#${id})">${art}</g></g>`
    }
    // A lit landmark throws its light at the ship coming in, picking it out
    // of the dark water; without a ship it only glows.
    const lantern: Point | null = mark.lit
      ? [
          mark.x + (mark.lit[0] - 0.5) * mark.width,
          mark.y + (mark.lit[1] - 0.5) * mark.height,
        ]
      : null
    stand(
      mark.y + mark.height / 2,
      tile.height,
      (lantern && layout.arrivals.length > 0
        ? beaconMarkup(lantern, layout.arrivals[0], g)
        : '') + stamp(mark.symbol, 0, 0, 1, 0)
    )
  }
  // The ships' graveyard: over the rest of a sunken district's water, hulls
  // heeled over and half under, with a broken spar standing out of the sea
  // beside some of them.
  if (pins) {
    // A fixed number from 0 to 1, so the wrecks lie the same way every time.
    const roll = (n: number) => {
      const value = Math.sin(n * 12.9898) * 43758.5453
      return value - Math.floor(value)
    }
    const wrecks = layout.tiles.filter(tile => tile.sunken && !tile.landmark)
    wrecks.forEach((tile, n) => {
      for (let k = 0; k < 2; k++) {
        const seed = n * 7 + k * 3
        const rower = roll(seed * 5) > 0.55
        const [w, h] = rower ? [0.95, 0.42] : [1.15, 0.95]
        const x = tile.center[0] + (roll(seed) - 0.5) * 1.9
        const y = tile.center[1] + (roll(seed + 1) - 0.5) * 1.2
        const tilt = (roll(seed + 2) - 0.5) * 60 + (k === 1 ? 160 : 0)
        const spar =
          roll(seed * 11) > 0.6
            ? `<path d="M${((x + 0.6) * g).toFixed(1)},${((y + 0.12) * g).toFixed(1)}L${((x + 0.9) * g).toFixed(1)},${((y - 0.7) * g).toFixed(1)}" stroke="${PLANK_GAP}" stroke-width="3" stroke-linecap="round"/>`
            : ''
        stand(
          y,
          0,
          `<use href="#${rower ? 'rowboat' : 'sailboat'}" x="${((x - w / 2) * g).toFixed(1)}" y="${((y - h / 2) * g).toFixed(1)}" width="${(w * g).toFixed(1)}" height="${(h * g).toFixed(1)}" transform="rotate(${tilt.toFixed(1)} ${(x * g).toFixed(1)} ${(y * g).toFixed(1)})" opacity="0.8"/>` +
            spar
        )
      }
    })
  }
  // A ship coming in to the harbor, with its wake behind it: among what
  // stands, so that the low land round the bay does not cover its masthead.
  if (pins) {
    for (const [x, y] of layout.arrivals) {
      stand(y, 0, arrivalShipMarkup(x, y, 1.9, g))
    }
    // Boats lying at their moorings about the anchorage.
    for (const boat of layout.moorings) {
      const [w, h] =
        boat.kind === 'rowboat'
          ? [boat.size, boat.size * 0.44]
          : [boat.size, boat.size * 0.82]
      out.push(
        `<use href="#${boat.kind}" x="${((boat.at[0] - w / 2) * g).toFixed(1)}" y="${((boat.at[1] - h / 2) * g).toFixed(1)}" width="${(w * g).toFixed(1)}" height="${(h * g).toFixed(1)}"/>`
      )
    }
    // And ships standing out from the anchorage for the rest of the world,
    // each with its wake angling back to the mouth it came out of.
    for (const ship of layout.departures) {
      stand(
        ship.at[1],
        0,
        departingShipMarkup(ship.at[0], ship.at[1], ship.size, ship.from, g)
      )
    }
  }
  // The compass rose, round the four buttons of map furniture that stand at
  // its points (Merch, Suggest entry and the rest), as the original map
  // draws it.
  const furniture = (pins ?? []).filter(pin => pin.furniture)
  if (layout.compass && furniture.length > 0) {
    const rose = layout.compass
    const x = furniture.reduce((sum, pin) => sum + pin.x, 0) / furniture.length
    const y = furniture.reduce((sum, pin) => sum + pin.y, 0) / furniture.length
    out.push(
      `<use href="#compass" x="${((x - rose.width / 2) * g).toFixed(1)}" y="${((y - rose.height / 2) * g).toFixed(1)}" width="${(rose.width * g).toFixed(1)}" height="${(rose.height * g).toFixed(1)}"/>`
    )
  }
  // Footpaths, over the ground of every level; then the districts' buildings
  // among what stands.
  for (const path of layout.paths) {
    const d = `M${path.points.map(xy).join('L')}`
    out.push(
      `<path d="${d}" fill="none" stroke="${ROAD_PEBBLE}" stroke-width="${(path.width * g + 3).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<path d="${d}" fill="none" stroke="${ROAD}" stroke-width="${(path.width * g).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`
    )
  }
  if (pins) {
    for (const building of layout.buildings) {
      stand(
        building.y,
        building.height,
        buildingMarkup(building.kind, building.x, building.y, building.width, g)
      )
    }
  }
  standing.sort((a, b) => a.depth - b.depth)
  for (const item of standing) out.push(item.markup)

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
