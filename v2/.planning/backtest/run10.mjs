import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=41;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
const BINS=[[0,60],[60,120],[120,210],[210,330],[330,480],[480,9999]];
const LBL=["0-2mo","2-4mo","4-7mo","7-11mo","11-16mo","16mo+"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const MK={"28d":T=>E.modelFlat(T,28),"90d":T=>E.modelFlat(T,90),"365d":T=>E.modelFlat(T,365)};
const P={};
for(const [nm,mk] of Object.entries(MK)) P[nm]=origins.map(T=>{
  const st=E.originState(T), mod=mk(T); if(!mod)return null; const a=[];
  for(let i=0;i<E.B.recv.length;i+=STRIDE){ if(E.B.recv[i]>T)break;
    if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
    const h=E.predict(mod,E.blocking(st,E.B.recv[i])); if(h<0)continue; a.push([h,h-(E.B.ddec[i]-T)]); }
  const lower=CORPUS_END-T+1;
  for(const [d,c] of E.CENS){ if(d>T)break; const h=E.predict(mod,E.blocking(st,d)); if(h<0)continue;
    const reps=Math.max(1,Math.round(c/STRIDE)); for(let k=0;k<reps;k++) a.push([h,h-lower]); }
  return a.length>200?a:null;});
console.log("28 vs 90 vs 365, RAW (no bias correction at all)\n");
console.log("  model   available   median SIGNED error (late is +)   median ABS error");
for(const nm of Object.keys(MK)){
  const ok=P[nm].filter(Boolean);
  const sg=ok.map(a=>med(a.map(x=>x[1]))), ab=ok.map(a=>med(a.map(x=>Math.abs(x[1]))));
  console.log(`  ${nm.padEnd(7)} ${String(ok.length).padStart(6)}/${origins.length}   ${String(med(sg)).padStart(28)}d   ${String(med(ab)).padStart(14)}d`);
}
console.log("\nBY HORIZON, median ABSOLUTE error, RAW:\n");
console.log("  model   "+LBL.map(l=>l.padStart(9)).join(""));
for(const nm of Object.keys(MK)){
  const byBin=BINS.map(()=>[]);
  for(const a of P[nm]){ if(!a)continue; for(const [h,e] of a){const b=bin(h); if(b>=0)byBin[b].push(Math.abs(e));} }
  console.log(`  ${nm.padEnd(7)} `+byBin.map(x=>x.length>300?String(med(x)).padStart(9):"        -").join(""));
}
console.log("\nBY HORIZON, median SIGNED error, RAW  (is it late or early?):\n");
console.log("  model   "+LBL.map(l=>l.padStart(9)).join(""));
for(const nm of Object.keys(MK)){
  const byBin=BINS.map(()=>[]);
  for(const a of P[nm]){ if(!a)continue; for(const [h,e] of a){const b=bin(h); if(b>=0)byBin[b].push(e);} }
  console.log(`  ${nm.padEnd(7)} `+byBin.map(x=>x.length>300?String(med(x)).padStart(9):"        -").join(""));
}
console.log("\nHOW VARIABLE IS EACH RATE ESTIMATE ITSELF? (spread of the rate across origins)\n");
for(const W of [28,90,365]){
  const v=origins.map(T=>E.pace(T,W)).filter(x=>x>0);
  console.log(`  ${String(W).padStart(3)}d window: rate ranged ${Math.min(...v).toFixed(0)} to ${Math.max(...v).toFixed(0)}/day across origins  (${(Math.max(...v)/Math.min(...v)).toFixed(2)}x)`);
}
