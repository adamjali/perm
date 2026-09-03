import type { FlagCaseRow, FlagDisclosedRow } from "@/lib/turso/flagCases";

/**
 * One row per case across the two halves of a FLAG search. The live table
 * (DOL's daily check) has the status and is the only record of anything
 * pending; DOL's quarterly file has the decided record with the wage. A case
 * in both is one row: the live one, with the file's wage beside it. A case
 * only the file holds is listed after, with the file's status and dates.
 *
 * Plain module on purpose: the browser (a client component) and the employer
 * page (a server component) both need it, and a function exported from a
 * "use client" file is a client reference on the server, not a function.
 */
export function mergeHalves(cases: FlagCaseRow[], disclosed: FlagDisclosedRow[]): {
  wages: Map<string, FlagDisclosedRow>;
  fileOnly: FlagDisclosedRow[];
} {
  const wages = new Map<string, FlagDisclosedRow>();
  const live = new Set(cases.map((c) => c.caseNumber));
  const fileOnly: FlagDisclosedRow[] = [];
  for (const d of disclosed) {
    if (live.has(d.caseNumber)) wages.set(d.caseNumber, d);
    else fileOnly.push(d);
  }
  return { wages, fileOnly };
}

/** A compact line for a list that mixes both halves, newest first. */
export interface UnifiedFlagRow {
  caseNumber: string;
  jobTitle: string | null;
  /** Filing date from the live row, or received date from the file. */
  date: string | null;
  status: string;
  wage: number | null;
  wageUnit: string | null;
  /** Where the status came from. */
  source: "live" | "file";
}

/**
 * The two halves as one list, newest first, capped. Ties keep the live row
 * first, because its status is today's and the file's is the quarter's.
 */
export function unifiedRows(cases: FlagCaseRow[], disclosed: FlagDisclosedRow[], limit: number): UnifiedFlagRow[] {
  const { wages, fileOnly } = mergeHalves(cases, disclosed);
  const out: UnifiedFlagRow[] = cases.map((c) => {
    const d = wages.get(c.caseNumber);
    return {
      caseNumber: c.caseNumber,
      jobTitle: c.jobTitle,
      date: c.filingDate,
      status: c.status,
      wage: d?.wage ?? null,
      wageUnit: d?.wageUnit ?? null,
      source: "live",
    };
  });
  for (const d of fileOnly) {
    out.push({
      caseNumber: d.caseNumber,
      jobTitle: d.jobTitle,
      date: d.receivedDate,
      status: d.status,
      wage: d.wage,
      wageUnit: d.wageUnit,
      source: "file",
    });
  }
  out.sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da !== db) return da < db ? 1 : -1;
    if (a.source !== b.source) return a.source === "live" ? -1 : 1;
    return a.caseNumber < b.caseNumber ? 1 : -1;
  });
  return out.slice(0, Math.max(0, limit));
}
