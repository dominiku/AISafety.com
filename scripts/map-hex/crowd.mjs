// usage: node crowd.mjs
// How full each district is: the share of its ground its logos cover.
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
const { MAP_35_HEX_SPEC, hexLogoRadius } = await jiti.import(
  '@/lib/data/map-hex-spec'
)
const orgs = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, 'orgs.json'), 'utf8')
)
const logos = orgs
  .filter(o => o.district)
  .map(o => ({
    id: o.id,
    district: o.district,
    radius: hexLogoRadius(o.scale),
    name: o.name ?? '',
  }))
const layout = layoutHexMap(MAP_35_HEX_SPEC, logos)
const area = polygon =>
  Math.abs(
    polygon.reduce((sum, [x, y], n) => {
      const [nx, ny] = polygon[(n + 1) % polygon.length]
      return sum + x * ny - nx * y
    }, 0) / 2
  )
const rows = MAP_35_HEX_SPEC.districts.map(d => {
  const tiles = layout.tiles.filter(
    t => t.code === d.code && t.state !== 'sea'
  )
  const open = tiles.filter(t => !t.landmark)
  const ground = open.reduce((sum, t) => sum + area(t.top), 0)
  const own = logos.filter(l => l.district === d.district)
  const covered = own.reduce((sum, l) => sum + Math.PI * l.radius ** 2, 0)
  return {
    code: d.code,
    tiles: tiles.length,
    logos: own.length,
    full: ground ? covered / ground : NaN,
  }
})
rows.sort((a, b) => b.full - a.full)
for (const r of rows) {
  console.log(
    `${r.code}  tiles ${String(r.tiles).padStart(2)}  logos ${String(r.logos).padStart(2)}  full ${Number.isNaN(r.full) ? '  -' : (r.full * 100).toFixed(0).padStart(3) + '%'}`
  )
}
const features = layout.tiles.filter(
  t => t.district === null && t.state !== 'sea' && t.ref
)
console.log(
  'tiles with no district:',
  features.map(t => `${t.ref}(${t.state})`).join(' ')
)
