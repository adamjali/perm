import fs from "fs";
import {S,D,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=41;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
// US federal holidays 2023-2028 (observed dates)
const HOL=new Set(`2023-11-23 2023-12-25 2024-01-01 2024-01-15 2024-02-19 2024-05-27 2024-06-19 2024-07-04 2024-09-02 2024-10-14 2024-11-11 2024-11-28 2024-12-25
2025-01-01 2025-01-20 2025-02-17 2025-05-26 2025-06-19 2025-07-04 2025-09-01 2025-10-13 2025-11-11 2025-11-27 2025-12-25
2026-01-01 2026-01-19 2026-02-16 2026-05-25 2026-06-19 2026-07-03 2026-09-07 2026-10-12 2026-11-11 2026-11-26 2026-12-25
2027-01-01 2027-01-18 2027-02-15 2027-05-31 2027-06-18 2027-07-05 2027-09-06 2027-10-11 2027-11-11 2027-11-25 2027-12-24`.split(/\s+/).map(s=>D(s)));
const yearEnd=t=>{const d=new Date(t*86400000);const m=d.getUTCMonth(),day=d.getUTCDate();
  return (m===11&&day>=24)||(m===0&&day<=1);};
// MEASURE the effect from the observed series
const {daily,dayLo}=E.B;
let hs=0,hn=0,ws=0,wn=0,ys=0,yn=0;
for(let d=dayLo;d<dayLo+daily.length;d++){
  const n=daily[d-dayLo]; if(n===undefined)continue;
  const dow=new Date(d*86400000).getUTCDay(); if(dow===0||dow===6)continue;   // weekdays only
  if(n<5) {}                                                                  // keep zeros: that is the effect
  if(yearEnd(d)){ys+=n;yn++;} else if(HOL.has(d)){hs+=n;hn++;} else {ws+=n;wn++;}
}
const wm=ws/wn, hm=hn?hs/hn:NaN, ym=yn?ys/yn:NaN;
console.log("MEASURED CALENDAR EFFECT ON FUTURE DATES (weekdays only)\n");
console.log(`  ordinary weekday      ${wm.toFixed(0)}/day   n=${wn}`);
console.log(`  federal holiday       ${hm.toFixed(0)}/day   n=${hn}   ratio ${(hm/wm).toFixed(2)}`);
console.log(`  Dec 24 - Jan 1        ${ym.toFixed(0)}/day   n=${yn}   ratio ${(ym/wm).toFixed(2)}`);
const fHol=hm/wm, fYE=ym/wm;
// factor with MEAN 1 over a year: redistribute, never add
function rawFactor(t){ const dow=new Date(t*86400000).getUTCDay();
  if(dow===0||dow===6) return 1;            // weekends already inside the calendar-day average
  if(yearEnd(t)) return fYE; if(HOL.has(t)) return fHol; return 1; }
let norm=0; for(let k=0;k<365;k++) norm+=rawFactor(D("2026-01-01")+k); norm/=365;
const cal=t=>rawFactor(t)/norm;
console.log(`  normaliser ${norm.toFixed(4)}  (factor has mean 1 over a year, so the annual total is preserved)\n`);

console.log("=========== DOES IT HELP?  identical nested calibration both sides ===========\n");
const BINS=[[0,60],[60,120],[120,210],[210,330],[330,480],[480,9999]];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const MK={"flat 365":T=>E.modelFlat(T,365),"flat 365 + holidays":T=>E.withCalendar(T,E.modelFlat(T,365),cal)};
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
const BURN=12;
function perOrigin(nm){ return origins.map((T,k)=>{ const a=P[nm][k]; if(!a)return null;
  const prior=BINS.map(()=>[]);
  for(let i=0;i<k;i++){const b2=P[nm][i]; if(!b2)continue; for(const [h,e] of b2){const b=bin(h); if(b>=0)prior[b].push(e);}}
  const fit=prior.map(x=>x.length>300?med(x):null);
  const cor=[]; for(const [h,e] of a){const b=bin(h); if(b<0||fit[b]===null)continue; cor.push(Math.abs(e-fit[b]));}
  return cor.length>200?med(cor):null; }); }
const A=perOrigin("flat 365"), Bv=perOrigin("flat 365 + holidays");
const d=[]; for(let k=BURN;k<origins.length;k++){ if(A[k]===null||Bv[k]===null)continue; d.push(Bv[k]-A[k]); }
const m=med(d), sd=Math.sqrt(d.reduce((s,x)=>s+(x-m)**2,0)/(d.length-1))/Math.sqrt(d.length);
console.log(`  flat 365            median ${med(A.slice(BURN).filter(x=>x!==null))}d`);
console.log(`  flat 365 + holidays median ${med(Bv.slice(BURN).filter(x=>x!==null))}d`);
console.log(`\n  paired difference   ${m>0?"+":""}${m}d  (se ${sd.toFixed(2)})   holidays win ${d.filter(x=>x<0).length}/${d.length}`);
console.log(`  ${Math.abs(m)<=sd? "WITHIN ONE STANDARD ERROR -> no measurable value, leave it out." : (m<0?"helps":"hurts")}`);
