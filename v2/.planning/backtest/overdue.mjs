import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
import {measurePace} from "./estimator.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
// AN OVERDUE CASE WITH ALMOST NOTHING AHEAD: is it about to be decided, or stuck?
// Real outcome on 13 Sep said "about to be": a 476-day case with 74 ahead was
// certified 3 days later, and our refusal declined to say so while the rival dashboard
// called it to within 2 days. One case is not evidence. This is the measurement.
const buckets = [[0,1],[1,3],[3,10],[10,30],[30,1e9]];  // multiples of a day's output ahead
const LBL=["<1 day","1-3 days","3-10 days","10-30 days","30+ days"];
const waits=buckets.map(()=>[]);
for(const T of origins){
  const days=[]; for(let d=T-27;d<=T;d++){const n=E.B.daily[d-E.B.dayLo]; if(n!==undefined)
    days.push({dayOfWeek:new Date(d*86400000).getUTCDay(), n});}
  const pace=measurePace(days); if(!pace)continue;
  const st=E.originState(T);
  for(let i=0;i<E.B.recv.length;i+=17){
    if(E.B.recv[i]>T)break;
    if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
    const ahead=E.blocking(st,E.B.recv[i]);
    const mult=ahead/pace.pace;
    const b=buckets.findIndex(([a,z])=>mult>=a&&mult<z); if(b<0)continue;
    waits[b].push(E.B.ddec[i]-T);
  }
}
console.log("HOW LONG DOES A CASE ACTUALLY WAIT, BY HOW LITTLE IS AHEAD OF IT?\n");
console.log("  queue ahead      n        p25    MEDIAN     p75     p90   <- actual days to decision");
for(let i=0;i<buckets.length;i++){
  const w=waits[i]; if(w.length<200){console.log(`  ${LBL[i].padEnd(12)} (too few: ${w.length})`);continue;}
  console.log(`  ${LBL[i].padEnd(12)} ${String(w.length).padStart(7)}   ${String(q(w,.25)).padStart(5)}  ${String(q(w,.5)).padStart(7)}  ${String(q(w,.75)).padStart(6)}  ${String(q(w,.9)).padStart(6)}`);
}
console.log("\n  If '<1 day ahead' really meant imminent, its median would be a handful of days.");
