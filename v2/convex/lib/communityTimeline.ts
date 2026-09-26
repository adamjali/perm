/**
 * Community timelines: what happened to a case after PERM, as the person
 * waiting reports it. The rules live here, pure, so the Convex functions, the
 * HTTP layer, the case-page form and the public board read one definition.
 *
 * WHAT IS VERIFIED AND WHAT IS NOT. The PERM half (filed, certified) is read
 * from DOL's own record by case number and is never typed by the reporter.
 * Everything after it (I-140, I-485, work permit, travel document, interview,
 * the green card) has no public per-case source at all, so it is self-reported
 * and every surface says so. Nothing here is blended into an estimate.
 *
 * NO FREE TEXT, on purpose. Every field is a date or a choice from a fixed
 * list, so a public board built from these rows cannot carry a name, a slur,
 * an advertisement or a phone number, and needs no moderation queue to stay
 * that way. The RFE reason is a list for the same reason.
 *
 * PRIVACY. The public board never shows a case number, an employer, or an
 * exact PERM date. It shows the filing MONTH and durations in days, which is
 * what the board is for, and which cannot be turned back into a case without
 * other information.
 */

export const CATEGORIES = [
  { id: "eb2", label: "EB-2" },
  { id: "eb3", label: "EB-3 professional or skilled" },
  { id: "eb3-other", label: "EB-3 other workers" },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]["id"];

/** Chargeability as the visa bulletin splits it. */
export const COUNTRIES = [
  { id: "row", label: "Rest of world" },
  { id: "india", label: "India" },
  { id: "china", label: "China (mainland born)" },
  { id: "mexico", label: "Mexico" },
  { id: "philippines", label: "Philippines" },
] as const;
export type CountryId = (typeof COUNTRIES)[number]["id"];

export const ROUTES = [
  { id: "adjustment", label: "Adjusting status in the US (I-485)" },
  { id: "consular", label: "Consular processing abroad" },
] as const;
export type RouteId = (typeof ROUTES)[number]["id"];

export const I140_CENTERS = [
  { id: "nebraska", label: "Nebraska Service Center" },
  { id: "texas", label: "Texas Service Center" },
  { id: "other", label: "Another office" },
] as const;
export type I140CenterId = (typeof I140_CENTERS)[number]["id"];

/**
 * The self-reported dates, in the order a case meets them. `route` decides
 * which apply: the work permit, travel document and I-485 belong to an
 * adjustment; a consular case goes from the I-140 to an interview abroad.
 */
export const DATE_FIELDS = [
  { id: "i140FiledOn", label: "I-140 filed", short: "I-140 filed", routes: ["adjustment", "consular"] },
  { id: "i140ApprovedOn", label: "I-140 approved", short: "I-140 approved", routes: ["adjustment", "consular"] },
  { id: "i485FiledOn", label: "I-485 filed", short: "I-485 filed", routes: ["adjustment"] },
  { id: "eadOn", label: "Work permit (EAD) approved", short: "EAD", routes: ["adjustment"] },
  { id: "apOn", label: "Travel document (advance parole) approved", short: "Advance parole", routes: ["adjustment"] },
  { id: "interviewOn", label: "Interview", short: "Interview", routes: ["adjustment", "consular"] },
  { id: "greenCardOn", label: "Green card approved, or immigrant visa issued", short: "Green card", routes: ["adjustment", "consular"] },
] as const;
export type DateFieldId = (typeof DATE_FIELDS)[number]["id"];

export const RFE_FORMS = [
  { id: "i140", label: "I-140" },
  { id: "i485", label: "I-485" },
] as const;
export type RfeFormId = (typeof RFE_FORMS)[number]["id"];

export const RFE_REASONS = [
  { id: "ability-to-pay", label: "The employer's ability to pay the wage" },
  { id: "experience", label: "Experience letters or qualifications" },
  { id: "education", label: "A degree or its evaluation" },
  { id: "job-offer", label: "The job offer or the employer relationship" },
  { id: "perm-docs", label: "PERM documents missing or inconsistent" },
  { id: "medical", label: "The medical exam (I-693)" },
  { id: "supplement-j", label: "Supplement J or confirming the job" },
  { id: "status", label: "Immigration status history" },
  { id: "civil-docs", label: "Birth certificate or other civil documents" },
  { id: "other", label: "Something else" },
] as const;
export type RfeReasonId = (typeof RFE_REASONS)[number]["id"];

export const RFE_OUTCOMES = [
  { id: "pending", label: "Still waiting" },
  { id: "approved", label: "Approved after the response" },
  { id: "denied", label: "Denied" },
] as const;
export type RfeOutcomeId = (typeof RFE_OUTCOMES)[number]["id"];

/** The board lists rows once this many people have shared theirs publicly. */
export const BOARD_OPENS_AT = 25;
/** A median is printed only over at least this many timelines. */
export const METRIC_MIN_N = 5;

/** PERM numbers only: the FLAG form and the older A- form. */
export const PERM_CASE = /^(G-\d{3}-\d{5}-\d{6}|A-\d{5}-\d{5})$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
/** The earliest date any field may carry; PERM case numbers start in 2005. */
const FLOOR = "2005-01-01";

export interface TimelineInput {
  category?: string | null;
  country?: string | null;
  route?: string | null;
  premium?: boolean | null;
  i140Center?: string | null;
  i140FiledOn?: string | null;
  i140ApprovedOn?: string | null;
  i485FiledOn?: string | null;
  eadOn?: string | null;
  apOn?: string | null;
  interviewOn?: string | null;
  greenCardOn?: string | null;
  rfeForm?: string | null;
  rfeReason?: string | null;
  rfeIssuedOn?: string | null;
  rfeRespondedOn?: string | null;
  rfeOutcome?: string | null;
  public?: boolean | null;
}

/** The validated shape, every field present and either a value or undefined. */
export interface TimelineFields {
  category?: CategoryId;
  country?: CountryId;
  route?: RouteId;
  premium?: boolean;
  i140Center?: I140CenterId;
  i140FiledOn?: string;
  i140ApprovedOn?: string;
  i485FiledOn?: string;
  eadOn?: string;
  apOn?: string;
  interviewOn?: string;
  greenCardOn?: string;
  rfeForm?: RfeFormId;
  rfeReason?: RfeReasonId;
  rfeIssuedOn?: string;
  rfeRespondedOn?: string;
  rfeOutcome?: RfeOutcomeId;
  public: boolean;
}

export type ValidationResult =
  | { ok: true; value: TimelineFields }
  | { ok: false; message: string };

function pick<T extends { id: string }>(list: readonly T[], raw: unknown): T["id"] | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || raw.length > 24) return null;
  const hit = list.find((x) => x.id === raw);
  return hit ? hit.id : null;
}

function isoOrUndefined(raw: unknown, today: string): string | undefined | null {
  if (raw === undefined || raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || raw.length !== 10 || !ISO.test(raw)) return null;
  if (Number.isNaN(Date.parse(`${raw}T00:00:00Z`))) return null;
  if (raw < FLOOR || raw > today) return null;
  return raw;
}

/** "YYYY-MM-DD", UTC, for comparisons against today. */
export function isoToday(now: number = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

/**
 * Check a submission field by field. Every field is optional; a timeline with
 * no date at all is still refused, because there is nothing to record.
 *
 * Order is checked where it is unambiguous (an approval cannot precede its own
 * filing, an I-485 or interview cannot precede the I-140 filing, a response
 * cannot precede the RFE). Anything subtler (an EAD before the I-485 receipt
 * notice arrived, say) is left alone: a person's own dates are theirs.
 */
export function validateTimeline(input: TimelineInput, today: string = isoToday()): ValidationResult {
  const out: TimelineFields = { public: input.public === true };

  const choices: [keyof TimelineFields, readonly { id: string }[], unknown, string][] = [
    ["category", CATEGORIES, input.category, "category"],
    ["country", COUNTRIES, input.country, "country"],
    ["route", ROUTES, input.route, "route"],
    ["i140Center", I140_CENTERS, input.i140Center, "I-140 office"],
    ["rfeForm", RFE_FORMS, input.rfeForm, "RFE form"],
    ["rfeReason", RFE_REASONS, input.rfeReason, "RFE reason"],
    ["rfeOutcome", RFE_OUTCOMES, input.rfeOutcome, "RFE outcome"],
  ];
  for (const [key, list, raw, name] of choices) {
    const v = pick(list, raw);
    if (v === null) return { ok: false, message: `That ${name} isn't one this form records.` };
    if (v !== undefined) (out as unknown as Record<string, unknown>)[key] = v;
  }
  if (input.premium === true || input.premium === false) out.premium = input.premium;

  const dates: [keyof TimelineFields, unknown][] = [
    ...DATE_FIELDS.map((f) => [f.id, input[f.id]] as [keyof TimelineFields, unknown]),
    ["rfeIssuedOn", input.rfeIssuedOn],
    ["rfeRespondedOn", input.rfeRespondedOn],
  ];
  for (const [key, raw] of dates) {
    const v = isoOrUndefined(raw, today);
    if (v === null) return { ok: false, message: "Enter each date as YYYY-MM-DD, from 2005 on and not in the future." };
    if (v !== undefined) (out as unknown as Record<string, unknown>)[key] = v;
  }

  const any = DATE_FIELDS.some((f) => out[f.id] !== undefined);
  if (!any) return { ok: false, message: "Add at least one date after PERM to record a timeline." };

  const before = (a?: string, b?: string) => a !== undefined && b !== undefined && b < a;
  if (before(out.i140FiledOn, out.i140ApprovedOn)) {
    return { ok: false, message: "The I-140 approval is dated before its filing." };
  }
  if (before(out.i485FiledOn, out.greenCardOn) && out.route !== "consular") {
    return { ok: false, message: "The green card is dated before the I-485 filing." };
  }
  // An I-485 filed before the I-140 is NOT checked: concurrent filing puts
  // them in on the same day, and a refiled or upgraded I-140 can carry a
  // later date than the I-485 it supports. A person's own dates are theirs.
  if (before(out.rfeIssuedOn, out.rfeRespondedOn)) {
    return { ok: false, message: "The RFE response is dated before the RFE." };
  }
  const rfeAny = out.rfeForm || out.rfeReason || out.rfeIssuedOn || out.rfeRespondedOn || out.rfeOutcome;
  if (rfeAny && !out.rfeForm) {
    return { ok: false, message: "Say which form the RFE was on." };
  }
  if (out.route === "consular") {
    // An adjustment-only date on a consular timeline is a contradiction the
    // board would print as fact. Refuse it rather than silently dropping it.
    for (const f of DATE_FIELDS) {
      if (out[f.id] !== undefined && !(f.routes as readonly string[]).includes("consular")) {
        return { ok: false, message: `${f.label} applies to an adjustment in the US, not consular processing.` };
      }
    }
  }
  return { ok: true, value: out };
}

/** Whole days from `a` to `b`, both ISO; null when either is missing. */
export function daysBetween(a?: string | null, b?: string | null): number | null {
  if (!a || !b) return null;
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86_400_000);
}

/** The stored row, as the board sees it: the verified PERM half plus the fields. */
export interface TimelineRecord extends TimelineFields {
  /** DOL's filing date for the case, when found. Never typed by the reporter. */
  permFiledOn?: string;
  /** DOL's certification date, when found. */
  permCertifiedOn?: string;
  /** Where the certification date came from. */
  permCertifiedSource?: "disclosure" | "observed";
  hiddenAt?: number;
  updatedAt: number;
}

/**
 * A stage the board measures: from one milestone to the next. `from` may be
 * the verified PERM certification. Premium is split out where it decides the
 * answer (the I-140), because a median across premium and regular filings is
 * a number that describes nobody.
 */
export const METRICS = [
  { id: "perm", label: "PERM filed to certified", from: "permFiledOn", to: "permCertifiedOn", verified: true },
  { id: "cert-to-i140", label: "PERM certified to I-140 filed", from: "permCertifiedOn", to: "i140FiledOn", verified: false },
  { id: "i140-premium", label: "I-140 filed to approved, premium", from: "i140FiledOn", to: "i140ApprovedOn", premium: true, verified: false },
  { id: "i140-regular", label: "I-140 filed to approved, regular", from: "i140FiledOn", to: "i140ApprovedOn", premium: false, verified: false },
  { id: "i485-ead", label: "I-485 filed to work permit", from: "i485FiledOn", to: "eadOn", verified: false },
  { id: "i485-gc", label: "I-485 filed to green card", from: "i485FiledOn", to: "greenCardOn", verified: false },
] as const;
export type MetricId = (typeof METRICS)[number]["id"];

export interface MetricResult {
  id: MetricId;
  label: string;
  verified: boolean;
  n: number;
  /** Null below METRIC_MIN_N: too few to print a median. */
  median: number | null;
  p25: number | null;
  p75: number | null;
}

/** Nearest-rank percentile over a sorted list; the lists here are small. */
function nearestRank(sorted: readonly number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i] as number;
}

/**
 * Medians per stage. A negative duration (a date typed in the wrong box, or a
 * PERM certification after the reporter's own I-140 date, which cannot
 * happen) is dropped rather than averaged in, and the count says what was used.
 */
export function computeMetrics(records: readonly TimelineRecord[]): MetricResult[] {
  const live = records.filter((r) => r.hiddenAt === undefined);
  return METRICS.map((m) => {
    const vals: number[] = [];
    for (const r of live) {
      if ("premium" in m && r.premium !== m.premium) continue;
      const d = daysBetween(
        (r as unknown as Record<string, string | undefined>)[m.from],
        (r as unknown as Record<string, string | undefined>)[m.to],
      );
      if (d !== null && d >= 0 && d <= 3650) vals.push(d);
    }
    vals.sort((a, b) => a - b);
    const enough = vals.length >= METRIC_MIN_N;
    return {
      id: m.id,
      label: m.label,
      verified: m.verified,
      n: vals.length,
      median: enough ? nearestRank(vals, 0.5) : null,
      p25: enough ? nearestRank(vals, 0.25) : null,
      p75: enough ? nearestRank(vals, 0.75) : null,
    };
  });
}

export interface RfeSummary {
  total: number;
  byForm: { id: RfeFormId; label: string; count: number }[];
  byReason: { id: RfeReasonId; label: string; count: number }[];
  byOutcome: { id: RfeOutcomeId; label: string; count: number }[];
}

export function summarizeRfes(records: readonly TimelineRecord[]): RfeSummary {
  const rfes = records.filter((r) => r.hiddenAt === undefined && r.rfeForm !== undefined);
  const count = <T extends { id: string; label: string }>(list: readonly T[], key: keyof TimelineRecord) =>
    list
      .map((x) => ({ id: x.id as T["id"], label: x.label, count: rfes.filter((r) => r[key] === x.id).length }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  return {
    total: rfes.length,
    byForm: count(RFE_FORMS, "rfeForm"),
    byReason: count(RFE_REASONS, "rfeReason"),
    byOutcome: count(RFE_OUTCOMES, "rfeOutcome"),
  };
}

/** One row of the public board: no case number, no employer, no exact PERM date. */
export interface BoardRow {
  /** "YYYY-MM": the PERM filing month, the priority-date month. */
  filedMonth: string | null;
  category: CategoryId | null;
  country: CountryId | null;
  route: RouteId | null;
  premium: boolean | null;
  /** Days from PERM filing to each stop, in DATE_FIELDS order; null when not reported. */
  stops: { id: DateFieldId | "permCertifiedOn"; day: number | null; month: string | null }[];
  /** True when the PERM half was found in DOL's record. */
  permVerified: boolean;
  rfe: { form: RfeFormId; reason: RfeReasonId | null; outcome: RfeOutcomeId | null } | null;
  updatedMonth: string;
}

export function toBoardRow(r: TimelineRecord): BoardRow {
  const origin = r.permFiledOn ?? null;
  const stop = (id: DateFieldId | "permCertifiedOn") => {
    const iso = (r as unknown as Record<string, string | undefined>)[id];
    return { id, day: origin && iso ? daysBetween(origin, iso) : null, month: iso ? iso.slice(0, 7) : null };
  };
  return {
    filedMonth: origin ? origin.slice(0, 7) : null,
    category: r.category ?? null,
    country: r.country ?? null,
    route: r.route ?? null,
    premium: r.premium ?? null,
    stops: [stop("permCertifiedOn"), ...DATE_FIELDS.map((f) => stop(f.id))],
    permVerified: Boolean(r.permFiledOn && r.permCertifiedOn),
    rfe: r.rfeForm ? { form: r.rfeForm, reason: r.rfeReason ?? null, outcome: r.rfeOutcome ?? null } : null,
    updatedMonth: new Date(r.updatedAt).toISOString().slice(0, 7),
  };
}

/** The stages the case page draws, in order, with whether anyone reported each. */
export const CASE_STOPS = [
  { id: "permFiledOn", label: "PERM filed", verified: true },
  { id: "permCertifiedOn", label: "PERM certified", verified: true },
  ...DATE_FIELDS.map((f) => ({ id: f.id, label: f.short, verified: false })),
] as const;
