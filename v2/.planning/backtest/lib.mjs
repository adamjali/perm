import fs from "fs";
export const D=s=>Math.floor(Date.parse(s+"T00:00:00Z")/86400000);
export const S=d=>new Date(d*86400000).toISOString().slice(0,10);
export const MO=t=>new Date(t*86400000).getUTCMonth();
export const TODAY=D("2026-09-12");
export const CORPUS_END=D("2026-06-30");   // last decision date the disclosure file carries

export function load(dir=".planning/backtest"){
  const dec=JSON.parse(fs.readFileSync(dir+"/decided.json","utf8"))
    .map(r=>({r:D(r[0]),d:D(r[1])})).filter(c=>!isNaN(c.r)&&!isNaN(c.d)&&c.d>=c.r);
  dec.sort((a,b)=>a.r-b.r);
  const recv=Int32Array.from(dec.map(c=>c.r)), ddec=Int32Array.from(dec.map(c=>c.d));
  // cases STILL pending today, bucketed by filing day -> cumulative by received-day
  const praw=JSON.parse(fs.readFileSync(dir+"/pending.json","utf8"))
    .map(([d,n])=>[D(d),n]).filter(([d])=>!isNaN(d)).sort((a,b)=>a[0]-b[0]);
  // daily decision counts
  let lo=Infinity,hi=-Infinity; for(const d of ddec){if(d<lo)lo=d;if(d>hi)hi=d;}
  const daily=new Int32Array(hi-lo+2); for(const d of ddec) daily[d-lo]++;
  return {recv,ddec,praw,daily,dayLo:lo,dayHi:hi,n:dec.length};
}

/** index of first case with received >= x */
export function lbRecv(recv,x){let lo=0,hi=recv.length;while(lo<hi){const m=(lo+hi)>>1;if(recv[m]<x)lo=m+1;else hi=m;}return lo;}

/** cases still pending TODAY that were filed strictly before x */
export function pendingBefore(praw,x){let n=0;for(const [d,c] of praw){if(d>=x)break;n+=c;}return n;}

/**
 * Decisions in [a,b] inclusive. Calendar denominator is the caller's business.
 */
export function decidedIn(daily,dayLo,a,b){
  let s=0; const A=Math.max(a,dayLo), B=Math.min(b,dayLo+daily.length-1);
  for(let d=A;d<=B;d++) s+=daily[d-dayLo];
  return s;
}

/** trailing mean decisions per CALENDAR day over window W ending at T, shutdown-level days dropped from the numerator only */
export function paceAt(daily,dayLo,T,W){
  if(T-W+1<dayLo) return null;                       // not enough history: refuse rather than guess
  const v=[]; for(let d=T-W+1;d<=T;d++) v.push(daily[d-dayLo]||0);
  const s=[...v].sort((a,b)=>a-b), med=s[Math.floor(s.length/2)];
  if(!(med>0)) return null;
  return v.filter(x=>x>=med*0.15).reduce((a,b)=>a+b,0)/W;
}
