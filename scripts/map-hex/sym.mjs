// usage: node sym.mjs <symbol-id> <out.png>: one landmark symbol with a grid of
// shares of its box, to read off where something sits inside the art.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const sharp = require('sharp')
const [id, out] = process.argv.slice(2)
const sprite = fs.readFileSync('public/images/map35-landmarks.svg', 'utf8')
const m = sprite.match(new RegExp('<symbol[^>]*id="' + id + '"[^>]*>'))
console.log(m[0])
const vb = m[0].match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number)
const symbols = sprite.slice(sprite.indexOf('>') + 1, sprite.lastIndexOf('</svg>'))
const W = 900
const H = Math.round((900 * vb[3]) / vb[2])
let grid = ''
for (let i = 1; i < 10; i++) {
  grid += `<path d="M${(i * W) / 10},0V${H}M0,${(i * H) / 10}H${W}" stroke="#00f" stroke-width="0.5"/><text x="${(i * W) / 10 + 2}" y="10" font-size="10" fill="#00f">${i / 10}</text><text x="2" y="${(i * H) / 10 - 2}" font-size="10" fill="#00f">${i / 10}</text>`
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#bbc77a"/><defs>${symbols}</defs><use href="#${id}" x="0" y="0" width="${W}" height="${H}"/>${grid}</svg>`
await sharp(Buffer.from(svg)).png().toFile(out)
