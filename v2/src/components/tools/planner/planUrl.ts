import { GREEN_CARD_ROUTES, MILESTONE_ORDER, type GreenCardRoute, type Milestone } from "@/lib/perm";
import { PLAN_CATEGORIES, PLAN_COUNTRIES, type PlanCategory, type PlanCountry } from "@/lib/planQuery";
import { ISO_DATE_REGEX } from "@convex/lib/dateValidation";

/**
 * The planner's inputs as they live in the address, so a plan can be shared and other pages
 * can link to one already filled in. Pure: read from params, written as a patch.
 */

/** Where a case can stand, in order, each with the milestone the reader's date is for. */
export const WHERE = [
  { key: "start", label: "Not started yet", milestone: null },
  { key: "pwd-filed", label: "Wage request filed", milestone: "pwdFiled" },
  { key: "recruiting", label: "Wage determination in, recruiting", milestone: "pwdIssued" },
  { key: "perm-filed", label: "PERM filed", milestone: "permFiled" },
  { key: "perm-certified", label: "PERM certified", milestone: "permCertified" },
  { key: "i140-filed", label: "I-140 filed", milestone: "i140Filed" },
  { key: "i140-approved", label: "I-140 approved", milestone: "i140Approved" },
  { key: "i485-filed", label: "I-485 filed", milestone: "i485Filed" },
] as const satisfies readonly { key: string; label: string; milestone: Milestone | null }[];
export type WhereKey = (typeof WHERE)[number]["key"];

/** Each milestone's address key. */
export const MILESTONE_PARAM: Record<Milestone, string> = {
  pwdFiled: "pwdf",
  pwdIssued: "pwdi",
  permFiled: "pd",
  permCertified: "cert",
  i140Filed: "i140f",
  i140Approved: "i140a",
  i485Filed: "i485f",
  greenCard: "gc",
};
/** With nothing started, the day the wage request will be filed. */
export const START_PARAM = "on";
/** The address keys of links made before Oct 28 2026: `date` was the step's own date. */
const LEGACY_DATE = "date";

export interface PlanUrlState {
  where: WhereKey;
  /** The dates the reader knows, up to and including where the case is. */
  known: Partial<Record<Milestone, string>>;
  /** With nothing started, when the wage request will be filed. */
  startOn: string;
  category: PlanCategory;
  country: PlanCountry;
  premium: boolean;
  /** Adjustment of status inside the US, or consular processing abroad. */
  route: GreenCardRoute;
}

/** The route's address key; adjustment of status, the default, leaves it out. */
export const ROUTE_PARAM = "route";

const isoOrNull = (v: string | null) => (v && ISO_DATE_REGEX.test(v) ? v : null);
const whereOf = (key: string | null) => WHERE.find((w) => w.key === key) ?? WHERE[0];
const indexOf = (m: Milestone) => MILESTONE_ORDER.indexOf(m);

/** The milestone a case at `where` has reached, dated or not: the plan holds it to today or earlier. */
export function reachedMilestone(where: WhereKey): Milestone | undefined {
  return whereOf(where).milestone ?? undefined;
}

/** The milestones a case at `where` can have dates for: every one up to where it stands. */
export function milestonesUpTo(where: WhereKey): Milestone[] {
  const m = whereOf(where).milestone;
  return m ? MILESTONE_ORDER.slice(0, indexOf(m) + 1) : [];
}

/** The dates the plan can't start without: where the case stands, and its priority date once past PERM. */
export function requiredMilestones(where: WhereKey): Milestone[] {
  const m = whereOf(where).milestone;
  if (!m) return [];
  return indexOf(m) > indexOf("permFiled") ? ["permFiled", m] : [m];
}

export function readPlanUrl(params: URLSearchParams, today: string): PlanUrlState {
  const w = whereOf(params.get("where"));
  const known: Partial<Record<Milestone, string>> = {};
  for (const m of milestonesUpTo(w.key)) {
    const v = isoOrNull(params.get(MILESTONE_PARAM[m]));
    if (v) known[m] = v;
  }
  // An old link: `date` was the reader's date for the step they were at, and for
  // "I-140 approved" it was the priority date.
  const legacy = isoOrNull(params.get(LEGACY_DATE));
  if (legacy && w.milestone) {
    const target: Milestone = w.key === "i140-approved" && !known.permFiled ? "permFiled" : w.milestone;
    if (!known[target]) known[target] = legacy;
  }
  const category = PLAN_CATEGORIES.find((c) => c === params.get("cat")) ?? "EB2";
  const country = PLAN_COUNTRIES.find((c) => c === params.get("country")) ?? "worldwide";
  return {
    where: w.key,
    known,
    startOn: isoOrNull(params.get(START_PARAM)) ?? (w.key === "start" ? legacy : null) ?? today,
    category,
    country,
    premium: params.get("premium") === "1",
    route: GREEN_CARD_ROUTES.find((r) => r === params.get(ROUTE_PARAM)) ?? "aos",
  };
}

/** The address change for one input, the old `date` key dropped once the reader edits. */
export function planPatch(patch: Partial<Record<Milestone, string | null>> & {
  where?: WhereKey;
  startOn?: string | null;
  category?: PlanCategory;
  country?: PlanCountry;
  premium?: boolean;
  route?: GreenCardRoute;
}): Record<string, string | null> {
  const out: Record<string, string | null> = { [LEGACY_DATE]: null };
  for (const m of MILESTONE_ORDER) if (m in patch) out[MILESTONE_PARAM[m]] = patch[m] ?? null;
  if (patch.where !== undefined) out.where = patch.where === "start" ? null : patch.where;
  if (patch.startOn !== undefined) out[START_PARAM] = patch.startOn;
  if (patch.category !== undefined) out.cat = patch.category === "EB2" ? null : patch.category;
  if (patch.country !== undefined) out.country = patch.country === "worldwide" ? null : patch.country;
  if (patch.premium !== undefined) out.premium = patch.premium ? "1" : null;
  if (patch.route !== undefined) out[ROUTE_PARAM] = patch.route === "aos" ? null : patch.route;
  return out;
}

/** The planner's address for a case, from the pages that know one (the case page, a queue month). */
export function planHref(c: { permFiled: string; permCertified?: string | null }): string {
  const q = new URLSearchParams(
    c.permCertified
      ? { where: "perm-certified", [MILESTONE_PARAM.permFiled]: c.permFiled, [MILESTONE_PARAM.permCertified]: c.permCertified }
      : { where: "perm-filed", [MILESTONE_PARAM.permFiled]: c.permFiled },
  );
  return `/tools/green-card-timeline?${q}`;
}
