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
T_("no weekend in the window -> refuses (a broken feed, not a 7-day DOL)",
   measurePace(noWeekend)===null, measurePace(noWeekend));
// A federal holiday is a normal calendar day and must stay IN the rate; only a
// sustained collapse is excluded. Otherwise we project 5 clean weekdays into
// every future week and read ~11% high.
const withHol=mk(800); withHol[3].n=2;
T_("an isolated holiday stays in the rate (it is part of the calendar)",
   measurePace(withHol).pace < measurePace(mk(800)).pace, 
   {withHoliday:measurePace(withHol).pace.toFixed(1), clean:measurePace(mk(800)).pace.toFixed(1)});
const shut2=mk(800).map((d,i)=> i>=5&&i<=11 ? {...d,n:1} : d);
// The right assertion is that the collapse leaves the rate UNCHANGED, not that
// it is above some number I guessed: a clean fixture here paces at 647, and my
// first assertion of >700 was reasoning about a weekday-only rate.
T_("a sustained collapse IS excluded (rate matches the clean window)",
   Math.abs(measurePace(shut2).pace - measurePace(mk(800)).pace) < 1,
   {collapsed:measurePace(shut2).pace.toFixed(2), clean:measurePace(mk(800)).pace.toFixed(2),
    daysUsed:measurePace(shut2).daysUsed});

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

console.log("\n--- no fitted parameters ---");
const r1=estimate({...base,casesAhead:60000});
T_("the estimate is exactly today + queue/pace, nothing added",
   r1.day===T+Math.round(60000/normal.pace), {day:r1.day, expect:T+Math.round(60000/normal.pace)});
T_("no bias field is emitted at all", !("bias" in r1), Object.keys(r1));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
