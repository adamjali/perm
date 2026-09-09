/**
 * The embeddable badges: one small SVG per figure, rendered once a day.
 *
 * A badge is a claim on somebody else's page, so it carries only figures DOL
 * itself publishes (the queue month and the average days) and the date they
 * were true for. No estimates, no counts of our own.
 */

export const BADGE_KINDS = ["perm-queue", "perm-days", "pwd-queue"] as const;
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
  /** Analyst review queue month, "YYYY-MM". */
  analystReviewMonth: string | null;
  /** Analyst review average calendar days. */
  analystReviewDays: number | null;
  /** PERM prevailing wage OEWS receipt month, "YYYY-MM". */
  pwdOewsMonth: string | null;
  /** DOL's as-of date, ISO. */
  asOf: string | null;
}

/** The spec for one kind, or null when DOL published no figure for it. */
export function badgeSpec(kind: BadgeKind, i: BadgeInputs): BadgeSpec | null {
  const stamp = i.asOf ? `, DOL ${i.asOf}` : "";
  if (kind === "perm-queue") {
    const m = shortMonth(i.analystReviewMonth);
    return m ? { kind, label: "PERM queue", value: `at ${m}`, href: "/perm-queue", alt: `PERM queue: DOL is working ${m}${stamp}` } : null;
  }
  if (kind === "perm-days") {
    const d = i.analystReviewDays;
    return d !== null && Number.isFinite(d)
      ? { kind, label: "PERM decision", value: `${Math.round(d)} days avg`, href: "/perm-processing-times", alt: `PERM decision: ${Math.round(d)} days on average${stamp}` }
      : null;
  }
  const m = shortMonth(i.pwdOewsMonth);
  return m ? { kind, label: "Wage requests", value: `at ${m}`, href: "/tools/pwd-calculator", alt: `Prevailing wage queue: DOL is working ${m}${stamp}` } : null;
}

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
