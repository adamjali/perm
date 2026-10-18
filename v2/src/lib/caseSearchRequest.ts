/**
 * The case search's request, read and planned: every shape guard, the lead an
 * index can seek on, and the filters that lead can carry. One function, so the
 * site's search (/api/case-search) and the API's export (/v1/exports/cases)
 * accept the same parameters, refuse the same malformed ones with the same
 * words, and drop the same filters a lead can't serve.
 *
 * See src/app/api/case-search/route.ts for why each guard exists and why the
 * request, not the browser, enforces the plan.
 */
import {
  FILTER_KEYS,
  FIELD_RE,
  MAX_FIELD,
  NAICS_RE,
  availableOutcomes,
  chooseLead,
  filterAvailability,
  withStageNarrow,
  isOutcome,
  isWageSource,
  type FilterKey,
  type Outcome,
  type ResolvedEntity,
} from "@/lib/caseSearchPlan";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { searchStageFromSlug } from "@/lib/searchStages";
import { nameCandidates, occupationChoices } from "@/lib/db/nameSuggest";
import type { UnifiedNarrow } from "@/lib/db/caseSearchReads";
import {
  PROGRAMS,
  UNIFIED_MAX,
  isProgram,
  isSearchOrder,
  type Program,
  type SearchOrder,
  type UnifiedSearchArgs,
} from "@/lib/db/unifiedSearch";
import { SEARCH_TEXT_MAX, SEARCH_TEXT_MIN } from "@/lib/search/limits";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const STATE_RE = /^[A-Z]{2}$/;
const FY_RE = /^\d{4}$/;
// Ahead of any comparison work: `v.string()`-scale input reaches a route
// handler, and a length cap is the cheap guard that belongs before anything
// that walks the string.
/** Above any real annual wage, and small enough that a typo is refused. */
const MAX_WAGE = 100_000_000;


/** A month parameter, or null. Throws nothing: the caller reports the 400. */
function month(p: URLSearchParams, key: string): { ok: true; value: string } | { ok: false } {
  const raw = (p.get(key) ?? "").trim();
  if (!raw) return { ok: true, value: "" };
  return MONTH_RE.test(raw) ? { ok: true, value: raw } : { ok: false };
}

/**
 * A worker or job field: empty, a value, or "bad". The length cap runs
 * before the character test, as the house rule for public endpoints says.
 */
function field(p: URLSearchParams, key: string): string | "bad" {
  const raw = (p.get(key) ?? "").trim();
  if (!raw) return "";
  if (raw.length > MAX_FIELD || !FIELD_RE.test(raw)) return "bad";
  return raw.replace(/\s+/g, " ");
}

function wage(p: URLSearchParams, key: string): number | null | "bad" {
  const raw = (p.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_WAGE) return "bad";
  return Math.round(n);
}

/** Names offered beside the one a box resolved to. */
const ALTERNATIVES = 7;

/**
 * Turn typed words into the key an index can seek on, through the site's name
 * resolvers (the page's slug exactly, else the closest name by the matcher), so
 * this box and the sponsor finder's job box answer the same words the same way.
 * A firm keys on its slug; an occupation on its SOC code, one choice per group.
 * A read that fails throws to the route's 503: a failed lookup is never "no match".
 */
async function resolveEntity(
  kind: "attorney" | "occupation",
  text: string,
): Promise<ResolvedEntity | null> {
  const keyed =
    kind === "attorney"
      ? (await nameCandidates(kind, text, ALTERNATIVES + 1)).map((c) => ({
          slug: c.slug, name: c.name, total: c.cases, key: c.slug,
        }))
      : (await occupationChoices(text, ALTERNATIVES + 1)).map((c) => ({
          slug: c.slug, name: c.name, total: c.cases, key: c.code,
        }));
  const [top, ...rest] = keyed;
  if (!top) return null;
  return { ...top, alternatives: rest.map(({ slug, name, total }) => ({ slug, name, total })) };
}

export interface Resolved {
  firm: ResolvedEntity | null;
  occupation: ResolvedEntity | null;
}

export type CaseSearchRequest =
  | { kind: "bad"; message: string }
  | { kind: "needsLead"; csv: boolean; resolved: Resolved }
  | { kind: "search"; csv: boolean; args: UnifiedSearchArgs; resolved: Resolved; dropped: FilterKey[] };

const fail = (message: string): CaseSearchRequest => ({ kind: "bad", message });

/**
 * Read a case search's parameters. `maxLimit` caps the rows one answer may
 * hold (the site's 1,000; an API export's plan cap), never above UNIFIED_MAX.
 */
export async function planCaseSearch(
  p: URLSearchParams,
  opts: { maxLimit?: number } = {},
): Promise<CaseSearchRequest> {
  // Cheap shape guards first, in cost order: everything below walks a string.
  const q = (p.get("q") ?? p.get("text") ?? "").trim().slice(0, SEARCH_TEXT_MAX);
  const firmText = (p.get("firm") ?? "").trim().slice(0, SEARCH_TEXT_MAX);
  const occText = (p.get("occupation") ?? "").trim().slice(0, SEARCH_TEXT_MAX);
  const title = (p.get("title") ?? "").trim().slice(0, 80);
  const state = (p.get("state") ?? "").trim().toUpperCase();
  const fy = (p.get("fy") ?? "").trim();
  const stageSlug = (p.get("stage") ?? "").trim().toLowerCase();
  if (stageSlug && !/^[a-z0-9-]{1,60}$/.test(stageSlug)) return fail("stage must be a stage slug");
  const stage = stageSlug ? searchStageFromSlug(stageSlug) : null;
  if (stageSlug && !stage) return fail("unknown stage");

  if (state && !STATE_RE.test(state)) return fail("state must be two letters");
  if (fy && !FY_RE.test(fy)) return fail("fy must be a four-digit year");

  const from = month(p, "from");
  const to = month(p, "to");
  const dFrom = month(p, "dfrom");
  const dTo = month(p, "dto");
  if (!from.ok || !to.ok || !dFrom.ok || !dTo.ok) {
    return fail("dates must be YYYY-MM");
  }

  const wMin = wage(p, "wmin");
  const wMax = wage(p, "wmax");
  if (wMin === "bad" || wMax === "bad") return fail("wage bounds must be whole dollars");

  const naicsRaw = (p.get("naics") ?? "").trim();
  if (naicsRaw && (naicsRaw.length > 7 || !NAICS_RE.test(naicsRaw))) {
    return fail("naics must be a 2 to 6 digit code or a sector range such as 31-33");
  }
  const city = field(p, "city");
  const citizenship = field(p, "cit");
  const birthCountry = field(p, "bcountry");
  const visaClass = field(p, "visa");
  const education = field(p, "edu");
  const jobEducation = field(p, "jobedu");
  if ([city, citizenship, birthCountry, visaClass, education, jobEducation].includes("bad")) {
    return fail(`worker and job fields must be at most ${MAX_FIELD} letters, digits, spaces or . , ' ( ) & / -`);
  }
  // Where an LCA's prevailing wage came from: one of four names, nothing else.
  const wsrcRaw = (p.get("wsrc") ?? "").trim();
  if (wsrcRaw && !isWageSource(wsrcRaw)) return fail("wsrc must be oes, survey, cba or contract");
  const wageSource = wsrcRaw && isWageSource(wsrcRaw) ? wsrcRaw : null;
  // No file carries both halves, so the pair can only answer "nothing"; say why instead.
  if (wageSource && (naicsRaw || [city, citizenship, birthCountry, visaClass, education, jobEducation].some(Boolean))) {
    return fail("a prevailing wage source is in DOL's LCA file, and industry, city and the worker's fields are in the PERM file; use one side");
  }

  const orderRaw = (p.get("order") ?? "").trim();
  if (orderRaw && (orderRaw.length > 20 || !isSearchOrder(orderRaw))) return fail("unknown order");
  const order: SearchOrder | undefined = orderRaw && isSearchOrder(orderRaw) ? orderRaw : undefined;

  const formatRaw = (p.get("format") ?? "").trim();
  if (formatRaw && formatRaw !== "json" && formatRaw !== "csv") return fail("format must be json or csv");
  const csv = formatRaw === "csv";

  const outcomeRaw = (p.get("outcome") ?? "").trim();
  if (outcomeRaw && !isOutcome(outcomeRaw)) return fail("unknown outcome");
  const outcome: Outcome | undefined = outcomeRaw && isOutcome(outcomeRaw) ? outcomeRaw : undefined;

  // An unknown program name narrows to nothing rather than erroring: the
  // parameter is a filter, and a typo that returns "no results for that
  // filter" is easier to understand than a 400 on a search that half worked.
  const asked = (p.get("programs") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const programs: Program[] = asked.length ? asked.filter(isProgram) : [...PROGRAMS];

  const maxLimit = Math.min(opts.maxLimit ?? UNIFIED_MAX, UNIFIED_MAX);
  const rawLimit = Number(p.get("limit") ?? maxLimit);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.floor(rawLimit)), maxLimit) : maxLimit;

  // A case number in the main box is a lookup, not an employer name: the
  // employer search reads our own tables and can only ever miss on a number.
  const caseNumber = normaliseCaseNumber(q);
  const employer = caseNumber ? "" : q;

  const [firm, occupation] = await Promise.all([
    firmText ? resolveEntity("attorney", firmText) : Promise.resolve(null),
    occText ? resolveEntity("occupation", occText) : Promise.resolve(null),
  ]);

  const lead = chooseLead({
    ...(caseNumber ? { caseNumber } : {}),
    ...(employer.length >= SEARCH_TEXT_MIN ? { employer } : {}),
    ...(firm ? { firmSlug: firm.key } : {}),
    ...(state ? { state } : {}),
    ...(occupation ? { socCode: occupation.key } : {}),
    ...(stage ? { stage } : {}),
  });

  // Not malformed: there is simply no column an index can lead with. The
  // caller says so (guidance on the page, a refusal for a download).
  if (!lead) return { kind: "needsLead", csv, resolved: { firm, occupation } };

  // THE ROUTE DROPS WHAT THE LEAD CANNOT CARRY. See the header: the greyed
  // control in the browser is an explanation, this is the enforcement.
  const can = withStageNarrow(filterAvailability(lead), stage !== null && lead.kind === "employer");
  const dropped = new Set<FilterKey>();

  /** Keep a value only if this lead's index can carry that filter. */
  function allowed(key: FilterKey): boolean {
    if (can[key].on) return true;
    dropped.add(key);
    return false;
  }

  const narrow: UnifiedNarrow = {};

  if (outcome !== undefined) {
    if (allowed("outcome") && availableOutcomes(lead).includes(outcome)) {
      narrow.outcome = outcome;
    } else {
      // "Still open" under a firm, state or occupation lead: every row in a
      // disclosure file has a decision on it, so the bucket is empty by
      // construction rather than by filtering.
      dropped.add("outcome");
    }
  }
  if (title && allowed("title")) narrow.title = title;
  if ((from.value || to.value) && allowed("filed")) {
    if (from.value) narrow.from = from.value;
    if (to.value) narrow.to = to.value;
  }
  if ((dFrom.value || dTo.value) && allowed("decided")) {
    if (dFrom.value) narrow.decidedFrom = dFrom.value;
    if (dTo.value) narrow.decidedTo = dTo.value;
  }
  // The field a lead IS never doubles as its own narrowing filter: the lead
  // already put that equality in the WHERE clause.
  if (firm && lead.kind !== "firm" && allowed("firm")) narrow.firmSlug = firm.key;
  if (state && lead.kind !== "state" && allowed("state")) narrow.state = state;
  if (occupation && lead.kind !== "occupation" && allowed("occupation")) {
    narrow.socCode = occupation.key;
  }
  if (fy && allowed("fiscalYear")) narrow.fiscalYear = fy;
  if (stage && lead.kind !== "stage" && allowed("stage")) narrow.stage = stage;
  if ((wMin !== null || wMax !== null) && allowed("wage")) {
    if (wMin !== null) narrow.wageMin = wMin;
    if (wMax !== null) narrow.wageMax = wMax;
  }
  // The worker, job and industry filters exist on published PERM only;
  // `unifiedSearch` reads that one source when any is set and says so.
  if (naicsRaw && allowed("industry")) narrow.naics = naicsRaw;
  if (city && allowed("city")) narrow.city = city;
  if (citizenship && allowed("citizenship")) narrow.citizenship = citizenship;
  if (birthCountry && allowed("birthCountry")) narrow.birthCountry = birthCountry;
  if (visaClass && allowed("visaClass")) narrow.visaClass = visaClass;
  if (education && allowed("education")) narrow.education = education;
  if (jobEducation && allowed("jobEducation")) narrow.jobEducation = jobEducation;
  // The LCA file alone names it; `unifiedSearch` reads that one source when it's set.
  if (wageSource && allowed("wageSource")) narrow.wageSource = wageSource;

  return {
    kind: "search",
    csv,
    args: { lead, narrow, programs, limit, ...(order ? { order } : {}) },
    resolved: { firm, occupation },
    // In the form's own order, so the page can list the refusals where the
    // reader will look for them.
    dropped: FILTER_KEYS.filter((k) => dropped.has(k)),
  };
}
