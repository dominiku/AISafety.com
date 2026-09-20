// usage: node scripts/map-hex/export.mjs <out.json>
// The hex map's geography as data, in MAP GRID UNITS (x 0 to 60, y 0 to 32,
// y downward: the same frame as the Airtable x / y fields and the map spec).
// Everything is "as drawn": the board is seen from the south, so a point on
// high ground is lifted up the page by height * view.lift.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const root = process.cwd()
const require = createRequire(path.join(root, 'package.json'))
const { createJiti } = require('jiti')
const jiti = createJiti(path.join(root, 'x.js'), {
  alias: { '@': path.join(root, 'src') },
  moduleCache: false,
})
const { layoutHexMap } = await jiti.import('@/lib/data/map-hex-layout')
const { MAP_35_HEX_SPEC, MAP_35_HEX_NAMES, hexLogoRadius } = await jiti.import(
  '@/lib/data/map-hex-spec'
)
const orgs = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'orgs.json'), 'utf8')
)
const logos = orgs
  .filter((o) => o.district)
  .map((o) => ({
    id: o.id,
    district: o.district,
    radius: hexLogoRadius(o.scale),
    name: o.name ?? '',
  }))
const layout = layoutHexMap(MAP_35_HEX_SPEC, logos)

const r2 = (n) => Math.round(n * 100) / 100
const pt = (p) => [r2(p[0]), r2(p[1])]
const mean = (points) => [
  r2(points.reduce((s, p) => s + p[0], 0) / points.length),
  r2(points.reduce((s, p) => s + p[1], 0) / points.length),
]

// A district's border: the sides of its tiles that are its edge, each as a
// segment. Side i of a tile runs from corner i to corner i + 1 of its top.
const borderOf = (tiles) =>
  tiles.flatMap((t) =>
    t.edges.flatMap((edge, i) =>
      edge ? [[pt(t.top[i]), pt(t.top[(i + 1) % 6])]] : []
    )
  )

const land = layout.tiles.filter((t) => t.code && t.state !== 'sea')
const districts = MAP_35_HEX_SPEC.districts.map((d) => {
  const tiles = land.filter((t) => t.code === d.code)
  return {
    code: d.code,
    district: d.district,
    realm: d.realm,
    workingName: MAP_35_HEX_NAMES[d.district] ?? null,
    height: d.height,
    logos: logos.filter((l) => l.district === d.district).length,
    tiles: tiles.map((t) => [t.col, t.row]),
    // Null for a district with no tiles of its own (its logos stand on
    // another district's slopes: see onSlopesOf in the spec).
    anchor: tiles.length ? mean(tiles.map((t) => t.center)) : null,
    onSlopesOf: d.onSlopesOf ?? null,
    border: borderOf(tiles),
  }
})
const realms = [...new Set(districts.map((d) => d.realm))].map((realm) => {
  const own = districts.filter((d) => d.realm === realm && d.anchor)
  return {
    realm,
    workingName: MAP_35_HEX_NAMES[realm] ?? null,
    districts: own.map((d) => d.code),
    anchor: mean(own.map((d) => d.anchor)),
  }
})

const out = {
  frame: { width: 60, height: 32, yDown: true },
  view: MAP_35_HEX_SPEC.view,
  board: { columns: layout.columns, rows: layout.rows },
  tileMap: MAP_35_HEX_SPEC.tiles.trim().split('\n'),
  realms,
  districts,
  tiles: land.map((t) => ({
    at: [t.col, t.row],
    code: t.code,
    mark: t.mark,
    state: t.state,
    height: t.height,
    center: pt(t.center),
    top: t.top.map(pt),
  })),
  landmarks: land
    .filter((t) => t.landmark)
    .map((t) => ({
      code: t.code,
      symbol: t.landmark.symbol,
      at: pt([t.landmark.x, t.landmark.y]),
      width: t.landmark.width,
      height: t.landmark.height,
    })),
  buildings: layout.buildings.map((b) => ({ ...b, x: r2(b.x), y: r2(b.y) })),
  roads: layout.pieces
    .filter((p) => p.kind === 'road')
    .map((p) => ({ tile: p.tile, width: p.width, points: p.points.map(pt) })),
  river: layout.pieces
    .filter((p) => p.kind === 'river')
    .map((p) => ({
      tile: p.tile,
      width: p.width,
      closed: p.closed ?? false,
      points: p.points.map(pt),
    })),
  ends: layout.ends.map((e) => ({ kind: e.kind, at: pt(e.at) })),
  springs: layout.springs.map((s) => ({ tile: s.tile, at: pt(s.at) })),
  bridges: layout.bridges.map((b) => ({ tile: b.tile, a: pt(b.a), b: pt(b.b) })),
  lakes: layout.lakes.map((l) => ({ tile: l.tile, whole: l.whole })),
  dams: layout.dams,
  arrivals: layout.arrivals.map(pt),
  departures: layout.departures.map((d) => ({ at: pt(d.at), from: pt(d.from) })),
  moorings: layout.moorings.map((m) => ({ at: pt(m.at), kind: m.kind })),
  logoPositions: [...layout.positions.entries()].map(([id, p]) => {
    const org = orgs.find((o) => o.id === id)
    return {
      id,
      name: org?.name ?? null,
      district: org?.district ?? null,
      x: r2(p.x),
      y: r2(p.y),
    }
  }),
  unplaced: layout.unplaced,
}
fs.writeFileSync(process.argv[2], JSON.stringify(out))
console.log(
  'wrote',
  process.argv[2],
  '| districts',
  districts.length,
  '| land tiles',
  land.length,
  '| logos placed',
  out.logoPositions.length,
  '| unplaced',
  out.unplaced.length
)
