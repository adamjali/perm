import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=37, W=28;
const QLO=Number(process.env.QLO||'0.25'), QHI=Number(process.env.QHI||'0.75');
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
// the rival tracker's shape: a band from the SPREAD OF THE PACE ITSELF, not from forecast error.
// early = queue / fast pace, late = queue / slow pace.
// They publish pace p25/p75; we use the same quantiles of daily counts in the window.
function paceQuantiles(T){
  // WEEKDAY AND WEEKEND ARE DIFFERENT POPULATIONS AND MUST NOT BE POOLED.
  // A first version took p25/p75 over ALL days in the window; the p25 landed on
  // a Saturday, so the "slow" scenario was literally "every day is a weekend"
  // and the band came out 208 days wide (5 Dec to 1 Jul). The rival tracker avoids this
  // by publishing weekday quantiles (p25 775 / p75 953 around a weekday_avg of
  // 804) and a separate weekend_avg. Same construction here.
  const wd=[], we=[];
  for(let d=T-W+1;d<=T;d++){
    const n=E.B.daily[d-E.B.dayLo]; if(n===undefined) continue;
    const dow=new Date(d*86400000).getUTCDay();
    (dow===0||dow===6 ? we : wd).push(n);
  }
  if(wd.length<8) return null;
  const sw=[...wd].sort((a,b)=>a-b), m=sw[Math.floor(sw.length/2)];
  const act=sw.filter(x=>x>=m*0.15);                    // drop shutdown-level weekdays
  if(act.length<6) return null;
  const weMean=we.length?we.reduce((a,b)=>a+b,0)/we.length:0;
  // a weekday scenario converted to a CALENDAR rate: 5 weekdays + 2 weekend days
  const cal=w=>(w*5+weMean*2)/7;
  return {
    mid : cal(act.reduce((a,b)=>a+b,0)/act.length),
    fast: cal(act[Math.floor(QHI*(act.length-1))]),
    slow: cal(act[Math.floor(QLO*(act.length-1))]),
  };
}
const BINS=[[0,60],[60,120],[120,190],[190,280]], LBL=["0-2mo","2-4mo","4-6mo","6-9mo"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const res=BINS.map(()=>({n:0,inSc:0,w:[],err:[]}));
for(const T of origins){
  const st=E.originState(T), pq=paceQuantiles(T); if(!pq)continue;
  const lower=CORPUS_END-T+1;
  const push=(ahead,truth)=>{
    const h=Math.round(ahead/pq.mid), b=bin(h); if(b<0)return;
    const early=Math.round(ahead/pq.fast), late=Math.round(ahead/pq.slow);
    const r=res[b]; r.n++; r.err.push(h-truth); r.w.push(late-early);
    if(truth>=early && truth<=late) r.inSc++;
  };
  for(let i=0;i<E.B.recv.length;i+=STRIDE){ if(E.B.recv[i]>T)break;
    if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
    push(E.blocking(st,E.B.recv[i]), E.B.ddec[i]-T); }
  for(const [d,c] of E.CENS){ if(d>T)break; const a=E.blocking(st,d);
    const reps=Math.max(1,Math.round(c/STRIDE)); for(let k=0;k<reps;k++) push(a,lower); }
}
console.log(`pace quantiles p${(QLO*100).toFixed(0)} / p${(QHI*100).toFixed(0)}`);
console.log("  horizon    n        median err   band width   ACTUAL coverage");
for(let i=0;i<BINS.length;i++){
  const r=res[i]; if(r.n<500){console.log(`  ${LBL[i].padEnd(9)} (too few)`);continue;}
  console.log(`  ${LBL[i].padEnd(9)} ${String(r.n).padStart(7)}  ${String(med(r.err)).padStart(10)}d  ${String(med(r.w)).padStart(10)}d  ${(100*r.inSc/r.n).toFixed(0).padStart(15)}%`);
}
//console.log("\n  the rival tracker ships this shape and calls it nothing. The rival dashboard calls its own '80%'.");
