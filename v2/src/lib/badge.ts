/**
 * The badges: one small image per figure, rendered from data this site already
 * holds and regenerated once a day.
 *
 * A badge is a claim on somebody else's page. There is no room next to it for
 * a caveat and no way to add one later, so the rule is absolute: every badge
 * carries a number that a FEDERAL SOURCE published, or a count of records this
 * site holds, and the date it was true for. None of them carries an estimate,
 * a forecast, or a rate this site derived. The estimator keeps its own record
 * on /estimate-scorecard, where the margin of error can sit beside it.
 *
 * THE FIRST THREE IDS ARE FROZEN. `perm-queue`, `perm-days` and `pwd-queue`
 * are already pasted into READMEs and forum signatures as
 * `permtracker.app/badge/<id>.svg`; renaming one breaks an image on a page
 * this project does not control. New kinds get new ids and nothing is ever
 * re-pointed. `badge.test.ts` says so.
 */

export type BadgeGroup = "DOL queues" | "The record" | "Where cases sit" | "Visa bulletin";

/** The shapes a badge can be drawn in. Not every figure supports every one. */
export const BADGE_STYLES = ["shield", "card", "bar"] as const;
export type BadgeStyle = (typeof BADGE_STYLES)[number];

export const BADGE_THEMES = ["dark", "light"] as const;
export type BadgeTheme = (typeof BADGE_THEMES)[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-11" -> "Nov 2025"; anything else -> null. */
export function shortMonth(ym: string | null | undefined): string | null {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const m = Number(ym.slice(5, 7));
  const name = MONTHS[m - 1];
  return name ? `${name} ${ym.slice(0, 4)}` : null;
}

/** 373939 -> "373,939". Badges are read at a glance, so no scientific shorthand. */
export function groupDigits(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/**
 * Everything the badges can be built from, assembled once per request.
 *
 * Deliberately a plain object of already-resolved values rather than a handle
 * to the read layer: the renderers and the catalogue page are pure functions
 * of it, so a badge cannot quietly issue its own query.
 */
export interface BadgeData {
  /** DOL processing times. */
  permQueueMonths: Partial<Record<"analyst" | "audit" | "recon", string | null>>;
  analystReviewDays: number | null;
  pwdMonths: Partial<Record<"perm-oews" | "perm-survey" | "h1b" | "h2b" | "cw1", string | null>>;
  /** DOL's as-of date for the processing-times table, ISO. */
  dolAsOf: string | null;

  /** Counts of the record this site holds, keyed by badge id. */
  counts: Partial<Record<string, { value: number; asOf: string | null }>>;

  /**
   * Pending cases by DOL review stage, each with the date it was last seen.
   *
   * The stamp is PER STAGE, not one date for the table. A figure and its date
   * are one claim, and this site has already shipped the bug where a hub and a
   * leaf printed the same count under two different dates.
   */
  stages: Partial<Record<string, { cases: number; seenTo: string | null }>>;
  /** Everything pending, the denominator the bar style draws against. */
  stagesTotal: number | null;

  /** Visa bulletin final-action cutoffs, keyed `<category>:<country>`. */
  bulletin: Partial<Record<string, { cutoff: string; month: string; series: number[] }>>;
}

export interface BadgeFigure {
  /** The headline, already formatted for display. */
  value: string;
  /** 0..1, for the bar style. */
  fraction?: number;
  /** A normalised 0..1 series, for the card's sparkline. */
  series?: number[];
  /** What the figure is true for, shown in the card footer. */
  asOf: string | null;
  /** Who published it. Badges say this out loud. */
  source: string;
}

export interface BadgeDef {
  id: string;
  group: BadgeGroup;
  /** The left-hand segment of a shield, and the card's caption. */
  label: string;
  /** Plain-language explanation, for the catalogue page. */
  meaning: string;
  /** Where the number lives on this site. */
  href: string;
  /** Alt text, with the figure substituted in. */
  alt: (value: string) => string;
  /** Which shapes suit this figure. The first is the default. */
  styles: readonly BadgeStyle[];
  resolve: (d: BadgeData) => BadgeFigure | null;
}

const DOL = "Department of Labor";
const STATE = "State Department";

/** A DOL queue month, as "at Nov 2025". */
function queueMonth(label: string, id: string, href: string, meaning: string, pick: (d: BadgeData) => string | null | undefined, what: string): BadgeDef {
  return {
    id, group: "DOL queues", label, href, meaning,
    styles: ["shield", "card"],
    alt: (v) => `${what}: DOL is working ${v}`,
    resolve: (d) => {
      const m = shortMonth(pick(d));
      return m ? { value: `at ${m}`, asOf: d.dolAsOf, source: DOL } : null;
    },
  };
}

/** A count of records this site holds. */
function recordCount(id: string, label: string, href: string, meaning: string, what: string): BadgeDef {
  return {
    id, group: "The record", label, href, meaning,
    styles: ["card", "shield"],
    alt: (v) => `${v} ${what}`,
    resolve: (d) => {
      const c = d.counts[id];
      return c ? { value: groupDigits(c.value), asOf: c.asOf, source: "PERM Tracker, from federal files" } : null;
    },
  };
}

/** A review stage, as a count and as its share of everything pending. */
function stage(id: string, status: string, label: string, meaning: string): BadgeDef {
  return {
    id, group: "Where cases sit", label, href: "/perm-rfi-audit", meaning,
    styles: ["bar", "card", "shield"],
    alt: (v) => `${v} PERM cases at ${status.toLowerCase()}`,
    resolve: (d) => {
      const s = d.stages[status];
      if (!s) return null;
      const total = d.stagesTotal ?? 0;
      return {
        value: groupDigits(s.cases),
        fraction: total > 0 ? s.cases / total : undefined,
        asOf: s.seenTo,
        source: "DOL's own case index, read daily",
      };
    },
  };
}

/** A visa bulletin final-action cutoff, with its own history as a sparkline. */
function cutoff(category: string, country: string, countryLabel: string): BadgeDef {
  const key = `${category}:${country}`;
  return {
    id: `bulletin-${category.toLowerCase()}-${country}`,
    group: "Visa bulletin",
    label: `${category} ${countryLabel}`,
    href: "/visa-bulletin",
    meaning: `The final action cutoff the State Department published for ${category}, ${countryLabel}. A priority date earlier than this one has a visa number available.`,
    styles: ["card", "shield"],
    alt: (v) => `${category} ${countryLabel} final action date: ${v}`,
    resolve: (d) => {
      const c = d.bulletin[key];
      return c ? { value: c.cutoff, series: c.series, asOf: c.month, source: STATE } : null;
    },
  };
}

const BULLETIN_COUNTRIES: [string, string][] = [
  ["worldwide", "worldwide"],
  ["china", "China"],
  ["india", "India"],
  ["mexico", "Mexico"],
  ["philippines", "Philippines"],
];

export const BADGE_DEFS: readonly BadgeDef[] = [
  // ---- DOL queues -------------------------------------------------------
  queueMonth("PERM queue", "perm-queue", "/perm-queue",
    "The filing month DOL's analysts are working through. The single number most people waiting on a PERM want.",
    (d) => d.permQueueMonths.analyst, "PERM queue"),
  queueMonth("PERM audits", "perm-audits", "/perm-rfi-audit",
    "The filing month DOL is working in audit review, for cases audited rather than decided straight through.",
    (d) => d.permQueueMonths.audit, "PERM audit review"),
  queueMonth("PERM recon", "perm-recon", "/perm-rfi-audit",
    "The month DOL is working for reconsideration requests, filed after a denial.",
    (d) => d.permQueueMonths.recon, "PERM reconsideration requests"),
  {
    id: "perm-days", group: "DOL queues", label: "PERM decision", href: "/perm-processing-times",
    meaning: "DOL's published average calendar days from filing to an analyst-review determination.",
    styles: ["shield", "card"],
    alt: (v) => `PERM decision: ${v} on average`,
    resolve: (d) => {
      const n = d.analystReviewDays;
      return n !== null && Number.isFinite(n)
        ? { value: `${Math.round(n)} days avg`, asOf: d.dolAsOf, source: DOL }
        : null;
    },
  },
  queueMonth("PERM wage", "pwd-queue", "/tools/pwd-calculator",
    "The month the National Prevailing Wage Center is working for PERM requests set on OEWS wages.",
    (d) => d.pwdMonths["perm-oews"], "PERM prevailing wage requests on OEWS wages"),
  queueMonth("PERM wage, survey", "pwd-perm-survey", "/tools/pwd-calculator",
    "The same queue for PERM requests set on an employer-provided survey instead of OEWS. It moves on its own.",
    (d) => d.pwdMonths["perm-survey"], "PERM prevailing wage requests on an employer survey"),
  queueMonth("H-1B wage", "pwd-h1b", "/lca-cases",
    "The wage-request queue for H-1B, H-1B1 and E-3 petitions.",
    (d) => d.pwdMonths.h1b, "H-1B prevailing wage requests"),
  queueMonth("H-2B wage", "pwd-h2b", "/tools/pwd-calculator",
    "The wage-request queue for H-2B seasonal labour.",
    (d) => d.pwdMonths.h2b, "H-2B prevailing wage requests"),
  queueMonth("CW-1 wage", "pwd-cw1", "/tools/pwd-calculator",
    "The wage-request queue for CW-1, the Northern Mariana Islands transitional worker.",
    (d) => d.pwdMonths.cw1, "CW-1 prevailing wage requests"),

  // ---- The record -------------------------------------------------------
  recordCount("perm-decisions", "PERM decisions", "/case-search",
    "Every PERM decision in DOL's published disclosure files, which is the complete decided record through the last quarter.",
    "PERM decisions in DOL's published files"),
  recordCount("perm-pending", "PERM pending", "/perm-case-status",
    "PERM cases still waiting at DOL, counted from the live case index this site reads every day.",
    "PERM cases pending at DOL"),
  recordCount("pwd-determinations", "Wage determinations", "/pwd-cases",
    "Prevailing wage determinations held with the wage DOL set, the figure the live index never returns.",
    "prevailing wage determinations held with the wage"),
  recordCount("lca-decisions", "H-1B LCAs", "/lca-cases",
    "H-1B labour condition applications held with the wage the employer offered.",
    "H-1B LCAs held with the offered wage"),
  recordCount("bulletins-held", "Visa bulletins", "/visa-bulletin",
    "Monthly visa bulletins in the archive, every category and country, back to the first month held.",
    "monthly visa bulletins in the archive"),

  // ---- Where cases sit --------------------------------------------------
  stage("stage-analyst", "ANALYST REVIEW", "In analyst review",
    "PERM cases sitting in ordinary analyst review, the stage almost every pending case is in."),
  stage("stage-rfi", "RFI ISSUED", "RFI issued",
    "PERM cases where DOL has issued a request for information and is waiting on the answer."),
  stage("stage-hold", "APPLICATION ON HOLD", "On hold",
    "PERM cases DOL has placed on hold."),
  stage("stage-recon", "RECONSIDERATION APPEALS", "Reconsideration",
    "Denied PERM cases whose reconsideration request is with DOL."),
  stage("stage-balca", "BALCA APPEALS", "At BALCA",
    "PERM cases on appeal to the Board of Alien Labor Certification Appeals."),
  stage("stage-nord", "NORD ISSUED", "Notice of intent to deny",
    "PERM cases where DOL has issued a notice of intent to deny."),

  // ---- Visa bulletin ----------------------------------------------------
  ...(["EB1", "EB2", "EB3"] as const).flatMap((cat) =>
    BULLETIN_COUNTRIES.map(([country, label]) => cutoff(cat, country, label)),
  ),
];

export const BADGE_KINDS = BADGE_DEFS.map((d) => d.id);
export type BadgeKind = string;

const BY_ID = new Map(BADGE_DEFS.map((d) => [d.id, d]));
export function badgeDef(id: string): BadgeDef | null {
  return BY_ID.get(id) ?? null;
}

export interface BadgeSpec {
  kind: string;
  label: string;
  value: string;
  href: string;
  alt: string;
  asOf: string | null;
  source: string;
  fraction?: number;
  series?: number[];
}

/** The spec for one kind, or null when no figure was published for it. */
export function badgeSpec(kind: string, d: BadgeData): BadgeSpec | null {
  const def = badgeDef(kind);
  if (!def) return null;
  const figure = def.resolve(d);
  if (!figure) return null;
  const stamp = figure.asOf ? `, as of ${figure.asOf}` : "";
  return {
    kind: def.id,
    label: def.label,
    value: figure.value,
    href: def.href,
    alt: `${def.alt(figure.value)}${stamp}`,
    asOf: figure.asOf,
    source: figure.source,
    fraction: figure.fraction,
    series: figure.series,
  };
}
