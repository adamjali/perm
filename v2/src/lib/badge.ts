/**
 * The embeddable badges: one small SVG per figure, rendered once a day.
 *
 * A badge is a claim on somebody else's page, so it carries only figures DOL
 * itself publishes (the queue month and the average days) and the date they
 * were true for. No estimates, no counts of our own.
 */

/**
 * THE FIRST THREE IDS ARE FROZEN. `perm-queue`, `perm-days` and `pwd-queue`
 * are already pasted into READMEs and forum signatures as
 * `permtracker.app/badge/<id>.svg`; renaming one breaks an image somebody
 * else owns. New kinds get new ids and nothing is ever re-pointed.
 *
 * Every kind here is a figure DOL PUBLISHES, not one this site derives. That
 * is the whole constraint: a badge is a claim rendered on someone else's
 * page, where there is no room for a caveat, so it carries only numbers whose
 * source is a federal table and the date that table was published.
 */
export const BADGE_KINDS = [
  // The three PERM queues DOL prints, by the month each is working.
  "perm-queue",
  "perm-audits",
  "perm-recon",
  // Average calendar days to a determination.
  "perm-days",
  // The prevailing-wage centre, by program and by which wage source the
  // request used. DOL publishes an OEWS column and a non-OEWS (employer
  // survey) column for each program, and they move independently.
  "pwd-queue",
  "pwd-perm-survey",
  "pwd-h1b",
  "pwd-h2b",
  "pwd-cw1",
] as const;
export type BadgeKind = (typeof BADGE_KINDS)[number];

export interface BadgeSpec {
  kind: BadgeKind;
  /** Left segment. */
  label: string;
  /** Right segment. */
  value: string;
  /** The page the badge stands for. */
  href: string;
  /** What the badge says, for alt text. */
  alt: string;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2025-11" -> "Nov 2025"; anything else -> null. */
export function shortMonth(ym: string | null | undefined): string | null {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return null;
  const m = Number(ym.slice(5, 7));
  const name = MONTHS[m - 1];
  return name ? `${name} ${ym.slice(0, 4)}` : null;
}

export interface BadgeInputs {
  /** Month each PERM queue is working, "YYYY-MM", keyed by DOL's own row name. */
  permQueueMonths: Partial<Record<"analyst" | "audit" | "recon", string | null>>;
  /** Average calendar days to an Analyst Review determination. */
  analystReviewDays: number | null;
  /** Wage-request receipt month by program and wage source, "YYYY-MM". */
  pwdMonths: Partial<Record<"perm-oews" | "perm-survey" | "h1b" | "h2b" | "cw1", string | null>>;
  /** DOL's as-of date, ISO. */
  asOf: string | null;
}

/**
 * What each kind is, in one table, so adding a badge is adding a row.
 *
 * `pick` returns the figure or null. A null renders the "no figure today"
 * badge rather than yesterday's number: DOL prints "--" for a queue with no
 * determinations that month, and an embed that quietly kept showing the last
 * real value would be wrong on exactly the days it mattered.
 */
const SPECS: Record<BadgeKind, {
  label: string;
  href: string;
  /** Reads the figure out of the inputs. */
  pick: (i: BadgeInputs) => string | null;
  /** Turns the figure into the badge's right-hand segment. */
  value: (v: string) => string;
  /** Plain-language alt text; the figure is substituted in. */
  alt: (v: string) => string;
}> = {
  "perm-queue": {
    label: "PERM queue", href: "/perm-queue",
    pick: (i) => shortMonth(i.permQueueMonths.analyst),
    value: (v) => `at ${v}`,
    alt: (v) => `PERM queue: DOL analysts are working ${v}`,
  },
  "perm-audits": {
    label: "PERM audits", href: "/perm-rfi-audit",
    pick: (i) => shortMonth(i.permQueueMonths.audit),
    value: (v) => `at ${v}`,
    alt: (v) => `PERM audit review: DOL is working ${v}`,
  },
  "perm-recon": {
    label: "PERM recon", href: "/perm-rfi-audit",
    pick: (i) => shortMonth(i.permQueueMonths.recon),
    value: (v) => `at ${v}`,
    alt: (v) => `PERM reconsideration requests: DOL is working ${v}`,
  },
  "perm-days": {
    label: "PERM decision", href: "/perm-processing-times",
    pick: (i) => (i.analystReviewDays !== null && Number.isFinite(i.analystReviewDays) ? String(Math.round(i.analystReviewDays)) : null),
    value: (v) => `${v} days avg`,
    alt: (v) => `PERM decision: ${v} days on average`,
  },
  "pwd-queue": {
    label: "PERM wage", href: "/tools/pwd-calculator",
    pick: (i) => shortMonth(i.pwdMonths["perm-oews"]),
    value: (v) => `at ${v}`,
    alt: (v) => `PERM prevailing wage requests on OEWS wages: DOL is working ${v}`,
  },
  "pwd-perm-survey": {
    label: "PERM wage, survey", href: "/tools/pwd-calculator",
    pick: (i) => shortMonth(i.pwdMonths["perm-survey"]),
    value: (v) => `at ${v}`,
    alt: (v) => `PERM prevailing wage requests on an employer survey: DOL is working ${v}`,
  },
  "pwd-h1b": {
    label: "H-1B wage", href: "/lca-cases",
    pick: (i) => shortMonth(i.pwdMonths.h1b),
    value: (v) => `at ${v}`,
    alt: (v) => `H-1B prevailing wage requests: DOL is working ${v}`,
  },
  "pwd-h2b": {
    label: "H-2B wage", href: "/tools/pwd-calculator",
    pick: (i) => shortMonth(i.pwdMonths.h2b),
    value: (v) => `at ${v}`,
    alt: (v) => `H-2B prevailing wage requests: DOL is working ${v}`,
  },
  "pwd-cw1": {
    label: "CW-1 wage", href: "/tools/pwd-calculator",
    pick: (i) => shortMonth(i.pwdMonths.cw1),
    value: (v) => `at ${v}`,
    alt: (v) => `CW-1 prevailing wage requests: DOL is working ${v}`,
  },
};

/** The spec for one kind, or null when DOL published no figure for it. */
export function badgeSpec(kind: BadgeKind, i: BadgeInputs): BadgeSpec | null {
  const def = SPECS[kind];
  const figure = def.pick(i);
  if (figure === null) return null;
  const stamp = i.asOf ? `, DOL ${i.asOf}` : "";
  return {
    kind,
    label: def.label,
    value: def.value(figure),
    href: def.href,
    alt: `${def.alt(figure)}${stamp}`,
  };
}

/** What the badge measures, for the catalogue page. Not rendered into the SVG. */
export const BADGE_MEANING: Record<BadgeKind, string> = {
  "perm-queue": "The filing month DOL's analysts are working through. The single number most people waiting on a PERM want.",
  "perm-audits": "The filing month DOL is working in audit review, for cases that were audited rather than decided straight through.",
  "perm-recon": "The month DOL is working for reconsideration requests, filed after a denial.",
  "perm-days": "DOL's published average calendar days from filing to an analyst-review determination.",
  "pwd-queue": "The month the National Prevailing Wage Center is working for PERM requests set on OEWS wages.",
  "pwd-perm-survey": "The same queue for PERM requests set on an employer-provided survey instead of OEWS. It moves on its own.",
  "pwd-h1b": "The wage-request queue for H-1B, H-1B1 and E-3 petitions.",
  "pwd-h2b": "The wage-request queue for H-2B seasonal labour.",
  "pwd-cw1": "The wage-request queue for CW-1, the Northern Mariana Islands transitional worker.",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Approximate text width at 11px Verdana, the width shields-style badges assume. */
const textWidth = (s: string) => Math.round(s.length * 6.6) + 12;

/** A 20px-tall two-segment badge, black label and lime value, in the site's own colours. */
export function renderBadgeSvg(spec: BadgeSpec): string {
  const lw = textWidth(spec.label);
  const vw = textWidth(spec.value);
  const w = lw + vw;
  const label = esc(spec.label);
  const value = esc(spec.value);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="20" role="img" aria-label="${esc(spec.alt)}">`,
    `<title>${esc(spec.alt)}</title>`,
    `<rect width="${lw}" height="20" fill="#000000"/>`,
    `<rect x="${lw}" width="${vw}" height="20" fill="#2ECC40"/>`,
    `<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">`,
    `<text x="${lw / 2}" y="14" fill="#FAFAFA">${label}</text>`,
    `<text x="${lw + vw / 2}" y="14" fill="#000000" font-weight="bold">${value}</text>`,
    `</g></svg>`,
  ].join("");
}

/** A badge that says DOL published nothing, so an embed never shows a stale number as current. */
export function renderUnavailableSvg(kind: BadgeKind): string {
  return renderBadgeSvg({ kind, label: "PERM Tracker", value: "no figure today", href: "/", alt: "PERM Tracker: DOL published no figure for this badge today" });
}
