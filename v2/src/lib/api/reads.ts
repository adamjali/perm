/**
 * What the API and the assistant tools answer, built from the same reads the
 * pages use. /v1 and /mcp both call these, so an endpoint and its tool can't
 * disagree.
 *
 * Every answer names its source and the date its data is true for, and links
 * the page it came from. Nothing here asks DOL live: the API answers from our
 * own records, which the nightly and afternoon sweeps keep current.
 */
import "server-only";

import { SITE_URL } from "@/lib/constants/site";
import { normaliseFlagCaseNumber, type FlagProgram } from "@/lib/flagCaseNumber";
import { isEntityKind, type EntityKind } from "@/lib/entityPayload";
import { lookupCase } from "@/lib/turso/caseLookup";
import { one } from "@/lib/turso/client";
import { getEntityBySlug, getLiveBacklog } from "@/lib/turso/publicData";
import { searchByName } from "@/lib/turso/entities";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { pwd } from "@/lib/turso/pwdCases";
import { lca } from "@/lib/turso/lcaCases";
import { seasonal } from "@/lib/turso/seasonalCases";
import { estimatePermCase, loadPermEstimateContext } from "@/lib/turso/permEstimate";

export interface ApiMeta {
  /** Who published the underlying records. */
  source: string;
  /** The date the data is true for, `YYYY-MM-DD`, when one applies. */
  asOf: string | null;
  /** The page on permtracker.app that shows the same thing. */
  url: string;
}

export type ReadResult<T> =
  | { ok: true; data: T; meta: ApiMeta }
  | { ok: false; status: 400 | 404 | 503; code: string; message: string; url?: string };

const DOL_SOURCE = "U.S. Department of Labor, FLAG case status (flag.dol.gov) and OFLC disclosure files";
const PROGRAM_NAMES: Record<FlagProgram, string> = {
  perm: "PERM labor certification",
  pwd: "prevailing wage determination",
  lca: "H-1B labor condition application",
  seasonal: "H-2A or H-2B seasonal program",
};
const FLAG_PROGRAMS = { pwd, lca, seasonal } as const;

const bad = (message: string): ReadResult<never> => ({ ok: false, status: 400, code: "bad_request", message });
const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : null);

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

export interface CaseRecord {
  caseNumber: string;
  program: FlagProgram;
  programName: string;
  status: string | null;
  isFinal: boolean;
  filingDate: string | null;
  employer: string | null;
  jobTitle: string | null;
  /** When the sweep last asked DOL about this case. */
  statusCheckedOn: string | null;
  /** DOL's decided record, once a disclosure file carries the case. */
  decision: Record<string, unknown> | null;
  /** PERM only: where the case's filing month stands in the queue. */
  queue: {
    filingMonth: string;
    casesFiledThatMonth: number;
    decidedFromThatMonth: number;
    pendingFromThatMonth: number;
    pendingFromEarlierMonths: number;
  } | null;
}

export async function readCase(input: string): Promise<ReadResult<CaseRecord>> {
  if (input.length > 40) return bad("That isn't a case number.");
  const ref = normaliseFlagCaseNumber(input);
  if (!ref) {
    return bad("That isn't a case number. PERM numbers look like G-100-26045-123456, prevailing wage P-100-..., H-1B I-200-....");
  }
  const url = `${SITE_URL}/perm-case-status?case=${encodeURIComponent(ref.caseNumber)}`;
  const notFound: ReadResult<never> = {
    ok: false,
    status: 404,
    code: "not_found",
    message:
      "No record of this case yet. New filings are found nightly; the case page on the site can ask DOL right now.",
    url,
  };

  if (ref.program === "perm") {
    const r = await lookupCase(ref.caseNumber, { discover: false });
    if (!r || (!r.live && !r.decided)) return notFound;
    const d = r.decided;
    return {
      ok: true,
      data: {
        caseNumber: r.caseNumber,
        program: "perm",
        programName: PROGRAM_NAMES.perm,
        status: r.live?.status ?? d?.status ?? null,
        isFinal: r.live ? r.live.isFinal : true,
        filingDate: r.live?.filingDate ?? d?.receivedDate ?? null,
        employer: r.live?.employerName ?? d?.employerName ?? null,
        jobTitle: r.live?.jobTitle ?? d?.jobTitle ?? null,
        statusCheckedOn: day(r.live?.lastCheckedAt),
        decision: d
          ? {
              status: d.status,
              receivedDate: d.receivedDate,
              decisionDate: d.decisionDate,
              daysToDecision: d.days,
              occupation: d.socTitle,
              worksiteState: d.state,
              offeredWage: d.wage,
            }
          : null,
        queue: r.cohort
          ? {
              filingMonth: r.cohort.month,
              casesFiledThatMonth: r.cohort.total,
              decidedFromThatMonth: r.cohort.decided,
              pendingFromThatMonth: r.cohort.sameMonthPending,
              pendingFromEarlierMonths: r.cohort.aheadOfMonth,
            }
          : null,
      },
      meta: { source: DOL_SOURCE, asOf: day(r.live?.lastCheckedAt) ?? d?.decisionDate ?? null, url },
    };
  }

  const program = FLAG_PROGRAMS[ref.program];
  const [row, disc] = await Promise.all([
    program.lookup(ref.caseNumber, { discover: false }),
    program.lookupDisclosed(ref.caseNumber).catch(() => null),
  ]);
  if (!row && !disc) return notFound;
  return {
    ok: true,
    data: {
      caseNumber: ref.caseNumber,
      program: ref.program,
      programName: PROGRAM_NAMES[ref.program],
      status: row?.status ?? disc?.status ?? null,
      isFinal: row ? row.isFinal : true,
      filingDate: row?.filingDate ?? disc?.receivedDate ?? null,
      employer: row?.employerName ?? disc?.employerName ?? null,
      jobTitle: row?.jobTitle ?? disc?.jobTitle ?? null,
      statusCheckedOn: day(row?.lastCheckedAt),
      decision: disc
        ? {
            status: disc.status,
            receivedDate: disc.receivedDate,
            decisionDate: disc.decisionDate,
            occupation: disc.socTitle,
            occupationCode: disc.socCode,
            wage: disc.wage,
            wageUnit: disc.wageUnit,
            worksiteState: disc.worksiteState,
            visaClass: disc.visaClass,
            lawFirm: disc.attorneyName,
          }
        : null,
      queue: null,
    },
    meta: { source: DOL_SOURCE, asOf: day(row?.lastCheckedAt) ?? disc?.decisionDate ?? null, url },
  };
}

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

export async function readQueue(): Promise<ReadResult<Record<string, unknown>>> {
  const [pt, backlog] = await Promise.all([getProcessingTimes(), getLiveBacklog().catch(() => [])]);
  if (!pt) return { ok: false, status: 503, code: "unavailable", message: "DOL's processing times aren't loaded right now. Try again later." };
  return {
    ok: true,
    data: {
      perm: {
        asOf: pt.permAsOf,
        queues: pt.permQueues.map((q) => ({ queue: q.queue, workingOnMonth: q.priorityDate, asPrinted: q.raw })),
        averageDays: pt.permAverageDays.map((a) => ({
          determination: a.determination,
          month: a.month,
          calendarDays: a.calendarDays,
        })),
      },
      prevailingWage: {
        asOf: pt.pwdAsOf,
        queues: pt.pwdQueues,
        permRequestsPending: pt.pwdPermBacklog,
      },
      pendingPermByFilingMonth: backlog.map((m) => ({
        month: m.month,
        filed: m.total,
        decided: m.decided,
        pending: m.pending,
        inAnalystReview: m.analystReview ?? null,
      })),
    },
    meta: {
      source: "U.S. Department of Labor, FLAG processing times; pending counts from PERM Tracker's sweep of DOL case statuses",
      asOf: pt.permAsOf,
      url: `${SITE_URL}/perm-processing-times`,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Visa bulletin                                                       */
/* ------------------------------------------------------------------ */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function readBulletin(month?: string | null): Promise<ReadResult<Record<string, unknown>>> {
  if (month && !MONTH_RE.test(month)) return bad("month must look like 2026-10.");
  const cols = "bulletin_month, source_url, final_action, dates_for_filing, family_final_action, family_dates_for_filing";
  const r = month
    ? await one<Record<string, string | null>>(`SELECT ${cols} FROM visa_bulletins WHERE bulletin_month = ?`, [month])
    : await one<Record<string, string | null>>(`SELECT ${cols} FROM visa_bulletins ORDER BY bulletin_month DESC LIMIT 1`);
  if (!r) {
    const span = await one<{ first: string | null; last: string | null }>(
      "SELECT min(bulletin_month) AS first, max(bulletin_month) AS last FROM visa_bulletins",
    ).catch(() => null);
    return {
      ok: false,
      status: 404,
      code: "not_found",
      message: span?.first
        ? `No bulletin held for that month. The archive runs from ${span.first} to ${span.last}, with a few months missing.`
        : "No bulletin held for that month.",
    };
  }
  const parse = (v: string | null | undefined) => (v ? JSON.parse(v) : null);
  const m = r.bulletin_month as string;
  return {
    ok: true,
    data: {
      month: m,
      cells: "As printed: a date like 15JAN13, C (current: every priority date may proceed) or U (unavailable).",
      employment: { finalAction: parse(r.final_action), datesForFiling: parse(r.dates_for_filing) },
      family: { finalAction: parse(r.family_final_action), datesForFiling: parse(r.family_dates_for_filing) },
      sourceUrl: r.source_url,
    },
    meta: { source: "U.S. Department of State, Visa Bulletin", asOf: `${m}-01`, url: `${SITE_URL}/visa-bulletin/${m}` },
  };
}

/* ------------------------------------------------------------------ */
/* Employers, law firms, occupations                                   */
/* ------------------------------------------------------------------ */

/** The URL segment for each kind, and the site's page for it. */
export const ENTITY_PATHS: Record<string, { kind: EntityKind; page: string }> = {
  employers: { kind: "employer", page: "/perm-employers" },
  "law-firms": { kind: "attorney", page: "/perm-attorneys" },
  occupations: { kind: "occupation", page: "/perm-wages" },
};

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;

function entityData(kind: EntityKind, page: string, e: NonNullable<Awaited<ReturnType<typeof getEntityBySlug>>>) {
  const decided = e.certified + e.denied;
  return {
    kind,
    slug: e.slug,
    name: e.name,
    rankByVolume: e.rank,
    publishedCases: e.total,
    certified: e.certified,
    denied: e.denied,
    certifiedShare: decided > 0 ? Math.round((e.certified / decided) * 1000) / 1000 : null,
    medianDaysToDecision: e.medianDays,
    medianAnnualWage: e.medianAnnualWage,
    state: e.state,
    occupationCode: kind === "occupation" ? e.code : null,
    filingsLast12Months: e.recent12m,
    url: `${SITE_URL}${page}/${e.slug}`,
  };
}

export async function readEntity(kind: EntityKind, slug: string): Promise<ReadResult<Record<string, unknown>>> {
  if (!isEntityKind(kind)) return bad("Unknown kind.");
  if (!SLUG_RE.test(slug)) return bad("That isn't a valid name in a URL. Search by name first to find it.");
  const page = Object.values(ENTITY_PATHS).find((p) => p.kind === kind)!.page;
  const e = await getEntityBySlug(kind, slug);
  if (!e) return { ok: false, status: 404, code: "not_found", message: "No page by that name. Search by name to find the right one." };
  return {
    ok: true,
    data: entityData(kind, page, e),
    meta: {
      source: "U.S. Department of Labor, OFLC PERM disclosure files (decided cases)",
      asOf: null,
      url: `${SITE_URL}${page}/${e.slug}`,
    },
  };
}

export async function searchEntities(kind: EntityKind, q: string, limit = 25): Promise<ReadResult<Record<string, unknown>>> {
  if (!isEntityKind(kind)) return bad("Unknown kind.");
  const needle = q.trim();
  if (needle.length < 2 || needle.length > 120) return bad("Search with 2 to 120 characters.");
  const take = Math.min(Math.max(1, Math.floor(limit)), 100);
  const page = Object.values(ENTITY_PATHS).find((p) => p.kind === kind)!.page;
  const found = await searchByName(kind, needle, take + 1);
  return {
    ok: true,
    data: {
      results: found.slice(0, take).map((e) => entityData(kind, page, e)),
      // One more was asked for so the answer can say there are more, rather
      // than imply it found everything.
      more: found.length > take,
    },
    meta: { source: "U.S. Department of Labor, OFLC PERM disclosure files (decided cases)", asOf: null, url: `${SITE_URL}${page}?q=${encodeURIComponent(needle)}` },
  };
}

/* ------------------------------------------------------------------ */
/* Estimate                                                            */
/* ------------------------------------------------------------------ */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function readEstimate(args: { caseNumber?: string | null; filed?: string | null }): Promise<
  ReadResult<Record<string, unknown>>
> {
  const today = new Date().toISOString().slice(0, 10);
  let filingDate: string | null = null;
  let status = "ANALYST REVIEW";
  let url = `${SITE_URL}/tools/perm-timeline-calculator`;

  if (args.caseNumber) {
    const ref = normaliseFlagCaseNumber(args.caseNumber.slice(0, 40));
    if (!ref) return bad("That isn't a case number.");
    if (ref.program !== "perm") return bad("Decision estimates cover PERM cases (G-100-...). Use /v1/queue for the wage-request queue.");
    url = `${SITE_URL}/perm-case-status?case=${encodeURIComponent(ref.caseNumber)}`;
    const r = await lookupCase(ref.caseNumber, { discover: false });
    if (!r || (!r.live && !r.decided)) {
      return { ok: false, status: 404, code: "not_found", message: "No record of this case yet, so no estimate. Try again tomorrow, or pass filed=YYYY-MM-DD.", url };
    }
    if ((r.live ? r.live.isFinal : true) || r.decided) {
      return {
        ok: true,
        data: { kind: "decided", status: r.live?.status ?? r.decided?.status ?? null, decisionDate: r.decided?.decisionDate ?? null },
        meta: { source: DOL_SOURCE, asOf: day(r.live?.lastCheckedAt) ?? r.decided?.decisionDate ?? null, url },
      };
    }
    filingDate = r.live?.filingDate ?? null;
    status = r.live?.status ?? status;
  } else if (args.filed) {
    if (!DATE_RE.test(args.filed)) return bad("filed must look like 2026-02-15.");
    if (args.filed > today) return bad("filed can't be in the future.");
    filingDate = args.filed;
  } else {
    return bad("Pass case=G-100-... or filed=YYYY-MM-DD.");
  }
  if (!filingDate) return { ok: false, status: 404, code: "not_found", message: "This case has no filing date on record, so no estimate.", url };

  const ctx = await loadPermEstimateContext();
  const { estimate, casesAhead } = estimatePermCase(ctx, { filingDate, status }, today);
  const meta: ApiMeta = {
    source: "PERM Tracker's estimate, from DOL's published queue and the decision pace our sweep measures. An estimate, not a promise.",
    asOf: today,
    url,
  };
  if (!estimate) {
    return { ok: true, data: { kind: "none", filingDate, status, note: "No model can give this case a defensible date." }, meta };
  }
  if (estimate.kind === "no-date") {
    return { ok: true, data: { kind: "no-date", filingDate, status, note: estimate.note, waitedDays: estimate.age }, meta };
  }
  return {
    ok: true,
    data: {
      kind: "date",
      filingDate,
      status,
      estimatedDate: estimate.estimatedDate,
      earliest: estimate.earliestDate,
      latest: estimate.latestDate,
      model: estimate.modelLabel,
      basis: estimate.basis,
      pendingCasesAhead: casesAhead,
      caveats: estimate.caveats,
    },
    meta,
  };
}
