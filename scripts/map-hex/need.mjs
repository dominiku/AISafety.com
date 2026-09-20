import fs from 'node:fs';import path from 'node:path';import { createRequire } from 'node:module'
const root=process.cwd();const require=createRequire(path.join(root,'package.json'));const {createJiti}=require('jiti')
const jiti=createJiti(path.join(root,'x.js'),{alias:{'@':path.join(root,'src')},moduleCache:false})
const {layoutHexMap}=await jiti.import('@/lib/data/map-hex-layout');const {MAP_35_HEX_SPEC,hexLogoRadius}=await jiti.import('@/lib/data/map-hex-spec')
const orgs=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'orgs.json'),'utf8'))
const logos=orgs.filter(o=>o.district).map(o=>({id:o.id,district:o.district,radius:hexLogoRadius(o.scale),name:o.name??''}))
const need=layoutHexMap({...MAP_35_HEX_SPEC,takeAllTiles:false},logos)
const rows=[]
for(const d of MAP_35_HEX_SPEC.districts){const t=need.tiles.filter(x=>x.code===d.code);const painted=t.length;const used=t.filter(x=>x.state==='used').length;const n=logos.filter(l=>l.district===d.district).length
rows.push(`${d.code} logos ${String(n).padStart(2)}  needs ${String(used).padStart(2)}  painted ${String(painted).padStart(2)}  spare ${painted-used}`)}
console.log(rows.join('\n'));console.log('unplaced',need.unplaced.length)
const full=layoutHexMap(MAP_35_HEX_SPEC,logos)
const short={};for(const id of [...need.unplaced,...full.unplaced]){const d=logos.find(l=>l.id===id).district;short[d]=(short[d]||0)+1}
console.log('short (need-mode + take-all mode):',short)
