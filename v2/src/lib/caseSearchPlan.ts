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
 * **2. Turso bills rows READ.** Every read here rides an index, and which
 * index depends on which field LEADS. Measured against production on
 * 2026-09-03:
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
 * **3. The same rule now holds on all three programs.** A state or occupation
 * lead used to read `perm_cases` alone, and the reason given was that no other
 * table carried an index on those columns. That was true and it was fixable:
 * `pwd_cases` and `lca_cases` both hold `worksite_state` and `soc_code`, so
 * eight indexes (`<table>_state_dec`, `<table>_state_st_dec`,
 * `<table>_soc_dec`, `<table>_soc_st_dec`) were created and the leads now
 * reach every program. Measured against production on 2026-09-03, rows READ
 * for a hundred-row page:
 *
 * | query | before | after |
 * |---|---|---|
 * | `pwd_cases` state `WY` | 229,555 | **305** |
 * | `pwd_cases` state `CA` + `DENIED` (no such rows) | 634,638 | **0** |
 * | `lca_cases` state `WY` | 259,885 | **100** |
 * | `lca_cases` state `CA` + `DENIED` | 78,360 | **100** |
 * | `lca_cases` occupation `49-3051` (no such rows) | 437,496 | **0** |
 *
 * The before column is not hypothetical: every one of those planned as
 * `SCAN <table> USING INDEX <table>_decided`, which walks the whole table in
 * decision order and throws away what does not match. It is cheap when the
 * needle is common and it is the entire table when the needle is rare, which
 * is the shape of cost that arrives as a bill rather than as a bug report.
 */

/** Which field leads the search. Exactly one, and the index follows from it. */
export type LeadKind = "case" | "employer" | "firm" | "state" | "occupation";

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
  | "wage";

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
];

/** Why a control is off. One of these is always shown beside a disabled field. */
export type Refusal =
  /** Nothing has been typed that an index can lead with. */
  | "no-lead"
  /** A case number is one case; nothing narrows one row. */
  | "one-case"
  /** The number itself says which program it belongs to. */
  | "number-names-program"
  /** The field would be a filter the lead's index cannot carry: a slice walk. */
  | "walks-the-slice"
  /** Only DOL's PERM file carries the column this lead searches by. */
  | "perm-only";

export interface FilterState {
  on: boolean;
  why?: Refusal;
}

/** Ready to print. Second person, and it names the alternative every time. */
export function refusalText(why: Refusal, key: FilterKey): string {
  switch (why) {
    case "no-lead":
      return "Type an employer or a case number first, or pick a worksite state.";
    case "one-case":
      return "A case number finds one case, so there is nothing left to narrow.";
    case "number-names-program":
      return "The case number already says which program it is.";
    case "perm-only":
      return (
        "DOL names the law firm in its PERM file only, so a firm search reads " +
        "PERM. Search by worksite state or occupation to reach wage requests " +
        "and LCAs as well."
      );
    case "walks-the-slice":
      return (
        `Narrowing by ${FILTER_LABEL[key].toLowerCase()} works under an employer, ` +
        "whose filings are a few thousand rows. Under a firm, a state or an " +
        "occupation it would read every case in that slice on every search: " +
        "measured at 44.7 seconds for California. Add an employer, or make " +
        `${FILTER_LABEL[key].toLowerCase()} the thing you search by.`
      );
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
  wage: "Wage",
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
}

export type Lead =
  | { kind: "case"; value: string }
  | { kind: "employer"; value: string }
  | { kind: "firm"; value: string }
  | { kind: "state"; value: string }
  | { kind: "occupation"; value: string };

export function chooseLead(input: LeadInput): Lead | null {
  if (input.caseNumber) return { kind: "case", value: input.caseNumber };
  const employer = (input.employer ?? "").trim();
  if (employer.length >= 2) return { kind: "employer", value: employer };
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
 * THE PROGRAM CHIPS SPLIT THE THREE APART, and the split is about which column
 * DOL publishes rather than about cost:
 *
 * * **state and occupation** now reach all three programs. `pwd_cases` and
 *   `lca_cases` have always held `worksite_state` and `soc_code`; what they
 *   lacked was an index on either, so the search read the PERM file alone and
 *   said nothing about it. Measured 2026-09-03 before the indexes existed: a
 *   state lead on `pwd_cases` planned as `SCAN pwd_cases USING INDEX
 *   pwd_cases_decided` and read **634,638 rows to return none** for a state
 *   and status pair that does not occur. The eight indexes in
 *   `scripts/ingest_flag_disclosure.py` turn every one of those into a seek.
 * * **firm** still reads PERM alone. DOL DOES publish the firm for the other
 *   two programs - `LAWFIRM_NAME_BUSINESS_NAME` is in both the ETA-9035 and
 *   ETA-9141 FY2026 Q3 record layouts - but this site has never ingested that
 *   column, so there is nothing to search. That is a missing ingest, not a
 *   missing index, and the chips say so rather than returning an empty PWD
 *   half that looks like "this firm files no wage requests".
 */
export function filterAvailability(lead: Lead | null): Record<FilterKey, FilterState> {
  const all = (state: FilterState): Record<FilterKey, FilterState> =>
    Object.fromEntries(FILTER_KEYS.map((k) => [k, state])) as Record<FilterKey, FilterState>;

  if (lead === null) return all({ on: false, why: "no-lead" });

  if (lead.kind === "case") {
    const out = all({ on: false, why: "one-case" });
    out.programs = { on: false, why: "number-names-program" };
    return out;
  }

  if (lead.kind === "employer") return all({ on: true });

  // firm | state | occupation: one equality, and only what its index carries.
  const out = all({ on: false, why: "walks-the-slice" });
  out.outcome = { on: true };
  out.decided = { on: true };
  // A state or an occupation is a column all three published files carry, so
  // the chips choose between three real sources. A firm is a column only the
  // PERM file has been ingested for, so they would choose between one source
  // and two empty ones.
  out.programs = lead.kind === "firm" ? { on: false, why: "perm-only" } : { on: true };
  // The field this lead IS stays "on" so the form does not grey out the box
  // the reader just filled in.
  if (lead.kind === "firm") out.firm = { on: true };
  if (lead.kind === "state") out.state = { on: true };
  if (lead.kind === "occupation") out.occupation = { on: true };
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
];
