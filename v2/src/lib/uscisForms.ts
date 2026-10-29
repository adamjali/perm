/**
 * One page per USCIS form: which forms get a page, the lines each draws, and
 * the arithmetic over USCIS's quarterly rows. Plain module: the page, the
 * sitemap and the tests read it.
 *
 * USCIS's quarterly workbook prints a row per form AND per kind of case, and
 * it renames rows: the I-130 was one row until FY2024 Q4 and two from FY2025
 * Q1, and every I-131 row took a new name in FY2026 Q1. A line here names
 * each title a row has carried, and joins two only where the old and new rows
 * plainly count the same cases (advance parole, parole in place). A row whose
 * meaning we can't match across a rename stays its own line, drawn only over
 * the quarters it existed.
 *
 * A quarter USCIS published but nobody kept (FY2024 Q2: the Internet Archive
 * holds no copy of that workbook) is a gap: a dashed empty frame on the
 * charts, never a zero and never a line drawn through it.
 */

export interface FormLine {
  key: string;
  /** What the line counts, in plain words. */
  label: string;
  /** Every title USCIS has printed for this row, newest first. */
  titles: readonly string[];
  /** The FY2016 to FY2024 factsheet's row for the same cases, by its basis, when it has one. */
  factsheet?: string;
}

export interface FormPage {
  slug: string;
  form: string;
  /** The form's name as people know it. */
  name: string;
  /** Who files it and why, one sentence. */
  who: string;
  lines: readonly FormLine[];
  /** Where to go next on this site. */
  links: ReadonlyArray<{ href: string; label: string }>;
  /** Words people search with, for the site search. */
  terms: string;
}

const TIMELINE = { href: "/tools/green-card-timeline", label: "Plan the whole green card, step by step" };
const HUB = { href: "/uscis-processing-times", label: "Every form's median, side by side" };

export const FORM_PAGES: readonly FormPage[] = [
  {
    slug: "i-140",
    form: "I-140",
    name: "Immigrant Petition for Alien Workers",
    who: "An employer files it to sponsor a worker for a green card, usually after DOL certifies the PERM.",
    lines: [{ key: "all", label: "Every I-140", titles: ["Immigrant Petition for Alien Workers"] }],
    links: [
      { href: "/tools/i140-calculator", label: "When to file the I-140, and its deadline" },
      { href: "/i140-awaiting-visa", label: "Approved I-140s waiting for a visa number" },
      TIMELINE,
    ],
    terms: "i-140 i140 immigrant petition employer green card petition processing time",
  },
  {
    slug: "i-485",
    form: "I-485",
    name: "Application to Register Permanent Residence or Adjust Status",
    who: "The person files it inside the U.S. to become a permanent resident once their priority date is current.",
    lines: [
      {
        key: "employment",
        label: "Employment-based",
        titles: ["Application to Register Permanent Residence or Adjust Status (Employment)"],
        factsheet: "Employment-based adjustment applications",
      },
      {
        key: "family",
        label: "Family-based",
        titles: ["Application to Register Permanent Residence or Adjust Status (Family)"],
        factsheet: "Family-based adjustment applications",
      },
      {
        key: "asylum",
        label: "Based on asylum",
        titles: ["Application to Register Permanent Residence or Adjust Status (Asylum)"],
        factsheet: "Based on grant of asylum more than 1 year ago",
      },
      {
        key: "refugee",
        label: "Based on refugee admission",
        titles: ["Application to Register Permanent Residence or Adjust Status (Refugee)"],
        factsheet: "Based on refugee admission more than 1 year ago",
      },
      { key: "cuban", label: "Cuban Adjustment Act", titles: ["Application to Register Permanent Residence or Adjust Status (Cuban)"] },
      { key: "other", label: "Every other basis", titles: ["Application to Register Permanent Residence or Adjust Status (Other)"] },
    ],
    links: [
      { href: "/i485-by-field-office", label: "The I-485 at each field office" },
      { href: "/tools/green-card-line", label: "How many people are ahead of you in line" },
      TIMELINE,
    ],
    terms: "i-485 i485 adjustment of status green card application aos processing time",
  },
  {
    slug: "i-765",
    form: "I-765",
    name: "Application for Employment Authorization",
    who: "The work permit (EAD): filed with or after a pending I-485, by asylum applicants, by H-4 and L-2 spouses and others.",
    lines: [
      {
        key: "adjustment",
        label: "With a pending I-485",
        titles: ["Application for Employment Authorization (Adjustment Of Status)"],
        factsheet: "Based on a pending I-485 adjustment application",
      },
      {
        key: "other",
        label: "Every other basis (H-4, L-2 and others)",
        titles: ["Application for Employment Authorization (All Other)"],
        factsheet: "All other applications for employment authorization",
      },
      {
        key: "asylum",
        label: "With a pending asylum application",
        titles: ["Application for Employment Authorization (Asylum)"],
        factsheet: "Based on a pending asylum application",
      },
    ],
    links: [{ href: "/tools/ead-extension", label: "Whether a renewal extends your work permit" }, TIMELINE],
    terms: "i-765 i765 ead work permit employment authorization h-4 ead processing time",
  },
  {
    slug: "i-131",
    form: "I-131",
    name: "Application for Travel Document",
    who: "Filed for advance parole (travel while an I-485 is pending), a reentry permit, a refugee travel document or parole.",
    lines: [
      {
        key: "advance-parole",
        label: "Advance parole, from inside the U.S.",
        titles: [
          "Application for Advance Parole Document for Aliens Inside the United States",
          "Application for Travel Document (Advance Parole)",
        ],
        factsheet: "Advance Parole Document",
      },
      {
        key: "parole-in-place",
        label: "Parole in place",
        titles: [
          "Application for Travel Document, Parole Documents, and Arrival/Departure Records (Parole in Place)",
          "Application for Travel Document (Parole-in-Place)",
        ],
        factsheet: "Parole in Place",
      },
      {
        key: "travel",
        label: "Travel documents and parole records",
        titles: ["Application for Travel Documents, Parole Documents, and Arrival/Departure Records"],
      },
      { key: "outside", label: "Parole, from outside the U.S.", titles: ["Application for Initial Parole Document for Aliens Outside the United States"] },
      { key: "travel-old", label: "Travel documents (until FY2025)", titles: ["Application for Travel Document"], factsheet: "Travel Documents" },
      { key: "humanitarian-old", label: "Humanitarian parole (until FY2025)", titles: ["Application for Travel Document (Humanitarian Parole)"] },
    ],
    links: [{ href: "/guides/ead-and-advance-parole-timelines", label: "The work permit and advance parole, step by step" }, TIMELINE],
    terms: "i-131 i131 advance parole travel document reentry permit ap processing time",
  },
  {
    slug: "i-129",
    form: "I-129",
    name: "Petition for a Nonimmigrant Worker",
    who: "An employer files it for an H-1B, L-1, O-1 and other temporary workers, new or extending.",
    lines: [
      {
        key: "all",
        label: "Every I-129",
        titles: ["Petition for a Nonimmigrant Worker"],
        factsheet: "Nonimmigrant Petition (non Premium filed)",
      },
    ],
    links: [
      { href: "/uscis-rfe-rates", label: "How often USCIS asks for more evidence on an I-129" },
      { href: "/h1b-employers", label: "The busiest H-1B employers" },
    ],
    terms: "i-129 i129 h-1b petition nonimmigrant worker l-1 o-1 processing time",
  },
  {
    slug: "i-539",
    form: "I-539",
    name: "Application to Extend or Change Nonimmigrant Status",
    who: "Filed to extend a stay or change to another status, often by an H-4 or L-2 spouse beside the worker's I-129.",
    lines: [{ key: "all", label: "Every I-539", titles: ["Application To Extend/Change Nonimmigrant Status"] }],
    links: [{ href: "/uscis-processing-times", label: "Every form's median, side by side" }],
    terms: "i-539 i539 extend change status h-4 extension processing time",
  },
  {
    slug: "i-130",
    form: "I-130",
    name: "Petition for Alien Relative",
    who: "A citizen or permanent resident files it to sponsor a family member for a green card.",
    lines: [
      {
        key: "immediate",
        label: "Immediate relatives of citizens",
        titles: ["Petition for Alien Relative (Immediate Relative)"],
        factsheet: "Immediate Relative",
      },
      { key: "other", label: "Every other relative", titles: ["Petition for Alien Relative (All Other Relative)"] },
      { key: "all-old", label: "Every relative (one row until FY2024)", titles: ["Petition for Alien Relative"] },
    ],
    links: [{ href: "/visa-bulletin/family", label: "The family visa bulletin" }, HUB],
    terms: "i-130 i130 family petition relative spouse parent processing time",
  },
  {
    slug: "i-360",
    form: "I-360",
    name: "Petition for Amerasian, Widow(er), or Special Immigrant",
    who: "Filed for special immigrants: religious workers, VAWA self-petitioners, special immigrant juveniles and others.",
    lines: [{ key: "all", label: "Every I-360", titles: ["Petition for Amerasian, Widow(er), or Special Immigrant"] }],
    links: [{ href: "/i140-awaiting-visa", label: "Approved petitions waiting for a visa number" }, HUB],
    terms: "i-360 i360 special immigrant religious worker sij vawa processing time",
  },
  {
    slug: "i-526",
    form: "I-526",
    name: "Immigrant Petition by Alien Investor",
    who: "An investor files it for an EB-5 green card, standalone or through a regional center (the I-526E).",
    lines: [
      { key: "standalone", label: "Standalone investor", titles: ["Immigrant Petition by Standalone Investor"] },
      { key: "legacy", label: "Filed before the 2022 EB-5 law", titles: ["Immigrant Petition by Alien Investor (Legacy)"] },
    ],
    links: [HUB],
    terms: "i-526 i526 eb-5 investor petition processing time",
  },
  {
    slug: "i-824",
    form: "I-824",
    name: "Application for Action on an Approved Application or Petition",
    who: "Filed to ask USCIS to send an approval to a consulate, or to notify the consulate for a family member following to join.",
    lines: [{ key: "all", label: "Every I-824", titles: ["Application for Action on an Approved Application or Petition"] }],
    links: [HUB],
    terms: "i-824 i824 action on approved petition follow to join processing time",
  },
  {
    slug: "i-290b",
    form: "I-290B",
    name: "Notice of Appeal or Motion",
    who: "Filed to appeal a USCIS denial or to ask USCIS to reopen or reconsider its decision.",
    lines: [{ key: "all", label: "Every I-290B", titles: ["Notice of Appeal or Motion"] }],
    links: [HUB],
    terms: "i-290b i290b appeal motion reopen reconsider processing time",
  },
  {
    slug: "i-751",
    form: "I-751",
    name: "Petition to Remove Conditions on Residence",
    who: "Filed by a conditional resident through marriage, in the 90 days before the two-year card expires.",
    lines: [{ key: "all", label: "Every I-751", titles: ["Petition to Remove Conditions on Residence"] }],
    links: [HUB],
    terms: "i-751 i751 remove conditions conditional green card processing time",
  },
  {
    slug: "i-90",
    form: "I-90",
    name: "Application to Replace Permanent Resident Card",
    who: "A permanent resident files it to renew or replace a green card.",
    lines: [
      {
        key: "all",
        label: "Every I-90",
        titles: ["Application to Replace Permanent Resident Card"],
        factsheet: "Initial issuance, replacement or renewal",
      },
    ],
    links: [HUB],
    terms: "i-90 i90 renew replace green card processing time",
  },
  {
    slug: "i-129f",
    form: "I-129F",
    name: "Petition for Alien Fiancé(e)",
    who: "A U.S. citizen files it for a fiancé(e) to come to marry (the K-1 visa).",
    lines: [{ key: "all", label: "Every I-129F", titles: ["Petition for Alien Fiancé(e)"] }],
    links: [HUB],
    terms: "i-129f i129f fiance k-1 visa processing time",
  },
  {
    slug: "n-400",
    form: "N-400",
    name: "Application for Naturalization",
    who: "A permanent resident files it to become a U.S. citizen, usually after three or five years.",
    lines: [
      { key: "civilian", label: "Every N-400 but military", titles: ["Application for Naturalization"], factsheet: "Application for Naturalization" },
      { key: "military", label: "Military", titles: ["Application for Naturalization (Military)"] },
    ],
    links: [HUB],
    terms: "n-400 n400 naturalization citizenship processing time",
  },
];

export function formPage(slug: string): FormPage | null {
  return FORM_PAGES.find((p) => p.slug === slug) ?? null;
}

/** One of USCIS's quarterly rows for a form, as the page reads it. */
export interface FormQuarterRow {
  fy: number;
  quarter: number;
  quarterEnd: string;
  title: string;
  received: number | null;
  approved: number | null;
  denied: number | null;
  completed: number | null;
  pending: number | null;
  medianMonths: number | null;
}

export interface Slot {
  fy: number;
  quarter: number;
  /** No workbook for this quarter is held. */
  gap: boolean;
}

const indexOf = (fy: number, quarter: number) => fy * 4 + (quarter - 1);

/** Every quarter from the first held to the last, in order, with the ones not held marked as gaps. */
export function quarterSlots(rows: readonly { fy: number; quarter: number }[]): Slot[] {
  if (rows.length === 0) return [];
  const held = new Set(rows.map((r) => indexOf(r.fy, r.quarter)));
  const lo = Math.min(...held);
  const hi = Math.max(...held);
  const out: Slot[] = [];
  for (let i = lo; i <= hi; i++) out.push({ fy: Math.floor(i / 4), quarter: (i % 4) + 1, gap: !held.has(i) });
  return out;
}

export interface LinePoint {
  slot: Slot;
  row: FormQuarterRow | null;
}

/**
 * One line over the quarters it existed: from the first quarter USCIS printed
 * any of its titles to the last. A quarter in that span without the row is a
 * gap when no workbook is held for it, and a missing row (null) when the
 * workbook is held but lacks the row.
 */
export function lineSeries(rows: readonly FormQuarterRow[], line: FormLine, slots: readonly Slot[]): LinePoint[] {
  const titles = new Set(line.titles);
  const mine = rows.filter((r) => titles.has(r.title));
  if (mine.length === 0) return [];
  const at = new Map(mine.map((r) => [indexOf(r.fy, r.quarter), r]));
  const lo = Math.min(...at.keys());
  const hi = Math.max(...at.keys());
  return slots
    .filter((s) => indexOf(s.fy, s.quarter) >= lo && indexOf(s.fy, s.quarter) <= hi)
    .map((s) => ({ slot: s, row: at.get(indexOf(s.fy, s.quarter)) ?? null }));
}

export interface FormTotal {
  slot: Slot;
  received: number | null;
  approved: number | null;
  denied: number | null;
  completed: number | null;
  pending: number | null;
}

/**
 * Every row of the form summed per quarter: the form's whole workload. A count
 * USCIS withheld on any row leaves that quarter's sum unknown (null), never a
 * sum that silently left a row out.
 */
export function formTotals(rows: readonly FormQuarterRow[], slots: readonly Slot[]): FormTotal[] {
  const byQuarter = new Map<number, FormQuarterRow[]>();
  for (const r of rows) {
    const k = indexOf(r.fy, r.quarter);
    byQuarter.set(k, [...(byQuarter.get(k) ?? []), r]);
  }
  const sum = (list: FormQuarterRow[], key: "received" | "approved" | "denied" | "completed" | "pending") =>
    list.some((r) => r[key] === null) ? null : list.reduce((n, r) => n + (r[key] ?? 0), 0);
  return slots.map((slot) => {
    const list = slot.gap ? [] : byQuarter.get(indexOf(slot.fy, slot.quarter)) ?? [];
    if (list.length === 0) return { slot, received: null, approved: null, denied: null, completed: null, pending: null };
    return {
      slot,
      received: sum(list, "received"),
      approved: sum(list, "approved"),
      denied: sum(list, "denied"),
      completed: sum(list, "completed"),
      pending: sum(list, "pending"),
    };
  });
}

/** The share of decided cases approved, or null without both counts or with none decided. */
export function approvedShare(t: { approved: number | null; denied: number | null }): number | null {
  if (t.approved === null || t.denied === null) return null;
  const decided = t.approved + t.denied;
  return decided > 0 ? t.approved / decided : null;
}

/** "FY2026 Q3" for a column's short label. */
export function slotShort(s: { fy: number; quarter: number }): string {
  return `FY${String(s.fy).slice(2)} Q${s.quarter}`;
}
