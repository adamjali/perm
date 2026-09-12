import { createClient } from "@libsql/client";
import fs from "fs";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const db=createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
// cases that are FINAL today but absent from the decided file => decided after 2026-06-30.
// They were unresolved at EVERY origin in this study, and the decided-only file cannot see them.
const r=await db.execute(`
  SELECT s.filing_date d, COUNT(*) n
  FROM perm_case_status s LEFT JOIN perm_cases c ON c.case_number=s.case_number
  WHERE s.is_final IN (1,'1') AND c.case_number IS NULL AND s.filing_date IS NOT NULL
  GROUP BY d ORDER BY d`);
fs.writeFileSync(".planning/backtest/censored.json",JSON.stringify(r.rows.map(x=>[String(x.d).slice(0,10),Number(x.n)])));
console.log(`censored (decided after the file ends): ${r.rows.reduce((a,x)=>a+Number(x.n),0).toLocaleString()} across ${r.rows.length} filing days`);
