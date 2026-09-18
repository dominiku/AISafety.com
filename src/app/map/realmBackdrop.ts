// PROTOTYPE Map 3.5: a schematic backdrop for the realm and district layout,
// drawn in place of the island art, which was painted for the classic
// positions and does not line up with the draft ones.
//
// There is no drawn boundary data yet, so the land is split by which pin is
// nearest (a Voronoi diagram): each pin's cell takes its realm's color, a thin
// line runs wherever two districts meet and a heavier one where two realms do.
// Moving pins in Airtable therefore moves the borders with them. The colors
// follow the Map 3.5 schematic and are placeholders for the real art.

import * as d3 from 'd3'

export interface BackdropPin {
  x: number // map pixels
  y: number
  realm: string
  district: string
}

const SEA = '#16323f'
const LAND_EDGE = '#5b6f7f'
const BORDER = '#ffffff'
// Handed out to the realms in alphabetical order.
const REALM_COLORS = [
  '#f7c8a8',
  '#cfcfcf',
  '#cdb2e0',
  '#b7ddb0',
  '#f6d571',
  '#a9c6e8',
  '#e8b4b4',
  '#b4e0dc',
]

const CLIP_ID = 'realm-land-clip'

// Two cells share an edge when they share two corners.
const cornerKey = (p: [number, number]) =>
  `${Math.round(p[0] * 10)},${Math.round(p[1] * 10)}`

export function drawRealmBackdrop(
  group: d3.Selection<SVGGElement, unknown, null, undefined>,
  defs: d3.Selection<SVGDefsElement, unknown, null, undefined>,
  pins: BackdropPin[],
  width: number,
  height: number
) {
  // The sea runs well past the frame so zooming out never shows its edge.
  group
    .append('rect')
    .attr('x', -width)
    .attr('y', -height)
    .attr('width', width * 3)
    .attr('height', height * 3)
    .attr('fill', SEA)

  // One oval landmass, as in the Map 3.5 brief, kept clear of the title.
  const land = {
    cx: width / 2,
    cy: height * 0.54,
    rx: width * 0.485,
    ry: height * 0.43,
  }
  defs
    .append('clipPath')
    .attr('id', CLIP_ID)
    .append('ellipse')
    .attr('cx', land.cx)
    .attr('cy', land.cy)
    .attr('rx', land.rx)
    .attr('ry', land.ry)

  const landGroup = group.append('g').attr('clip-path', `url(#${CLIP_ID})`)
  const realms = [...new Set(pins.map(p => p.realm))].sort()
  const colorOf = (realm: string) =>
    REALM_COLORS[realms.indexOf(realm) % REALM_COLORS.length]

  const delaunay = d3.Delaunay.from(
    pins,
    p => p.x,
    p => p.y
  )
  const voronoi = delaunay.voronoi([0, 0, width, height])
  const cells = pins.map(
    (_, i) => voronoi.cellPolygon(i) as [number, number][] | null
  )

  cells.forEach((cell, i) => {
    if (!cell) return
    const color = colorOf(pins[i].realm)
    landGroup
      .append('path')
      .attr('d', `M${cell.map(p => p.join(',')).join('L')}Z`)
      .attr('fill', color)
      // Same-colored stroke closes the hairline seams between cells.
      .attr('stroke', color)
      .attr('stroke-width', 1.5)
  })

  // Borders go on after every cell, so no fill paints over one.
  cells.forEach((cell, i) => {
    if (!cell) return
    const corners = new Set(cell.map(cornerKey))
    for (const j of delaunay.neighbors(i)) {
      const other = cells[j]
      if (j <= i || !other || pins[i].district === pins[j].district) continue
      // A cell polygon repeats its first corner at the end.
      const shared = other.slice(0, -1).filter(p => corners.has(cornerKey(p)))
      if (shared.length < 2) continue
      const betweenRealms = pins[i].realm !== pins[j].realm
      landGroup
        .append('line')
        .attr('x1', shared[0][0])
        .attr('y1', shared[0][1])
        .attr('x2', shared[1][0])
        .attr('y2', shared[1][1])
        .attr('stroke', BORDER)
        .attr('stroke-width', betweenRealms ? 7 : 2)
        .attr('stroke-opacity', betweenRealms ? 1 : 0.7)
        .attr('stroke-linecap', 'round')
    }
  })

  group
    .append('ellipse')
    .attr('cx', land.cx)
    .attr('cy', land.cy)
    .attr('rx', land.rx)
    .attr('ry', land.ry)
    .attr('fill', 'none')
    .attr('stroke', LAND_EDGE)
    .attr('stroke-width', 6)
}
