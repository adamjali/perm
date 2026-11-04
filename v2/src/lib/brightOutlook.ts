/**
 * O*NET's Bright Outlook jobs beside how often employers sponsor them: the pure half of /bright-outlook-jobs.
 *
 * O*NET marks an occupation "Bright Outlook" when it's projected to grow much faster than average, to have
 * many openings, or is a new and emerging job. Each is set beside BLS's 2025-35 projection, the PERM cases DOL
 * decided under the code and the certified H-1B LCAs filed under it. Joined by the 7-character SOC code.
 *
 * Plain module: lib/db/brightOutlook.ts reads the tables and passes the rows here.
 */

import { MIN_DECIDED_FOR_RATE, approvalRate } from "@/lib/entityPayload";

/** O*NET's three Bright Outlook categories, as O*NET OnLine names them. */
export const BRIGHT_CATEGORIES = ["Rapid Growth", "Numerous Job Openings", "New and Emerging"] as const;
export type BrightCategory = (typeof BRIGHT_CATEGORIES)[number];

export interface OnetBrightRow {
  /** O*NET's own code: "15-1252.00", or a detailed occupation under the SOC code ("15-1299.08"). */
  onet_code: string;
  soc7: string;
  title: string;
  /** "Rapid Growth; Numerous Job Openings", as the loader stores O*NET's list. */
  bright: string;
}

export interface ProjectionRow {
  soc7: string;
  title: string;
  change_pct: number | null;
  openings: number | null;
  median_wage: number | null;
}

/** One PERM occupation page (a job title under a code) and its decided cases. */
export interface PermTitleRow {
  code: string;
  slug: string;
  name: string;
  total: number;
  certified: number;
  denied: number;
}

export interface BrightJob {
  soc7: string;
  title: string;
  /**
   * When O*NET marks only detailed occupations inside the code (15-1299.08 inside 15-1299), their names. The
   * row's counts are the whole code's, since DOL's files record the code.
   */
  marked: string[];
  categories: BrightCategory[];
  /** BLS's projected change in jobs over its ten years, percent; null where BLS has no projection. */
  growthPct: number | null;
  /** BLS's projected openings a year (BLS publishes thousands; this is the count). */
  openings: number | null;
  /** BLS's median yearly wage for the job. */
  blsMedian: number | null;
  /** PERM cases DOL decided under the code, every title together. */
  permDecided: number;
  permCertified: number;
  permDenied: number;
  /** The certified share, under MIN_DECIDED_FOR_RATE certified-or-denied cases null. */
  approval: number | null;
  /** The busiest PERM title under the code: its page. */
  permSlug: string | null;
  permTitle: string | null;
  /** Certified H-1B LCAs filed under the code, or null when the code isn't in the count (fewer than its floor). */
  lcaCertified: number | null;
}

const soc7 = (code: string) => code.trim().slice(0, 7);
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function categoriesOf(raw: string): BrightCategory[] {
  const found = new Set(raw.split(";").map((s) => s.trim().replace(/&/g, "and")));
  return BRIGHT_CATEGORIES.filter((c) => found.has(c));
}

/** Every Bright Outlook job, one per SOC code, with its projection and its sponsorship. Pure. */
export function brightJobs(
  onet: readonly OnetBrightRow[],
  projections: readonly ProjectionRow[],
  perm: readonly PermTitleRow[],
  lca: ReadonlyMap<string, number>,
): BrightJob[] {
  const byCode = new Map<string, { own: string | null; detailed: string[]; categories: Set<BrightCategory> }>();
  for (const r of onet) {
    const code = soc7(r.soc7);
    const cats = categoriesOf(r.bright ?? "");
    if (!/^\d{2}-\d{4}$/.test(code) || cats.length === 0) continue;
    const held = byCode.get(code) ?? { own: null, detailed: [], categories: new Set<BrightCategory>() };
    if (r.onet_code.endsWith(".00")) held.own = r.title;
    else held.detailed.push(r.title);
    cats.forEach((c) => held.categories.add(c));
    byCode.set(code, held);
  }
  const proj = new Map(projections.map((p) => [soc7(p.soc7), p]));
  const permBy = new Map<string, { decided: number; certified: number; denied: number; top: PermTitleRow | null }>();
  for (const t of perm) {
    const code = soc7(t.code);
    const g = permBy.get(code) ?? { decided: 0, certified: 0, denied: 0, top: null };
    g.decided += t.total;
    g.certified += t.certified;
    g.denied += t.denied;
    if (!g.top || t.total > g.top.total) g.top = t;
    permBy.set(code, g);
  }
  const out: BrightJob[] = [];
  for (const [code, o] of byCode) {
    const p = proj.get(code);
    const g = permBy.get(code);
    out.push({
      soc7: code,
      // The code's own O*NET title; a code marked only through its detailed occupations takes BLS's title for the
      // code, with those occupations named beside it.
      title: o.own ?? (p?.title ? capitalise(p.title) : o.detailed[0]!),
      marked: o.own ? [] : o.detailed,
      categories: BRIGHT_CATEGORIES.filter((c) => o.categories.has(c)),
      growthPct: p?.change_pct ?? null,
      openings: p?.openings != null ? Math.round(p.openings * 1000) : null,
      blsMedian: p?.median_wage ?? null,
      permDecided: g?.decided ?? 0,
      permCertified: g?.certified ?? 0,
      permDenied: g?.denied ?? 0,
      approval: g && g.certified + g.denied >= MIN_DECIDED_FOR_RATE ? approvalRate(g) : null,
      permSlug: g?.top?.slug ?? null,
      permTitle: g?.top?.name ?? null,
      lcaCertified: lca.get(code) ?? null,
    });
  }
  return out.sort((a, b) => b.permDecided - a.permDecided || (b.lcaCertified ?? 0) - (a.lcaCertified ?? 0) || a.soc7.localeCompare(b.soc7));
}

/** The jobs employers sponsor, fastest growing first: some PERM cases and a BLS projection. Pure. */
export function growingAndSponsored(jobs: readonly BrightJob[], minDecided = 10): BrightJob[] {
  return jobs
    .filter((j) => j.permDecided >= minDecided && j.growthPct !== null)
    .sort((a, b) => b.growthPct! - a.growthPct! || b.permDecided - a.permDecided);
}

export interface BrightTotals {
  jobs: number;
  withPerm: number;
  withLca: number;
  permDecided: number;
  byCategory: Record<BrightCategory, number>;
}

export function brightTotals(jobs: readonly BrightJob[]): BrightTotals {
  const byCategory = Object.fromEntries(BRIGHT_CATEGORIES.map((c) => [c, 0])) as Record<BrightCategory, number>;
  for (const j of jobs) j.categories.forEach((c) => (byCategory[c] += 1));
  return {
    jobs: jobs.length,
    withPerm: jobs.filter((j) => j.permDecided > 0).length,
    withLca: jobs.filter((j) => (j.lcaCertified ?? 0) > 0).length,
    permDecided: jobs.reduce((s, j) => s + j.permDecided, 0),
    byCategory,
  };
}
