/**
 * USCIS's processing-times page as posted, every posting since March 2022: the pure half.
 *
 * `scripts/ingest_uscis_posted_times.py` writes `perm_docs['uscis_posted_times']` from the daily copies an
 * open-source project keeps of USCIS's page (the script says why and how). Every figure is USCIS's, dated by USCIS's
 * own posting date; the site's typed figures (`i140ProcessingTimes.ts`) are the fallback when the doc is missing or
 * older than USCIS's own longest gap between postings allows.
 */

import { getI140ProcessingTime, PROCESSING_TIMES_AS_OF, type I140Category, type I140Subtype } from "@/lib/processing-times/i140ProcessingTimes";

export interface PostedRow {
  form: string;
  subtype: string;
  office: string;
  /** Months, the figure USCIS's page prints; null where it prints a note instead. */
  posted: number | null;
  postedText: string | null;
  /** The receipt date before which a case may ask USCIS about itself. */
  requestDate: string | null;
  label: string | null;
  officeLabel: string | null;
}

export interface PostedSeries {
  form: string;
  subtype: string;
  office: string;
  label: string | null;
  officeLabel: string | null;
  /** [USCIS's posting date, months], oldest first. */
  points: [string, number][];
}

export interface UscisPosted {
  /** USCIS's newest posting date (ISO). */
  published: string;
  postings: string[];
  newest: PostedRow[];
  series: PostedSeries[];
  /** The longest gap between two postings since 2022, in days. */
  longestGapDays: number | null;
  project: string;
}

/** The office USCIS posts every I-140 subtype under since Sep 5 2025 (the Nebraska and Texas centers before). */
export const I140_OFFICE = "SCD";
/** USCIS posts about monthly; past this many days without a posting, the typed figures stand in. */
const FLOOR_FRESH_DAYS = 75;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function parseUscisPosted(json: string): UscisPosted | null {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return null;
  }
  if (!isObj(raw) || typeof raw.published !== "string" || !ISO.test(raw.published)) return null;
  const newest: PostedRow[] = (Array.isArray(raw.newest) ? raw.newest : []).filter(isObj).flatMap((r) => {
    const form = str(r.form);
    const subtype = str(r.subtype);
    const office = str(r.office);
    if (!form || !subtype || !office) return [];
    return [{ form, subtype, office, posted: num(r.posted), postedText: str(r.postedText),
      requestDate: typeof r.requestDate === "string" && ISO.test(r.requestDate) ? r.requestDate : null,
      label: str(r.label), officeLabel: str(r.officeLabel) }];
  });
  const series: PostedSeries[] = (Array.isArray(raw.series) ? raw.series : []).filter(isObj).flatMap((s) => {
    const form = str(s.form);
    const subtype = str(s.subtype);
    const office = str(s.office);
    if (!form || !subtype || !office) return [];
    const points = (Array.isArray(s.points) ? s.points : []).flatMap((p): [string, number][] =>
      Array.isArray(p) && typeof p[0] === "string" && ISO.test(p[0]) && num(p[1]) !== null ? [[p[0], p[1] as number]] : []);
    return [{ form, subtype, office, label: str(s.label), officeLabel: str(s.officeLabel), points }];
  });
  const postings = (Array.isArray(raw.postings) ? raw.postings : []).filter((d): d is string => typeof d === "string" && ISO.test(d));
  return { published: raw.published, postings, newest, series, longestGapDays: num(raw.longestGapDays),
    project: str(raw.project) ?? "https://github.com/jzebedee/uscis" };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** Whether the newest posting is recent enough to stand for "now": USCIS's longest gap so far, with room. */
export function isCurrent(doc: UscisPosted, today: string): boolean {
  const allowed = Math.max(FLOOR_FRESH_DAYS, Math.round((doc.longestGapDays ?? 0) * 1.5));
  return daysBetween(doc.published, today) <= allowed;
}

/** "136A-E21" -> "E21": the subtype code the typed figures and USCIS's labels use. */
export const i140Code = (subtype: string) => subtype.split("-").pop() ?? subtype;

export interface I140Figures {
  subtypes: I140Subtype[];
  /** USCIS's posting date when the figures are posted ones, else the day they were last read by hand. */
  asOf: string;
  /** "posted": USCIS's own posting, from the daily copies; "read": the typed fallback. */
  from: "posted" | "read";
}

const CATEGORIES: I140Category[] = ["EB-1", "EB-2", "EB-2-NIW", "EB-3"];

/**
 * The I-140 subtypes with USCIS's newest posted figure in place of the typed one, when the doc is current. A
 * subtype the posting lacks, or prints only a note for, keeps its typed figure; when none can be taken, every one
 * does, with the day it was read.
 */
export function i140Figures(doc: UscisPosted | null, today: string): I140Figures {
  const typed = CATEGORIES.flatMap((c) => getI140ProcessingTime(c)?.subtypes ?? []);
  if (!doc || !isCurrent(doc, today)) return { subtypes: typed, asOf: PROCESSING_TIMES_AS_OF, from: "read" };
  const posted = new Map(
    doc.newest.filter((r) => r.form === "I-140" && r.office === I140_OFFICE && r.posted !== null).map((r) => [i140Code(r.subtype), r.posted as number]),
  );
  if (posted.size === 0) return { subtypes: typed, asOf: PROCESSING_TIMES_AS_OF, from: "read" };
  return {
    subtypes: typed.map((s) => (posted.has(s.code) ? { ...s, months80: posted.get(s.code) as number } : s)),
    asOf: doc.published,
    from: "posted",
  };
}

/** Each I-140 subtype's line at Service Center Operations, in the typed order, with at least two postings. */
export function i140Series(doc: UscisPosted | null): (PostedSeries & { code: string; name: string })[] {
  if (!doc) return [];
  const typed = CATEGORIES.flatMap((c) => getI140ProcessingTime(c)?.subtypes ?? []);
  return typed.flatMap((t) => {
    const s = doc.series.find((x) => x.form === "I-140" && x.office === I140_OFFICE && i140Code(x.subtype) === t.code);
    return s && s.points.length >= 2 ? [{ ...s, code: t.code, name: t.label }] : [];
  });
}
