import { createClient } from "@libsql/client";
import fs from "fs";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const db=createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
const dec=[];let off=0;
while(true){const r=await db.execute(`SELECT received_date rd, decision_date dd FROM perm_cases
 WHERE received_date IS NOT NULL AND decision_date IS NOT NULL ORDER BY rowid LIMIT 50000 OFFSET ${off}`);
 if(!r.rows.length)break;for(const x of r.rows)dec.push([String(x.rd).slice(0,10),String(x.dd).slice(0,10)]);off+=50000;}
const pend=await db.execute(`SELECT filing_date d, COUNT(*) n FROM perm_case_status
 WHERE is_final IN (0,'0') AND filing_date IS NOT NULL GROUP BY d ORDER BY d`);
const pstat=await db.execute(`SELECT current_status s, COUNT(*) n FROM perm_case_status
 WHERE is_final IN (0,'0') GROUP BY s ORDER BY n DESC`);
fs.writeFileSync(".planning/backtest/decided.json",JSON.stringify(dec));
fs.writeFileSync(".planning/backtest/pending.json",JSON.stringify(pend.rows.map(r=>[String(r.d).slice(0,10),Number(r.n)])));
fs.writeFileSync(".planning/backtest/pendstatus.json",JSON.stringify(pstat.rows.map(r=>[String(r.s),Number(r.n)])));
console.log(`decided=${dec.length}  pending-filing-dates=${pend.rows.length}  pending-total=${pend.rows.reduce((a,r)=>a+Number(r.n),0)}`);
