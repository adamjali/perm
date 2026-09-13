import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=37;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
// permupdate, in their own words on /how-it-works:
//   "the actual processing speed observed from the last three weeks"
//   "adds a 15% buffer to provide realistic upper-bound estimates"
//   "our estimates come with about an 80% confidence level"
const BINS=[[0,60],[60,120],[120,190],[190,280]], LBL=["0-2mo","2-4mo","4-6mo","6-9mo"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const res=BINS.map(()=>({in15:0,inBand:0,n:0,err:[]}));
for(const T of origins){
  const st=E.originState(T), lower=CORPUS_END-T+1;
  const p=E.pace(T,21); if(!(p>0))continue;
  const push=(ahead,truth)=>{
    const h=Math.round(ahead/p); const b=bin(h); if(b<0)return;
    const r=res[b]; r.n++; r.err.push(h-truth);
    // their advertised interval: the point estimate, plus a 15% buffer upward
    if(truth>=h && truth<=h*1.15) r.in15++;
    // the most generous reading: +/-15% around it
    if(truth>=h*0.85 && truth<=h*1.15) r.inBand++;
  };
  for(let i=0;i<E.B.recv.length;i+=STRIDE){ if(E.B.recv[i]>T)break;
    if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
    push(E.blocking(st,E.B.recv[i]), E.B.ddec[i]-T); }
  for(const [d,c] of E.CENS){ if(d>T)break; const a=E.blocking(st,d);
    const reps=Math.max(1,Math.round(c/STRIDE)); for(let k=0;k<reps;k++) push(a,lower); }
}
console.log("permupdate's method, reconstructed from their own stated parameters");
console.log("(21-day pace, 15% buffer, advertised as ~80% confidence)\n");
console.log("  horizon    n        median err   coverage of +0..+15%   coverage of +/-15%");
for(let i=0;i<BINS.length;i++){
  const r=res[i]; if(r.n<500){console.log(`  ${LBL[i].padEnd(9)} (too few)`);continue;}
  console.log(`  ${LBL[i].padEnd(9)} ${String(r.n).padStart(7)}  ${String(q(r.err,.5)).padStart(10)}d  ${(100*r.in15/r.n).toFixed(0).padStart(19)}%  ${(100*r.inBand/r.n).toFixed(0).padStart(18)}%`);
}
console.log("\n  Advertised: 'about an 80% confidence level'.");
