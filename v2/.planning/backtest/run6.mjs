import fs from "fs";
import {S} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=41, BURN=12, SC=Number(process.env.BLOCK_SCALE||'1');
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
const BINS=[[0,60],[60,120],[120,210],[210,330],[330,480],[480,9999]];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const MK={"flat 365":T=>E.modelFlat(T,365),"blend 14/365 t=45":T=>E.modelBlend2(T,14,365,45),
          "flat 270":T=>E.modelFlat(T,270)};
for(const [name,mk] of Object.entries(MK)){
  // per-origin raw (predictedHorizon, error) pairs
  const P=[];
  for(const T of origins){
    const st=E.originState(T), tg=E.targets(T,STRIDE), mod=mk(T);
    if(!mod){P.push(null);continue;}
    const a=[];
    for(const i of tg){const h=E.predict(mod,E.blocking(st,E.B.recv[i])*SC); if(h<0)continue; a.push([h,h-(E.B.ddec[i]-T)]);}
    P.push(a.length>100?a:null);
  }
  console.log(`\n===== ${name}: NESTED range calibration (bias+width from origins < k only) =====`);
  console.log("  test origin   n     med|err| after   80%-band width   ACTUAL coverage of that band   +/-45d cov");
  const cov80=[],widths=[],cov45=[],errs=[];
  for(let k=BURN;k<origins.length;k++){
    if(!P[k])continue;
    // fit bias + quantiles per bin from PRIOR origins only
    const prior=BINS.map(()=>[]);
    for(let i=0;i<k;i++){ if(!P[i])continue; for(const [h,e] of P[i]){const b=bin(h); if(b>=0)prior[b].push(e);} }
    const fit=prior.map(a=>a.length>300?{b:med(a),lo:q(a,.1),hi:q(a,.9)}:null);
    let inside=0,in45=0,n=0; const ae=[],w=[];
    for(const [h,e] of P[k]){
      const b=bin(h), f=fit[b]; if(!f)continue;
      const ce=e-f.b;                       // bias-corrected error
      const lo=f.lo-f.b, hi=f.hi-f.b;       // band offsets around the corrected estimate
      n++; ae.push(Math.abs(ce)); w.push(hi-lo);
      if(ce>=lo&&ce<=hi) inside++;
      if(Math.abs(ce)<=45) in45++;
    }
    if(n<100)continue;
    cov80.push(inside/n); widths.push(med(w)); cov45.push(in45/n); errs.push(med(ae));
    if(0)console.log(`  ${S(origins[k])}  ${String(n).padStart(5)}   ${String(med(ae)).padStart(11)}d   ${String(med(w)).padStart(14)}d   ${(100*inside/n).toFixed(0).padStart(27)}%   ${(100*in45/n).toFixed(0).padStart(9)}%`);
  }
  console.log(`  ---- median over ${cov80.length} held-out origins:  err ${med(errs)}d   width ${med(widths)}d   coverage ${(100*med(cov80)).toFixed(0)}%   +/-45d ${(100*med(cov45)).toFixed(0)}%`);
}
