/**
 * Words for a sponsor's profile: each part of its record, ranked against the
 * other sponsors with enough cases (sponsor_index, built nightly by
 * scripts/build_sponsor_index.py). Pure, so the page and the tests read one
 * definition. There is no single score; each part says what it measures, over
 * what window, and among how many sponsors.
 */

export interface SponsorPart {
  id: "perm_rate" | "perm_recent" | "lca_24m" | "transfer_share" | "senior_share" | "uscis_rate";
  label: string;
  value: number;
  n: number;
  /** Mid-rank percentile among `of` sponsors, 0 to 1. */
  pct: number;
  of: number;
  /** The LCA detail window, for the two shares. */
  from?: string | null;
  to?: string | null;
}

export type SponsorFact =
  | { id: "debarred"; program: string; until: string }
  | { id: "warn"; notices: number; workers: number; since: string }
  | { id: "dependent"; as_of: string }
  | { id: "willful"; lcas: number }
  | { id: "cap_exempt" };

const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
const int = (n: number) => Math.round(n).toLocaleString("en-US");

function monthYear(iso: string | null | undefined): string | null {
  const m = iso ? /^(\d{4})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** The part's own figure, as the page prints it. */
export function partValue(p: SponsorPart): string {
  switch (p.id) {
    case "perm_rate":
    case "uscis_rate":
      return pct(p.value, p.value >= 0.9 && p.value < 1 ? 1 : 0);
    case "transfer_share":
    case "senior_share":
      return pct(p.value);
    default:
      return int(p.value);
  }
}

/** What the figure counts, under it. */
export function partBasis(p: SponsorPart): string {
  const window = p.from && p.to ? `, LCAs decided ${monthYear(p.from)} to ${monthYear(p.to)}` : "";
  switch (p.id) {
    case "perm_rate":
      return `of ${int(p.n)} decided PERM cases`;
    case "uscis_rate":
      return `of ${int(p.n)} USCIS decisions`;
    case "transfer_share":
      return `of ${int(p.n)} certified H-1B positions${window}`;
    case "senior_share":
      return `of ${int(p.n)} certified LCAs with a level${window}`;
    case "perm_recent":
      return "filed in the last 12 months";
    case "lca_24m":
      return "certified in the last 24 months";
  }
}

/** Where it stands: "Higher than 72% of 2,179 sponsors with 20 or more decided cases." */
export function partRank(p: SponsorPart): string {
  const among: Record<SponsorPart["id"], string> = {
    perm_rate: "sponsors with 20 or more decided cases",
    perm_recent: "sponsors that filed in the last 12 months",
    lca_24m: "sponsors with a certified LCA in the last 24 months",
    transfer_share: "sponsors with 20 or more certified positions",
    senior_share: "sponsors with 20 or more leveled LCAs",
    uscis_rate: "sponsors with 20 or more USCIS decisions",
  };
  const share = Math.round(p.pct * 100);
  const lead = share >= 100 ? "At the top of" : share <= 0 ? "At the bottom of" : `Higher than ${share}% of`;
  return `${lead} the ${int(p.of)} ${among[p.id]}.`;
}

/** A fact on the record, as a sentence. */
export function factSentence(f: SponsorFact): string {
  switch (f.id) {
    case "debarred":
      return `DOL has debarred it from ${f.program || "its"} filings until ${f.until}.`;
    case "warn":
      return `${int(f.notices)} WARN layoff ${f.notices === 1 ? "notice" : "notices"} since ${monthYear(f.since)}, covering ${int(f.workers)} workers.`;
    case "dependent":
      return `Its newest LCA that answered declared it H-1B dependent (decided ${f.as_of}).`;
    case "willful":
      return `It declared itself a willful violator on ${int(f.lcas)} ${f.lcas === 1 ? "LCA" : "LCAs"}.`;
    case "cap_exempt":
      return "Likely cap-exempt: most of its PERM filings carry a college or university's industry code.";
  }
}

export function parseParts(json: string | null | undefined): SponsorPart[] {
  try {
    const v: unknown = JSON.parse(json || "[]");
    return Array.isArray(v) ? (v as SponsorPart[]) : [];
  } catch {
    return [];
  }
}

export function parseFacts(json: string | null | undefined): SponsorFact[] {
  try {
    const v: unknown = JSON.parse(json || "[]");
    return Array.isArray(v) ? (v as SponsorFact[]) : [];
  } catch {
    return [];
  }
}
