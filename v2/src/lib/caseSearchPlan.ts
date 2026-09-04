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
  ;

export interface FilterState {
  on: boolean;
  why?: Refusal;
}

/** Ready to print. Second person, and it names the alternative every time. */
export function refusalText(why: Refusal, key: FilterKey): string {
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

  if (lead === null) {
    // THE THREE LEAD-CAPABLE FIELDS STAY OPEN ON AN EMPTY FORM, because
    // filling one is how a lead comes into existence. Turning them off with
    // everything else was a deadlock: the law-firm box was disabled because
    // there was no lead, and there could be no lead because the box was
    // disabled. The employer box was the only way in, so "search by law firm
    // alone" was unreachable even though `chooseLead` has always supported it.
    // Reported by a reader who tried exactly that.
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

  // firm | state | occupation: EVERY filter, because the index now carries the
  // combinations that used to be walks.
  //
  // This block used to turn everything off with `walks-the-slice` except the
  // outcome and a decided-date range, so picking a law firm greyed out
  // worksite state. The cost argument behind it was real and measured, and it
  // was about a SELECTIVE second equality: the biggest firm in the corpus plus
  // `state='WY'` read 48,166 rows in 17.11 s through `idx_pc_att_dec`, walking
  // the firm's whole slice to return four cases.
  //
  // Three composite indexes now cover exactly those pairs, and the same query
  // reads 5 rows in 0.55 s. `state='CA'` plus a rare occupation went from
  // 67,743 rows / 8.82 s to 0 rows / 0.43 s. The filters that still walk are
  // the cheap per-row tests - a title LIKE over all of California measured
  // 0.57 s - and they now run against whatever the pair of equalities left,
  // which is usually a handful of rows.
  //
  // So the restriction is gone rather than relaxed. A control is disabled here
  // only when the data genuinely cannot answer it, which is the next line.
  const out = all({ on: true });
  // ALL THREE LEADS NOW REACH ALL THREE PROGRAMS. The firm used to be the odd
  // one out: DOL publishes `LAWFIRM_NAME_BUSINESS_NAME` in the ETA-9035 and
  // ETA-9141 files, and this site had simply never ingested the column, so a
  // firm lead read the PERM file alone and said "this firm files no wage
  // requests" by omission. `ingest_flag_disclosure.py --backfill-attorney`
  // reads it now; measured on the FY2026 wage-request file, DOL fills it on
  // 91.0% of rows.
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
