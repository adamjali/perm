import {D,S,MO,CORPUS_END,load,lbRecv,paceAt} from "./lib.mjs";

export const B=load();
const {recv,ddec,praw,daily,dayLo}=B;

/** cumulative count of still-pending-today cases filed before day x */
const pendDays=praw.map(p=>p[0]), pendCum=[]; {let s=0;for(const p of praw){pendCum.push(s);s+=p[1];}}
export function pendingBefore(x){
  let lo=0,hi=pendDays.length; while(lo<hi){const m=(lo+hi)>>1; if(pendDays[m]<x)lo=m+1;else hi=m;}
  return lo===0?0:pendCum[lo-1]+praw[lo-1][1];
}

/** Build the origin's state once: prefix count of "unresolved at T" over the received-sorted array. */
export function originState(T){
  const pre=new Int32Array(recv.length+1);
  for(let i=0;i<recv.length;i++) pre[i+1]=pre[i]+(ddec[i]>T?1:0);
  return {T,pre};
}
/** blocking as of T for a case filed on day x (upper bound = every unresolved case) */
export function blocking(st,x){ return st.pre[lbRecv(recv,x)] + pendingBefore(x); }

/** targets: cases unresolved at T whose outcome IS observable (decided by corpus end) */
export function targets(T,stride){
  const out=[];
  for(let i=0;i<recv.length;i+=stride){
    if(recv[i]>T) break;
    if(ddec[i]>T && ddec[i]<=CORPUS_END) out.push(i);
  }
  return out;
}

/* ---------------- rate models ---------------- */
export const pace=(T,W)=>paceAt(daily,dayLo,T,W);

/** cumulative decisions expected over the next H future days, given a per-day rate fn */
function cumulative(rateFn,H){
  const C=new Float64Array(H+1);
  for(let h=1;h<=H;h++) C[h]=C[h-1]+rateFn(h);
  return C;
}
/** first h where C(h) >= ahead */
function solve(C,ahead){
  if(ahead<=0) return 0;
  let lo=1,hi=C.length-1;
  if(C[hi]<ahead) return -1;                    // queue does not clear inside the horizon cap
  while(lo<hi){const m=(lo+hi)>>1; if(C[m]>=ahead)hi=m;else lo=m+1;}
  return lo;
}
const HMAX=1400;

/** MODEL A: one flat rate for the whole walk */
export function modelFlat(T,W){
  const p=pace(T,W); if(!(p>0))return null;
  const C=cumulative(()=>p,HMAX);
  return {C,describe:`flat${W}`};
}
/** MODEL B: two timescales blended smoothly by FUTURE day h */
export function modelBlend2(T,Ws,Wl,tau){
  const ps=pace(T,Ws), pl=pace(T,Wl); if(!(ps>0)||!(pl>0))return null;
  const C=cumulative(h=>{const w=Math.exp(-h/tau); return w*ps+(1-w)*pl;},HMAX);
  return {C,describe:`blend2(${Ws},${Wl},t=${tau})`};
}
/** MODEL C: three timescales, two decays */
export function modelBlend3(T,Ws,Wm,Wl,t1,t2){
  const ps=pace(T,Ws),pm=pace(T,Wm),pl=pace(T,Wl);
  if(!(ps>0)||!(pm>0)||!(pl>0))return null;
  const C=cumulative(h=>{const a=Math.exp(-h/t1),b=Math.exp(-h/t2);
    return a*ps+(b-a)*pm+(1-b)*pl;},HMAX);
  return {C,describe:`blend3(${Ws},${Wm},${Wl},${t1},${t2})`};
}
/** MODEL D wrapper: multiply the per-day rate by a calendar factor */
export function withCalendar(T,inner,cal){
  if(!inner) return null;
  const C=new Float64Array(inner.C.length);
  for(let h=1;h<C.length;h++){
    const r=inner.C[h]-inner.C[h-1];
    C[h]=C[h-1]+r*cal(T+h);
  }
  return {C,describe:inner.describe+"+cal"};
}

export function predict(model,ahead){ return model?solve(model.C,ahead):-1; }
export const HORIZON_CAP=HMAX;
