import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
import {measurePace, estimate as est0} from "./estimator.mjs";
const NOBIAS=process.env.NOBIAS==="1";
const estimate=(i)=>{const r=est0(i); if(NOBIAS&&r.kind==="estimate"){r.day+=r.bias; r.bias=0;} return r;};
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=37;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
const BINS=[[0,60],[60,120],[120,190],[190,280]], LBL=["0-2mo","2-4mo","4-6mo","6-9mo"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
const res=BINS.map(()=>({n:0,inBand:0,w:[],err:[],early:0,late:0}));
let imminent=0, refused=0;
for(const T of origins){
  const days=[]; for(let d=T-27;d<=T;d++){const n=E.B.daily[d-E.B.dayLo]; if(n!==undefined)
    days.push({dayOfWeek:new Date(d*86400000).getUTCDay(), n});}
  const pace=measurePace(days); if(!pace)continue;
  const st=E.originState(T), lower=CORPUS_END-T+1;
  const push=(ahead,truth)=>{
    const r=estimate({today:T,casesAhead:ahead,pace,status:"ANALYST REVIEW",monthsBehindFrontier:1,sweepAgeDays:0});
    if(r.kind==="queue-clear"){imminent++;return;}
    if(r.kind!=="estimate"){refused++;return;}
    const h=r.day-T, b=bin(h); if(b<0)return;
    const o=res[b]; o.n++; o.err.push(h-truth); o.w.push(r.late-r.early);
    const tAbs=T+truth;
    if(tAbs>=r.early&&tAbs<=r.late) o.inBand++;
    else if(tAbs<r.early) o.early++; else o.late++;
  };
  for(let i=0;i<E.B.recv.length;i+=STRIDE){ if(E.B.recv[i]>T)break;
    if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
    push(E.blocking(st,E.B.recv[i]), E.B.ddec[i]-T); }
  for(const [d,c] of E.CENS){ if(d>T)break; const a=E.blocking(st,d);
    const reps=Math.max(1,Math.round(c/STRIDE)); for(let k=0;k<reps;k++) push(a,lower); }
}
console.log("BACKTEST OF THE SHIPPING DESIGN  (28d pace, scenario band only)\n");
console.log("  horizon    n        median err   band width   IN BAND   too early   too late");
for(let i=0;i<BINS.length;i++){
  const r=res[i]; if(r.n<500){console.log(`  ${LBL[i].padEnd(9)} (too few)`);continue;}
  console.log(`  ${LBL[i].padEnd(9)} ${String(r.n).padStart(7)}  ${String(med(r.err)).padStart(10)}d  ${String(med(r.w)).padStart(10)}d  ${(100*r.inBand/r.n).toFixed(0).padStart(7)}%  ${(100*r.early/r.n).toFixed(0).padStart(9)}%  ${(100*r.late/r.n).toFixed(0).padStart(8)}%`);
}
const tot=res.reduce((a,r)=>a+r.n,0), tin=res.reduce((a,r)=>a+r.inBand,0);
console.log(`\n  overall: ${(100*tin/tot).toFixed(0)}% inside the band over ${tot.toLocaleString()} predictions`);
console.log(`  also: ${imminent.toLocaleString()} answered "imminent", ${refused.toLocaleString()} refused`);
