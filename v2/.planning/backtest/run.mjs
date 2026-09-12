import fs from "fs";
import {S,MO} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature);
const STRIDE=53;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);

// candidate space -- deliberately wide, log-ish grid
const WINDOWS=[3,5,7,10,14,21,28,35,42,56,70,90,120,150,180,240,270,365,450,540,730];
const TAUS=[10,20,30,45,60,90,120,180,260,400];

console.log("Precomputing per-origin predictions for every candidate...\n");
const perOrigin=[];           // [{t, errFor: Map(configKey -> {errs, hs})}]
let t0=Date.now();
for(const o of origins){
  const T=o.t, st=E.originState(T), tg=E.targets(T,STRIDE);
  const ahead=tg.map(i=>E.blocking(st,E.B.recv[i]));
  const truth=tg.map(i=>E.B.ddec[i]-T);
  const m=new Map();
  for(const W of WINDOWS){
    const mod=E.modelFlat(T,W); if(!mod)continue;
    const errs=[],hs=[];
    for(let k=0;k<tg.length;k++){const h=E.predict(mod,ahead[k]); if(h<0)continue; errs.push(h-truth[k]); hs.push(h);}
    if(errs.length>50) m.set(`A|${W}`,{errs,hs});
  }
  perOrigin.push({t:T,n:tg.length,m});
  process.stderr.write(`  ${S(T)}  targets=${tg.length}  configs=${m.size}   \r`);
}
console.log(`\ndone in ${((Date.now()-t0)/1000).toFixed(0)}s\n`);

console.log("=========== FLAT-RATE WINDOW SWEEP, PER ORIGIN ===========");
console.log("median absolute date error (days), by origin x window\n");
const use=WINDOWS.filter(W=>perOrigin.every(o=>o.m.has(`A|${W}`)));
console.log(`windows available at EVERY mature origin: ${use.join(", ")}\n`);
const hdr=use.filter(w=>[7,14,28,56,90,180,270,365].includes(w));
console.log("  origin      "+hdr.map(w=>`${w}d`.padStart(7)).join(""));
for(const o of perOrigin){
  console.log(`  ${S(o.t)}  `+hdr.map(w=>String(med(o.m.get(`A|${w}`).errs.map(Math.abs))).padStart(7)).join(""));
}
console.log("\n  MEDIAN of per-origin medians, and how often each window wins:");
const winCount={}; for(const W of use) winCount[W]=0;
for(const o of perOrigin){
  let best=null; for(const W of use){const v=med(o.m.get(`A|${W}`).errs.map(Math.abs)); if(!best||v<best.v)best={W,v};}
  winCount[best.W]++;
}
console.log("  window   med-of-medians   wins");
for(const W of use){
  const v=med(perOrigin.map(o=>med(o.m.get(`A|${W}`).errs.map(Math.abs))));
  console.log(`  ${String(W).padStart(5)}d  ${String(v).padStart(14)}   ${String(winCount[W]).padStart(4)}/${perOrigin.length}`);
}
fs.writeFileSync(".planning/backtest/flat.json",JSON.stringify(
  perOrigin.map(o=>({t:o.t,n:o.n,e:Object.fromEntries([...o.m].map(([k,v])=>[k,v.errs]))}))));
