import fs from "fs";
import {S,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const W=JSON.parse(fs.readFileSync("weights.tmp.json","utf8"));
const STRIDE=37;
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
const BINS=[[0,60],[60,120],[120,190],[190,280]], LBL=["0-2mo","2-4mo","4-6mo","6-9mo"];
const bin=h=>BINS.findIndex(([a,z])=>h>=a&&h<z);
// weekday-only pace: what the rivals divide by (28d window, weekdays only)
function weekdayPace(T,Wd){
  const v=[]; for(let d=T-Wd+1;d<=T;d++){ const dow=new Date(d*86400000).getUTCDay();
    if(dow===0||dow===6) continue; const n=E.B.daily[d-E.B.dayLo]; if(n!==undefined) v.push(n); }
  if(v.length<5) return null;
  const s=[...v].sort((a,b)=>a-b), m=s[Math.floor(s.length/2)];
  const keep=v.filter(x=>x>=m*0.15);
  return keep.reduce((a,b)=>a+b,0)/v.length;
}
const MODELS={
  "THEIRS: 28d weekday pace": {pace:(T)=>weekdayPace(T,28), correct:false},
  "OURS-A: 14d calendar":     {pace:(T)=>E.pace(T,14),      correct:true},
  "OURS-B: 365d calendar":    {pace:(T)=>E.pace(T,365),     correct:true},
};
const acc={}; for(const k of Object.keys(MODELS)) acc[k]=BINS.map(()=>[]);
for(const T of origins){
  const st=E.originState(T), lower=CORPUS_END-T+1;
  const p={}; for(const [k,m] of Object.entries(MODELS)) p[k]=m.pace(T);
  const push=(ahead,truth)=>{ for(const k of Object.keys(MODELS)){ const r=p[k]; if(!(r>0))continue;
    const h=Math.round(ahead/r); const b=bin(h); if(b>=0) acc[k][b].push(h-truth); } };
  for(let i=0;i<E.B.recv.length;i+=STRIDE){ if(E.B.recv[i]>T)break;
    if(!(E.B.ddec[i]>T&&E.B.ddec[i]<=CORPUS_END))continue;
    push(E.blocking(st,E.B.recv[i]), E.B.ddec[i]-T); }
  for(const [d,c] of E.CENS){ if(d>T)break; const a=E.blocking(st,d);
    const reps=Math.max(1,Math.round(c/STRIDE)); for(let k=0;k<reps;k++) push(a,lower); }
}
console.log("HEAD TO HEAD on identical cases, weighted by today's population\n");
console.log("  model                       weighted err   weighted band   bias 0-2 / 2-4 / 4-6mo");
for(const [k,bins] of Object.entries(acc)){
  const corr=MODELS[k].correct;
  let e=0,bw=0; const biases=[];
  bins.forEach((b,i)=>{ if(b.length<200){biases.push(NaN);return;}
    const bias=corr?med(b):0; biases.push(med(b));
    const c=b.map(x=>x-bias);
    e+=W[i]*med(c.map(Math.abs)); bw+=W[i]*(q(c,.9)-q(c,.1)); });
  console.log(`  ${k.padEnd(27)} ${e.toFixed(1).padStart(11)}d ${bw.toFixed(0).padStart(14)}d   ${biases.slice(0,3).map(x=>String(x).padStart(5)).join(" /")}`);
}
console.log("\n  (THEIRS is scored with NO bias correction, which is what they ship.)");
