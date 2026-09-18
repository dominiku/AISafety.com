// PROTOTYPE Map 3.5: a schematic backdrop for the realm and district layout,
// drawn in place of the island art, which was painted for the classic
// positions and does not line up with the new ones. An abstract version of the
// classic map: a faceted island, flat colors and straight borders, heavier
// between realms than between districts. The Advocacy anchorage is marked out
// on the water, and the newcomer's road runs from the arrival harbour to the
// crossroads and on toward each of the three realms it leads to. The colors
// follow the Map 3.5 schematic and are placeholders for the real art.

import * as d3 from 'd3'
import type {
  Point,
  RealmLayout,
  RealmMapSpec,
} from '@/lib/data/map-realm-layout'

export interface RealmBackdrop {
  layout: Pick<RealmLayout, 'coast' | 'realms' | 'districts'>
  landmarks: RealmMapSpec['landmarks']
}

const SEA = '#16323f'
const ANCHORAGE = '#1f4556'
const LINE = '#1b2b3e'
const ROAD = '#8a5a2b'
// Matched on the first word of the realm's name; any other realm gets one of
// the spare colors.
const REALM_COLORS: Record<string, string> = {
  field: '#cfcfcf',
  media: '#cdb2e0',
  policy: '#b7ddb0',
  talent: '#f6d571',
  technical: '#a9c6e8',
}
const SPARE_COLORS = ['#f7c8a8', '#e8b4b4', '#b4e0dc']

const COAST_CLIP_ID = 'realm-coast-clip'

export function drawRealmBackdrop(
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  { layout, landmarks }: RealmBackdrop,
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

  // Water first, so the island is drawn over the part of it that runs inland.
  const byWaterFirst = [...layout.realms].sort(
    (a, b) => Number(b.water) - Number(a.water)
  )
  byWaterFirst.forEach((realm, i) => {
    const realmClipId = `realm-clip-${i}`
    clip(realmClipId, realm.polygon)
    // A district's cell is cut off by its realm's border, and on land by the
    // coast too.
    const inRealm = group
      .append('g')
      .attr('clip-path', realm.water ? null : `url(#${COAST_CLIP_ID})`)
      .append('g')
      .attr('clip-path', `url(#${realmClipId})`)
    const fill = realm.water ? ANCHORAGE : colorOf(realm.realm)
    for (const district of layout.districts) {
      if (district.realm !== realm.realm) continue
      inRealm
        .append('path')
        .attr('d', outline(district.polygon))
        .attr('fill', fill)
        .attr('stroke', realm.water ? SEA : LINE)
        .attr('stroke-width', realm.water ? 3 : 2.5)
        .attr('stroke-dasharray', realm.water ? '10 8' : null)
    }
    if (realm.water) {
      // The land will cover the inland part; until then this hides it.
      group.append('path').attr('d', outline(layout.coast)).attr('fill', SEA)
    }
  })

  // Realm borders over the district ones, then the coast over both.
  const onLand = group.append('g').attr('clip-path', `url(#${COAST_CLIP_ID})`)
  for (const realm of layout.realms) {
    if (realm.water) continue
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

  // The road: in from the arrival harbour to the crossroads, then a fork into
  // each realm on the east side.
  const { arrivalHarbour, crossroads, departureHarbour, controlDam } = landmarks
  const beyond = (from: Point, to: Point, times: number): Point => [
    from[0] + (to[0] - from[0]) * times,
    from[1] + (to[1] - from[1]) * times,
  ]
  const roads: Point[][] = [
    [arrivalHarbour, crossroads],
    [crossroads, departureHarbour],
    [crossroads, controlDam, beyond(crossroads, controlDam, 3)],
    // North-east, to the shore the Advocacy ships lie off.
    [crossroads, [46, 8]],
  ]
  for (const road of roads) {
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
  for (const spot of [arrivalHarbour, crossroads, departureHarbour]) {
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
