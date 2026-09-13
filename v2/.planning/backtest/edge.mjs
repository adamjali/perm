import {measurePace, estimate, MIN_WEEKDAYS} from "./estimator.mjs";
const T=20710;  // an arbitrary "today"
const mk=(n,len=28)=>{const d=[];for(let i=0;i<len;i++){const dow=(i+1)%7;
  d.push({dayOfWeek:dow, n: (dow===0||dow===6)? Math.round(n*0.33) : n});}return d;};
const normal=measurePace(mk(800));
let pass=0, fail=0;
const T_=(name,cond,got)=>{ if(cond){pass++;console.log(`  ok    ${name}`);}
  else {fail++;console.log(`  FAIL  ${name}   got: ${JSON.stringify(got)}`);} };

console.log("EDGE CASES\n--- pace measurement ---");
T_("normal window measures a pace", normal && normal.pace>0, normal);
T_("weekend rate pulls the calendar pace below the weekday rate",
   normal.pace < normal.weekdayMean, normal);
T_("a window with too few weekdays refuses", measurePace(mk(800,6))===null);
T_("a window of all zeros refuses", measurePace(mk(0))===null);
const hol=mk(800); hol[3].n=2; hol[10].n=0;        // a holiday and a dead day
const holP=measurePace(hol);
T_("holidays are dropped, not averaged in", holP.weekdaysUsed < 20 && Math.abs(holP.weekdayMean-800)<1, holP);
const shutdown=mk(800).map((d,i)=> i<14 ? {...d,n:1} : d);
T_("a half-shutdown window still measures from the live half",
   measurePace(shutdown)!==null);
const noWeekend=Array.from({length:20},(_,i)=>({dayOfWeek:(i%5)+1,n:800}));
const nw=measurePace(noWeekend);
T_("no weekend observed -> scales by 5/7 rather than assuming zero",
   nw && Math.abs(nw.pace-800*5/7)<1, nw);

console.log("\n--- refusals ---");
const base={today:T,pace:normal,status:"ANALYST REVIEW",monthsBehindFrontier:2,sweepAgeDays:0};
T_("stale sweep refuses", estimate({...base,casesAhead:50000,sweepAgeDays:5}).reason==="stale-data");
T_("RFI refuses", estimate({...base,casesAhead:50000,status:"RFI ISSUED"}).reason==="side-queue");
T_("appeal refuses", estimate({...base,casesAhead:50000,status:"RECONSIDERATION APPEALS"}).reason==="side-queue");
T_("overdue refuses", estimate({...base,casesAhead:50000,monthsBehindFrontier:-3}).reason==="overdue");
T_("unknown case refuses", estimate({...base,casesAhead:null}).reason==="unknown-case");
T_("unmeasurable pace refuses", estimate({...base,casesAhead:50000,pace:null}).reason==="pace-unmeasurable");
T_("refusals are ordered: stale beats side-queue",
   estimate({...base,casesAhead:50000,status:"RFI ISSUED",sweepAgeDays:9}).reason==="stale-data");

console.log("\n--- boundaries ---");
T_("zero ahead -> queue-clear, not a date", estimate({...base,casesAhead:0}).kind==="queue-clear");
T_("fewer ahead than one day's output -> queue-clear",
   estimate({...base,casesAhead:Math.floor(normal.pace)-1}).kind==="queue-clear");
T_("queue-clear carries the measured wait, not a promise of immediacy",
   estimate({...base,casesAhead:10}).medianDays===34);
const justOver=estimate({...base,casesAhead:Math.ceil(normal.pace)+1});
T_("just over one day's output -> a real estimate", justOver.kind==="estimate", justOver);
const huge=estimate({...base,casesAhead:5_000_000});
T_("an absurd queue refuses rather than printing a year 3000 date",
   huge.reason==="beyond-horizon", huge);

console.log("\n--- the band must behave ---");
for(const ahead of [2000,10000,40000,70000,120000,250000]){
  const r=estimate({...base,casesAhead:ahead});
  if(r.kind!=="estimate"){console.log(`  (ahead=${ahead} -> ${r.kind})`);continue;}
  const okOrder = r.early<=r.day && r.day<=r.late;
  const okFuture = r.early>T;
  T_(`ahead ${String(ahead).padStart(7)}: band brackets the day and starts in the future (${r.late-r.early}d wide)`,
     okOrder&&okFuture, r);
}
const widths=[2000,10000,40000,70000,120000].map(a=>{const r=estimate({...base,casesAhead:a});return r.late-r.early;});
T_("band widens monotonically with the queue", widths.every((w,i)=>i===0||w>=widths[i-1]), widths);

console.log("\n--- bias ---");
const biases=[30,90,150,300].map(d=>{
  const r=estimate({...base,casesAhead:Math.round(d*normal.pace)});
  return r.kind==="estimate"?r.bias:null;});
T_("bias never exceeds 31 days in magnitude", biases.every(b=>b===null||Math.abs(b)<=31), biases);
console.log(`        bias by horizon (30/90/150/300 days): ${biases.join(", ")}`);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
