// PROTOTYPE Map 3.5, "Hex work" view: the board of hexagonal tiles laid out
// by map-hex-layout.ts, drawn as a strategy board game seen from the south.
// Each tile is a slab in the classic map's palette: a top, and a darker face
// under each of its three sides that look toward the viewer. A district is
// one plateau: its tiles stand at one height and run into each other, and a
// darker rim runs round the district, not round each tile. Tiles stand at different heights and are drawn from
// the back of the board to the front, so a nearer, taller tile covers what is
// behind it.
//
// The colors, the biome tones, the brown road with its pebbles, the streaked
// river, the terrain details and the landmark art are the Art work view's
// (realmArtBackdrop.ts). New here: the slabs, the falls where the river steps
// down toward the viewer, and the castle's moat and mound.
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
  HEX_DIRECTIONS,
  type Point,
} from '@/lib/data/map-hex'
import {
  type HexLaidTile,
  type HexLayout,
  type HexPathPiece,
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
// greens. Every other color of this view is the Art work view's.
const QUIET_THEME: RealmTheme = {
  tones: ['#2f5650'],
  cliff: { lip: '#2f5650', face: '#21463f', foot: '#173633' },
}
// How much darker than its plate a tile's rim is, and its south-east face
// than the other two (the light comes from the west).
const RIM_SHADE = 0.2
const FACE_SHADE = 0.16
// Map grid units the rim reaches in from the edge of a district.
const RIM_WIDTH = 0.3
// Map grid units: the bright lip along the top of a face, and the dark foot
// where it meets the sea.
const FACE_LIP = 0.1
const FACE_FOOT = 0.14
// The castle's mound inside its moat: share of the tile, and levels it rises.
const MOUND = 0.55
const MOUND_RISE = 0.9
// Sea tiles are drawn this far past the board, so zooming out shows no edge.
const SEA_REACH = 6

const themeFor = (realm: string | null) =>
  realm === QUIET_REALM ? QUIET_THEME : themeOf(realm ?? undefined)

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
  const px = ([x, y]: Point) => `${(x * g).toFixed(1)},${(y * g).toFixed(1)}`
  const outline = (polygon: Point[]) => `M${polygon.map(px).join('L')}Z`
  const out: string[] = []

  out.push(
    `<rect x="${-width}" y="${-height}" width="${width * 3}" height="${height * 3}" fill="${SEA}"/>`
  )

  // The sea, tiled like the land: a faint honeycomb, and two rings of
  // shallower water round the island.
  const land = new Set(
    layout.tiles.filter(tile => tile.state !== 'sea').map(tile => hexKey(tile))
  )
  const stepsFromLand = new Map<string, number>()
  let ring = [...land].map(key => {
    const [col, row] = key.split(',').map(Number)
    return { col, row }
  })
  for (const steps of [1, 2]) {
    const next: typeof ring = []
    for (const cell of ring) {
      for (const direction of HEX_DIRECTIONS) {
        const neighbor = hexNeighbor(cell, direction)
        const key = hexKey(neighbor)
        if (land.has(key) || stepsFromLand.has(key)) continue
        stepsFromLand.set(key, steps)
        next.push(neighbor)
      }
    }
    ring = next
  }
  for (let col = -SEA_REACH; col < layout.columns + SEA_REACH; col++) {
    for (let row = -SEA_REACH; row < layout.rows + SEA_REACH; row++) {
      const key = hexKey({ col, row })
      if (land.has(key)) continue
      const steps = stepsFromLand.get(key)
      const hexagon = hexCorners({ col, row }, view.size, 0.95).map(corner =>
        projectPoint(view, corner, 0)
      )
      out.push(
        `<path d="${outline(hexagon)}" fill="${steps === 1 ? SHELF_INNER : steps === 2 ? SHELF_OUTER : 'none'}" stroke="${SHELF_OUTER}" stroke-width="2"/>`
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

  const drawPiece = (piece: HexPathPiece) => {
    const d = `M${piece.points.map(px).join('L')}${piece.closed ? 'Z' : ''}`
    const stroke = (color: string, strokeWidth: number, extra = '') =>
      out.push(
        `<path d="${d}" fill="none" stroke="${color}" stroke-width="${strokeWidth.toFixed(1)}" stroke-linejoin="round"${extra}/>`
      )
    if (piece.kind === 'river') {
      // A darker bank, so the water shows on the delta's pale green too.
      stroke(LINE, piece.width * g + 7, ' stroke-opacity="0.28"')
      stroke(WATER, piece.width * g)
      // The light streaks the classic map draws on its river.
      stroke(
        WATER_STREAK,
        piece.width >= 0.4 ? 3.2 : 2.5,
        ' stroke-dasharray="22 46" stroke-linecap="round"'
      )
      return
    }
    // The classic brown road: one flat brown, with dark pebbles strewn on it.
    stroke(ROAD, piece.width * g)
    alongLine(piece.points).forEach(([x, y], n) => {
      if (n % 2 === 1) return
      const roll = Math.sin((n + piece.points[0][0]) * 12.9898) * 43758.5453
      const side = (roll - Math.floor(roll) - 0.5) * piece.width * g * 0.55
      out.push(
        `<circle cx="${(x * g + side).toFixed(1)}" cy="${(y * g + side * 0.6).toFixed(1)}" r="${n % 3 === 0 ? 3.2 : 2.2}" fill="${ROAD_PEBBLE}"/>`
      )
    })
    if (piece.bridge) {
      const planks = `M${piece.bridge.map(px).join('L')}`
      out.push(
        `<path d="${planks}" fill="none" stroke="${PLANK_GAP}" stroke-width="${(piece.width * g * 1.15).toFixed(1)}"/>`,
        `<path d="${planks}" fill="none" stroke="${PLANK}" stroke-width="${(piece.width * g * 1.15).toFixed(1)}" stroke-dasharray="7 3"/>`
      )
    }
  }

  // A slab: faces under the three sides toward the viewer, down to the sea
  // (nearer tiles cover what of them is out of sight), then the top.
  const drawSlab = (
    top: Point[],
    level: number,
    tone: string,
    cliff: RealmTheme['cliff'],
    // Which sides (from corner n to corner n + 1) carry the darker rim, and
    // the clip that keeps it on the top.
    edges: boolean[],
    clip: string
  ) => {
    const drop = level * view.lift
    // Corners run E, SE, SW, W, NW, NE: the faces are E-SE, SE-SW and SW-W.
    ;[0, 1, 2].forEach(n => {
      const [a, b] = [top[n], top[n + 1]]
      const band = (from: number, to: number, color: string) =>
        out.push(
          `<path d="${outline([
            [a[0], a[1] + from],
            [b[0], b[1] + from],
            [b[0], b[1] + to],
            [a[0], a[1] + to],
          ])}" fill="${color}" stroke="${color}" stroke-width="1"/>`
        )
      band(0, drop, cliff.face)
      band(0, Math.min(FACE_LIP, drop), cliff.lip)
      band(Math.max(0, drop - FACE_FOOT), drop, cliff.foot)
      if (n === 0) {
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
    const rim = edges
      .flatMap((edge, n) =>
        edge ? [`M${px(top[n])}L${px(top[(n + 1) % top.length])}`] : []
      )
      .join('')
    if (rim) {
      out.push(
        `<g clip-path="url(#${clip})" opacity="${RIM_SHADE}"><path d="${rim}" fill="none" stroke="${LINE}" stroke-width="${(RIM_WIDTH * 2 * g).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/></g>`
      )
    }
  }

  const clips: string[] = []
  layout.tiles.forEach((tile, n) => {
    if (tile.state === 'sea') return
    if (tile.state === 'water') {
      out.push(
        `<path d="${outline(tile.top)}" fill="${SHALLOWS}" stroke="${SHELF_INNER}" stroke-width="3"/>`
      )
    } else {
      const theme = themeFor(tile.realm)
      clips.push(
        `<clipPath id="hex-top-${n}"><path d="${outline(tile.top)}"/></clipPath>`
      )
      drawSlab(
        tile.top,
        tile.height,
        theme.tones[tile.tone % theme.tones.length],
        theme.cliff,
        tile.edges,
        `hex-top-${n}`
      )
      drawGround(tile, n, theme)
    }
    const mark = tile.landmark
    if (mark && pins) {
      out.push(
        `<use href="#${mark.symbol}" x="${((mark.x - mark.width / 2) * g).toFixed(1)}" y="${((mark.y - mark.height / 2) * g).toFixed(1)}" width="${(mark.width * g).toFixed(1)}" height="${(mark.height * g).toFixed(1)}"/>`
      )
    }
  })

  // What lies on a tile's top: the river and the road, the falls on its
  // faces, the castle's mound, and the details of its realm's country.
  function drawGround(tile: HexLaidTile, n: number, theme: RealmTheme) {
    const pieces = layout.pieces.filter(piece => piece.tile === tile.ref)
    if (pieces.length > 0) {
      out.push(`<g clip-path="url(#hex-top-${n})">`)
      // Water under the road, so a bridge lies over its river.
      for (const piece of pieces) if (piece.kind === 'river') drawPiece(piece)
      for (const piece of pieces) if (piece.kind === 'road') drawPiece(piece)
      out.push('</g>')
    }
    for (const drop of layout.drops.filter(d => d.tile === tile.ref)) {
      const half = (drop.width * g) / 2
      const [x, top] = [drop.top[0] * g, drop.top[1] * g]
      const bottom = drop.bottom[1] * g
      if (drop.kind === 'river') {
        // The falls: the river's water down the face, streaked, with foam
        // where it lands.
        out.push(
          `<rect x="${(x - half).toFixed(1)}" y="${top.toFixed(1)}" width="${(half * 2).toFixed(1)}" height="${(bottom - top).toFixed(1)}" fill="${WATER}"/>`
        )
        for (const share of [-0.5, 0, 0.5]) {
          out.push(
            `<path d="M${(x + share * half).toFixed(1)},${(top + 2).toFixed(1)}V${(bottom - 3).toFixed(1)}" stroke="${WATER_STREAK}" stroke-width="2.5" stroke-dasharray="${9 + share * 6} 7" stroke-linecap="round"/>`
          )
        }
        for (const [dx, r] of [
          [-0.9, 4.5],
          [-0.3, 6],
          [0.35, 5.5],
          [0.9, 4],
        ]) {
          out.push(
            `<circle cx="${(x + dx * half).toFixed(1)}" cy="${bottom.toFixed(1)}" r="${r}" fill="${SNOW}"/>`
          )
        }
      } else {
        // The road climbs a face as steps.
        out.push(
          `<rect x="${(x - half).toFixed(1)}" y="${top.toFixed(1)}" width="${(half * 2).toFixed(1)}" height="${(bottom - top).toFixed(1)}" fill="${ROAD}"/>`,
          `<path d="M${x.toFixed(1)},${top.toFixed(1)}V${bottom.toFixed(1)}" stroke="${ROAD_PEBBLE}" stroke-width="${(half * 2).toFixed(1)}" stroke-dasharray="2 5"/>`
        )
      }
    }

    // The castle's mound, inside the ring of its moat.
    const moated = pieces.some(piece => piece.closed)
    if (moated) {
      const mound = hexCorners(tile, view.size, MOUND).map(corner =>
        projectPoint(view, corner, tile.height + MOUND_RISE)
      )
      // Only its own rise shows: its faces stop at the tile's top.
      const rise = MOUND_RISE * view.lift
      ;[0, 1, 2].forEach(k => {
        const [a, b] = [mound[k], mound[k + 1]]
        out.push(
          `<path d="${outline([a, b, [b[0], b[1] + rise], [a[0], a[1] + rise]])}" fill="${theme.cliff.face}" stroke="${theme.cliff.face}" stroke-width="1"/>`
        )
      })
      out.push(
        `<path d="${outline(mound)}" fill="${theme.tones[tile.tone % theme.tones.length]}"/>`
      )
    }

    if (!pins || !theme.terrain || tile.landmark?.logos === 'none' || moated) {
      return
    }
    const ground = insetConvex(
      tile.top,
      tile.top.map(() => 0.25)
    )
    const inTile = (x: number, y: number) => insideConvex([x, y], ground)
    const xs = tile.top.map(p => p[0])
    const ys = tile.top.map(p => p[1])
    const near = (pin: { x: number; y: number }) =>
      pin.x > Math.min(...xs) - 2 &&
      pin.x < Math.max(...xs) + 2 &&
      pin.y > Math.min(...ys) - 2 &&
      pin.y < Math.max(...ys) + 2
    const fixed = [
      ...(tile.landmark
        ? [
            {
              x: tile.landmark.x,
              y: tile.landmark.y,
              radius: Math.max(tile.landmark.width, tile.landmark.height) * 0.4,
            },
          ]
        : []),
      ...pieces
        .flatMap(piece => alongLine(piece.points))
        .map(([x, y]) => ({ x, y, radius: 0.6 })),
    ]
    const logos = pins.filter(near)
    const extent = { width: width / g, height: height / g }
    const backRow = BACK_ROW[theme.terrain]
    const spots = [
      // A back row the logos are drawn over (see realmArtBackdrop.ts).
      ...(backRow ? scatterSpots(inTile, fixed, extent, backRow) : []),
      ...scatterSpots(
        inTile,
        [...logos, ...fixed],
        extent,
        TERRAIN_SCATTER[theme.terrain]
      ),
    ].sort((a, b) => a.y - b.y)
    for (const spot of spots) out.push(terrainDetail(theme, spot, g, true))
  }

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
