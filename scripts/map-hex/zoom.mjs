// usage: node zoom.mjs <in.svg> <out.png> x,y,w,h [scale]
import fs from 'node:fs';import path from 'node:path';import { createRequire } from 'node:module'
const require=createRequire(path.join(process.cwd(),'package.json'));const sharp=require('sharp')
const [inp,out,box,scale='4']=process.argv.slice(2);const [x,y,w,h]=box.split(',').map(Number);const k=+scale
await sharp(fs.readFileSync(inp),{density:72*k}).extract({left:x*k,top:y*k,width:w*k,height:h*k}).png().toFile(out);console.log('wrote',out)
