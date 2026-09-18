// PROTOTYPE Map 3.5: a schematic backdrop for the realm and district layout,
// drawn in place of the island art, which was painted for the classic
// positions and does not line up with the new ones. An abstract version of the
// classic map, in a tube map's hand: flat colors, and every line (the coast
// too) straight or at 45°. Borders are heavier between realms than between
// districts. The road in from the arrival harbour is a border too, drawn over
// it. The Advocacy cove is water inside the coast, drawn over the land, with
// a short boardwalk from its foot to the castle town. East of the crossroads
// a footpath wanders from district to district: the one curved line on the
// map. The Advocacy anchorage is marked out
// on the water, and the newcomer's road runs from the arrival harbour to the
// crossroads and on toward each of the three realms it leads to. The colors
// follow the Map 3.5 schematic and are placeholders for the real art.

import * as d3 from 'd3'
import type { Point, RealmLayout } from '@/lib/data/map-realm-layout'

export type RealmBackdrop = Pick<
  RealmLayout,
  | 'coast'
  | 'cove'
  | 'realms'
  | 'districts'
  | 'landmarks'
  | 'roads'
  | 'trail'
  | 'boardwalk'
  | 'districtAt'
>

const SEA = '#16323f'
const ANCHORAGE = '#1f4556'
const LINE = '#1b2b3e'
const ROAD = '#8a5a2b'
const BOARDWALK = '#b98a55'
// Matched on the first word of the realm's name; any other realm gets one of
// the spare colors.
const REALM_COLORS: Record<string, string> = {
  advocacy: '#f7c8a8',
  field: '#cfcfcf',
  media: '#cdb2e0',
  policy: '#b7ddb0',
  talent: '#f6d571',
  technical: '#a9c6e8',
}
const SPARE_COLORS = ['#e8b4b4', '#b4e0dc', '#d9d2a6']

const COAST_CLIP_ID = 'realm-coast-clip'

export function drawRealmBackdrop(
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  layout: RealmBackdrop,
  gridSize: number,
  width: number,
  height: number
) {
  const px = ([x, y]: Point) => `${x * gridSize},${y * gridSize}`
  const outline = (polygon: Point[]) => `M${polygon.map(px).join('L')}Z`
  const clip = (id: string, polygon: Point[]) =>
    defs
      .append('clipPath')
      .attr('id', id)
      .append('path')
      .attr('d', outline(polygon))

  // The sea runs well past the frame so zooming out never shows its edge.
  group
    .append('rect')
    .attr('x', -width)
    .attr('y', -height)
    .attr('width', width * 3)
    .attr('height', height * 3)
    .attr('fill', SEA)

  clip(COAST_CLIP_ID, layout.coast)
  let spare = 0
  const colorOf = (realm: string) =>
    REALM_COLORS[realm.split(' ')[0].toLowerCase()] ??
    SPARE_COLORS[spare++ % SPARE_COLORS.length]

  layout.realms.forEach((realm, i) => {
    const realmClipId = `realm-clip-${i}`
    clip(realmClipId, realm.polygon)
    // A district's cell is cut off by its realm's border and by the coast.
    const inRealm = group
      .append('g')
      .attr('clip-path', `url(#${COAST_CLIP_ID})`)
      .append('g')
      .attr('clip-path', `url(#${realmClipId})`)
    const fill = colorOf(realm.realm)
    // Towns lie over the open districts around them.
    const inOrder = [...layout.districts].sort(
      (a, b) => Number(a.block) - Number(b.block)
    )
    for (const district of inOrder) {
      if (district.realm !== realm.realm) continue
      inRealm
        .append('path')
        .attr('d', district.pieces.map(outline).join(''))
        .attr('fill', fill)
        .attr('stroke', LINE)
        .attr('stroke-width', 2.5)
    }
  })

  // Realm borders over the district ones, then the coast over both.
  const onLand = group.append('g').attr('clip-path', `url(#${COAST_CLIP_ID})`)
  for (const realm of layout.realms) {
    onLand
      .append('path')
      .attr('d', outline(realm.polygon))
      .attr('fill', 'none')
      .attr('stroke', LINE)
      .attr('stroke-width', 8)
      .attr('stroke-linejoin', 'round')
  }
  group
    .append('path')
    .attr('d', outline(layout.coast))
    .attr('fill', 'none')
    .attr('stroke', LINE)
    .attr('stroke-width', 8)
    .attr('stroke-linejoin', 'round')

  // The cove goes over all of that: its water hides the coast line across its
  // mouth, and its own shore is drawn only where there is land behind it.
  if (layout.cove.length > 0) {
    group.append('path').attr('d', outline(layout.cove)).attr('fill', SEA)
    onLand
      .append('path')
      .attr('d', outline(layout.cove))
      .attr('fill', ANCHORAGE)
      .attr('stroke', LINE)
      .attr('stroke-width', 8)
      .attr('stroke-linejoin', 'round')
  }

  const { arrivalHarbour, crossroads } = layout.landmarks
  // The two ways that wander: a curve through the places they call at.
  const wander = d3
    .line<Point>()
    .x(p => p[0] * gridSize)
    .y(p => p[1] * gridSize)
    .curve(d3.curveCatmullRom.alpha(0.5))
  if (layout.trail.length > 1) {
    group
      .append('path')
      .attr('d', wander(layout.trail))
      .attr('fill', 'none')
      .attr('stroke', ROAD)
      .attr('stroke-width', 3.5)
      .attr('stroke-dasharray', '2 9')
      .attr('stroke-linecap', 'round')
  }
  if (layout.boardwalk.length > 1) {
    // Planks: short dashes across a wide line.
    group
      .append('path')
      .attr('d', `M${layout.boardwalk.map(px).join('L')}`)
      .attr('fill', 'none')
      .attr('stroke', BOARDWALK)
      .attr('stroke-width', 12)
      .attr('stroke-dasharray', '5 4')
  }
  for (const road of layout.roads) {
    group
      .append('path')
      .attr('d', `M${road.map(px).join('L')}`)
      .attr('fill', 'none')
      .attr('stroke', ROAD)
      .attr('stroke-width', 7)
      .attr('stroke-dasharray', '22 14')
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
  }
  for (const spot of [arrivalHarbour, crossroads]) {
    group
      .append('circle')
      .attr('cx', spot[0] * gridSize)
      .attr('cy', spot[1] * gridSize)
      .attr('r', 16)
      .attr('fill', spot === crossroads ? ROAD : LINE)
      .attr('stroke', '#fff')
      .attr('stroke-width', 4)
  }
}
