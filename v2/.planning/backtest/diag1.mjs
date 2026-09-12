import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const BINS=[[0,60],[60,120],[120,210],[210,330],[330,480],[480,9999]];
const LBL=["0-2mo","2-4mo","4-7mo","7-11mo","11-16mo","16mo+"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
// For each origin and each PREDICTED-horizon bucket: how many scoreable targets,
// how many same-bucket cases are UNSCOREABLE (still pending today), how many origins contribute.
const sc=BINS.map(()=>0), un=BINS.map(()=>0), orgs=BINS.map(()=>new Set());
const {praw,recv,ddec}=E.B;
for(const T of origins){
  const st=E.originState(T), mod=E.modelFlat(T,365); if(!mod)continue;
  // scoreable: unresolved at T, decided by corpus end
  for(let i=0;i<recv.length;i+=41){
    if(recv[i]>T)break;
    if(!(ddec[i]>T))continue;
    const h=E.predict(mod,E.blocking(st,recv[i])); if(h<0)continue;
    const b=bin(h); if(b<0)continue;
    if(ddec[i]<=CORPUS_END){sc[b]++; orgs[b].add(T);} else un[b]++;
  }
  // still-pending-today cases filed before T are ALSO unscoreable members of some bucket
  for(const [d,c] of praw){
    if(d>T)break;
    const h=E.predict(mod,E.blocking(st,d)); if(h<0)continue;
    const b=bin(h); if(b>=0) un[b]+=c/41;          // scale to the same 1-in-41 sampling
  }
}
console.log("WHY DOES THE BAND NARROW AT LONG HORIZONS?  (model: flat 365)\n");
console.log("  predicted    scoreable   UNSCOREABLE   censoring rate   distinct origins contributing");
for(let b=0;b<BINS.length;b++){
  const tot=sc[b]+un[b];
  console.log(`  ${LBL[b].padEnd(10)} ${String(sc[b]).padStart(10)}   ${String(Math.round(un[b])).padStart(11)}   ${(100*un[b]/tot).toFixed(1).padStart(13)}%   ${String(orgs[b].size).padStart(29)}`);
}
console.log("\n  A bucket whose cases are mostly UNSCOREABLE is measuring only the fast survivors.");
