import fs from "fs";
import {D,S,TODAY,CORPUS_END,load,lbRecv,pendingBefore,paceAt} from "./lib.mjs";
const B=load();
console.log("================ AUDIT 1: HISTORICAL QUEUE RECONSTRUCTION ================\n");
console.log(`decided corpus     ${B.n.toLocaleString()} cases, decisions ${S(B.dayLo)} .. ${S(B.dayHi)}`);
console.log(`still pending now  ${B.praw.reduce((a,r)=>a+r[1],0).toLocaleString()} cases`);
console.log(`corpus end         ${S(CORPUS_END)}  <- nothing decided after this is visible\n`);

console.log("HOW THE QUEUE IS REBUILT AT ORIGIN T, for a target filed on date x:");
console.log("  blocking(T,x) = |{decided : received < x AND decision > T}|      <- unresolved at T, later resolved");
console.log("                + |{pending today : filing   < x}|                 <- unresolved at T, STILL unresolved");
console.log("  The two sets are disjoint. The second term is the censoring correction:");
console.log("  those rows are absent from the decided-only file at EVERY historical origin.\n");

// origins: 1st + 15th
const origins=[];
for(let y=2024;y<=2026;y++) for(let m=1;m<=12;m++) for(const dd of ["01","15"]){
  const t=D(`${y}-${String(m).padStart(2,"0")}-${dd}`);
  if(t>=D("2024-10-01")&&t<=D("2026-02-15")) origins.push(t);
}
console.log(`ORIGINS: ${origins.length}, twice monthly ${S(origins[0])} .. ${S(origins[origins.length-1])}\n`);

console.log("PER-ORIGIN MATURITY AND CENSORING");
console.log("  origin      pending@T   still pending now   unobservable   max window   verdict");
const rows=[];
for(const T of origins){
  // everyone unresolved at T
  let openDecided=0; for(let i=0;i<B.recv.length;i++){ if(B.recv[i]>T) break; if(B.ddec[i]>T) openDecided++; }
  const openPending=pendingBefore(B.praw,T+1);
  const open=openDecided+openPending;
  const unobs=openPending/open;                       // share of the T-queue whose outcome we can never score
  const maxW=T-B.dayLo+1;
  const mature = unobs<0.25 && maxW>=365;
  rows.push({T,open,openPending,unobs,maxW,mature});
  console.log(`  ${S(T)}  ${String(open).padStart(9)}   ${String(openPending).padStart(17)}   ${(100*unobs).toFixed(1).padStart(11)}%   ${String(maxW).padStart(10)}   ${mature?"mature":"IMMATURE"}`);
}
fs.writeFileSync(".planning/backtest/origins.json",JSON.stringify(rows.map(r=>({t:r.T,mature:r.mature,unobs:r.unobs,maxW:r.maxW}))));
const mat=rows.filter(r=>r.mature);
console.log(`\n  ${mat.length} of ${rows.length} origins are mature (under 25% unobservable AND >=365d of rate history).`);
console.log(`  Scoring uses only those. The rest are reported, never scored.`);
