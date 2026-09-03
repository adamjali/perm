import { NextResponse } from "next/server";

import {
  FILTER_KEYS,
  availableOutcomes,
  chooseLead,
  filterAvailability,
  isOutcome,
  type FilterKey,
  type Outcome,
} from "@/lib/caseSearchPlan";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { searchByName } from "@/lib/turso/entities";
import type { UnifiedNarrow } from "@/lib/turso/caseSearchReads";
import {
  PROGRAMS,
  UNIFIED_MAX,
  isProgram,
  unifiedSearch,
  type Program,
} from "@/lib/turso/unifiedSearch";

/**
 * One search across PERM, prevailing wage requests and H-1B LCAs.
 *
 * A ROUTE, NOT A PAGE PARAM. Reading `searchParams` in the page would make it
 * dynamic, and every visit would then be a server render against Turso. That
 * is the cost that read 11.6 billion rows in two days in August. The page
 * stays static and the search is one JSON request.
 *
 * ## The route enforces the plan; the UI only explains it
 *
 * `filterAvailability` decides which narrowing a lead can carry, and the page
 * uses the same function to grey the controls out. But a greyed-out control is
 * a courtesy, not a control: this endpoint is public and anyone can hand-craft
 * a URL. So every filter the lead cannot serve is DROPPED here before any SQL
 * is built, and the response says which ones were dropped. Leaving that to the
 * browser is how a state-plus-wage search - measured at 44.7 seconds and a
 * 67,742-row walk - would reach production through a URL nobody typed in a
 * form.
 *
 * ## Two fields arrive as words and leave as keys
 *
 * A law firm and an occupation are searched as an EQUALITY on a slug or a SOC
 * code, because an equality is what lets the index supply the ordering: the
 * biggest firm in the corpus answers in 0.67 s that way and forces a sort over
 * 48,317 rows as a prefix range. So the typed words are resolved against
 * `perm_entities` first and the answer names which one it used, with the other
 * matches offered - DOL prints one firm under several spellings and the reader
 * has to be able to see that rather than wonder.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const STATE_RE = /^[A-Z]{2}$/;
const FY_RE = /^\d{4}$/;
// Ahead of any comparison work: `v.string()`-scale input reaches a route
// handler, and a length cap is the cheap guard that belongs before anything
// that walks the string.
const MAX_TEXT = 120;
const MIN_TEXT = 2;
/** Above any real annual wage, and small enough that a typo is refused. */
const MAX_WAGE = 100_000_000;

export const revalidate = 0;

interface ResolvedEntity {
  key: string;
  name: string;
  total: number;
  /** The other spellings DOL used, so the reader can pick a different one. */
  alternatives: { key: string; name: string; total: number }[];
}

const bad = (message: string) => NextResponse.json({ error: message }, { status: 400 });

/** A month parameter, or null. Throws nothing: the caller reports the 400. */
function month(p: URLSearchParams, key: string): { ok: true; value: string } | { ok: false } {
  const raw = (p.get(key) ?? "").trim();
  if (!raw) return { ok: true, value: "" };
  return MONTH_RE.test(raw) ? { ok: true, value: raw } : { ok: false };
}

function wage(p: URLSearchParams, key: string): number | null | "bad" {
  const raw = (p.get(key) ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > MAX_WAGE) return "bad";
  return Math.round(n);
}

/**
 * Turn typed words into the key an index can seek on.
 *
 * `searchByName` is a substring LIKE over one entity kind - at most a few tens
 * of thousands of rows, measured at 42 ms - which is affordable precisely
 * because it is NOT run against the 374k-row case table. The top match is the
 * one with the most filings, which is the right default when DOL has spelled a
 * firm six ways and one spelling holds 48,165 of the 48,322 cases.
 */
async function resolveEntity(
  kind: "attorney" | "occupation",
  text: string,
): Promise<ResolvedEntity | null> {
  const found = await searchByName(kind, text, 8).catch(() => []);
  const usable = found.filter((r) => (kind === "attorney" ? r.slug : r.code));
  const top = usable[0];
  if (!top) return null;
  const keyOf = (r: (typeof usable)[number]) => (kind === "attorney" ? r.slug : (r.code ?? ""));
  return {
    key: keyOf(top),
    name: top.name,
    total: top.total,
    alternatives: usable.slice(1).map((r) => ({ key: keyOf(r), name: r.name, total: r.total })),
  };
}

export async function GET(request: Request): Promise<NextResponse> {
  const p = new URL(request.url).searchParams;

  // Cheap shape guards first, in cost order: everything below walks a string.
  const q = (p.get("q") ?? p.get("text") ?? "").trim().slice(0, MAX_TEXT);
  const firmText = (p.get("firm") ?? "").trim().slice(0, MAX_TEXT);
  const occText = (p.get("occupation") ?? "").trim().slice(0, MAX_TEXT);
  const title = (p.get("title") ?? "").trim().slice(0, 80);
  const state = (p.get("state") ?? "").trim().toUpperCase();
  const fy = (p.get("fy") ?? "").trim();

  if (state && !STATE_RE.test(state)) return bad("state must be two letters");
  if (fy && !FY_RE.test(fy)) return bad("fy must be a four-digit year");

  const from = month(p, "from");
  const to = month(p, "to");
  const dFrom = month(p, "dfrom");
  const dTo = month(p, "dto");
  if (!from.ok || !to.ok || !dFrom.ok || !dTo.ok) {
    return bad("dates must be YYYY-MM");
  }

  const wMin = wage(p, "wmin");
  const wMax = wage(p, "wmax");
  if (wMin === "bad" || wMax === "bad") return bad("wage bounds must be whole dollars");

  const outcomeRaw = (p.get("outcome") ?? "").trim();
  if (outcomeRaw && !isOutcome(outcomeRaw)) return bad("unknown outcome");
  const outcome: Outcome | undefined = outcomeRaw && isOutcome(outcomeRaw) ? outcomeRaw : undefined;

  // An unknown program name narrows to nothing rather than erroring: the
  // parameter is a filter, and a typo that returns "no results for that
  // filter" is easier to understand than a 400 on a search that half worked.
  const asked = (p.get("programs") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const programs: Program[] = asked.length ? asked.filter(isProgram) : [...PROGRAMS];

  const rawLimit = Number(p.get("limit") ?? UNIFIED_MAX);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), UNIFIED_MAX)
    : UNIFIED_MAX;

  // A case number in the main box is a lookup, not an employer name: the
  // employer search reads our own tables and can only ever miss on a number.
  const caseNumber = normaliseCaseNumber(q);
  const employer = caseNumber ? "" : q;

  try {
    const [firm, occupation] = await Promise.all([
      firmText ? resolveEntity("attorney", firmText) : Promise.resolve(null),
      occText ? resolveEntity("occupation", occText) : Promise.resolve(null),
    ]);

    const lead = chooseLead({
      ...(caseNumber ? { caseNumber } : {}),
      ...(employer.length >= MIN_TEXT ? { employer } : {}),
      ...(firm ? { firmSlug: firm.key } : {}),
      ...(state ? { state } : {}),
      ...(occupation ? { socCode: occupation.key } : {}),
    });

    if (!lead) {
      // Not a 400: nothing was malformed, there is simply no column an index
      // can lead with. The page renders this as guidance, not as an error.
      return NextResponse.json({
        rows: [],
        counts: { perm: 0, pwd: 0, lca: 0 },
        truncated: false,
        capped: false,
        skipped: { live: false, published: false, because: [] },
        lead: null,
        resolved: { firm, occupation },
        dropped: [],
        needsLead: true,
      });
    }

    // THE ROUTE DROPS WHAT THE LEAD CANNOT CARRY. See the header: the greyed
    // control in the browser is an explanation, this is the enforcement.
    const can = filterAvailability(lead);
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
    if ((wMin !== null || wMax !== null) && allowed("wage")) {
      if (wMin !== null) narrow.wageMin = wMin;
      if (wMax !== null) narrow.wageMax = wMax;
    }

    const result = await unifiedSearch({ lead, narrow, programs, limit });
    return NextResponse.json(
      {
        ...result,
        resolved: { firm, occupation },
        // In the form's own order, so the page can list the refusals where
        // the reader will look for them.
        dropped: FILTER_KEYS.filter((k) => dropped.has(k)),
        needsLead: false,
      },
      {
        // The corpus changes once a night. A short shared cache absorbs the
        // repeat of an identical search without letting a day-old answer stand.
        headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" },
      },
    );
  } catch (err) {
    // Named, so a failure here is distinguishable in the logs from a miss.
    console.error("[caseSearch] failed", err);
    return NextResponse.json({ error: "search unavailable" }, { status: 503 });
  }
}
