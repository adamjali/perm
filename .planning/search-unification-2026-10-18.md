# Search by job everywhere, and one source for every search rule (Oct 18 2026)

Owner's brief (Oct 18, 1:00 AM EDT): search by job too, with filters, sort, timing and wage, on
every search and across every data source (DOL's published files and the live daily record),
built from one shared definition so a change is made once.

Inventory: an audit of every public search surface on Oct 18 (filters, sorts, job matching,
wage, timing, tables, duplicates). Each item below is checked off only when its tests pass.

## Defects (fixed first)

- [x] Occupation narrowing on published PERM bound the raw code (`15-1252.00`) against the
      7-character group, so an employer or state search filtered by job matched nothing for
      dotted codes. Every SOC condition now comes from `socGroupClause` (src/lib/socCode.ts);
      a test asserts the bound value, probed by putting the bug back.
- [x] /case-search's browser re-sorted wages by the raw amount, ignoring the pay unit.
- [x] Unit-blind wage filters and sorts: flagFilter, FlagCaseBrowser, decidedFilter, decidedDays,
      DecidedTable. All compare `comparableWage` (yearly); display stays as DOL printed it.
- [x] /perm-cases and the decided feed matched an occupation by exact `soc_code`.
- [x] The decided feed read every wage request, not only PERM ones (`PWD_VISA_CLASS`, one constant
      for every surface that scopes `pwd_cases`).
- [x] /case-search showed a same-day PERM decision's days as blank.
- [x] Occupation and firm "alternatives" re-ran by name and re-picked the top match; they carry
      their slug now, and one resolver (`nameCandidates`, `occupationChoices`) serves the case
      search and the sponsor finder. A failed lookup is a 503, never "no match".
- [x] "nurse" resolved to a farm job "in a nursery": the matcher now scores a whole word (plural
      included) clearly above letters opening a longer word (`WHOLE_WORD`, `WORD_START`).
- [x] Stale comments (firm lead, seasonal live-only, "published PERM only" notes, the facet
      floor, who converts the PERM wage).

## Search by job, wage and timing

- [x] Sponsor finder: a job box (any words, resolved by the site's matcher, with other jobs
      offered), the job's own filings, approval rate, median offered wage and typical days to a
      decision, per state; filters for wage, timing and cases waiting now; a sort for every
      column; employers whose cases are all still pending are included when no job or state is
      chosen. `sponsor_jobs` and the new `sponsor_index` columns built on production Oct 18,
      1:47 AM EDT (94,831 sponsors, 410,976 job rows); figures checked equal to the employer
      pages' own.
- [x] Occupation pages link to the sponsor finder and the case search for their job; finder rows
      link to that employer's filings for the job.
- [x] /case-search keeps its whole form in the address (read on load, written on every search).
- [x] The finder on a phone: a card per sponsor from the same column list; a search lands on its
      answer (`#answer`); a Schedule A job (nurses, physical therapists) says why DOL's files hold
      few of its cases (`isScheduleA`).
- [x] One link builder into the case search (`caseSearchHref`) for every page that hands it a search.

## One source for each rule

- [x] The approval-rate and median floors (`MIN_DECIDED_FOR_RATE`, `MIN_DECIDED_FOR_MEDIAN`) in
      src/lib/entityPayload.ts; the finder and the sponsor ranks use the page's own bar (30, was 20).
- [x] `formatApprovalRate` (one place, one decimal); the profile's local number helpers removed.
- [x] SOC group: `socGroup`, `SOC_GROUP_SQL`, `socGroupClause`, `SOC_CODE_RE` (src/lib/socCode.ts);
      `soc7`, two `socGroup`s and nine inline slices removed; the major-group name helper is
      `socMajorGroup`.
- [x] Wage to a year: scripts/data/pay_periods.json, read by src/lib/wageFormat.ts and
      scripts/lib_wage.py; the SQL is built from it in both languages and held to
      scripts/fixtures/annual_wage_sql.txt. Seven copies and the inline `* 2080` removed; the
      plausible yearly bands come from the same file.
- [x] Sectors: `SECTOR_GROUPS` (src/lib/naicsSectors.ts) for the sponsor finder, the salary
      explorer and the case search; Python names sectors from the Census file (`sector_of`).
- [x] Search text limits (src/lib/search/limits.ts): the 120-character cap in nine places.
- [x] Program lists and names: `CHANGE_PROGRAMS`, `PROGRAM_LABEL` (short) and `PROGRAM_TITLE`
      (long) in src/lib/changeProgram.ts; the case search's and the employer page's copies removed.
- [x] Months (convex/lib/months.ts): `ISO_MONTH_RE` (16 copies), `shiftMonth`, `monthIndex`,
      `monthFromIndex` (10 copies of next, previous and index-to-month), `fiscalYearOf`,
      `fiscalYearSpan`, `FY_START_MONTH` (4 copies). The current/history line is one fiscal year
      (`CURRENT_FIRST_FY`), with both boundary days derived.
- [x] Entity links: `ENTITY_BASE` and `entityHref` (src/lib/entityPayload.ts); 59 hand-built links
      and four kind-to-path tables.
- [x] `likeContains` and `LIKE_ESCAPE` (src/lib/db/like.ts), four copies.
- [x] `compareNullsLast` (src/lib/tableSort.ts), three copies.
- [x] One column reader (`tableColumns`, by `PRAGMA table_info`, which the read-only token allows):
      the decided feed's copy took any error for "no columns".
- [x] The duplicate PERM-only filter list (`OLD_FORM_FILTERS`, unused) removed.
- [x] Found on the way: the decided-day feed answered a failed read as an empty day; it answers
      503 with a reason now.
- [x] Checked, left: status sets are one per program, each held to the Python ingest by a test.
      The remaining one-decimal `%` strings format figures already in percent (tooltips, intervals),
      not ratios, so `formatPercent` doesn't fit them as is.

## Recruitment (attorney-facing)

- [x] The loader, the columns, the facets and the national doc built and tested (`lib_recruitment.py`,
      `build_recruitment.py`, `RecruitmentMix` on employer, law firm and occupation pages).
- [ ] DOL's Form 9089 Section H columns loaded on production (a disclosure load after the push).
- [ ] Employer, occupation and national figures; a where-employers-advertise page; timing in the
      filing-window guides.

## Content

- [x] The no-fee rule (20 CFR 656.12(b)) and USCIS's scam warning, in the existing sponsor guide
      (green-card-sponsors-for-your-job), with its finder paragraph rewritten for search by job.
