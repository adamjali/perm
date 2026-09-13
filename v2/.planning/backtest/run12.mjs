import fs from "fs";
const acc=JSON.parse(fs.readFileSync(".planning/backtest/scoped.json","utf8"));
const W=JSON.parse(fs.readFileSync("weights.tmp.json","utf8"));
const q=(a,p)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.floor(p*(s.length-1))]:NaN;};
const med=a=>q(a,.5);
const LBL=["0-2mo","2-4mo","4-6mo","6-9mo"];
console.log("\nERROR WEIGHTED BY TODAY'S ACTUAL POPULATION");
console.log(`weights: ${LBL.map((l,i)=>l+" "+(100*W[i]).toFixed(0)+"%").join("  ")}\n`);
console.log("  window   weighted median err   weighted 80% band width");
const out=[];
for(const [w,bins] of Object.entries(acc)){
  if(bins.some(b=>b.length<200)) continue;
  let e=0, bw=0;
  bins.forEach((b,i)=>{
    const bias=med(b), c=b.map(x=>x-bias);
    e  += W[i]*med(c.map(Math.abs));
    bw += W[i]*(q(c,.9)-q(c,.1));
  });
  out.push({w:+w,e,bw});
}
out.sort((a,b)=>a.e-b.e);
for(const o of out) console.log(`  ${String(o.w).padStart(5)}d  ${o.e.toFixed(1).padStart(18)}d  ${o.bw.toFixed(0).padStart(22)}d`);
console.log("\nBAND WIDTH BY HORIZON for the top few (after removing that bucket's own bias):\n");
console.log("  window  " + LBL.map(l=>l.padStart(10)).join(""));
for(const o of out.slice(0,5)){
  const bins=acc[String(o.w)];
  console.log(`  ${String(o.w).padStart(5)}d  ` + bins.map(b=>{const bias=med(b),c=b.map(x=>x-bias);
    return String(q(c,.9)-q(c,.1)).padStart(10);}).join(""));
}
