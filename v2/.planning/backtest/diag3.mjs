import fs from "fs";
import {S,D,CORPUS_END} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const {daily,dayLo}=E.B;
const realised=(a,b)=>{let s=0,n=0;for(let d=a;d<=b;d++){const v=daily[d-dayLo];if(v===undefined)continue;s+=v;n++;}return n?s/n:null;};
console.log("IS THE +111-DAY BIAS SIMPLY THE ACCELERATION?\n");
console.log("At each origin: the 365-day trailing rate the model uses, versus the rate DOL");
console.log("ACTUALLY ran over the following 365 days. If trailing systematically understates");
console.log("realised, the model is late by construction and the 'bias correction' is that gap.\n");
console.log("  origin      trailing 365   realised next 365   ratio   implied lateness on a 300d queue");
const ratios=[];
for(const T of origins){
  const tr=E.pace(T,365); const rz=realised(T+1,Math.min(T+365,CORPUS_END));
  if(!tr||!rz)continue;
  const r=rz/tr; ratios.push(r);
  // a queue that truly takes 300d at the realised rate is predicted to take 300*r days
  const late=Math.round(300*r-300);
  console.log(`  ${S(T)}   ${tr.toFixed(0).padStart(12)}   ${rz.toFixed(0).padStart(17)}   ${r.toFixed(2).padStart(5)}   ${(late>0?"+":"")+late}d`);
}
const s=[...ratios].sort((a,b)=>a-b);
const m=s[Math.floor(s.length/2)];
console.log(`\n  MEDIAN ratio realised/trailing = ${m.toFixed(3)}`);
console.log(`  On a queue that truly takes 1 year, that alone makes the raw model ${Math.round(365*m-365)} days late.`);
console.log(`  Reported bias correction at 11-16mo: +83d.  At 16mo+: +111d.`);
