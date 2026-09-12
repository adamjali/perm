import fs from "fs";
import {S} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=53, SCALE=Number(process.env.BLOCK_SCALE||"1");
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5), mAbs=a=>med(a.map(Math.abs));
const sched=h=>h<60?10:h<120?14:h<365?365:270;

const FIX=[
  ["frozen 10/14/365/270", T=>({bench:1,p0:E.pace(T,270)})],
  ["flat 120",  T=>E.modelFlat(T,120)],
  ["flat 180",  T=>E.modelFlat(T,180)],
  ["flat 240",  T=>E.modelFlat(T,240)],
  ["flat 270",  T=>E.modelFlat(T,270)],
  ["flat 365",  T=>E.modelFlat(T,365)],
  ["blend 14/365 t=45",  T=>E.modelBlend2(T,14,365,45)],
  ["blend 14/365 t=90",  T=>E.modelBlend2(T,14,365,90)],
  ["blend 14/365 t=180", T=>E.modelBlend2(T,14,365,180)],
  ["blend 28/365 t=90",  T=>E.modelBlend2(T,28,365,90)],
  ["blend 28/270 t=90",  T=>E.modelBlend2(T,28,270,90)],
  ["blend 56/365 t=90",  T=>E.modelBlend2(T,56,365,90)],
];
const out=FIX.map(()=>[]);
for(const T of origins){
  const st=E.originState(T), tg=E.targets(T,STRIDE);
  const ahead=tg.map(i=>E.blocking(st,E.B.recv[i])*SCALE);
  const truth=tg.map(i=>E.B.ddec[i]-T);
  FIX.forEach(([name,mk],fi)=>{
    const mod=mk(T);
    if(!mod||(mod.bench&&!(mod.p0>0))){out[fi].push(null);return;}
    const errs=[];
    for(let k=0;k<tg.length;k++){
      let h;
      if(mod.bench){ h=ahead[k]/mod.p0; let ok=true;
        for(let it=0;it<3;it++){const p=E.pace(T,sched(h)); if(!(p>0)){ok=false;break;} h=ahead[k]/p;}
        if(!ok)continue; h=Math.round(h);
      } else { h=E.predict(mod,ahead[k]); if(h<0)continue; }
      errs.push(h-truth[k]);
    }
    out[fi].push(errs.length>50?errs:null);
  });
}
console.log(`FIXED CONFIGS on all ${origins.length} mature origins   (block_scale=${SCALE})\n`);
console.log("  model                 med-of-med   P90-of-med   med bias   origins   beats frozen");
const frozen=out[0];
FIX.forEach(([name],fi)=>{
  const meds=[],biases=[]; let beat=0,cmp=0;
  out[fi].forEach((e,oi)=>{ if(!e)return; meds.push(mAbs(e)); biases.push(med(e));
    if(frozen[oi]){cmp++; if(mAbs(e)<mAbs(frozen[oi]))beat++;} });
  console.log(`  ${name.padEnd(22)} ${String(med(meds)).padStart(9)}    ${String(q(meds,.9)).padStart(9)}   ${String(med(biases)).padStart(8)}   ${String(meds.length).padStart(7)}   ${fi===0?"    -":String(beat)+"/"+cmp}`);
});
fs.writeFileSync(".planning/backtest/fixed.json",JSON.stringify({names:FIX.map(f=>f[0]),origins,out}));
