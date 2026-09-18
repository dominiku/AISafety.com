// PROTOTYPE Map 3.5, "Art work" view: the computed realm and district layout
// (the same one the schematic in realmBackdrop.ts draws) redrawn in the hand
// of the classic island art, to try that style on the new geography. Nothing
// here is imported artwork: it is all drawn from the layout.
//
// What is taken from the classic map: a dark sea with a lighter shelf around
// the island; a faceted coast with eased corners; the island seen from the
// south, so every south-facing shore drops a cliff face to the water; green
// land whose regions differ in tone and are parted by thin dark lines, not by
// colored fills; orange rock in the research country and sand on the beaches;
// pale teal roads.
//
// The drawing is built as SVG markup (artBackdropMarkup) so it can be looked
// at outside the browser too; drawRealmArtBackdrop puts it on the map.

import * as d3 from 'd3'
import { cliffFaces, roundCorners } from '@/lib/data/map-art-geometry'
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
const CLIFF_EARTH = { lip: '#00ae85', face: '#008969', foot: '#2f5650' }
// DESIGN DECISION, for review: realms are told apart by the ground itself, as
// the classic map tells Research Range (orange rock) from the green country
// and Blog Beach (sand). Matched on the first word of the realm's name.
const REALM_GROUND: Record<string, string> = {
  field: '#008969',
  talent: '#00ae85',
  policy: '#2dc2a4',
  media: '#7dd5c2',
  advocacy: '#ffa777',
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

const realmKey = (realm: string) => realm.split(' ')[0].toLowerCase()

export function artBackdropMarkup(
  layout: RealmBackdrop,
  gridSize: number,
  width: number,
  height: number
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
    const tones =
      realm && ROCK_REALMS.has(realmKey(realm)) ? CLIFF_ROCK : CLIFF_EARTH
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
      `<path d="${outline(realm.polygon)}" fill="none" stroke="${LINE}" stroke-opacity="0.6" stroke-width="5" stroke-linejoin="round"/>`
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

  return out.join('')
}

export function drawRealmArtBackdrop(
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  layout: RealmBackdrop,
  gridSize: number,
  width: number,
  height: number
) {
  group.append('g').html(artBackdropMarkup(layout, gridSize, width, height))
}
