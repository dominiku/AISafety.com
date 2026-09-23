import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}))
const token=env.AIRTABLE_IA_FORK_TOKEN, base=env.AIRTABLE_IA_FORK_BASE_ID
const F={name:'fldqYJa5li27kVOUW',status:'fld2OFKbXPhO2NQRx',scale:'fldw2bKsCY0VdTCN6',x:'fld2FlBMPjxhjGuFO',y:'fldkAQPZaibRGawVw',newX:'fld6xcM2STFRQQWzL',newY:'fldZKw63bkTpmPOiW',realm:'fldi6QsDIBKXIj3n0',district:'fldY6iDCQjsmB2UOh',logo:'fldua2ISy01Yntwof'}
let out=[],offset
do{
 const u=new URL(`https://api.airtable.com/v0/${base}/tblvzbGL9q9dOO9Nc`)
 u.searchParams.set('returnFieldsByFieldId','true')
 u.searchParams.set('filterByFormula','AND({fldCCQ2OYlQluuarR} = TRUE(), {fldKwedEOWPFuWSe7} = FALSE())')
 Object.values(F).forEach(f=>u.searchParams.append('fields[]',f))
 if(offset)u.searchParams.set('offset',offset)
 const r=await fetch(u,{headers:{Authorization:`Bearer ${token}`}})
 if(!r.ok)throw new Error('airtable '+r.status)
 const j=await r.json();offset=j.offset
 for(const rec of j.records){const f=rec.fields;const s=v=>typeof v==='string'?v:(v&&v.name)||null
  out.push({id:rec.id,name:f[F.name]??null,status:s(f[F.status]),scale:s(f[F.scale]),x:f[F.x]??null,y:f[F.y]??null,newX:f[F.newX]??null,newY:f[F.newY]??null,realm:s(f[F.realm]),district:s(f[F.district]),hasLogo:!!f[F.logo]})}
 await new Promise(r=>setTimeout(r,250))
}while(offset)
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,1))
const by={}
for(const o of out){const k=(o.realm||'-')+' | '+(o.district||'-');by[k]??={n:0,fp:0};by[k].n++;by[k].fp+=({Large:4,Small:1}[o.scale]??2)}
console.log(out.length);for(const k of Object.keys(by).sort())console.log(k,by[k].n,by[k].fp)
