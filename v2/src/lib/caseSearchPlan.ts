/**
 * What a unified case search is allowed to ask, and why it is not allowed to
 * ask the rest.
 *
 * PURE, AND OUTSIDE `turso/` ON PURPOSE. The server needs it to build SQL and
 * the browser needs it to grey out a control before anyone clicks it, so it
 * can carry no `server-only` import. One copy, two readers: a rule the UI
 * enforces differently from the route is a control that looks live and returns
 * nothing.
 *
 * ## The two constraints this encodes
 *
 * **1. Some fields do not exist while a case is open.** DOL's live case-status
 * endpoint returns a case number, an employer, a job title, a filing date and
 * a status. The wage, the law firm, the worksite state and the SOC occupation
 * arrive only when DOL publishes the case in a quarterly disclosure file. So
 * "pending cases paying over $200k" is not an unbuilt feature, it is a
 * question the record cannot answer, and a control that silently returns
 * nothing teaches the reader to distrust the site instead of teaching them the
 * data model.
 *
 * **2. Every read rides an index**, and which index depends on which field
 * LEADS. Measured against production:
 *
 * | lead | shape | slice | one search |
 * |---|---|---|---|
 * | `employer_slug` prefix `amazon` | range | 3,847 rows | 5.69 s worst case |
 * | `attorney_slug` = Fragomen's slug | equality | 48,165 rows | **0.67 s** |
 * | `attorney_slug` prefix `fragomen` | range | 48,317 rows | forced sort, over the 20 s deadline |
 * | `state` = `CA` | equality | 67,742 rows | **0.30 s** |
 * | `state` = `CA` + a selective filter | equality + walk | 67,742 rows | **44.72 s** |
 *
 * The pattern is the repo's own measured rule: an EQUALITY on the leading
 * index column lets the index supply `ORDER BY decision_date DESC`, so `LIMIT`
 * stops the read at a hundred rows. A RANGE cannot, and neither can a filter
 * the index does not carry: both walk the whole slice.
 *
 * That is why an employer may be narrowed by anything (its slice is small, and
 * 5.69 s is inside the read deadline) while a firm, a state or an occupation
 * may be narrowed only by the columns its own index already carries - the
 * outcome and a decided-date range. Everything else is refused HERE, in words,
 * rather than shipped as a scan.
 *
 * **3. The same rule holds on all three programs.** `pwd_cases` and
 * `lca_cases` both hold `worksite_state` and `soc_code`, and eight indexes
 * (`<table>_state_dec`, `<table>_state_st_dec`, `<table>_soc_dec`,
 * `<table>_soc_st_dec`) let a state or occupation lead reach every program.
 * Rows READ for a hundred-row page, measured against production without and
 * with them:
 *
 * | query | without | with |
 * |---|---|---|
 * | `pwd_cases` state `WY` | 229,555 | **305** |
 * | `pwd_cases` state `CA` + `DENIED` (no such rows) | 634,638 | **0** |
 * | `lca_cases` state `WY` | 259,885 | **100** |
 * | `lca_cases` state `CA` + `DENIED` | 78,360 | **100** |
 * | `lca_cases` occupation `49-3051` (no such rows) | 437,496 | **0** |
 *
 * The without column is not hypothetical: without those indexes every one
 * plans as `SCAN <table> USING INDEX <table>_decided`, which walks the whole
 * table in decision order and throws away what does not match. It is cheap
 * when the needle is common and it is the entire table when the needle is
 * rare, which is the shape of cost that arrives as a slow site rather than as
 * a bug report.
 */

/** Which field leads the search. Exactly one, and the index follows from it. */
export type LeadKind = "case" | "employer" | "firm" | "state" | "occupation" | "stage";
/** The program a review stage belongs to; mirrors `Program` in the search without importing it. */
export type StageProgram = "perm" | "pwd" | "lca";

export const LEAD_KINDS: readonly LeadKind[] = [
  "case",
  "employer",
  "firm",
  "state",
  "occupation",
];

/**
 * The outcome buckets, across three programs that spell their statuses
 * differently. Measured vocabularies, not remembered ones - see
 * `OUTCOME_STATUSES` in `src/lib/turso/caseSearchReads.ts`, which was built by
 * reading the live tables and the summary docs.
 */
export type Outcome = "open" | "granted" | "denied" | "withdrawn";

export const OUTCOMES: readonly Outcome[] = ["open", "granted", "denied", "withdrawn"];

export function isOutcome(v: string): v is Outcome {
  return (OUTCOMES as readonly string[]).includes(v);
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  open: "Still open",
  // Named for what DOL actually did, which is not the same act in all three
  // programs: PERM and the LCA are certified, a wage request has a
  // determination issued. Calling the wage one "approved" would say DOL
  // blessed the filing when all it did was set a number.
  granted: "Certified / issued",
  denied: "Denied",
  withdrawn: "Withdrawn",
};

/** Every control the form offers, whether or not the current lead allows it. */
export type FilterKey =
  | "programs"
  | "outcome"
  | "title"
  | "filed"
  | "decided"
  | "firm"
  | "state"
  | "occupation"
  | "fiscalYear"
  | "wage"
  | "stage"
  | "industry"
  | "city"
  | "citizenship"
  | "birthCountry"
  | "visaClass"
  | "education"
  | "jobEducation"
  | "wageSource";

export const FILTER_KEYS: readonly FilterKey[] = [
  "programs",
  "outcome",
  "title",
  "filed",
  "decided",
  "firm",
  "state",
  "occupation",
  "fiscalYear",
  "wage",
  "stage",
  "industry",
  "city",
  "citizenship",
  "birthCountry",
  "visaClass",
  "education",
  "jobEducation",
  "wageSource",
];

/**
 * The filters only DOL's published PERM file can answer, because no other
 * record this site holds carries the column: the worker's details, which DOL
 * printed on the old ETA-9089. A search that sets one reads published PERM and
 * says so rather than returning other programs unfiltered.
 *
 * Industry and city left this list on Oct 7 2026: every published file prints
 * them (the PW, LCA, H-2A, H-2B and CW-1 layouts), and the history quarters
 * that had been loaded without them were backfilled that night.
 */
export const PERM_ONLY_FILTERS: readonly FilterKey[] = [
  "citizenship",
  "birthCountry",
  "visaClass",
  "education",
  "jobEducation",
];

/** Read from every program's published file; the live check names neither. */
export const PLACE_FILTERS: readonly FilterKey[] = ["industry", "city"];

/**
 * The filters only DOL's published LCA file can answer: where the prevailing
 * wage the employer attested to came from (Section F of the ETA-9035), which
 * no other record this site holds carries. A search that sets one reads
 * published LCAs and says so.
 */
export const LCA_ONLY_FILTERS: readonly FilterKey[] = ["wageSource"];

/** The prevailing wage sources the LCA file names, as the filter offers them. */
export const WAGE_SOURCES = {
  oes: "OES (DOL's wage data)",
  survey: "A private salary survey",
  cba: "A union contract",
  // The Service Contract Act and Davis-Bacon Act wages for federal contracts.
  contract: "A federal contract wage",
} as const;
export type WageSourceKey = keyof typeof WAGE_SOURCES;
export function isWageSource(v: string): v is WageSourceKey {
  // Own keys only: `"toString" in WAGE_SOURCES` is true through the prototype.
  return Object.prototype.hasOwnProperty.call(WAGE_SOURCES, v);
}

/**
 * The filters DOL fills only on cases filed on its OLD ETA-9089 (the worker's
 * details moved to an appendix of the form in use since mid-2023, which DOL
 * does not publish). Said on the page next to the controls.
 */
export const OLD_FORM_FILTERS: readonly FilterKey[] = [
  "citizenship",
  "birthCountry",
  "visaClass",
  "education",
  "jobEducation",
];

export const OLD_FORM_NOTE =
  "DOL publishes the worker's citizenship, education and visa for cases filed on its old form " +
  "(decided through FY2024); the form in use since mid-2023 doesn't carry them.";

/** Why a control is off. One of these is always shown beside a disabled field. */
export type Refusal =
  /** Nothing has been typed that an index can lead with. */
  | "no-lead"
  /** A case number is one case; nothing narrows one row. */
  | "one-case"
  /** The number itself says which program it belongs to. */
  | "number-names-program"
  | "stage-live-only"
  | "stage-pending"
  | "stage-perm"
  | "lead-published-only"
  /** A PERM-only field is set, and this one is in the LCA file alone. */
  | "perm-only-set"
  /** A prevailing wage source is set, and this field is in the PERM file alone. */
  | "lca-only-set";

export interface FilterState {
  on: boolean;
  why?: Refusal;
}

/** Ready to print. Second person, and it names the alternative every time. */
export function refusalText(why: Refusal): string {
  switch (why) {
    case "no-lead":
      return (
        "Start with an employer or a case number, or search by law firm, " +
        "worksite state or occupation."
      );
    case "one-case":
      return "A case number finds one case, so there is nothing left to narrow.";
    case "number-names-program":
      return "The case number already says which program it is.";
    case "stage-live-only":
      // Short on purpose: it prints under up to seven controls at once. The
      // full explanation sits once, under the stage select.
      return "Not on DOL's live record; it arrives when DOL publishes the case.";
    case "stage-pending":
      return "A case at a review stage is still open by definition, so the outcome is pending.";
    case "stage-perm":
      return "A review stage belongs to one program, so this search reads that program's record only.";
    case "lead-published-only":
      return (
        "A law firm, state or occupation search reads DOL's published file, and no " +
        "published row carries a review stage. Search by employer, or by stage alone."
      );
    case "perm-only-set":
      return "The wage source is in DOL's LCA file, and a field you've set is in the PERM file. Clear that field to use this one.";
    case "lca-only-set":
      return "This field is in DOL's PERM file, and the wage source you've set is in the LCA file. Clear the wage source to use it.";
  }
}

export const FILTER_LABEL: Record<FilterKey, string> = {
  programs: "Programs",
  outcome: "Outcome",
  title: "Job title",
  filed: "Filed",
  decided: "Decided",
  firm: "Law firm",
  state: "Worksite state",
  occupation: "Occupation",
  fiscalYear: "Fiscal year",
  stage: "Review stage",
  wage: "Wage",
  industry: "Industry",
  city: "Worksite city",
  citizenship: "Citizenship",
  birthCountry: "Country of birth",
  visaClass: "Visa at filing",
  education: "Worker's education",
  jobEducation: "Education the job requires",
  wageSource: "Prevailing wage source",
};

/**
 * The lead, chosen from what the form holds, in the order an index can serve.
 *
 * PRIORITY, NOT PREFERENCE. A case number is a point read on a primary key and
 * beats everything. An employer prefix is the only lead the live tables carry
 * an index for, so it comes next and is the only lead that reaches all six
 * sources. Then the three PERM-published equalities.
 */
export interface LeadInput {
  /** A tidied case number, or "". */
  caseNumber?: string;
  /** Employer name text, 2+ characters after trimming. */
  employer?: string;
  /** A resolved `attorney_slug`, not free text. */
  firmSlug?: string;
  /** A two-letter worksite state. */
  state?: string;
  /** A resolved SOC code such as `15-1252.00`, not free text. */
  socCode?: string;
  /** A DOL status resolved from a stage slug, with the program it belongs to. */
  stage?: { status: string; program: StageProgram };
}

export type Lead =
  | { kind: "case"; value: string }
  | { kind: "employer"; value: string }
  | { kind: "firm"; value: string }
  | { kind: "state"; value: string }
  | { kind: "occupation"; value: string }
  /** A DOL review stage, as the status string (`APPLICATION ON HOLD`) and its program. Live record only. */
  | { kind: "stage"; value: string; program: StageProgram };

export function chooseLead(input: LeadInput): Lead | null {
  if (input.caseNumber) return { kind: "case", value: input.caseNumber };
  const employer = (input.employer ?? "").trim();
  if (employer.length >= 2) return { kind: "employer", value: employer };
  // A stage leads before the published-only leads: it is a live-record fact
  // with its own index, and a firm, state or occupation cannot narrow it
  // (DOL names those only at publication), so they are dropped with a reason.
  if (input.stage) return { kind: "stage", value: input.stage.status, program: input.stage.program };
  if (input.firmSlug) return { kind: "firm", value: input.firmSlug };
  if (input.state) return { kind: "state", value: input.state };
  if (input.socCode) return { kind: "occupation", value: input.socCode };
  return null;
}

/**
 * Which controls this lead can honour, and why each of the others cannot.
 *
 * The three equality leads (firm, state, occupation) keep the outcome and the
 * decided-date range because those are literally the next columns of the index
 * they ride - `idx_pc_state_st_dec` is `(state, status, decision_date)` - so
 * both are a seek rather than a walk. They all drop the "still open" bucket,
 * because they read DOL's published files and every row in one of those has a
 * decision on it.
 *
 * ALL THREE LEADS REACH ALL THREE PROGRAMS. `pwd_cases` and `lca_cases` hold
 * `worksite_state`, `soc_code` and the law firm (`LAWFIRM_NAME_BUSINESS_NAME`
 * in the ETA-9035 and ETA-9141 record layouts), and the eight state and
 * occupation indexes in `scripts/ingest_flag_disclosure.py` make every one of
 * those leads a seek. Without them a state lead on `pwd_cases` plans as
 * `SCAN pwd_cases USING INDEX pwd_cases_decided` and reads the whole table
 * (measured: **634,638 rows to return none** for a state and status pair that
 * does not occur).
 */
export function filterAvailability(lead: Lead | null): Record<FilterKey, FilterState> {
  const all = (state: FilterState): Record<FilterKey, FilterState> =>
    Object.fromEntries(FILTER_KEYS.map((k) => [k, state])) as Record<FilterKey, FilterState>;

  if (lead === null) {
    // THE THREE LEAD-CAPABLE FIELDS STAY OPEN ON AN EMPTY FORM, because
    // filling one is how a lead comes into existence. Turning them off with
    // everything else was a deadlock: the law-firm box was disabled because
    // there was no lead, and there could be no lead because the box was
    // disabled, and "search by law firm alone" would be unreachable even
    // though `chooseLead` supports it.
    const out = all({ on: false, why: "no-lead" });
    out.firm = { on: true };
    out.state = { on: true };
    out.occupation = { on: true };
    return out;
  }

  if (lead.kind === "case") {
    const out = all({ on: false, why: "one-case" });
    out.programs = { on: false, why: "number-names-program" };
    return out;
  }

  if (lead.kind === "employer") return all({ on: true });
  if (lead.kind === "stage") {
    const out = all({ on: false, why: "stage-live-only" });
    out.stage = { on: true };
    out.title = { on: true };
    out.filed = { on: true };
    out.outcome = { on: false, why: "stage-pending" };
    out.decided = { on: false, why: "stage-pending" };
    out.programs = { on: false, why: "stage-perm" };
    return out;
  }

  // firm | state | occupation: EVERY filter, because composite indexes carry
  // the combinations that would otherwise be walks.
  //
  // The cost that matters is a SELECTIVE second equality. Through
  // `idx_pc_att_dec` alone, the biggest firm in the corpus plus `state='WY'`
  // reads 48,166 rows in 17 s, walking the firm's whole slice to return four
  // cases. Three composite indexes cover exactly those pairs, and the same
  // query reads 5 rows in 0.55 s; `state='CA'` plus a rare occupation reads 0
  // rows in 0.43 s where it would read 67,743. The filters that still walk
  // are the cheap per-row tests - a title LIKE over all of California
  // measures 0.57 s - and they run against whatever the pair of equalities
  // left, which is usually a handful of rows.
  //
  // So nothing is restricted for cost. A control is disabled here only when
  // the data genuinely cannot answer it, which is the next line.
  const out = all({ on: true });
  out.stage = { on: false, why: "lead-published-only" };
  // ALL THREE LEADS REACH ALL THREE PROGRAMS. DOL publishes
  // `LAWFIRM_NAME_BUSINESS_NAME` in the ETA-9035 and ETA-9141 files too, and
  // `ingest_flag_disclosure.py` loads it (DOL fills it on about nine in ten
  // wage-request rows), so a firm lead never says "this firm files no wage
  // requests" by omission.
  return out;
}

/**
 * The outcome buckets a lead can actually answer.
 *
 * A firm, state or occupation lead reads DOL's published files and nothing
 * else, and every row in a disclosure file has a decision on it, so "still
 * open" over one of those leads is empty by construction. The chip is removed
 * rather than offered and left to return nothing.
 */
export function availableOutcomes(lead: Lead | null): readonly Outcome[] {
  if (lead === null) return OUTCOMES;
  if (lead.kind === "employer" || lead.kind === "case") return OUTCOMES;
  if (lead.kind === "stage") return OUTCOMES.filter((o) => o === "open");
  return OUTCOMES.filter((o) => o !== "open");
}

/**
 * Whether an outcome can be asked of DOL's published files at all.
 *
 * Every row in a disclosure file has a decision on it - that is what a
 * disclosure file IS - so "still open" over the published half is always
 * empty. The reads skip those sources rather than run three queries that
 * cannot match, and the page says so.
 */
export function publishedCanAnswer(outcome: Outcome | undefined): boolean {
  return outcome !== "open";
}

/**
 * Whether the live tables can answer this outcome.
 *
 * They can answer all four: a live row carries a status and an `is_final`
 * flag, and a case DOL decided since the last quarterly file is live and
 * decided at once.
 */
export function liveCanAnswer(): boolean {
  return true;
}

/**
 * Which of the narrowing fields exist only after publication.
 *
 * Used to say, in the results, that turning one of these on dropped the live
 * half of every program rather than silently returning fewer rows.
 */
export const PUBLISHED_ONLY_FILTERS: readonly FilterKey[] = [
  "firm",
  "state",
  "occupation",
  "fiscalYear",
  "wage",
  ...PLACE_FILTERS,
  ...PERM_ONLY_FILTERS,
  ...LCA_ONLY_FILTERS,
];

/**
 * An employer search narrowed to a review stage keeps only what the live
 * record carries. The route uses this to DROP the rest with a reason, and the
 * form uses it to grey the same controls, so the two cannot disagree about
 * what a stage takes away. A stage LEAD gets the same answer from
 * `filterAvailability` directly; this is for the employer-plus-stage shape.
 */
export function withStageNarrow(
  can: Record<FilterKey, FilterState>,
  stageChosen: boolean,
): Record<FilterKey, FilterState> {
  if (!stageChosen) return can;
  return {
    ...can,
    outcome: { on: false, why: "stage-pending" },
    decided: { on: false, why: "stage-pending" },
    programs: { on: false, why: "stage-perm" },
    firm: { on: false, why: "stage-live-only" },
    state: { on: false, why: "stage-live-only" },
    occupation: { on: false, why: "stage-live-only" },
    fiscalYear: { on: false, why: "stage-live-only" },
    wage: { on: false, why: "stage-live-only" },
    ...Object.fromEntries(
      [...PLACE_FILTERS, ...PERM_ONLY_FILTERS, ...LCA_ONLY_FILTERS].map((k) => [k, { on: false, why: "stage-live-only" as const }]),
    ),
  };
}

/**
 * A PERM-only field and an LCA-only field can't both narrow one search: no
 * file carries both, so the answer would be empty for a reason nobody typed.
 * Whichever side is set turns the other side's controls off, with the reason
 * beside them. A control already off keeps its own reason.
 */
export function withFileScope(
  can: Record<FilterKey, FilterState>,
  set: { permOnly: boolean; lcaOnly: boolean },
): Record<FilterKey, FilterState> {
  const out = { ...can };
  if (set.permOnly) {
    for (const k of LCA_ONLY_FILTERS) if (out[k].on) out[k] = { on: false, why: "perm-only-set" };
  }
  if (set.lcaOnly) {
    for (const k of PERM_ONLY_FILTERS) if (out[k].on) out[k] = { on: false, why: "lca-only-set" };
  }
  return out;
}

/**
 * How the merged answer is ordered. Every order rearranges the rows the
 * sources returned; `decided-asc` also makes the published PERM reads start
 * from the OLDEST decision, which the index serves exactly, so it is the one
 * way to reach an employer's FY2016 cases.
 */
export type SearchOrder =
  | "filed-desc"
  | "filed-asc"
  | "decided-desc"
  | "decided-asc"
  | "wage-desc"
  | "wage-asc"
  | "days-asc"
  | "days-desc";
export const SEARCH_ORDERS: readonly SearchOrder[] = [
  "filed-desc",
  "filed-asc",
  "decided-desc",
  "decided-asc",
  "wage-desc",
  "wage-asc",
  "days-asc",
  "days-desc",
];
export function isSearchOrder(v: string): v is SearchOrder {
  return (SEARCH_ORDERS as readonly string[]).includes(v);
}

/** What each order is called on the page's control. */
export const ORDER_LABEL: Record<SearchOrder, string> = {
  "filed-desc": "Newest filing first",
  "filed-asc": "Oldest filing first",
  "decided-desc": "Newest decision first",
  "decided-asc": "Oldest decision first",
  "wage-desc": "Highest wage first",
  "wage-asc": "Lowest wage first",
  "days-asc": "Fastest decision first",
  "days-desc": "Slowest decision first",
};

/**
 * The table's column sort that shows the same order, so the header arrow and
 * the control agree. The column keys are the results table's.
 */
export function orderToSort(order: SearchOrder): { key: "filed" | "decided" | "wage" | "days"; dir: 1 | -1 } {
  const [key, dir] = order.split("-") as ["filed" | "decided" | "wage" | "days", "asc" | "desc"];
  return { key, dir: dir === "asc" ? 1 : -1 };
}

/** A NAICS code (2 to 6 digits) or a sector range such as `31-33`. */
export const NAICS_RE = /^(\d{2,6}|\d{2}-\d{2})$/;
/** Longest real worker or job value, with room: "SAINT VINCENT AND THE GRENADINES" is 32. */
export const MAX_FIELD = 60;
/**
 * The worker and job fields as DOL prints them: letters (any script, since a
 * city or a country can carry an accent), digits, spaces and the punctuation
 * real values use ("KOREA, SOUTH", "CONGO (KINSHASA)", "Master's", "H-1B").
 * Test it only after checking the length against `MAX_FIELD`. The form checks
 * with it too, so a value the route would refuse is flagged before it is sent.
 */
export const FIELD_RE = /^[\p{L}\p{N} .,'\u2019()&/-]+$/u;

/** A worker or job field the route will take, after trimming. */
export function isFieldValue(v: string): boolean {
  const t = v.trim();
  return t.length > 0 && t.length <= MAX_FIELD && FIELD_RE.test(t);
}
