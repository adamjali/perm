import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=37;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
// ONLY the horizons that exist in today's queue: nothing is past ~9 months.
const BINS=[[0,60],[60,120],[120,190],[190,280]];
const LBL=["0-2mo","2-4mo","4-6mo","6-9mo"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const WS=[7,10,14,21,28,35,42,56,70,90,120,180,270,365];
const acc={};                              // window -> bin -> errors
for(const W of WS) acc[W]=BINS.map(()=>[]);
for(const T of origins){
  const st=E.originState(T), mods={};
  for(const W of WS) mods[W]=E.modelFlat(T,W);
  const lower=CORPUS_END-T+1;
  for(let i=0;i<E.B.recv.length;i+=STRIDE){
    if(E.B.recv[i]>T)break;
    if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
    const ahead=E.blocking(st,E.B.recv[i]), truth=E.B.ddec[i]-T;
    for(const W of WS){ const m=mods[W]; if(!m)continue;
      const h=E.predict(m,ahead); if(h<0)continue;
      const b=bin(h); if(b>=0) acc[W][b].push(h-truth); }
  }
  for(const [d,c] of E.CENS){ if(d>T)break;
    const ahead=E.blocking(st,d), reps=Math.max(1,Math.round(c/STRIDE));
    for(const W of WS){ const m=mods[W]; if(!m)continue;
      const h=E.predict(m,ahead); if(h<0)continue;
      const b=bin(h); if(b>=0) for(let k=0;k<reps;k++) acc[W][b].push(h-lower); }
  }
}
console.log("SCOPED TO TODAY'S HORIZONS ONLY (nothing in the live queue is past ~9 months)\n");
console.log("median ABSOLUTE error, days:\n");
console.log("  window  " + LBL.map(l=>l.padStart(9)).join("") + "      all");
for(const W of WS){
  const all=acc[W].flat();
  if(all.length<500) continue;
  console.log(`  ${String(W).padStart(5)}d  ` + acc[W].map(e=>e.length>200?String(med(e.map(Math.abs))).padStart(9):"        -").join("") + String(med(all.map(Math.abs))).padStart(9));
}
console.log("\nmedian SIGNED error (late +), days:\n");
console.log("  window  " + LBL.map(l=>l.padStart(9)).join(""));
for(const W of WS){
  if(acc[W].flat().length<500) continue;
  console.log(`  ${String(W).padStart(5)}d  ` + acc[W].map(e=>e.length>200?String(med(e)).padStart(9):"        -").join(""));
}
fs.writeFileSync(".planning/backtest/scoped.json",JSON.stringify(
  Object.fromEntries(Object.entries(acc).map(([w,b])=>[w,b.map(x=>x.slice(0,20000))]))));
