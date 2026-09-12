import fs from "fs";
import {S} from "./lib.mjs";
import * as E from "./engine.mjs";
const origins=JSON.parse(fs.readFileSync(".planning/backtest/origins.json","utf8")).filter(o=>o.mature).map(o=>o.t);
const STRIDE=53, BLOCK_SCALE=Number(process.env.BLOCK_SCALE||"1");
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5), mAbs=a=>med(a.map(Math.abs));

const FLAT=[56,90,120,150,180,240,270,365,450,540];
const BW_S=[10,14,28,56], BW_L=[180,270,365], BTAU=[20,45,90,180];
const cfgs=[];
for(const W of FLAT) cfgs.push({k:`A|${W}`,fam:"A",make:T=>E.modelFlat(T,W)});
for(const s of BW_S) for(const l of BW_L) for(const t of BTAU)
  cfgs.push({k:`B|${s}|${l}|${t}`,fam:"B",make:T=>E.modelBlend2(T,s,l,t)});
// frozen benchmark: the current spec's horizon-switched schedule
const sched=h=>h<60?10:h<120?14:h<365?365:270;
cfgs.push({k:"BENCH",fam:"BENCH",make:T=>{
  const p0=E.pace(T,270); if(!(p0>0))return null;
  return {bench:true,T,p0,describe:"frozen 10/14/365/270"};
}});

console.log(`configs=${cfgs.length}  origins=${origins.length}  block_scale=${BLOCK_SCALE}\n`);
const per=[];   // per origin: Map(cfgKey -> {errs, hs})
for(const T of origins){
  const st=E.originState(T), tg=E.targets(T,STRIDE);
  const ahead=tg.map(i=>E.blocking(st,E.B.recv[i])*BLOCK_SCALE);
  const truth=tg.map(i=>E.B.ddec[i]-T);
  const m=new Map();
  for(const c of cfgs){
    const mod=c.make(T); if(!mod)continue;
    const errs=[],hs=[];
    if(mod.bench){
      for(let k=0;k<tg.length;k++){
        let h=ahead[k]/mod.p0, ok=true;
        for(let it=0;it<3;it++){const p=E.pace(T,sched(h)); if(!(p>0)){ok=false;break;} h=ahead[k]/p;}
        if(!ok)continue;
        h=Math.round(h); errs.push(h-truth[k]); hs.push(h);
      }
    } else {
      for(let k=0;k<tg.length;k++){const h=E.predict(mod,ahead[k]); if(h<0)continue; errs.push(h-truth[k]); hs.push(h);}
    }
    if(errs.length>50) m.set(c.k,{errs,hs});
  }
  per.push({t:T,m});
}
const avail=k=>per.filter(o=>o.m.has(k)).length;
console.log("availability (origins where the config could be computed at all):");
console.log(`  BENCH ${avail("BENCH")}/${per.length}   A|270 ${avail("A|270")}/${per.length}   B|10|365|45 ${avail("B|10|365|45")}/${per.length}\n`);

/* ---------- NESTED ROLLING-ORIGIN ---------- */
const BURN=10;
function pick(family,upto){            // choose using ONLY origins [0,upto)
  let best=null;
  for(const c of cfgs){
    if(family&&c.fam!==family)continue;
    if(c.fam==="BENCH")continue;
    const v=[]; for(let i=0;i<upto;i++){const e=per[i].m.get(c.k); if(e)v.push(mAbs(e.errs));}
    if(v.length<upto*0.8)continue;
    const s=med(v); if(!best||s<best.s)best={k:c.k,s};
  }
  return best;
}
const res={A:[],B:[],BENCH:[]}, chosen={A:[],B:[]};
for(let k=BURN;k<per.length;k++){
  for(const fam of ["A","B"]){
    const p=pick(fam,k); chosen[fam].push(p?p.k:"-");
    const e=p?per[k].m.get(p.k):null;
    res[fam].push(e?mAbs(e.errs):NaN);
  }
  const b=per[k].m.get("BENCH"); res.BENCH.push(b?mAbs(b.errs):NaN);
}
console.log("=========== NESTED ROLLING-ORIGIN (parameters chosen ONLY from earlier origins) ===========\n");
console.log("  test origin   benchmark   best-flat(A)   blend2(B)    A chose        B chose");
for(let i=0;i<res.A.length;i++){
  const T=per[BURN+i].t;
  const f=v=>Number.isFinite(v)?String(v).padStart(5):"    -";
  console.log(`  ${S(T)}   ${f(res.BENCH[i])}       ${f(res.A[i])}        ${f(res.B[i])}    ${chosen.A[i].padEnd(12)}   ${chosen.B[i]}`);
}
const fin=a=>a.filter(Number.isFinite);
console.log("\n  MEDIAN of per-origin median abs error, over held-out origins only:");
for(const k of ["BENCH","A","B"]) console.log(`    ${k.padEnd(6)} ${med(fin(res[k]))}d   (scored on ${fin(res[k]).length} origins)`);
let bw=0,aw=0,tie=0;
for(let i=0;i<res.A.length;i++){ if(!Number.isFinite(res.A[i])||!Number.isFinite(res.B[i]))continue;
  if(res.B[i]<res.A[i])bw++; else if(res.A[i]<res.B[i])aw++; else tie++; }
console.log(`\n  blend2 beats best-flat in ${bw} of ${bw+aw+tie} held-out origins (flat wins ${aw}, tie ${tie})`);
let bb=0,n=0; for(let i=0;i<res.A.length;i++){ if(!Number.isFinite(res.BENCH[i]))continue; n++;
  if(Math.min(res.A[i],res.B[i])<res.BENCH[i])bb++; }
console.log(`  best of A/B beats the frozen benchmark in ${bb} of ${n} held-out origins`);
fs.writeFileSync(".planning/backtest/nested.json",JSON.stringify({res,chosen,origins:per.map(o=>o.t)}));
