import { createClient } from "@libsql/client";
import fs from "fs";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const db=createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
console.log("THE THIRD INVISIBLE GROUP: pending at T, decided AFTER the disclosure file ends.\n");
console.log("Live-status rows that are FINAL but absent from the decided file (so decided after 2026-06-30),");
console.log("by filing month:\n");
const r=await db.execute(`
  SELECT substr(s.filing_date,1,7) m, COUNT(*) n
  FROM perm_case_status s
  LEFT JOIN perm_cases c ON c.case_number = s.case_number
  WHERE s.is_final IN (1,'1') AND c.case_number IS NULL AND s.filing_date >= '2024-01-01'
  GROUP BY m ORDER BY m`);
let tot=0; for(const x of r.rows) tot+=Number(x.n);
for(const x of r.rows) console.log(`  ${x.m}  ${String(Number(x.n)).padStart(7)}`);
console.log(`\n  TOTAL filed 2024+ and decided after the file ends: ${tot.toLocaleString()}`);
const inCorpus=await db.execute(`SELECT COUNT(*) n FROM perm_cases WHERE received_date>='2024-01-01'`);
console.log(`  in the decided file for the same filing period:     ${Number(inCorpus.rows[0].n).toLocaleString()}`);
console.log(`  => invisible share of that population: ${(100*tot/(tot+Number(inCorpus.rows[0].n))).toFixed(1)}%`);
