// PROTOTYPE Map 3.5, "Art work" view: the computed realm and district layout
// (the same one the schematic in realmBackdrop.ts draws) redrawn in the hand
// of the classic island art, to try that style on the new geography. The
// island is all drawn from the layout; only the landmarks are the old art.
//
// What is taken from the classic map: a dark sea with a lighter shelf around
// the island; a faceted coast with eased corners; the island seen from the
// south, so every south-facing shore drops a cliff face to the water; green
// land whose regions differ in tone and are parted by thin dark lines, not by
// colored fills; orange rock in the research country and sand on the beaches;
// pale teal roads. Over that stand the classic map's own landmarks (the
// castle, the town, the forests and the rest), each in its new district: see
// map-art-landmarks.ts.
//
// The drawing is built as SVG markup (artBackdropMarkup) so it can be looked
// at outside the browser too; drawRealmArtBackdrop puts it on the map.

import * as d3 from 'd3'
import { cliffFaces, roundCorners } from '@/lib/data/map-art-geometry'
import {
  MAP_35_ART_LANDMARKS,
  placeLandmarks,
  type PlacedLandmark,
} from '@/lib/data/map-art-landmarks'
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
const ROAD = '#7dd5c2'
const FOOTPATH = '#bbe8e1'
const PLANK = '#972f00'
const PLANK_GAP = '#571f02'
const SAND = '#ffd1bc'
const CLIFF_ROCK = { lip: '#ff4b00', face: '#d53d00', foot: '#972f00' }
const CLIFF_SAND = { lip: '#ffa777', face: '#ff7c25', foot: '#d53d00' }
const CLIFF_EARTH = { lip: '#00ae85', face: '#008969', foot: '#2f5650' }
// DESIGN DECISION, for review: realms are told apart by the ground itself, as
// the classic map tells Research Range (orange rock) from the green country
// and Blog Beach (sand). Matched on the first word of the realm's name.
const REALM_GROUND: Record<string, string> = {
  field: '#008969',
  talent: '#00ae85',
  policy: '#2dc2a4',
  media: '#ffa777',
  advocacy: '#ffd1bc',
  technical: '#ff7c25',
}
const SPARE_GROUND = '#00ae85'
// Realms whose south shore is rock rather than earth, and those with a beach.
const ROCK_REALMS = new Set(['technical'])
const BEACH_REALMS = new Set(['media'])
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
const GRAVESTONES = { width: 9.6, height: 4.6 }
const COMPASS = { width: 5.2, height: 5.3 }

// What is drawn over the backdrop, so landmarks can keep out from under it.
// Map furniture is the parts of the compass.
export interface ArtPin {
  x: number
  y: number
  furniture: boolean
}

const realmKey = (realm: string) => realm.split(' ')[0].toLowerCase()
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

  // Cliff faces, under the land: rock below the research country, dark earth
  // elsewhere. Each is a lip, a face and a darker foot.
  for (const face of cliffFaces(coast, CLIFF_HEIGHT)) {
    const district = layout.districtAt(face.inland[0], face.inland[1])
    const realm = district ? realmOfDistrict.get(district) : undefined
    const key = realm ? realmKey(realm) : ''
    const tones = ROCK_REALMS.has(key)
      ? CLIFF_ROCK
      : BEACH_REALMS.has(key)
        ? CLIFF_SAND
        : CLIFF_EARTH
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
  out.push(`<path d="${coastPath}" fill="${SPARE_GROUND}"/>`)
  layout.realms.forEach((realm, i) => {
    const ground = REALM_GROUND[realmKey(realm.realm)] ?? SPARE_GROUND
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
    if (BEACH_REALMS.has(realmKey(realm.realm))) {
      out.push(
        `<path d="${coastPath}" fill="none" stroke="${SAND}" stroke-width="${BEACH_WIDTH * 2 * g}" stroke-linejoin="round"/>`
      )
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

  // Footpaths under the road, both in the classic map's pale teal.
  for (const trail of layout.trails) {
    out.push(
      `<path d="${curve(trail)}" fill="none" stroke="${FOOTPATH}" stroke-width="7" stroke-dasharray="16 12" stroke-linecap="round"/>`
    )
  }
  for (const road of layout.roads) {
    out.push(
      `<path d="${curve(road)}" fill="none" stroke="${ROAD}" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/>`
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
    for (const mark of landmarksFor(layout, pins)) {
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
