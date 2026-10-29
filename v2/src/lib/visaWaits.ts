/**
 * State's Global Visa Wait Times, as the page reads them: the columns, the
 * consulates it features first, and how each cell reads in plain words. Plain
 * module: the page and its tests read it. The reader is
 * `scripts/ingest_visa_wait_times.py`; the database read is
 * `src/lib/db/visaWaits.ts`.
 *
 * Every cell keeps what State printed. State counts a month as 30 days and half
 * a month as 15 (its page, read Oct 28 2026), so "< 0.5 Month" is under 15 days.
 * State never defines "NA": it's shown as "No figure", never as zero.
 */

export type WaitKind = "value" | "na" | "same_day" | "blank" | "unread";

export interface WaitCell {
  post: string;
  visaClass: string;
  measure: "next" | "average";
  waitText: string;
  kind: WaitKind;
  /** The number as printed; null for no figure. */
  amount: number | null;
  unit: "month" | "day" | null;
  /** "under" for State's "<" ("< 0.5 Month"). */
  bound: "under" | null;
  /** State's own arithmetic, a month being 30 days; null for no figure. */
  days: number | null;
}

/** The table's columns, the workers' column first. */
export const WAIT_COLUMNS = [
  { key: "H,L,O,P,Q|next", visaClass: "H,L,O,P,Q", measure: "next", label: "Work visas (H-1B, L, O, P, Q)", short: "H, L, O, P, Q" },
  { key: "F,M,J|next", visaClass: "F,M,J", measure: "next", label: "Students and exchange visitors (F, M, J)", short: "F, M, J" },
  { key: "B1/B2|next", visaClass: "B1/B2", measure: "next", label: "Visitors (B1/B2), next appointment", short: "B1/B2 next" },
  { key: "B1/B2|average", visaClass: "B1/B2", measure: "average", label: "Visitors (B1/B2), last month's average wait", short: "B1/B2 average" },
  { key: "C,D,C1/D|next", visaClass: "C,D,C1/D", measure: "next", label: "Crew and transit (C, D)", short: "C, D" },
] as const;

export type WaitColumnKey = (typeof WAIT_COLUMNS)[number]["key"];

export const cellKey = (c: { visaClass: string; measure: string }) => `${c.visaClass}|${c.measure}`;

/**
 * The countries the page draws first, each with its consulates as State names
 * them: India and China (whose workers make up most H-1B petitions USCIS
 * approves), then a fixed list of countries common among H-1B, L and PERM
 * workers. A choice for this page's readers, not a ranking; every other
 * consulate is in the full table.
 */
export const FEATURED: ReadonlyArray<{ country: string; posts: readonly string[] }> = [
  { country: "India", posts: ["Chennai (Madras)", "Hyderabad", "Kolkata", "Mumbai (Bombay)", "New Delhi"] },
  { country: "China", posts: ["Beijing", "Chengdu", "Guangzhou", "Shanghai", "Shenyang", "Wuhan"] },
  { country: "Canada", posts: ["Calgary", "Halifax", "Montreal", "Ottawa", "Quebec", "Toronto", "Vancouver"] },
  { country: "Mexico", posts: ["Ciudad Juarez", "Guadalajara", "Hermosillo", "Matamoros", "Merida", "Mexico City", "Monterrey", "Nogales", "Nuevo Laredo", "Tijuana"] },
  { country: "Philippines", posts: ["Manila"] },
  { country: "South Korea", posts: ["Seoul"] },
  { country: "Taiwan", posts: ["Kaohsiung", "Taipei"] },
  { country: "Japan", posts: ["Fukuoka", "Naha", "Osaka/Kobe", "Sapporo", "Tokyo"] },
  { country: "Vietnam", posts: ["Hanoi", "Ho Chi Minh City"] },
  { country: "Pakistan", posts: ["Islamabad", "Karachi", "Lahore"] },
  { country: "Bangladesh", posts: ["Dhaka"] },
  { country: "Nepal", posts: ["Kathmandu"] },
  { country: "Brazil", posts: ["Brasilia", "Porto Alegre", "Recife", "Rio De Janeiro", "Sao Paulo"] },
  { country: "Nigeria", posts: ["Abuja", "Lagos"] },
  { country: "United Kingdom", posts: ["Belfast", "Edinburgh", "London"] },
];

/** A cell in plain words: "Under 15 days", "2.5 months", "Same day", "No figure". */
export function waitWords(c: Pick<WaitCell, "kind" | "amount" | "unit" | "bound" | "days" | "waitText">): string {
  if (c.kind === "same_day") return "Same day";
  // A cell the reader couldn't place keeps State's own words.
  if (c.kind === "unread") return c.waitText;
  if (c.kind === "na" || c.kind === "blank" || c.amount === null) return "No figure";
  if (c.bound === "under") return c.unit === "day" ? `Under ${c.amount} days` : `Under ${Math.round((c.amount ?? 0) * 30)} days`;
  const unit = c.unit === "day" ? "day" : "month";
  const n = Number.isInteger(c.amount) ? String(c.amount) : c.amount.toFixed(1);
  return `${n} ${unit}${c.amount === 1 ? "" : "s"}`;
}

/** The length a bar draws: State's days, half the bound for an "under" cell, nothing without a figure. */
export function waitBarDays(c: Pick<WaitCell, "kind" | "days" | "bound">): number | null {
  if (c.kind === "same_day") return 0;
  if (c.days === null || c.kind !== "value") return null;
  return c.bound === "under" ? c.days / 2 : c.days;
}

/** Every calendar month from the first reading to the last, each with its reading or none (a gap). */
export function monthSlots(readings: readonly string[]): Array<{ month: string; reading: string | null }> {
  if (readings.length === 0) return [];
  const sorted = [...readings].sort();
  const byMonth = new Map<string, string>();
  // One reading a month; were there two, the later stands for the month.
  for (const r of sorted) byMonth.set(r.slice(0, 7), r);
  const first = sorted[0]!.slice(0, 7);
  const last = sorted[sorted.length - 1]!.slice(0, 7);
  const out: Array<{ month: string; reading: string | null }> = [];
  let [y, m] = first.split("-").map(Number) as [number, number];
  for (;;) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ month: key, reading: byMonth.get(key) ?? null });
    if (key === last) break;
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
