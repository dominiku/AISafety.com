// PROTOTYPE Map 3.5, "Art work" view: the computed realm and district layout
// (the same one the schematic in realmBackdrop.ts draws) redrawn in the hand
// of the classic island art, to try that style on the new geography. The
// island is all drawn from the layout; only the landmarks are the old art.
//
// What is taken from the classic map: a dark sea with a lighter shelf around
// the island; a faceted coast with eased corners; the island seen from the
// south, so every south-facing shore drops a cliff face to the water; green
// land whose regions differ in tone and are parted by thin dark lines, not by
// colored fills; a brown dirt road. Each realm is a country of its own kind,
// after its proposed name: the Support Shoreline is sand and beach with boats
// off it, the Training Trail green country along the road, the Discourse
// Delta wet lowland with a river fanning out to the sea, the Policy Plains
// open grass, the Research Range rock with mountains throughout, in whatever
// gaps the org logos leave. Over that stand the classic map's own landmarks (the
// castle, the town, the forests and the rest), each in its new district: see
// map-art-landmarks.ts.
//
// The drawing is built as SVG markup (artBackdropMarkup) so it can be looked
// at outside the browser too; drawRealmArtBackdrop puts it on the map.

import * as d3 from 'd3'
import {
  cliffFaces,
  coastStretches,
  deltaChannels,
  roundCorners,
} from '@/lib/data/map-art-geometry'
import {
  MAP_35_ART_LANDMARKS,
  placeLandmarks,
  type PlacedLandmark,
} from '@/lib/data/map-art-landmarks'
import { scatterSpots, type ScatterSpot } from '@/lib/data/map-art-scatter'
import type { Point } from '@/lib/data/map-realm-layout'
import type { RealmBackdrop } from './realmBackdrop'

// DESIGN REVIEW (Melissa): every color of this view is in this one block.
// They are the classic map's own palette (public/images/map-1.5.1.svg), held
// here as placeholders the way realmBackdrop.ts holds the schematic's.
const SEA = '#112928'
const SHELF_OUTER = '#173633'
const SHELF_INNER = '#21463f'
const SHALLOWS = '#2f5650'
const LINE = '#112928'
const ROAD = '#972f00'
const ROAD_EDGE = '#571f02'
const FOOTPATH = '#ffd1bc'
const WATER = '#7dd5c2'
const PLANK = '#972f00'
const PLANK_GAP = '#571f02'
const SAND = '#ffd1bc'
const SNOW = '#f6fbff'
const CLIFF_ROCK = { lip: '#ff4b00', face: '#d53d00', foot: '#972f00' }
const CLIFF_SAND = { lip: '#ffa777', face: '#ff7c25', foot: '#d53d00' }
const CLIFF_EARTH = { lip: '#00ae85', face: '#008969', foot: '#2f5650' }
const MOUNTAIN_LIT = ['#ffa777', '#ffd1bc', '#7dd5c2']
const MOUNTAIN_SHADE = '#972f00'
const SHORE_DETAIL = '#d53d00'
const STARFISH = '#ff4b00'

// DESIGN DECISION, for review: each realm is a country of its own kind, told
// apart by its ground, its shore and what grows or stands on it, after the
// proposed realm names. Matched on the first word of the realm's name.
type Terrain = 'shore' | 'trail' | 'delta' | 'plains' | 'range'
interface RealmTheme {
  ground: string
  cliff: { lip: string; face: string; foot: string }
  // A strip of sand just inside the realm's shore.
  beach?: boolean
  terrain?: Terrain
  // Grass and reeds, where the terrain has them.
  growth?: string
}
const REALM_THEMES: Record<string, RealmTheme> = {
  // Support Shoreline
  field: {
    ground: '#ffa777',
    cliff: CLIFF_SAND,
    beach: true,
    terrain: 'shore',
  },
  // Training Trail
  talent: {
    ground: '#00ae85',
    cliff: CLIFF_EARTH,
    terrain: 'trail',
    growth: '#008969',
  },
  // Discourse Delta
  media: {
    ground: '#008969',
    cliff: CLIFF_EARTH,
    beach: true,
    terrain: 'delta',
    growth: '#2dc2a4',
  },
  // Advocacy Anchorage
  advocacy: { ground: '#ffd1bc', cliff: CLIFF_SAND },
  // Policy Plains
  policy: {
    ground: '#2dc2a4',
    cliff: CLIFF_EARTH,
    terrain: 'plains',
    growth: '#008969',
  },
  // Research Range
  technical: { ground: '#ff7c25', cliff: CLIFF_ROCK, terrain: 'range' },
}
const SPARE_THEME: RealmTheme = { ground: '#00ae85', cliff: CLIFF_EARTH }
// How thickly each terrain is strewn, in grid units (see scatterSpots).
const TERRAIN_SCATTER: Record<Terrain, Parameters<typeof scatterSpots>[3]> = {
  shore: { spacing: 1.25, minRoom: 0.3, maxRoom: 1 },
  trail: { spacing: 2.1, minRoom: 0.45, maxRoom: 1 },
  delta: { spacing: 1.8, minRoom: 0.3, maxRoom: 1 },
  plains: { spacing: 1.5, minRoom: 0.3, maxRoom: 1 },
  range: { spacing: 1.5, minRoom: 0.35, maxRoom: 1.3 },
}
// A range is mountainous throughout: behind the peaks that fill the gaps
// stands a row of larger ones, which the logos are drawn over.
const RANGE_BACKDROP = { spacing: 2.7, minRoom: 0.9, maxRoom: 1.15 }
// Districts of one realm step through these tints over the realm's ground.
const DISTRICT_TINTS = [
  { color: '#000', opacity: 0 },
  { color: '#000', opacity: 0.08 },
  { color: '#fff', opacity: 0.1 },
]

// Grid units.
const CORNER_RADIUS = 0.7
const CLIFF_HEIGHT = 0.95
const BEACH_WIDTH = 0.9
const PIER_LENGTH = 1.7

// The map's frame, in grid units.
const FRAME = { width: 60, height: 32.7 }
// The classic art, one <symbol> per landmark (see map-art-landmarks.ts).
const LANDMARKS_URL = '/images/map35-landmarks.svg'
// Grid units: landmarks that stand at a fixed place, not in a district.
const DAM = { width: 2.2, height: 2 }
const LIGHTHOUSE = { width: 1.2, height: 2.2 }
const BOATS = { width: 5.1, height: 1.9 }
const SAILBOAT = { width: 1.6, height: 1.3 }
const ROWBOAT = { width: 1.3, height: 0.6 }
const TREE = { width: 0.5, height: 1 }
const GRAVESTONES = { width: 9.6, height: 4.6 }
const COMPASS = { width: 5.2, height: 5.3 }

// What is drawn over the backdrop, so landmarks can keep out from under it.
// Map furniture is the parts of the compass.
export interface ArtPin {
  x: number
  y: number
  // Grid units the logo reaches from its middle.
  radius: number
  furniture: boolean
}

const realmKey = (realm: string) => realm.split(' ')[0].toLowerCase()
const themeOf = (realm: string | undefined) =>
  (realm && REALM_THEMES[realmKey(realm)]) || SPARE_THEME
const middle = (points: { x: number; y: number }[]) => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
})

// Every landmark's place: those of the districts, then the fixed ones.
function landmarksFor(layout: RealmBackdrop, pins: ArtPin[]) {
  const [damX, damY] = layout.landmarks.controlDam
  const onLand = pins.filter(pin => layout.districtAt(pin.x, pin.y) !== null)
  const atSea = pins.filter(pin => layout.districtAt(pin.x, pin.y) === null)
  const placed: PlacedLandmark[] = placeLandmarks(
    MAP_35_ART_LANDMARKS,
    layout.districtAt,
    onLand,
    FRAME,
    [{ x: damX, y: damY, radius: 2.5 }]
  )
  placed.push({ symbol: 'dam', x: damX, y: damY, ...DAM })

  const [harbourX, harbourY] = layout.landmarks.arrivalHarbour
  placed.push({
    symbol: 'lighthouse',
    x: harbourX + 0.6,
    y: harbourY - 1.2 - LIGHTHOUSE.height / 2,
    ...LIGHTHOUSE,
  })
  if (layout.cove.length > 0) {
    placed.push({
      symbol: 'boats',
      x: layout.cove.reduce((sum, p) => sum + p[0], 0) / layout.cove.length,
      y: Math.max(...layout.cove.map(p => p[1])) - 2.2,
      ...BOATS,
    })
  }
  // Off the land there are the closed orgs, in their graveyard, and the
  // compass's parts.
  const closed = atSea.filter(pin => !pin.furniture)
  const furniture = atSea.filter(pin => pin.furniture)
  if (closed.length > 0) {
    placed.push({ symbol: 'gravestones', ...middle(closed), ...GRAVESTONES })
  }
  if (furniture.length > 0) {
    placed.push({ symbol: 'compass', ...middle(furniture), ...COMPASS })
  }
  return placed
}

// Points no more than half a grid unit apart along a line of straight
// stretches.
function alongLine(line: Point[]): Point[] {
  const points: Point[] = []
  for (let i = 0; i + 1 < line.length; i++) {
    const [ax, ay] = line[i]
    const [bx, by] = line[i + 1]
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5))
    for (let s = 0; s < steps; s++) {
      points.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps])
    }
  }
  if (line.length > 0) points.push(line[line.length - 1])
  return points
}

// One detail of a realm's terrain at a spot, sized to the room it has.
function terrainDetail(
  theme: RealmTheme,
  spot: ScatterSpot,
  g: number,
  withSymbols: boolean
): string {
  const x = spot.x * g
  const y = spot.y * g
  const poly = (points: number[][], fill: string) =>
    `<path d="M${points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z" fill="${fill}"/>`
  // A faceted peak in the classic map's hand: a lit face, a shaded one, and
  // snow on the tall ones.
  const peak = (w: number, lit: string, shade: string, snow: boolean) => {
    const h = w * 0.85
    const base = y + h / 2
    const top = [x - w * 0.05, base - h]
    const fold = [x + w * 0.12, base]
    const parts = [
      poly([[x - w / 2, base], top, fold], lit),
      poly([top, [x + w / 2, base], fold], shade),
    ]
    if (snow) {
      const at = (toward: number[]) => [
        top[0] + (toward[0] - top[0]) * 0.28,
        top[1] + (toward[1] - top[1]) * 0.28,
      ]
      parts.push(poly([top, at([x - w / 2, base]), at(fold)], SNOW))
    }
    return parts.join('')
  }
  const tuft = (color: string) =>
    `<path d="M${x - 4},${y}L${x - 7},${y - 9}M${x},${y}L${x},${y - 12}M${x + 4},${y}L${x + 7},${y - 9}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`
  const tree = () => {
    const scale = Math.min(1, spot.room / 0.6)
    const w = TREE.width * scale * g
    const h = TREE.height * scale * g
    return `<use href="#tree" x="${(x - w / 2).toFixed(1)}" y="${(y - h / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`
  }
  const growth = theme.growth ?? SHORE_DETAIL

  switch (theme.terrain) {
    case 'range': {
      const lit = MOUNTAIN_LIT[Math.floor(spot.roll * MOUNTAIN_LIT.length)]
      return peak(spot.room * 1.9 * g, lit, MOUNTAIN_SHADE, spot.room > 0.85)
    }
    case 'shore': {
      if (spot.roll < 0.3) {
        const points = Array.from({ length: 10 }, (_, i) => {
          const r = (i % 2 === 0 ? 0.3 : 0.12) * g
          const a = (i * Math.PI) / 5 + spot.roll * 6
          return [x + r * Math.sin(a), y - r * Math.cos(a)]
        })
        return poly(points, STARFISH)
      }
      if (spot.roll < 0.6) {
        return peak(0.6 * g, SHORE_DETAIL, MOUNTAIN_SHADE, false)
      }
      if (spot.roll > 0.85 && withSymbols && spot.room > 0.5) return tree()
      return [-6, 1, 7]
        .map(
          (dx, i) =>
            `<circle cx="${x + dx}" cy="${y + (i - 1) * 4}" r="${2 + i * 0.5}" fill="${SHORE_DETAIL}" fill-opacity="0.7"/>`
        )
        .join('')
    }
    case 'trail':
      return spot.roll < 0.55 && withSymbols ? tree() : tuft(growth)
    case 'plains':
      return spot.roll > 0.88 && withSymbols && spot.room > 0.5
        ? tree()
        : tuft(growth)
    case 'delta':
      return spot.roll > 0.85
        ? peak(0.45 * g, WATER, SHALLOWS, false)
        : tuft(growth)
    default:
      return ''
  }
}

export function artBackdropMarkup(
  layout: RealmBackdrop,
  gridSize: number,
  width: number,
  height: number,
  // With pins, the classic landmarks are drawn too, as <use> of the symbols
  // in LANDMARKS_URL, which have to be in the same document.
  pins?: ArtPin[]
): string {
  const g = gridSize
  const px = ([x, y]: Point) => `${(x * g).toFixed(1)},${(y * g).toFixed(1)}`
  const outline = (polygon: Point[]) => `M${polygon.map(px).join('L')}Z`
  const curve = d3
    .line<Point>()
    .x(p => p[0] * g)
    .y(p => p[1] * g)
    .curve(d3.curveCatmullRom.alpha(0.5))

  const coast = roundCorners(layout.coast, CORNER_RADIUS)
  const cove = roundCorners(layout.cove, CORNER_RADIUS)
  const coastPath = outline(coast)
  const realmOfDistrict = new Map(
    layout.districts.map(d => [d.district, d.realm])
  )
  const realmAt = (x: number, y: number) => {
    const district = layout.districtAt(x, y)
    return district === null ? undefined : realmOfDistrict.get(district)
  }
  const landmarks = pins ? landmarksFor(layout, pins) : []
  // A delta realm's river: from the spot in the realm farthest from the sea,
  // out to four mouths spread along the realm's coast.
  const rivers = new Map<string, Point[][]>()
  const riverOf = (realm: string) => {
    const known = rivers.get(realm)
    if (known) return known
    const shore = coastStretches(coast)
      .filter(
        ({ middle, outward }) =>
          realmAt(middle[0] - outward[0], middle[1] - outward[1]) === realm
      )
      .sort((a, b) => a.middle[0] - b.middle[0])
    const mouths = [0.12, 0.38, 0.64, 0.9].flatMap(share => {
      const stretch = shore[Math.floor(share * shore.length)]
      return stretch ? [stretch.middle] : []
    })
    let source: Point | null = null
    let farthest = 0
    for (let x = 0; x <= FRAME.width; x += 0.5) {
      for (let y = 0; y <= FRAME.height; y += 0.5) {
        if (realmAt(x, y) !== realm) continue
        let toSea = Infinity
        for (const [cx, cy] of layout.coast) {
          toSea = Math.min(toSea, Math.hypot(cx - x, cy - y))
        }
        if (toSea > farthest) {
          farthest = toSea
          source = [x, y]
        }
      }
    }
    const river = source ? deltaChannels(source, mouths) : []
    rivers.set(realm, river)
    return river
  }

  const out: string[] = []
  out.push('<defs>')
  out.push(`<clipPath id="art-coast"><path d="${coastPath}"/></clipPath>`)
  layout.realms.forEach((realm, i) => {
    out.push(
      `<clipPath id="art-realm-${i}"><path d="${outline(realm.polygon)}"/></clipPath>`
    )
  })
  out.push('</defs>')

  // The sea runs well past the frame so zooming out never shows its edge.
  out.push(
    `<rect x="${-width}" y="${-height}" width="${width * 3}" height="${height * 3}" fill="${SEA}"/>`
  )

  // The shelf: two rings of shallower water around the island and the foot of
  // its cliffs.
  const foot = outline(coast.map(([x, y]): Point => [x, y + CLIFF_HEIGHT]))
  for (const [color, reach] of [
    [SHELF_OUTER, 2.6],
    [SHELF_INNER, 1.3],
  ] as const) {
    out.push(
      `<path d="${coastPath}${foot}" fill="${color}" stroke="${color}" stroke-width="${reach * 2 * g}" stroke-linejoin="round"/>`
    )
  }

  // Cliff faces, under the land: rock below the research country, sand below
  // the shoreline, dark earth elsewhere. Each is a lip, a face and a darker foot.
  for (const face of cliffFaces(coast, CLIFF_HEIGHT)) {
    const tones = themeOf(realmAt(face.inland[0], face.inland[1])).cliff
    const [a, b] = face.quad
    const band = (from: number, to: number, color: string) =>
      out.push(
        `<path d="${outline([
          [a[0], a[1] + CLIFF_HEIGHT * from],
          [b[0], b[1] + CLIFF_HEIGHT * from],
          [b[0], b[1] + CLIFF_HEIGHT * to],
          [a[0], a[1] + CLIFF_HEIGHT * to],
        ])}" fill="${color}" stroke="${color}" stroke-width="1"/>`
      )
    band(0, 1, tones.face)
    band(0, 0.22, tones.lip)
    band(0.72, 1, tones.foot)
  }

  // The land: each realm's ground, its districts as tones of it.
  out.push(`<path d="${coastPath}" fill="${SPARE_THEME.ground}"/>`)
  layout.realms.forEach((realm, i) => {
    const theme = themeOf(realm.realm)
    const ground = theme.ground
    out.push(
      `<g clip-path="url(#art-coast)"><g clip-path="url(#art-realm-${i})">`
    )
    // Towns lie over the open districts around them.
    const districts = layout.districts
      .filter(d => d.realm === realm.realm)
      .sort((a, b) => Number(a.block) - Number(b.block))
    districts.forEach((district, n) => {
      const d = district.pieces.map(outline).join('')
      const tint = DISTRICT_TINTS[n % DISTRICT_TINTS.length]
      out.push(`<path d="${d}" fill="${ground}"/>`)
      out.push(
        `<path d="${d}" fill="${tint.color}" fill-opacity="${tint.opacity}" stroke="${LINE}" stroke-opacity="0.35" stroke-width="3" stroke-linejoin="round"/>`
      )
    })
    // The beach: a strip of sand just inside the realm's shore.
    if (theme.beach) {
      out.push(
        `<path d="${coastPath}" fill="none" stroke="${SAND}" stroke-width="${BEACH_WIDTH * 2 * g}" stroke-linejoin="round"/>`
      )
    }
    // The delta's river, over the beach so its mouths cut through the sand.
    if (theme.terrain === 'delta') {
      for (const [n, channel] of riverOf(realm.realm).entries()) {
        out.push(
          `<path d="${curve(channel)}" fill="none" stroke="${WATER}" stroke-width="${n === 0 ? 15 : 11}" stroke-linecap="round"/>`
        )
      }
    }
    out.push('</g></g>')
  })

  // Realm borders, a little heavier than the district ones.
  out.push('<g clip-path="url(#art-coast)">')
  for (const realm of layout.realms) {
    out.push(
      `<path d="${outline(realm.polygon)}" fill="none" stroke="${LINE}" stroke-opacity="0.5" stroke-width="4" stroke-linejoin="round"/>`
    )
  }
  // The cove is water inside the coast, drawn over the land; its shallows
  // run into the shelf across its mouth.
  if (cove.length > 0) {
    out.push(
      `<path d="${outline(cove)}" fill="${SHELF_INNER}" stroke="${SHALLOWS}" stroke-width="${0.5 * g}" stroke-linejoin="round"/>`
    )
  }
  out.push('</g>')

  // What each realm's country is strewn with, in the gaps the logos, the
  // landmarks, the road and the river leave. The footpaths run over it.
  const taken = [
    ...(pins ?? []).map(pin => ({ x: pin.x, y: pin.y, radius: pin.radius })),
    ...landmarks.map(mark => ({
      x: mark.x,
      y: mark.y,
      radius: Math.max(mark.width, mark.height) * 0.4,
    })),
    ...layout.roads.flatMap(alongLine).map(([x, y]) => ({ x, y, radius: 0.7 })),
  ]
  for (const realm of layout.realms) {
    const theme = themeOf(realm.realm)
    if (!theme.terrain) continue
    const river =
      theme.terrain === 'delta'
        ? riverOf(realm.realm)
            .flatMap(alongLine)
            .map(([x, y]) => ({ x, y, radius: 0.6 }))
        : []
    const inRealm = (x: number, y: number) => realmAt(x, y) === realm.realm
    const behind =
      theme.terrain === 'range'
        ? scatterSpots(
            inRealm,
            taken.slice(pins?.length ?? 0),
            FRAME,
            RANGE_BACKDROP
          )
        : []
    const spots = [
      ...behind,
      ...scatterSpots(
        inRealm,
        [...taken, ...river],
        FRAME,
        TERRAIN_SCATTER[theme.terrain]
      ),
    ].sort((a, b) => a.y - b.y)
    for (const spot of spots) {
      out.push(terrainDetail(theme, spot, g, pins !== undefined))
    }
  }

  // Sandy footpaths under a brown dirt road with darker verges.
  for (const trail of layout.trails) {
    out.push(
      `<path d="${curve(trail)}" fill="none" stroke="${FOOTPATH}" stroke-width="7" stroke-dasharray="16 12" stroke-linecap="round"/>`
    )
  }
  for (const road of layout.roads) {
    out.push(
      `<path d="${curve(road)}" fill="none" stroke="${ROAD_EDGE}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`,
      `<path d="${curve(road)}" fill="none" stroke="${ROAD}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>`
    )
  }

  // Planks: the boardwalk to the cove, and a pier out from the arrival
  // harbour.
  const planks = (line: Point[]) => {
    const d = `M${line.map(px).join('L')}`
    out.push(
      `<path d="${d}" fill="none" stroke="${PLANK_GAP}" stroke-width="16"/>`,
      `<path d="${d}" fill="none" stroke="${PLANK}" stroke-width="16" stroke-dasharray="7 3"/>`
    )
  }
  if (layout.boardwalk.length > 1) planks(layout.boardwalk)
  const [hx, hy] = layout.landmarks.arrivalHarbour
  planks([
    [hx + 0.3, hy],
    [hx - PIER_LENGTH, hy],
  ])

  if (pins) {
    // Boats off the shoreline realm's coast: sailboats standing off, rowboats
    // close in.
    const shore = coastStretches(coast)
      .filter(({ middle, outward }) => {
        const behind = realmAt(middle[0] - outward[0], middle[1] - outward[1])
        return (
          behind !== undefined &&
          themeOf(behind).terrain === 'shore' &&
          // Not under a cliff face.
          outward[1] < 0.3
        )
      })
      .sort((a, b) => a.middle[0] - b.middle[0])
    const offShore = (share: number, reach: number): Point | null => {
      const stretch = shore[Math.floor(share * shore.length)]
      return stretch
        ? [
            stretch.middle[0] + stretch.outward[0] * reach,
            stretch.middle[1] + stretch.outward[1] * reach,
          ]
        : null
    }
    for (const [symbol, size, reach, shares] of [
      ['sailboat', SAILBOAT, 1.9, [0.22, 0.5, 0.8]],
      ['rowboat', ROWBOAT, 0.9, [0.36, 0.66]],
    ] as const) {
      for (const share of shares) {
        const at = offShore(share, reach)
        if (at) landmarks.push({ symbol, x: at[0], y: at[1], ...size })
      }
    }
    for (const mark of landmarks) {
      out.push(
        `<use href="#${mark.symbol}" x="${((mark.x - mark.width / 2) * g).toFixed(1)}" y="${((mark.y - mark.height / 2) * g).toFixed(1)}" width="${(mark.width * g).toFixed(1)}" height="${(mark.height * g).toFixed(1)}"/>`
      )
    }
  }

  return out.join('')
}

export function drawRealmArtBackdrop(
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  layout: RealmBackdrop,
  gridSize: number,
  width: number,
  height: number,
  pins: ArtPin[]
) {
  const backdrop = group.append('g')
  backdrop.html(artBackdropMarkup(layout, gridSize, width, height, pins))
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
