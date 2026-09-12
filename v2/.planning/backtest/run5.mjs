import fs from "fs";
import {S} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=41;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
// best config from the corrected table: flat 365 (and blend 14/365 t=45 is tied)
const MK=[["flat 365",T=>E.modelFlat(T,365)],["blend 14/365 t=45",T=>E.modelBlend2(T,14,365,45)]];
const BINS=[[0,60],[60,120],[120,210],[210,330],[330,480],[480,9999]];
const LBL=["0-2mo","2-4mo","4-7mo","7-11mo","11-16mo","16mo+"];
for(const [name,mk] of MK){
  const byBin=BINS.map(()=>[]);          // per-origin arrays of errors, keyed by PREDICTED horizon
  for(const T of origins){
    const st=E.originState(T), tg=E.targets(T,STRIDE);
    const mod=mk(T); if(!mod)continue;
    for(const i of tg){
      const h=E.predict(mod,E.blocking(st,E.B.recv[i])); if(h<0)continue;
      const truth=E.B.ddec[i]-T;
      const b=BINS.findIndex(([a,z])=>h>=a&&h<z); if(b<0)continue;
      byBin[b].push(h-truth);
    }
  }
  console.log(`\n=========== RANGE CALIBRATION: ${name} ===========`);
  console.log("  binned by PREDICTED horizon (knowable at prediction time), not true horizon\n");
  console.log("  predicted    n      bias   width for 80%   width for 50%   coverage of a capped +/-45d band");
  for(let b=0;b<BINS.length;b++){
    const e=byBin[b]; if(e.length<200){console.log(`  ${LBL[b].padEnd(10)} ${String(e.length).padStart(5)}   (too few)`);continue;}
    const bias=med(e), c=e.map(x=>x-bias);
    const w80=q(c,.9)-q(c,.1), w50=q(c,.75)-q(c,.25);
    const cov=c.filter(x=>Math.abs(x)<=45).length/c.length;
    console.log(`  ${LBL[b].padEnd(10)} ${String(e.length).padStart(5)}  ${String(bias).padStart(5)}d   ${String(w80).padStart(11)}d   ${String(w50).padStart(11)}d   ${(100*cov).toFixed(0).padStart(24)}%`);
  }
}
