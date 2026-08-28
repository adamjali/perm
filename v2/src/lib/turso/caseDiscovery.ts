/**
 * Lookup-side replenishment: unknown case numbers are asked of DOL live,
 * shown to the visitor, and recorded.
 *
 * WHY THIS EXISTS. The corpus was a closed set: the daily sweep only
 * re-checks case numbers already in `perm_case_status` (verified 2026-08-28:
 * still exactly the 414,050 rows the mirror seed left). Nothing added new
 * filings, so the pending pool could only drain and every month after the
 * freeze would read emptier than it is. This module opens the set from the
 * demand side: a lookup that misses our table queries DOL's own batch
 * endpoint (one case, one request), renders the real status instead of
 * "not found", and inserts the row - after which the daily sweep re-checks
 * it forever. Every visitor grows the corpus.
 *
 * THE CHECKLIST FOR A PUBLIC SURFACE THAT PROXIES A FEDERAL ENDPOINT:
 * - the cheap shape gate runs first and for free: `normaliseLookupCaseNumber`
 *   refuses junk before this module is ever reached;
 * - the budget is GLOBAL, on the shared resource itself (requests we send
 *   DOL), because a per-IP limit cannot stop identity rotation and 2,000
 *   misses a day is far beyond organic use;
 * - the write is `INSERT OR IGNORE` - idempotent, a read-through cache of a
 *   public record, never an act of consent;
 * - a miss, a timeout, or an exhausted budget all degrade to the page's
 *   existing not-found state. Nothing here can take the lookup down.
 *
 * NO EVENT IS WRITTEN. Discovering a case is an observation, not a status
 * transition; fabricating a `perm_case_events` row stamped today is exactly
 * the reconciliation-as-transition bug the ingest's --reconcile flag exists
 * to avoid. The events start with the sweep's next real change.
 */

import { parseCaseNumber } from "@/lib/permCaseNumber";
import { exec, one } from "./client";

/**
 * Byte-identical to `FINAL_STATUSES` in scripts/ingest_case_status_direct.py,
 * and pinned by a parity test that reads the Python. Two writers deciding
 * `is_final` differently is a flip-flop, not redundancy.
 */
export const FINAL_STATUSES = new Set([
  "CERTIFIED",
  "CERTIFIED - EXPIRED",
  "DENIED",
  "WITHDRAWN",
  "CERTIFIED-EXPIRED",
]);

/**
 * Distinct from the ingest's source string on purpose: a row's provenance
 * should say whether the sweep found it or a visitor did. The event-source
 * filter in the RFI blend matches the INGEST's string exactly and events
 * are never written here, so the two cannot interact.
 */
export const DISCOVERY_SOURCE =
  "flag.dol.gov/recaptcha/caseStatus (DOL, via lookup)";

/** Requests we are willing to send DOL for strangers per rolling UTC day. */
export const DAILY_DISCOVERY_CAP = 2000;

const ENDPOINT = "https://flag.dol.gov/recaptcha/caseStatus";

export interface DolCaseRecord {
  caseNumber: string;
  caseStatus: string;
  employerName: string | null;
  jobTitle: string | null;
  submittedDate: string | null;
  visaType: string | null;
}

/**
 * One case number against DOL's batch endpoint. Null on any failure - the
 * caller renders its ordinary miss state, never an error.
 */
export async function fetchDolCase(
  caseNumber: string,
  f: typeof fetch = fetch,
): Promise<DolCaseRecord | null> {
  try {
    const res = await f(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([caseNumber]),
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      value?: {
        caseNumber?: string;
        caseStatus?: string;
        employerName?: string;
        jobTitle?: string;
        submittedDate?: string;
        visaType?: string;
      }[];
    };
    // The endpoint is a SEARCH and can return scored neighbours. Only an
    // exact match may render: a near-miss shown as the visitor's case is
    // somebody else's record on their screen.
    const hit = body.value?.find(
      (v) => v.caseNumber?.toUpperCase() === caseNumber.toUpperCase(),
    );
    if (!hit?.caseStatus) return null;
    return {
      caseNumber,
      caseStatus: hit.caseStatus,
      employerName: hit.employerName ?? null,
      jobTitle: hit.jobTitle ?? null,
      submittedDate: hit.submittedDate ?? null,
      visaType: hit.visaType ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Count this attempt against the day and say whether it may proceed.
 *
 * Increment-then-check: refused attempts still count, which means a flood
 * exhausts the counter without ever reaching DOL - the counter protects
 * DOL, not itself. The upsert races under concurrency and can overshoot by
 * a few; a soft cap two orders of magnitude above organic traffic does not
 * need to be exact.
 */
async function underDailyBudget(now: Date): Promise<boolean> {
  const key = `discovery_budget_${now.toISOString().slice(0, 10)}`;
  await exec(
    `INSERT INTO perm_docs (key, json, computed_at) VALUES (?, '1', ?)
     ON CONFLICT(key) DO UPDATE SET
       json = CAST(CAST(json AS INTEGER) + 1 AS TEXT),
       computed_at = excluded.computed_at`,
    [key, now.getTime()],
  );
  const row = await one<{ n: number }>(
    `SELECT CAST(json AS INTEGER) AS n FROM perm_docs WHERE key = ?`,
    [key],
  );
  return (row?.n ?? Number.MAX_SAFE_INTEGER) < DAILY_DISCOVERY_CAP;
}

export interface DiscoveredCase {
  status: string;
  isFinal: boolean;
  filingDate: string | null;
  employerName: string | null;
  jobTitle: string | null;
  lastCheckedAt: string;
}

/**
 * The composite the lookup calls on a miss: budget, fetch, record, return.
 */
export async function discoverCase(
  caseNumber: string,
  f: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<DiscoveredCase | null> {
  // The page wraps its lookup in .catch(() => null), so a throw from here
  // renders as an ordinary "no record" - a silent failure indistinguishable
  // from a genuine miss. First deploy proved it: the budget INSERT failed in
  // the Vercel runtime and nothing anywhere said so. Every failure below is
  // caught and NAMED in the function logs instead.
  try {
    if (!(await underDailyBudget(now))) {
      console.error("[caseDiscovery] daily budget refused", caseNumber);
      return null;
    }
  } catch (e) {
    console.error("[caseDiscovery] budget write failed:", e);
    return null;
  }

  const rec = await fetchDolCase(caseNumber, f);
  if (!rec) {
    console.error("[caseDiscovery] DOL returned no exact match", caseNumber);
    return null;
  }

  const isFinal = FINAL_STATUSES.has(rec.caseStatus.trim().toUpperCase());
  // The number's own YYDDD segment, exact for 94.6% of the corpus and equal
  // to submittedDate for 409,127 of 414,050 rows; DOL's date is the
  // fallback, not the lead, because the decode is what every queue figure
  // keys on.
  const filingDate =
    parseCaseNumber(caseNumber)?.filingDate ?? rec.submittedDate ?? null;
  const lastCheckedAt = now.toISOString();

  try {
    await exec(
      `INSERT OR IGNORE INTO perm_case_status
         (case_number, filing_date, current_status, is_final, is_disclosed,
          employer_name, job_title, submitted_date, last_checked_at, verified,
          source, fetched_at)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, 1, ?, ?)`,
      [
        caseNumber,
        filingDate,
        rec.caseStatus,
        isFinal ? 1 : 0,
        rec.employerName,
        rec.jobTitle,
        rec.submittedDate,
        lastCheckedAt,
        DISCOVERY_SOURCE,
        now.getTime(),
      ],
    );
  } catch (e) {
    // The visitor still gets the truth DOL just told us; only the recording
    // failed, and the log names it rather than the page hiding it.
    console.error("[caseDiscovery] record failed:", e);
  }

  return {
    status: rec.caseStatus,
    isFinal,
    filingDate,
    employerName: rec.employerName,
    jobTitle: rec.jobTitle,
    lastCheckedAt,
  };
}
