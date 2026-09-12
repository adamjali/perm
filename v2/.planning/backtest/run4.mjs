import fs from "fs";
import {S} from "./lib.mjs";
const {names,origins,out}=JSON.parse(fs.readFileSync(".planning/backtest/fixed.json","utf8"));
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5), mAbs=a=>med(a.map(Math.abs));
const BURN=10;
console.log("BIAS CORRECTED OUT OF SAMPLE  (bias for origin k from origins < k only)\n");
console.log("  model                 raw med   corrected med   corrected P90   coverage of +/-45d");
const rows=[];
names.forEach((nm,fi)=>{
  const raw=[],cor=[],cov=[];
  for(let k=BURN;k<origins.length;k++){
    const e=out[fi][k]; if(!e)continue;
    const prior=[]; for(let i=0;i<k;i++){ const p=out[fi][i]; if(p) prior.push(med(p)); }
    if(prior.length<BURN*0.6)continue;
    const b=med(prior);                       // out-of-sample bias estimate
    raw.push(mAbs(e));
    const ce=e.map(x=>x-b);
    cor.push(mAbs(ce));
    cov.push(ce.filter(x=>Math.abs(x)<=45).length/ce.length);
  }
  if(!cor.length)return;
  rows.push({nm,raw:med(raw),cor:med(cor),p90:q(cor,.9),cov:med(cov)});
});
rows.sort((a,b)=>a.cor-b.cor);
for(const r of rows) console.log(`  ${r.nm.padEnd(22)} ${String(r.raw).padStart(6)}    ${String(r.cor).padStart(11)}     ${String(r.p90).padStart(11)}   ${(100*r.cov).toFixed(0).padStart(15)}%`);
console.log("\n  'coverage of +/-45d' = share of cases landing inside a 90-day-wide displayed band,");
console.log("  which is the product cap. Read it as: what an honest label would have to say.\n");
