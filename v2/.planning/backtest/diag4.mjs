import { createClient } from "@libsql/client";
import fs from "fs";
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>[l.slice(0,l.indexOf("=")).trim(),l.slice(l.indexOf("=")+1).trim().replace(/^["']|["']$/g,"")]));
const db=createClient({url:env.TURSO_DATABASE_URL,authToken:env.TURSO_AUTH_TOKEN});
console.log("CAN WE RECOVER THE 47,061 MISSING DECISION DATES?\n");
const r=await db.execute(`
  SELECT
    SUM(CASE WHEN ev.case_number IS NOT NULL THEN 1 ELSE 0 END) recoverable,
    SUM(CASE WHEN ev.case_number IS NULL THEN 1 ELSE 0 END) unrecoverable,
    COUNT(*) total
  FROM perm_case_status s
  LEFT JOIN perm_cases c ON c.case_number=s.case_number
  LEFT JOIN (SELECT DISTINCT case_number FROM perm_case_events
             WHERE to_status IN ('CERTIFIED','DENIED','WITHDRAWN')
               AND from_status NOT IN ('CERTIFIED','DENIED','WITHDRAWN')) ev
         ON ev.case_number=s.case_number
  WHERE s.is_final IN (1,'1') AND c.case_number IS NULL`);
const x=r.rows[0];
console.log(`  total censored cases                       ${Number(x.total).toLocaleString()}`);
console.log(`  we WATCHED go final (exact date known)     ${Number(x.recoverable).toLocaleString()}   <- our event log, since 2026-08-27`);
console.log(`  no observation (decided 1 Jul - 26 Aug)    ${Number(x.unrecoverable).toLocaleString()}   <- genuinely right-censored`);
console.log(`\n  recoverable share: ${(100*Number(x.recoverable)/Number(x.total)).toFixed(1)}%`);
console.log("\n  The unrecoverable block sits in the 57-day hole between the disclosure file");
console.log("  ending (30 Jun) and our sweep starting (27 Aug). DOL's FY2026 Q4 file, due");
console.log("  around November, closes it exactly.");
