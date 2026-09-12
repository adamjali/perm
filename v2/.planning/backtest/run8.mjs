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
const MK={"flat 240":T=>E.modelFlat(T,240),"flat 270":T=>E.modelFlat(T,270),"flat 365":T=>E.modelFlat(T,365)};
// collect per-origin (predicted h, error) with censored tail at its lower bound
const P={};
for(const [name,mk] of Object.entries(MK)){
  P[name]=origins.map(T=>{
    const st=E.originState(T), mod=mk(T); if(!mod)return null;
    const a=[];
    for(let i=0;i<E.B.recv.length;i+=STRIDE){
      if(E.B.recv[i]>T)break;
      if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
      const h=E.predict(mod,E.blocking(st,E.B.recv[i])); if(h<0)continue;
      a.push([h,h-(E.B.ddec[i]-T)]);
    }
    const lower=CORPUS_END-T+1;
    for(const [d,c] of E.CENS){ if(d>T)break;
      const h=E.predict(mod,E.blocking(st,d)); if(h<0)continue;
      const reps=Math.max(1,Math.round(c/STRIDE));
      for(let k=0;k<reps;k++) a.push([h,h-lower]); }
    return a.length>200?a:null;
  });
}
console.log("=========== 1. IS THE BIAS CURVE STABLE AS THE TRAINING CUTOFF ADVANCES? ===========");
console.log("   flat 365. Bias learned from origins < k, per predicted-horizon bin.\n");
console.log("   cutoff        0-2mo  2-4mo  4-7mo  7-11mo  11-16mo  16mo+   (prior origins contributing to the last bin)");
for(const k of [12,16,20,24,28,31]){
  const prior=BINS.map(()=>[]); const orgs=BINS.map(()=>0);
  for(let i=0;i<k;i++){const a=P["flat 365"][i]; if(!a)continue;
    const seen=BINS.map(()=>false);
    for(const [h,e] of a){const b=bin(h); if(b>=0){prior[b].push(e); seen[b]=true;}}
    seen.forEach((s,b)=>{if(s)orgs[b]++;});}
  const row=prior.map(a=>a.length>300?String(med(a)).padStart(6):"     -").join(" ");
  console.log(`   <${S(origins[k-1]).padEnd(11)} ${row}   ${orgs[5]}`);
}
console.log("\n   If the far-horizon bias drifts a lot as the cutoff moves, it is tracking the era, not the model.\n");

console.log("=========== 2. DOES THE CORRECTION REPEATEDLY HELP, PER ORIGIN? ===========\n");
const BURN=12;
console.log("   origin       uncorrected   corrected   better?");
let help=0,hurt=0;
for(let k=BURN;k<origins.length;k++){
  const a=P["flat 365"][k]; if(!a)continue;
  const prior=BINS.map(()=>[]);
  for(let i=0;i<k;i++){const b2=P["flat 365"][i]; if(!b2)continue; for(const [h,e] of b2){const b=bin(h); if(b>=0)prior[b].push(e);}}
  const fit=prior.map(x=>x.length>300?med(x):null);
  const raw=[],cor=[];
  for(const [h,e] of a){const b=bin(h); if(fit[b]===null||b<0)continue; raw.push(Math.abs(e)); cor.push(Math.abs(e-fit[b]));}
  if(raw.length<200)continue;
  const r=med(raw),c=med(cor); if(c<r)help++;else hurt++;
  console.log(`   ${S(origins[k])}  ${String(r).padStart(11)}d  ${String(c).padStart(10)}d   ${c<r?"yes":"NO"}`);
}
console.log(`\n   correction helps in ${help} of ${help+hurt} held-out origins`);

console.log("\n=========== 3. PAIRED WINDOW COMPARISON, ORIGINS AS THE UNIT ===========\n");
function perOriginErr(name){
  return origins.map((T,k)=>{
    const a=P[name][k]; if(!a)return null;
    const prior=BINS.map(()=>[]);
    for(let i=0;i<k;i++){const b2=P[name][i]; if(!b2)continue; for(const [h,e] of b2){const b=bin(h); if(b>=0)prior[b].push(e);}}
    const fit=prior.map(x=>x.length>300?med(x):null);
    const cor=[]; for(const [h,e] of a){const b=bin(h); if(b<0||fit[b]===null)continue; cor.push(Math.abs(e-fit[b]));}
    return cor.length>200?med(cor):null;
  });
}
const errs=Object.fromEntries(Object.keys(MK).map(n=>[n,perOriginErr(n)]));
for(const n of Object.keys(MK)){
  const v=errs[n].slice(BURN).filter(x=>x!==null);
  const m=med(v), sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1))/Math.sqrt(v.length);
  console.log(`   ${n.padEnd(10)} median ${String(m).padStart(4)}d   se ${sd.toFixed(1)}d   over ${v.length} origins`);
}
console.log("");
const pairs=[["flat 365","flat 270"],["flat 365","flat 240"],["flat 270","flat 240"]];
for(const [a,b] of pairs){
  const d=[]; for(let k=BURN;k<origins.length;k++){if(errs[a][k]===null||errs[b][k]===null)continue; d.push(errs[a][k]-errs[b][k]);}
  const w=d.filter(x=>x<0).length, l=d.filter(x=>x>0).length;
  const m=med(d), sd=Math.sqrt(d.reduce((s,x)=>s+(x-m)**2,0)/(d.length-1))/Math.sqrt(d.length);
  console.log(`   ${a} vs ${b}:  median diff ${m>0?"+":""}${m}d (se ${sd.toFixed(1)})   ${a} wins ${w}/${d.length}, loses ${l}`);
}
