// usage: node crop.mjs <in image> <out.png> [x,y,w,h] [width]: a crop of any
// image (the classic map, say), scaled to `width` pixels wide.
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire(path.join(process.cwd(), 'package.json'))
const sharp = require('sharp')
const [inp, out, box, width = '1400'] = process.argv.slice(2)
let img = sharp(inp)
const meta = await img.metadata()
console.log(meta.width, meta.height)
if (box && box !== '-') {
  const [x, y, w, h] = box.split(',').map(Number)
  img = img.extract({ left: x, top: y, width: w, height: h })
}
await img.resize(Number(width)).png().toFile(out)
