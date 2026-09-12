import fs from "fs";
import {S,D,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=41, INCLUDE_CENS=process.env.CENS!=="0";
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
const BINS=[[0,60],[60,120],[120,210],[210,330],[330,480],[480,9999]];
const LBL=["0-2mo","2-4mo","4-7mo","7-11mo","11-16mo","16mo+"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const MK={"flat 240":T=>E.modelFlat(T,240),"flat 270":T=>E.modelFlat(T,270),"flat 365":T=>E.modelFlat(T,365)};
console.log(`censored slow tail ${INCLUDE_CENS?"INCLUDED (truth at its LOWER bound - the most favourable assumption)":"EXCLUDED (the old, optimistic setup)"}\n`);
for(const [name,mk] of Object.entries(MK)){
  const byBin=BINS.map(()=>[]), orgBin=BINS.map(()=>new Set());
  for(const T of origins){
    const st=E.originState(T), mod=mk(T); if(!mod)continue;
    for(let i=0;i<E.B.recv.length;i+=STRIDE){
      if(E.B.recv[i]>T)break;
      if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
      const h=E.predict(mod,E.blocking(st,E.B.recv[i])); if(h<0)continue;
      const b=bin(h); if(b<0)continue;
      byBin[b].push(h-(E.B.ddec[i]-T)); orgBin[b].add(T);
    }
    if(INCLUDE_CENS){
      const lower=CORPUS_END-T+1;                       // truth is AT LEAST this
      for(const [d,c] of E.CENS){
        if(d>T)break;
        const h=E.predict(mod,E.blocking(st,d)); if(h<0)continue;
        const b=bin(h); if(b<0)continue;
        const e=h-lower;                                // upper bound on the error (most favourable)
        const reps=Math.max(1,Math.round(c/STRIDE));
        for(let k=0;k<reps;k++) byBin[b].push(e);
        orgBin[b].add(T);
      }
    }
  }
  console.log(`===== ${name} =====`);
  console.log("  predicted     n    origins    bias   80% width   monotone-enforced   cov of +/-45d");
  let prevW=0;
  for(let b=0;b<BINS.length;b++){
    const e=byBin[b]; if(e.length<300){console.log(`  ${LBL[b].padEnd(10)} ${String(e.length).padStart(6)}  (too few)`);continue;}
    const bias=med(e), c=e.map(x=>x-bias);
    const w=q(c,.9)-q(c,.1);
    const wm=Math.max(w,prevW); prevW=wm;               // width may never shrink as horizon grows
    const cov=c.filter(x=>Math.abs(x)<=45).length/c.length;
    console.log(`  ${LBL[b].padEnd(10)} ${String(e.length).padStart(6)}  ${String(orgBin[b].size).padStart(7)}  ${String(bias).padStart(6)}d  ${String(w).padStart(9)}d   ${String(wm).padStart(17)}d   ${(100*cov).toFixed(0).padStart(13)}%`);
  }
  console.log("");
}
