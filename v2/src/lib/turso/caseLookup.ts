import "server-only";

import { slugify } from "@/lib/entitySlug";
import { one } from "./client";
import { discoverCase } from "./caseDiscovery";
import {
  aheadPendingFrom,
  getLiveCensus,
  monthRowsFrom,
  statusTotalFrom,
} from "./liveCensus";

/**
 * Everything we can honestly say about ONE case, from a case number.
 *
 * The data has been sitting in `perm_case_status` (412,865 cases, 97,657 of
 * them undecided) with no way for a person to reach their own. Aggregates
 * answered "how big is the wall"; nobody could ask "where am I in it".
 *
 * WHAT THIS DELIBERATELY DOES NOT DO. It never predicts a decision date for
 * the case, and it never scores the case's odds. Every figure below is
 * either a fact about this case, or a measured rate over a named population
 * with its size shown. The distinction matters most here, because a page
 * that answers a case number feels personal and a reader will over-read a
 * number that looks tailored.
 */

export interface CaseLookupResult {
  caseNumber: string;
  /** Present when the case is in the live mirror. */
  live: {
    status: string;
    isFinal: boolean;
    filingDate: string | null;
    employerName: string | null;
    jobTitle: string | null;
    lastCheckedAt: string | null;
  } | null;
  /** Present when the case appears in DOL's decided disclosure files. */
  decided: {
    status: string;
    receivedDate: string | null;
    decisionDate: string | null;
    days: number | null;
    employerName: string | null;
    jobTitle: string | null;
    socTitle: string | null;
    state: string | null;
    wage: number | null;
  } | null;
  /** The filing-month cohort this case belongs to. */
  cohort: {
    month: string;
    total: number;
    decided: number;
    pending: number;
    decidedPct: number;
    /** Pending cases in STRICTLY EARLIER filing months. */
    aheadOfMonth: number;
    /** Still-pending cases in this same month. */
    sameMonthPending: number;
  } | null;
  /** The employer's own record in the decided corpus, when we can match it. */
  employer: {
    name: string;
    slug: string;
    total: number;
    certified: number;
    denied: number;
    approvalRate: number;
    medianDays: number | null;
  } | null;
  /** How this case's own status has historically resolved. */
  statusOutlook: {
    status: string;
    /** Cases now in this status, across every month. */
    nowInStatus: number;
  } | null;
}

/** `G-100-24158-078964` and friends, normalised for a primary-key lookup. */
export function normaliseCaseNumber(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]-\d{3}-\d{5}-\d+$/.test(raw) ? raw : null;
}

/**
 * The OTHER case-number format, and the reason lookup needs its own rule.
 *
 * MEASURED on the full tables, not sampled: `perm_cases` holds 281,691 cases
 * in the four-segment `G-100-26125-868956` form and **92,248** in a
 * three-segment `A-23043-00641` form, five digits then five. The mirror is
 * 100% G-. So `normaliseCaseNumber` above, which every alert and subscription
 * path is written against, told 92,248 people with a real case number in
 * DOL's own published records that their number was malformed.
 *
 * KEPT AS A SEPARATE FUNCTION RATHER THAN WIDENING THE ONE ABOVE. The two
 * rules serve different audiences and must not converge by accident. Alerts
 * are only meaningful for a case that can still change, and every A- case is
 * decided and years old; `src/lib/caseStatusVocabulary.ts` holds its own copy
 * of the narrow rule for exactly that path, cross-asserted by a test that
 * would break if this widened underneath it.
 */
export function normaliseLookupCaseNumber(input: string): string | null {
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  if (/^[A-Z]-\d{3}-\d{5}-\d+$/.test(raw)) return raw;
  return /^[A-Z]-\d{5}-\d{5}$/.test(raw) ? raw : null;
}

/**
 * Whether a number is the legacy three-segment form.
 *
 * The caller needs this because the two formats diverge on one thing that
 * matters: an A- number CANNOT be date-decoded. Measured over 12,000 of them,
 * reading the middle block as YYDDD lands exactly 13.4% of the time and
 * within two days 22.3%, against a G- control on the same query at 90.5% and
 * 100%. That is not an encoding with noise in it, it is a different quantity.
 * So an A- number that we cannot find yields no filing month and no cohort,
 * and the page has to say that rather than showing a month it guessed.
 */
export function isLegacyCaseNumber(caseNumber: string): boolean {
  return /^[A-Z]-\d{5}-\d{5}$/.test(caseNumber.trim().toUpperCase());
}

export async function lookupCase(input: string): Promise<CaseLookupResult | null> {
  const caseNumber = normaliseLookupCaseNumber(input);
  if (!caseNumber) return null;

  // 1. The live mirror: the only source that knows about a PENDING case.
  let live = await one<Record<string, unknown>>(
    `SELECT current_status, is_final, filing_date, employer_name, job_title,
            last_checked_at
       FROM perm_case_status WHERE case_number = ?`,
    [caseNumber],
  );

  // 2. DOL's own disclosure record, which exists only once the case is
  //    decided and carries fields the mirror does not (wage, SOC, state).
  const dec = await one<Record<string, unknown>>(
    `SELECT status, received_date, decision_date, days, employer_name,
            job_title, soc_title, state, wage
       FROM perm_cases WHERE case_number = ?`,
    [caseNumber],
  );

  if (!live && !dec) {
    // A three-way miss becomes a live DOL question. A real case filed last
    // week is not in the corpus (the seed was a closed set), and telling its
    // owner "not found" was both wrong and a dead end. discoverCase asks
    // DOL's own endpoint, records a hit so the daily sweep owns it from
    // tomorrow, and degrades to null on a genuine miss, a timeout, or an
    // exhausted global budget - in which case the old answer stands.
    const found = await discoverCase(caseNumber);
    if (!found) {
      return {
        caseNumber, live: null, decided: null, cohort: null,
        employer: null, statusOutlook: null,
      };
    }
    live = {
      current_status: found.status,
      is_final: found.isFinal ? 1 : 0,
      filing_date: found.filingDate,
      employer_name: found.employerName,
      job_title: found.jobTitle,
      last_checked_at: found.lastCheckedAt,
    };
  }

  const filing =
    (live?.filing_date as string) ?? (dec?.received_date as string) ?? null;
  const month = filing ? filing.slice(0, 7) : null;

  // 3. The cohort. Two different questions, kept separate on purpose:
  //    how far along is MY month, and how much sits in front of it.
  //
  //    FOLDED FROM THE PRECOMPUTED CENSUS, not queried. This route is
  //    dynamic, and the two aggregates this block used to run per request
  //    (a cohort group-by plus an unbounded ahead-of-month count) were most
  //    of what made one lookup cost ~1.8M row reads. The census is one doc
  //    read shared by every consumer in the render.
  const census = await getLiveCensus();
  let cohort: CaseLookupResult["cohort"] = null;
  if (month && census) {
    let total = 0;
    let done = 0;
    for (const r of monthRowsFrom(census.matrix, month)) {
      total += r.n;
      if (r.is_final === 1) done += r.n;
    }
    if (total > 0) {
      cohort = {
        month,
        total,
        decided: done,
        pending: total - done,
        decidedPct: (done / total) * 100,
        aheadOfMonth: aheadPendingFrom(census.matrix, month),
        sameMonthPending: total - done,
      };
    }
  }

  // 4. The employer's own record. The mirror and the disclosure files spell
  //    employers differently ("Psomagen, Inc." vs "Psomagen Inc"), so the
  //    join goes through the same slug the entity pages already use rather
  //    than through the raw string, which matches almost nothing.
  let employer: CaseLookupResult["employer"] = null;
  const empName =
    (live?.employer_name as string) ?? (dec?.employer_name as string) ?? null;
  if (empName) {
    const slug = slugify(empName);
    const e = await one<Record<string, unknown>>(
      `SELECT name, slug, total, certified, denied, median_days
         FROM perm_entities WHERE kind = 'employer' AND slug = ?`,
      [slug],
    );
    if (e) {
      const total = Number(e.total) || 0;
      const certified = Number(e.certified) || 0;
      employer = {
        name: String(e.name),
        slug: String(e.slug),
        total,
        certified,
        denied: Number(e.denied) || 0,
        approvalRate: total > 0 ? (certified / total) * 100 : 0,
        medianDays: e.median_days === null ? null : Number(e.median_days),
      };
    }
  }

  // 5. What this status IS, in scale terms. Deliberately NOT "how likely you
  //    are to be certified from here" - the mirror is one snapshot per case,
  //    so it cannot observe transitions and cannot support that claim.
  // Folded from the census: the COUNT(*) this used to run has no usable
  // index and scanned all 414k rows per lookup. No live fallback on
  // purpose - if the census is missing the block is withheld, because the
  // fallback IS the cost bug.
  let statusOutlook: CaseLookupResult["statusOutlook"] = null;
  if (live && !Number(live.is_final) && census) {
    const n = statusTotalFrom(census.matrix, String(live.current_status));
    if (n > 0) {
      statusOutlook = {
        status: String(live.current_status),
        nowInStatus: n,
      };
    }
  }

  return {
    caseNumber,
    live: live
      ? {
          status: String(live.current_status),
          isFinal: Number(live.is_final) === 1,
          filingDate: (live.filing_date as string) ?? null,
          employerName: (live.employer_name as string) ?? null,
          jobTitle: (live.job_title as string) ?? null,
          lastCheckedAt: (live.last_checked_at as string) ?? null,
        }
      : null,
    decided: dec
      ? {
          status: String(dec.status),
          receivedDate: (dec.received_date as string) ?? null,
          decisionDate: (dec.decision_date as string) ?? null,
          days: dec.days === null ? null : Number(dec.days),
          employerName: (dec.employer_name as string) ?? null,
          jobTitle: (dec.job_title as string) ?? null,
          socTitle: (dec.soc_title as string) ?? null,
          state: (dec.state as string) ?? null,
          wage: dec.wage === null ? null : Number(dec.wage),
        }
      : null,
    cohort,
    employer,
    statusOutlook,
  };
}
