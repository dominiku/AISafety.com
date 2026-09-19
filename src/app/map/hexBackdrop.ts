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
// Pixels of darker bank either side of the water.
const BANK = 3
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

  // A pier out from the harbor where the road ends at the water. (Where the
  // river reaches the coast its water simply ends at the edge of the land.)
  for (const end of layout.ends) {
    if (end.kind !== 'road') continue
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

  // The river and road pieces drawn once a tile is: every bank first, then
  // the water over them all, so that where the river parts no bank crosses
  // the water; then the road over the water.
  const drawPieces = (pieces: HexPathPiece[], id: string) => {
    if (pieces.length === 0) return
    const path = (piece: HexPathPiece, points = piece.points) =>
      `M${points.map(xy).join('L')}${piece.closed ? 'Z' : ''}`
    pieces.forEach((piece, n) => {
      const tops = piece.clip.flatMap(ref => {
        const tile = tileByRef.get(ref)
        return tile && tile.state !== 'sea' ? [outline(tile.top)] : []
      })
      clips.push(
        `<clipPath id="${id}-${n}"><path d="${tops.join('')}"/></clipPath>`
      )
    })
    const stroke = (
      piece: HexPathPiece,
      n: number,
      color: string,
      strokeWidth: number,
      cap: 'butt' | 'round',
      d = path(piece)
    ) =>
      out.push(
        `<path clip-path="url(#${id}-${n})" d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" stroke-linejoin="round" stroke-linecap="${cap}"/>`
      )
    const rivers = pieces.map((piece, n) => ({ piece, n }))
    for (const { piece, n } of rivers) {
      if (piece.kind === 'river') {
        stroke(piece, n, SHALLOWS, piece.width * g + BANK * 2, 'butt')
      }
    }
    for (const { piece, n } of rivers) {
      // A round end runs a little way onto the next tile of the same height,
      // so no seam shows between the two.
      if (piece.kind === 'river')
        stroke(piece, n, WATER, piece.width * g, 'round')
    }
    for (const { piece, n } of rivers) {
      if (piece.kind !== 'river') continue
      // The light streaks the classic map draws on its river.
      const streaks = piece.closed
        ? [beside(piece.points, 0.1, 0.3, 0), beside(piece.points, 0.6, 0.8, 0)]
        : [
            beside(piece.points, 0.12, 0.42, piece.width * 0.2),
            beside(piece.points, 0.55, 0.9, -piece.width * 0.22),
          ]
      for (const streak of streaks) {
        stroke(
          piece,
          n,
          WATER_STREAK,
          piece.width >= 0.6 ? 3 : 2.2,
          'round',
          `M${streak.map(xy).join('L')}`
        )
      }
    }
    for (const { piece, n } of rivers) {
      if (piece.kind !== 'road') continue
      // The classic brown road: one flat brown, with dark pebbles on it.
      stroke(piece, n, ROAD, piece.width * g, 'round')
      out.push(`<g clip-path="url(#${id}-${n})">`)
      alongLine(piece.points).forEach(([x, y], k) => {
        if (k % 2 === 1) return
        const roll = Math.sin((k + piece.points[0][0]) * 12.9898) * 43758.5453
        const side = (roll - Math.floor(roll) - 0.5) * piece.width * g * 0.55
        out.push(
          `<circle cx="${(x * g + side).toFixed(1)}" cy="${(y * g + side * 0.6).toFixed(1)}" r="${k % 3 === 0 ? 3 : 2}" fill="${ROAD_PEBBLE}"/>`
        )
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
    if (!drop.visible) {
      // Going over the far lip: a line of foam along it.
      if (drop.kind === 'river') {
        out.push(
          `<path d="M${at(0.08, 0)}L${at(0.92, 0)}" stroke="${SNOW}" stroke-width="3" stroke-dasharray="5 4" stroke-linecap="round"/>`
        )
      }
      return
    }
    const face = `M${at(0, 0)}L${at(1, 0)}L${at(1, fall)}L${at(0, fall)}Z`
    if (drop.kind === 'road') {
      // The road climbs a face as steps.
      out.push(`<path d="${face}" fill="${ROAD}"/>`)
      for (let down = 4; down < fall; down += 6) {
        out.push(
          `<path d="M${at(0.06, down)}L${at(0.94, down)}" stroke="${ROAD_PEBBLE}" stroke-width="1.6"/>`
        )
      }
      return
    }
    // The falls: the river's water down the face, streaked; foam where it
    // lands, and more of it, with spray, under a large fall.
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
    const drop = tile.height * view.lift
    // Corners run E, SE, SW, W, NW, NE: the faces are E-SE, SE-SW and SW-W.
    ;[0, 1, 2].forEach(k => {
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
      band(Math.max(0, drop - FACE_FOOT), drop, theme.cliff.foot)
      if (k === 0) {
        out.push(
          `<path d="${outline([a, b, [b[0], b[1] + drop], [a[0], a[1] + drop]])}" fill="${LINE}" fill-opacity="${FACE_SHADE}"/>`
        )
      }
    })
    out.push(
      `<path d="${outline(top)}" fill="${tone}" stroke="${tone}" stroke-width="1"/>`
    )
    // The rim: a darker band just inside the sides that are the edge of the
    // tile's district. Tiles of one district run into each other without
    // one. Drawn as one wide line along those sides, the outer half clipped
    // away; round ends close the band where it turns onto the next tile.
    const rim = tile.edges
      .flatMap((edge, k) =>
        edge ? [`M${xy(top[k])}L${xy(top[(k + 1) % top.length])}`] : []
      )
      .join('')
    if (rim) {
      clips.push(
        `<clipPath id="hex-top-${n}"><path d="${outline(top)}"/></clipPath>`
      )
      out.push(
        `<g clip-path="url(#hex-top-${n})" opacity="${RIM_SHADE}"><path d="${rim}" fill="none" stroke="${LINE}" stroke-width="${(RIM_WIDTH * 2 * g).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/></g>`,
        `<path clip-path="url(#hex-top-${n})" d="${rim}" fill="none" stroke="${LINE}" stroke-opacity="${BORDER_LINE.opacity}" stroke-width="${BORDER_LINE.width * 2}" stroke-linecap="round"/>`
      )
    }
  }

  // The details of a realm's country, in the gaps the logos, the river, the
  // road and a landmark leave on a tile.
  const drawCountry = (tile: HexLaidTile, theme: RealmTheme) => {
    if (!pins || !theme.terrain || tile.landmark) return
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

  // A wall of dark peaks along the sides of a tile that are the edge of a
  // walled district: the far sides' behind whatever stands on the tile, the
  // near sides' in front of it.
  const drawWall = (tile: HexLaidTile, sides: number[]) => {
    const poly = (points: Point[], fill: string) =>
      `<path d="M${points.map(xy).join('L')}Z" fill="${fill}"/>`
    for (const k of sides) {
      if (!tile.edges[k]) continue
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
    if (solid) {
      drawSlab(
        tile,
        districtTone(theme.tones[0], tile.tone, tile.tones, turn),
        theme,
        n
      )
    }
    // Corners run E, SE, SW, W, NW, NE: sides 3 to 5 are the far ones.
    if (tile.walled) drawWall(tile, [3, 4, 5])
    drawPieces(
      layout.pieces.filter(piece => piece.tile === tile.ref),
      `hex-path-${n}`
    )
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
    if (solid) drawCountry(tile, theme)
    if (pins) {
      for (const other of layout.tiles) {
        const mark = other.landmark
        if (!mark || mark.after !== tile.ref) continue
        const use = (
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
              use(mark.symbol, -0.7, 0, 1, -28) +
                use(mark.symbol, 0.9, 0.35, 0.7, 152)
            : use(mark.symbol, 0, 0, 1, 0)
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
