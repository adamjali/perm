/**
 * What a sandbox key (pt_test_) gets: fixed sample answers, in the same shape
 * as the live ones, for building and testing against without touching the
 * live records or spending an allowance.
 *
 * NOTHING HERE IS A REAL RECORD. The case numbers carry day 000, a day DOL's
 * numbering never issues, so a sample can't be mistaken for somebody's case;
 * the employers and law firm are made up. Every answer's `meta.source` says
 * it's sample data. A request the samples don't cover answers 404 and names
 * the samples that exist.
 *
 * Pure and synchronous: no database, no Convex, no network.
 */
import type { ReadResult } from "./reads";

export const SANDBOX_SOURCE = "PERM Tracker sandbox: fixed sample data for building and testing, not a real record";
const AS_OF = "2026-10-01";
const SITE = "https://permtracker.app";

const meta = (url: string, asOf: string | null = AS_OF) => ({ source: SANDBOX_SOURCE, asOf, url: `${SITE}${url}` });

/** The sample cases, by number: one pending PERM case, one decided, a wage request and an LCA. */
export const SANDBOX_CASES: Record<string, Record<string, unknown>> = {
  "G-100-26000-000101": {
    caseNumber: "G-100-26000-000101",
    program: "perm",
    programName: "PERM labor certification",
    status: "ANALYST REVIEW",
    isFinal: false,
    filingDate: "2026-02-10",
    employer: "Example Robotics LLC",
    jobTitle: "Software Engineer",
    statusCheckedOn: AS_OF,
    decision: null,
    queue: {
      filingMonth: "2026-02",
      casesFiledThatMonth: 9_800,
      decidedFromThatMonth: 410,
      pendingFromThatMonth: 9_390,
      pendingFromEarlierMonths: 31_200,
    },
  },
  "G-100-26000-000102": {
    caseNumber: "G-100-26000-000102",
    program: "perm",
    programName: "PERM labor certification",
    status: "CERTIFIED",
    isFinal: true,
    filingDate: "2025-06-02",
    employer: "Example Robotics LLC",
    jobTitle: "Data Scientist",
    statusCheckedOn: AS_OF,
    decision: {
      status: "Certified",
      receivedDate: "2025-06-02",
      decisionDate: "2026-04-14",
      daysToDecision: 316,
      occupation: "Data Scientists",
      worksiteState: "CA",
      offeredWage: 165_000,
    },
    queue: null,
  },
  "P-100-26000-000103": {
    caseNumber: "P-100-26000-000103",
    program: "pwd",
    programName: "prevailing wage determination",
    status: "IN PROCESS",
    isFinal: false,
    filingDate: "2026-08-20",
    employer: "Example Robotics LLC",
    jobTitle: "Software Engineer",
    statusCheckedOn: AS_OF,
    decision: null,
    queue: null,
  },
  "I-200-26000-000104": {
    caseNumber: "I-200-26000-000104",
    program: "lca",
    programName: "H-1B labor condition application",
    status: "CERTIFIED",
    isFinal: true,
    filingDate: "2026-03-03",
    employer: "Sample Analytics Inc.",
    jobTitle: "Machine Learning Engineer",
    statusCheckedOn: AS_OF,
    decision: {
      status: "Certified",
      receivedDate: "2026-03-03",
      decisionDate: "2026-03-10",
      occupation: "Software Developers",
      occupationCode: "15-1252",
      wage: 148_000,
      wageUnit: "Year",
      worksiteState: "WA",
      visaClass: "H-1B",
      lawFirm: "Sample & Partners LLP",
    },
    queue: null,
  },
};

const ENTITIES = {
  employer: [
    {
      kind: "employer",
      slug: "example-robotics-llc",
      name: "Example Robotics LLC",
      rankByVolume: 1_204,
      publishedCases: 86,
      certified: 81,
      denied: 2,
      certifiedShare: 0.976,
      medianDaysToDecision: 312,
      filingsLast12Months: 22,
      url: `${SITE}/perm-employers/example-robotics-llc`,
    },
    {
      kind: "employer",
      slug: "sample-analytics-inc",
      name: "Sample Analytics Inc.",
      rankByVolume: 3_870,
      publishedCases: 19,
      certified: 18,
      denied: 0,
      certifiedShare: 1,
      medianDaysToDecision: 298,
      filingsLast12Months: 5,
      url: `${SITE}/perm-employers/sample-analytics-inc`,
    },
  ],
  attorney: [
    {
      kind: "attorney",
      slug: "sample-partners-llp",
      name: "Sample & Partners LLP",
      rankByVolume: 412,
      publishedCases: 640,
      certified: 598,
      denied: 11,
      certifiedShare: 0.982,
      medianDaysToDecision: 305,
      state: "NY",
      filingsLast12Months: 140,
      url: `${SITE}/perm-attorneys/sample-partners-llp`,
    },
  ],
  occupation: [
    {
      kind: "occupation",
      slug: "software-developers",
      name: "Software Developers",
      rankByVolume: 1,
      publishedCases: 50_000,
      certified: 48_900,
      denied: 600,
      certifiedShare: 0.988,
      medianDaysToDecision: 301,
      occupationCode: "15-1252",
      medianAnnualWage: 152_000,
      filingsLast12Months: 14_000,
      url: `${SITE}/perm-wages/software-developers`,
    },
  ],
} as const;

const KIND_BY_SEGMENT: Record<string, keyof typeof ENTITIES> = {
  employers: "employer",
  "law-firms": "attorney",
  occupations: "occupation",
};
const PAGE_BY_KIND: Record<keyof typeof ENTITIES, string> = {
  employer: "/perm-employers",
  attorney: "/perm-attorneys",
  occupation: "/perm-wages",
};

const notInSandbox = (message: string): ReadResult<never> => ({ ok: false, status: 404, code: "not_found", message });

export const SANDBOX_CASE_NUMBERS = Object.keys(SANDBOX_CASES);

/** One sample case, or a 404 naming the ones that exist. */
export function sandboxCase(input: string, opts: { live?: boolean } = {}): ReadResult<Record<string, unknown>> {
  const n = input.trim().toUpperCase();
  const c = SANDBOX_CASES[n];
  if (!c) {
    return notInSandbox(
      `The sandbox holds four sample cases: ${SANDBOX_CASE_NUMBERS.join(", ")}. A live key looks up any real case.`,
    );
  }
  return {
    ok: true,
    data: opts.live ? { ...c, askedDolLive: true } : c,
    meta: meta(`/perm-case-status?case=${encodeURIComponent(n)}`),
  };
}

/** Sample search results for a kind, matched by a case-insensitive substring. */
export function sandboxSearch(kind: keyof typeof ENTITIES, q: string): ReadResult<Record<string, unknown>> {
  const needle = q.trim().toLowerCase();
  if (needle.length < 2 || needle.length > 120) {
    return { ok: false, status: 400, code: "bad_request", message: "Search with 2 to 120 characters." };
  }
  const results = ENTITIES[kind].filter((e) => e.name.toLowerCase().includes(needle));
  return { ok: true, data: { results, more: false }, meta: meta(`${PAGE_BY_KIND[kind]}?q=${encodeURIComponent(needle)}`) };
}

/** Every sample record of a kind, for a sandbox export. */
export function sandboxEntities(kind: keyof typeof ENTITIES): readonly Record<string, unknown>[] {
  return ENTITIES[kind];
}

function sandboxEntity(kind: keyof typeof ENTITIES, slug: string): ReadResult<Record<string, unknown>> {
  const e = ENTITIES[kind].find((x) => x.slug === slug);
  if (!e) {
    return notInSandbox(`The sandbox's sample ${kind === "attorney" ? "law firms" : `${kind}s`} are: ${ENTITIES[kind].map((x) => x.slug).join(", ")}.`);
  }
  return {
    ok: true,
    data: {
      ...e,
      pendingNow: { pending: 12, casesTracked: 98, byStatus: [{ status: "ANALYST REVIEW", cases: 12 }], oldestPendingFiled: "2025-11-04", asOf: AS_OF },
    },
    meta: meta(`${PAGE_BY_KIND[kind]}/${slug}`),
  };
}

const SAMPLE_QUEUE = {
  perm: {
    asOf: AS_OF,
    queues: [{ queue: "Analyst Review", workingOnMonth: "2025-12", asPrinted: "December 2025" }],
    averageDays: [{ determination: "Analyst Review", month: "2026-09", calendarDays: 470 }],
  },
  prevailingWage: { asOf: AS_OF, queues: [], permRequestsPending: 21_000 },
  pendingPermByFilingMonth: [
    { month: "2026-01", filed: 10_100, decided: 900, pending: 9_200, inAnalystReview: 9_050 },
    { month: "2026-02", filed: 9_800, decided: 410, pending: 9_390, inAnalystReview: 9_300 },
  ],
};

const SAMPLE_BULLETIN = {
  month: "2026-10",
  cells: "As printed: a date like 15JAN13, C (current: every priority date may proceed) or U (unavailable).",
  employment: {
    finalAction: { EB2: { "ALL CHARGEABILITY AREAS EXCEPT THOSE LISTED": "01APR24", INDIA: "01JAN13" } },
    datesForFiling: { EB2: { "ALL CHARGEABILITY AREAS EXCEPT THOSE LISTED": "01OCT24", INDIA: "01JUN13" } },
  },
  family: { finalAction: null, datesForFiling: null },
  sourceUrl: "https://travel.state.gov/",
};

const SAMPLE_ESTIMATE = {
  kind: "date",
  filingDate: "2026-02-10",
  status: "ANALYST REVIEW",
  estimatedDate: "2026-12-04",
  earliest: "2026-11-27",
  latest: "2026-12-17",
  model: "Decision pace",
  basis: "Sample: cases ahead divided by DOL's measured pace.",
  pendingCasesAhead: 40_100,
  caveats: ["Sample data: the sandbox's estimate never changes."],
};

/**
 * The sandbox's answer for a /v1 read, by its path (`/v1/...`). Paths the
 * samples don't cover answer 404 saying so, never a live read.
 */
export function sandboxAnswer(url: URL, params: Record<string, string>): ReadResult<unknown> {
  const parts = url.pathname.replace(/^\/v1\/?/, "").split("/").filter(Boolean);
  const [head, second] = parts;
  if (head === "cases" && params.caseNumber) {
    return sandboxCase(params.caseNumber, { live: url.searchParams.get("live") === "1" });
  }
  if (head === "queue") return { ok: true, data: SAMPLE_QUEUE, meta: meta("/perm-processing-times") };
  if (head === "visa-bulletin") return { ok: true, data: SAMPLE_BULLETIN, meta: meta("/visa-bulletin/2026-10", "2026-10-01") };
  if (head === "estimate") return { ok: true, data: SAMPLE_ESTIMATE, meta: meta("/tools/perm-timeline-calculator") };
  const kind = head ? KIND_BY_SEGMENT[head] : undefined;
  if (kind) {
    return second ? sandboxEntity(kind, params.slug ?? second) : sandboxSearch(kind, url.searchParams.get("q") ?? "");
  }
  return notInSandbox("The sandbox has no sample answer for this address. See the samples at https://permtracker.app/developers#sandbox.");
}
