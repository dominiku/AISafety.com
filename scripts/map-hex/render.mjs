// usage: node render.mjs <out.png> [--bare] [--labels] [--crop x,y,w,h]
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const root = process.cwd()
const require = createRequire(path.join(root, 'package.json'))
const { createJiti } = require('jiti')
const sharp = require('sharp')
const jiti = createJiti(path.join(root, 'x.js'), { alias: { '@': path.join(root, 'src') }, moduleCache: false })
const { layoutHexMap, strandedTiles } = await jiti.import('@/lib/data/map-hex-layout')
const { MAP_35_HEX_SPEC, MAP_35_HEX_ISLETS } = await jiti.import('@/lib/data/map-hex-spec')
const { hexBackdropMarkup } = await jiti.import('@/app/map/hexBackdrop')
const args = process.argv.slice(2)
const outFile = args[0]
const bare = args.includes('--bare'), labels = args.includes('--labels')
const cropArg = args.includes('--crop') ? args[args.indexOf('--crop') + 1].split(',').map(Number) : null
const W = 2485, H = 1355, G = W / 60
const orgs = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'orgs.json'), 'utf8'))
const RADIUS = { Small: 0.4, Medium: 0.6, Large: 0.8 }
const radiusOf = o => (64 * (RADIUS[o.scale] ?? 0.6)) / 2 / G
const logos = orgs.filter(o => o.district).map(o => ({ id: o.id, district: o.district, radius: radiusOf(o), name: o.name ?? '' }))
const layout = layoutHexMap(MAP_35_HEX_SPEC, logos)
const usedBy = {}
for (const t of layout.tiles) if (t.state === 'used' || t.state === 'spare') (usedBy[t.code] ??= []).push(t.ref + (t.state === 'spare' ? '(spare)' : ''))
console.log('tiles used:', Object.entries(usedBy).map(([k, v]) => `${k}:${v.length}`).join(' '))
console.log('land tiles:', layout.tiles.filter(t => t.state !== 'sea').length, 'unplaced:', layout.unplaced.length, layout.unplaced.map(id => orgs.find(o => o.id === id)?.district).join(' | '))
console.log('stranded:', strandedTiles(layout, MAP_35_HEX_ISLETS))
const FURNITURE = ['Merch', 'Last updated', 'Suggest correction', 'Suggest entry']
const pins = [...[...layout.positions.entries()].map(([id, p]) => ({ x: p.x, y: p.y, radius: radiusOf(orgs.find(o => o.id === id)), furniture: false })),
  // The four map-furniture buttons keep their draft place, as in the app.
  ...orgs.filter(o => FURNITURE.includes(o.name) && o.x !== null).map(o => ({ x: o.x, y: o.y, radius: radiusOf(o), furniture: true }))]
const sprite = fs.readFileSync(path.join(root, 'public/images/map35-landmarks.svg'), 'utf8')
const symbols = sprite.slice(sprite.indexOf('>') + 1, sprite.lastIndexOf('</svg>'))
let body = hexBackdropMarkup(layout, G, W, H, bare ? [] : pins)
if (!bare) body += pins.map(p => `<circle cx="${p.x * G}" cy="${p.y * G}" r="${p.radius * G}" fill="#fff" stroke="#1b2b3e" stroke-width="2"/>`).join('')
if (labels) body += layout.tiles.filter(t => t.ref).map(t => `<text x="${t.center[0] * G}" y="${t.center[1] * G + 8}" text-anchor="middle" font-family="Arial" font-size="26" font-weight="700" fill="#000" stroke="#fff" stroke-width="0.8">${t.ref}${t.state === 'sea' ? '~' : ''}</text>`).join('')
body += `<text x="${30 * G}" y="${3.1 * G}" text-anchor="middle" font-family="Arial" font-size="72" fill="#fff">Map of AI Existential Safety</text>`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${symbols}</defs>${body}</svg>`
fs.writeFileSync(outFile.replace(/\.png$/, '.svg'), svg)
let img = sharp(Buffer.from(svg), { density: 72 })
if (cropArg) img = img.extract({ left: cropArg[0], top: cropArg[1], width: cropArg[2], height: cropArg[3] })
else img = img.resize(1800)
await img.png().toFile(outFile)
console.log('wrote', outFile)
