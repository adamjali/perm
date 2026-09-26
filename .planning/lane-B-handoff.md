# Lane B handoff (Sep 26 2026 batch)

Worktree: `~/cc/pt-build/v2`. Nothing committed, stashed or checked out. Every path below is
relative to `v2/`. Updated after each item.

---

## Status at a glance (11:55 AM EDT)

| item | route | state |
|---|---|---|
| 15 + S1 | `/tools/green-card-line`, EW3 guide | done |
| S4 | `/tools/eb2-vs-eb3` | done |
| S7 | `/visa-bulletin/categories` + 45 line pages | done |
| S11 | bulletin history to Oct 2014 | code done, **write is yours** (one command) |
| S12 | `/nvc-waiting-list` | code done, **write is yours** after a coverage line |
| S13 | release days on `/visa-bulletin` | done (typed table, no write) |
| S10 | `/h1b-lottery-odds` | done |
| 19 | `/tools/which-green-card` | done |

Final scoped rerun of every lane B suite: unit 101, components 99, the four Python suites, the
article audit: all pass. `pnpm typecheck` exit 0 (both halves).

**Your actions, in order:** (1) registry lines per section (sitemap, rail/nav, pageCards + card
specs, llms.txt, known-routes, datasetCoverage for `nvc-waiting-list`); the palette and sitemap
tests stay red until they land. (2) Two CI steps: `test_bulletin_captures.py`,
`test_nvc_waiting_list.py`. (3) The S11 write and the S12 write (commands in their sections).
(4) Browser checks at 390px and in dark mode for every new page. (5) Adam's call: print "years at
last year's pace" on the green card line (off; section 15 has the case). (6) Stale "84 months" /
"since 2019" copy, and the `/visa-bulletin` title (S11 and S13 sections list every place).

## Item 15 + S1: the whole green-card line (DONE: tool, tests, EW3 guide)

Route: **`/tools/green-card-line`** (`?category=EB2|EB3|EW3&country=india|china|philippines|mexico|worldwide&pd=YYYY-MM-DD`,
read after mount so the page stays static).

### What it answers

For one line (EB-2, EB-3 professional and skilled, EB-3 Other Workers) and one chargeability, how
many people stand ahead of a priority date, split three ways, on the priority-date axis:

1. **Approved, waiting for the bulletin**: USCIS's own count of approved I-140s awaiting a visa
   number (principals, FY2026 Q3 workbook), spread across priority-date months by the I-140
   approvals-by-receipt-year profile, each moved back by the PERM time. Anchored so the spread
   always sums to USCIS's total.
2. **Waiting for I-140 approval**: pending I-140s times the share USCIS approved in complete
   years (FY currentFy-5 to -3), same spread.
3. **Current, not finished**: I-485s with a visa number available, from USCIS's monthly
   inventory (a range, because cells 1 to 10 are withheld).

Each principal becomes a family by DHS's measured ratio (Yearbook Table 7, FY2023 and FY2024).
Last year's supply (Table V FY2024, that line and country, families included) is printed as a fact; years are OFF (see the question below).
A counted floor (USCIS's I-485 inventory before the reader's PD, both statuses) means the
answer never goes below what USCIS actually counted. **The check**: at the dates-for-filing
cutoff the estimate is compared with the I-485s USCIS counted there; judged only for EB-2, the
one line that mostly adjusts inside the US (DHS adjustment share 78 to 90%). More than 2x off
shows an amber "treat as rough" box with the scaled range.

### Primary sources (all read 2026-09-26)

| input | source |
|---|---|
| approved awaiting, principals | USCIS "Approved EB I-140/I-360/I-526 Petitions Awaiting Visa Final Action Date", FY2026 Q3 (already ingested: `uscis_eb_awaiting_visa`) |
| I-140 by class, country, receipt FY | USCIS I-140 by class of admission and country, FY2026 Q3 (already ingested: `uscis_i140_class_country`) |
| I-485 inventory | USCIS monthly EB I-485 inventory (already ingested: `i485_inventory`) |
| family per principal, adjustment share | DHS Yearbook Table 7, FY2023 and FY2024 (`ohss.dhs.gov/topics/immigration/yearbook/2024/table7`, `/2023/table7`), typed constants in `src/lib/greenCardLine.ts` |
| PERM time | DOL disclosure decisions this site holds, medians by decision quarter FY2024 Q1 to FY2026 Q3, typed constant; plus 0 to 6 months to file the I-140 (20 CFR 656.30(b), 180-day validity) |
| visas per year by line and country | State, Report of the Visa Office FY2024, Table V Part 2 (now parsed per chargeability) |

### Files

New
- `src/lib/greenCardLine.ts`: the pure model (lag, spread, approval rate, pending, floor, check, `estimateLine`).
- `src/lib/greenCardLineSnapshot.ts`: pure mapping from stored rows to the model's snapshot.
- `src/lib/turso/greenCardLine.ts`: server-only reader (one GROUP BY over the newest I-485 release, the rest are existing small reads).
- `src/components/tools/GreenCardLine.tsx`: the calculator (client). Chart title ids are per instance so two can share a page.
- `src/app/(site)/(public)/tools/green-card-line/page.tsx`: the page, `revalidate = 86400`, 6 FAQs with FAQPage schema.
- `src/lib/__tests__/greenCardLine.fixture.ts`: the made-up EW3 line both test files use.
- Tests: `src/lib/greenCardLine.test.ts` (21), `src/lib/greenCardLineSnapshot.test.ts` (9), `src/components/tools/__tests__/GreenCardLine.test.tsx` (12).

Modified
- `scripts/ingest_visa_limits.py`: Table V Part 2 per chargeability (China mainland-born, India,
  Mexico, Philippines, and the rest = grand total less those four; refuses if a row is missing or
  the remainder goes negative). Written into the doc as `employment_by_chargeability`.
- `scripts/test_visa_limits.py`: 6 new checks (values, remainder, each column sums to the grand total).
- `src/lib/visaLimits.ts`: optional `employment_by_chargeability` on `TableVYear`.

### Tests (2026-09-26, 9:10 to 9:20 AM EDT)

- `npx vitest run src/lib/greenCardLine.test.ts src/lib/greenCardLineSnapshot.test.ts --project unit`: 30 passed.
- `npx vitest run GreenCardLine.test.tsx --project components`: 12 passed (incl. years off by default, on by prop).
- `python3 scripts/test_visa_limits.py`: all pass (it runs in CI already, `test.yml`).
- `pnpm typecheck`: exit 0 (both). eslint on all new files: 0. pyflakes: 0.
- Probed by mutation: anchoring removed, NIW lag changed, approval-rate years moved, filing delay
  dropped, part-year coverage widened, fixed chart id restored: each turns its test red.

### Real-data probe (production Turso, read only)

| line, priority date | people ahead | years at FY2024 pace |
|---|---|---|
| EB-3 Other Workers, rest of world, 2023-05 | 42,000 to 75,000 (USCIS counted at least 6,238) | 8.0 to 14.2 |
| EB-2 India, 2016-01 | 124,000 to 147,000 | 31.7 to 37.6; check disagrees 2.3x, rough box shows |
| EB-2 China, 2022-06 | 15,400 to 19,100 | 2.4 to 2.9; check disagrees 2.2x |
| EB-3 India, 2015-06 | 15,900 to 19,400 | 4.4 to 5.3 |
| EB-3 Philippines, 2024-06 | 42,000 to 55,000 | 4.6 to 6.0 |
| EB-3 rest of world, 2025-01 | 66,600 to 78,400 | 3.7 to 4.3 |
| EB-2 rest of world | current | |

### QUESTION FOR ADAM: print "years at last year's pace"?

The model computes it (people ahead / Table V FY2024 visas to that line and country, both
counting families) and it's tested, but it is **OFF**: `GreenCardLine` takes `showYears` and the
page doesn't pass it. Reason: `guides/approved-i140-no-visa-number-eb2-india` (attorney byline,
Sep 22) says plainly "Nothing on this site forecasts the bulletin" and explains why it won't
divide a count by a yearly supply; that's exactly this division. Off, the page prints the
supply as a fact ("5,281 green cards went to this line and country in fiscal 2024 ... it isn't a
promise") and the reader can divide. The bulletin-pace line (`monthsToReach`, the same "arithmetic,
not a promise" line the I-485 tool already prints) is kept. **To turn years on:** pass
`showYears` on the page, restore the FAQ "Where does the visas-a-year figure come from?", and
reword that guide's rule. Measured values if on: EW3 rest of world 2023-05 is 8.0 to 14.2 years,
EB-2 India 2016-01 is 31.7 to 37.6.

### EB-3 Other Workers guide

`content/guides/eb3-other-workers.mdx` (new; byline follows every guide: the About page's attorney;
she hasn't read it). Every figure checked against its primary source this morning:
8 CFR 204.5(l)(2) and (l)(4) from eCFR's API; the 10,000 cap and the NACARA note (FY2026 cut
"approximately 150") from the stored Jul 2026 bulletin; the FY2026 limits sheet's "currently
entitled to up to 10,000"; Table V FY2024 per chargeability (8,724 EW used); USCIS awaiting,
Jun 2026 (57,743; its note 7 quoted verbatim, "could contain multiple petitions for a single
individual"); I-140 EW3 approvals by receipt year (3,446 in FY2016 to 22,587 in FY2025); DHS
Table 7 adjustment share (41% FY2023, 27% FY2024); USCIS's consular processing page for the NVC
step (fetched live, 200). The EW3/EB-3 gap opened in the Jun 2022 bulletin (C to 08MAY19).
Hero is `photos/planner-notes.webp` (an alarm clock and a calendar, alt text describes that).
`departure-board.webp` is misnamed: it's a US passport on a boarding pass.

Also edited: `content/guides/approved-i140-no-visa-number-eb2-india.mdx`, one sentence in "What
this can't tell you" linking the new tool ("... as a range by priority date, and doesn't turn it
into a wait").

Gates: `audit_articles.py` clean except "link to unknown route: /tools/green-card-line" (the
known-routes line above fixes it); content-frontmatter, public-surface-hygiene,
public-descriptions: 15 passed. Lengths: description 155, seoDescription 150, seoTitle 38.

**Gate gap found, not fixed (your call):** `audit_articles.py` matches internal links with
`\]\((/[\w\-/]*)\)`, so a link carrying a query string (`/tools/green-card-line?category=EW3...`)
is never checked at all. The EW3 guide has one. Allowing `[?#][^)]*` after the path and checking
the path would close it.

**Card for the guide** (optional): `make-page-cards.mjs` is for pages; guides use their hero. Nothing needed.

### COORDINATOR: one command before the deploy

The production `visa_annual_limits` doc has no per-country Table V yet, so the years line is
simply absent until this runs (the page says nothing false in the meantime). From `v2/`, with
the RW token env already used by the ingests:

```
/usr/local/Caskroom/miniconda/base/bin/python3 scripts/ingest_visa_limits.py \
  --limits scripts/fixtures/visa-limits-FY2026.pdf --table-v scripts/fixtures/visa-table-v-FY2024.pdf
```

Check afterwards: `perm_docs['visa_annual_limits']` → `table_v["2024"].employment_by_chargeability.india["2nd"] == 3916`.
No workflow change: the script is run by hand once a year already.

### Registry lines (coordinator applies)

- **Sitemap** (`src/lib/sitemap/build.ts`, beside `i485-queue-position`):
  `{ url: \`${base}/tools/green-card-line\`, lastModified: "2026-09-26", images: [\`${base}/og/green-card-line.jpg\`] },`
- **pageCards** (`src/lib/pageCards.ts`):
  `"green-card-line": "The green card line. Everyone ahead of a priority date in EB-2, EB-3 and EB-3 Other Workers, counted from USCIS and State Department figures.",`
  then wrap the page's metadata: `export const metadata: Metadata = withSocialCard({ ... }, "green-card-line");`
  (import from `@/lib/socialCard`; left out here because `PageCardSlug` is typed from the registry).
- **Card spec** (`make-page-cards.mjs`): `{ "slug": "green-card-line", "ground": "paper", "eyebrow": "Calculator", "title": "Your place in the green card line", "label": "EB-2, EB-3 and Other Workers, by country", "shot": "green-card-line.png", "crop": [600, 136, 2280, 1376] }`,
  shot of `/tools/green-card-line?category=EW3&country=worldwide&pd=2023-05-01` at 1440x900.
- **Navigation** (`TOOL_NAV_LINKS` in `src/lib/constants/navigation.ts`, after I-485 queue position):
  `{ href: "/tools/green-card-line", label: "Green card line" },`
  This also puts it in the search palette (`palette-covers-every-page.test.ts` goes red until it's added).
- **llms.txt** (after the I-485 queue position entry):
  ```
  {
    path: "/tools/green-card-line",
    label: "The green card line: people ahead of a priority date",
    blurb:
      "Everyone ahead of a priority date in EB-2, EB-3 and EB-3 Other Workers by country: approved I-140s waiting (USCIS's count, spread by the measured PERM time), pending I-140s, and current I-485s, with families counted from DHS and years at State's FY2024 Table V pace. A range, checked against USCIS's I-485 counts where both exist.",
  },
  ```
- **known-routes** (`scripts/known-routes.json`, beside `/tools/i485-queue-position`): `"/tools/green-card-line",`
- **Calculators hub** (`src/app/(site)/(public)/calculators/page.tsx`, after the I-485 card; a page, not a
  registry, left to you to avoid a collision):
  `{ href: "/tools/green-card-line", viz: "range" as const, icon: UsersThreeIcon, kind: "Range", name: "Green card line", tone: "paper", blurb: "Everyone ahead of your priority date, not just the people who've filed: approved petitions waiting, petitions pending and cases already current, by line and country." },`
  (import `UsersThreeIcon` from `@phosphor-icons/react/ssr` if that page is a server component).
- **datasetCoverage**: nothing new, all five ids the page cites already exist.
- **Glossary** (optional): "Approved awaiting visa" / "Other Workers (EW3)" can link here.

### Not verified, and said so on the page

- The PERM time before FY2024 decisions is an ASSUMPTION (6 to 12 months); the site holds no DOL
  decisions before Oct 2023. It sits inside the range, not hidden.
- Consular vs adjustment shares are by category from DHS, not by country; no country split is published.
- Duplicates (one person, several approved petitions), leavers, and retained priority dates all
  make the count high; none is published, none is subtracted. Listed under "What this leaves out".
- Not rendered in a browser (lane rule). Coordinator: phone width, light and dark, and the
  strip's labels at 390px (the SVG scrolls inside its box at min-width 520px).

---

## S4: EB-2 vs EB-3 side by side (DONE)

Route: **`/tools/eb2-vs-eb3`** (`?country=&pd=`, read after mount). One country, one priority
date: a verdict band, both ranges on one scale (a disagreeing EB-2 check draws its scaled part as
a dashed outline), then a card per line with this month's final action and dates-for-filing
cutoffs, people ahead, USCIS's counted floor, the rough-check note, and last year's Table V
supply as a fact. Links into `/tools/green-card-line` for each line. No years, anywhere (a test
asserts it).

**The one new rule** (`src/lib/greenCardLineCompare.ts`, pure): a line is named as having fewer
people ahead only when its whole plausible range sits below the other's; plausible = the raw
range widened to the scaled range when the check disagrees, so a line is never called longer on
an overcount. Overlap reads "Too close to call". A current line beats a non-current one; both
current says so; either unavailable claims nothing.

Files
- New: `src/lib/greenCardLineCompare.ts`, `src/lib/greenCardLineCompare.test.ts` (7),
  `src/components/tools/Eb2VsEb3.tsx`, `src/components/tools/__tests__/Eb2VsEb3.test.tsx` (6),
  `src/app/(site)/(public)/tools/eb2-vs-eb3/page.tsx` (4 FAQs, FAQPage schema, revalidate 1 day).
- Modified: `src/lib/__tests__/greenCardLine.fixture.ts` (gained `twoLines`), `GreenCardLine.tsx`
  (`rangeText` exported).

Tests (9:50 AM EDT): unit 28 passed (model + compare); components 18 passed (both calculators);
page-description-length 3 passed; social-cards 132 passed; eslint 0; `pnpm typecheck` exit 0.
Probe: replacing the overlap rule with a midpoint comparison turns "calls it a tie" red.
`palette-covers-every-page.test.ts` is RED until the nav lines land: it names
`/tools/eb2-vs-eb3`, `/tools/green-card-line` (mine) and `/green-card-timelines` (lane C's).

Registry lines
- Sitemap: `{ url: \`${base}/tools/eb2-vs-eb3\`, lastModified: "2026-09-26", images: [\`${base}/og/eb2-vs-eb3.jpg\`] },`
- pageCards: `"eb2-vs-eb3": "EB-2 vs EB-3. The two lines side by side for one country and priority date: this month's cutoffs and the people ahead in each.",`
  then `withSocialCard(..., "eb2-vs-eb3")` on the page's metadata.
- Card spec: `{ "slug": "eb2-vs-eb3", "ground": "ink", "eyebrow": "Calculator", "title": "EB-2 or EB-3, for your date", "label": "Both lines side by side", "shot": "eb2-vs-eb3.png", "crop": [600, 136, 2280, 1376] }`,
  shot of `/tools/eb2-vs-eb3?country=india&pd=2014-06-01`.
- Navigation (`TOOL_NAV_LINKS`, after the green card line): `{ href: "/tools/eb2-vs-eb3", label: "EB-2 vs EB-3" },`
- llms.txt:
  ```
  {
    path: "/tools/eb2-vs-eb3",
    label: "EB-2 vs EB-3 for one priority date",
    blurb:
      "EB-2 and EB-3 side by side for one country and priority date: this month's final action and dates-for-filing cutoffs, and the people ahead in each line as a range. Names one line as shorter only when the ranges don't overlap, and compares people, not waits.",
  },
  ```
- known-routes: `"/tools/eb2-vs-eb3",`
- Calculators hub card (optional): `{ href: "/tools/eb2-vs-eb3", viz: "twobars" as const, icon: ScalesIcon, kind: "Compare", name: "EB-2 vs EB-3", tone: "paper", blurb: "The two lines side by side for your country and priority date, and whether one really has fewer people ahead." },`
- The `eb2-vs-eb3-perm` guide could link it in its "Downgrading and upgrading" section (content, left alone).

Not verified: no browser (lane rule). The range rows use percentage-positioned spans inside a
bordered track; check them at 390px and in dark mode.

---

## S7: one page per bulletin category x country (DONE)

Routes: **`/visa-bulletin/categories`** (hub) and **`/visa-bulletin/categories/[line]`**, where
`line` is words people search: `eb2-india`, `eb3-other-workers-rest-of-world`,
`eb5-high-unemployment-china`. A static `categories` segment beside `[month]`, so the two can
never answer one URL. 9 categories x 5 countries = **45 line pages**, listed from what the archive
holds (`categoriesIn`), prerendered, unknown slugs 404 from `generateMetadata`.

Each line page, top to bottom: this month's final action and dates-for-filing cutoffs plus the
archive's pace and step-back count (a ledger); the priority-date estimator opened on this line
(new `initialCategory`/`initialCountry` props, ignored when the archive doesn't hold the code);
a fiscal-year table (October bulletin against September, moved days, steps back, partial years
marked); USCIS's own counts for the line (approved petitions awaiting, I-485s pending by visa
status, withheld cells as ranges); a CTA into `/tools/green-card-line` for EB-2, EB-3 and EW3
only; links to the same category in other countries and the country's other categories; the
bulletin alert form (`source: visa-bulletin/categories/<slug>`, under the 64-char cap). No
forecast. `translate="no"` on the category name and the table body.

Files
- New: `src/lib/bulletinLines.ts` (slugs, `fiscalYearMoves`, `inventoryRange`, `uscisCode`),
  `src/lib/bulletinLines.test.ts` (9), `src/lib/turso/bulletinLine.ts` (server-only: one GROUP BY
  over the newest I-485 release, the awaiting read already cached), the two pages,
  `src/app/__tests__/visa-bulletin-lines.test.tsx` (10).
- Modified: `src/components/tools/PriorityDateEstimator.tsx` (two optional props, default
  behaviour unchanged) and its test (+2, 35 pass).

Tests (10:25 AM EDT): unit 9, components 10 + 35; eslint 0. Probes: dropping the shut-line rule
and the partial-year rule turn two tests red; removing the table cell's trailing space turns
the glued-text test red. **`pnpm typecheck`: the app half failed on 12 errors, all in
`src/components/i18n/LocalizedGuide.tsx` (lane C, importing `@/lib/i18n/guide`, which doesn't
exist yet); none in lane B files.** Re-run once lane C lands it.

USCIS mapping: the bulletin's EB-5 unreserved row is USCIS's `EB5U`; USCIS's awaiting-visa file
lumps the three set-asides as `EB5S`, so those line pages show no awaiting count (the I-485
inventory does carry `EB5R`, `EB5HU`, `EB5I`). No page claims one it doesn't have.

**`src/app/__tests__/sitemap.test.ts` goes RED** ("every dynamic public segment has at least one
URL") until the family is listed. Registry lines:

- **Sitemap** (`src/lib/sitemap/build.ts`). Replace the months read (lines ~132-136) so the
  categories come from the same one read:
  ```ts
  let bulletinMonths: string[] = [];
  let bulletinLines: string[] = [];
  try {
    const raw = await getVisaBulletins();
    bulletinMonths = raw.map((r) => r.bulletinMonth).sort();
    bulletinLines = lineSlugs(categoriesIn(raw.map((b) => ({
      bulletinMonth: b.bulletinMonth,
      finalAction: (b.finalAction ?? {}) as BulletinMonth["finalAction"],
      datesForFiling: (b.datesForFiling ?? {}) as BulletinMonth["datesForFiling"],
    }))));
  } catch { ... keep the existing catch ... }
  ```
  (`import { lineSlugs } from "@/lib/bulletinLines"; import { categoriesIn } from "@/lib/turso/bulletin"; import type { BulletinMonth } from "@/lib/perm";`)
  and after the month entries:
  ```ts
  ...(bulletinLines.length
    ? [
        { url: `${base}/visa-bulletin/categories`, lastModified: dol ?? "2026-09-26" },
        ...bulletinLines.map((s) => ({ url: `${base}/visa-bulletin/categories/${s}`, lastModified: dol ?? "2026-09-26" })),
      ]
    : []),
  ```
  (`dol` is the newest bulletin's stamp there, which is what moves a line page.)
- **Rail** (`dataSections.ts`, Visa bulletin group): `{ href: "/visa-bulletin/categories", label: "By category and country" }`.
  The prefix match then covers the 45 line pages; the palette test needs the hub reachable.
- **pageCards**: `"visa-bulletin-categories": "Every visa bulletin line. EB-1 to EB-5 for India, China, Mexico, the Philippines and the rest of the world, each with its history."`
  plus `withSocialCard(..., "visa-bulletin-categories")` on the hub; line pages can take the
  hub's card (wrap their `generateMetadata` return, as `perm-queue/[month]` does).
- **Card spec**: `{ "slug": "visa-bulletin-categories", "ground": "paper", "eyebrow": "Visa bulletin", "title": "Every line in the bulletin", "label": "Category by country, with each line's history", "shot": "visa-bulletin-categories.png", "crop": [600, 136, 2280, 1376] }`.
- **llms.txt**:
  ```
  {
    path: "/visa-bulletin/categories",
    label: "The visa bulletin by category and country",
    blurb:
      "One page per employment-based bulletin line (EB-1 to EB-5, Other Workers, the EB-5 set-asides) for India, China, Mexico, the Philippines and the rest of the world: both charts this month, the final action cutoff a fiscal year at a time since 2018, and USCIS's own counts behind the line. No forecast.",
  },
  ```
- **known-routes**: `"/visa-bulletin/categories",` and one line page per slug if the article audit
  should accept them (none of the guides link a line page yet).
- **Links in** (content, optional): the `/visa-bulletin` hub and each `/visa-bulletin/[month]`
  table cell could link its line page; left alone because `[month]/page.tsx` is already modified
  in the tree by another lane.

Not verified: no browser. The hub's grid is `min-w-[760px]` inside a scroll box; check 390px.

---

## Gate fixes on 15 + S4 (10:05 AM EDT, from the coordinator's note)

- `no-glued-jsx-text`: `{" "}` after each `</li>` followed by another `<li>` (3 in `Eb2VsEb3.tsx`,
  4 in `GreenCardLine.tsx`; both were static lists, the mapped ones already had keyed Fragments).
- `page-title-length`: titles now "Green Card Line: People Ahead of Your Date" (57 with the
  suffix) and "EB-2 vs EB-3: People Ahead at Your Date" (54). The hub "Visa Bulletin by Category
  and Country" is 52. Line pages use `{ absolute }` when base + suffix would pass 60 (longest,
  "EB-5 High Unemployment Rest of World Visa Bulletin History", 58 absolute).
- `responsive-grid-tracks`: `[&>*]:min-w-0` on two grids in `Eb2VsEb3.tsx`.
- Rerun, scoped: no-glued-jsx-text, page-title-length, public-surface-hygiene,
  responsive-grid-tracks, svg-title-single-child, form-controls-min-width, plus both component
  suites: **all pass (31 + 11)**. These gates scan all of `src`, so the S7 pages are covered too.

---

## S11: bulletin history back to 2015 (CODE DONE; the production write is yours)

The archive route already existed (`--backfill-turso --years`); production holds **96 months
from Oct 2018**. The Internet Archive holds every bulletin **Oct 2014 to Sep 2018** (48, in the
fiscal-year folders /2015/ to /2018/). Two things stopped the parser reading the older ones,
both found on real captures, not guessed:

1. **Before Oct 2015 the bulletin printed ONE employment chart.** Dates for filing began with
   the Oct 2015 bulletin. `parse_bulletin(page, month)` now accepts one chart only for months
   before `DATES_FOR_FILING_FROM = "2015-10"` (dates for filing stored as `{}`, the family chart
   as final action only). Without the month, or for any later month, one chart is still refused
   as a truncated capture. Both callers and the saved-page route pass the month.
2. **The old EB-5 row is "5th Targeted Employment Areas/ Regional Centers and Pilot Programs"**
   (Jan 2015; Oct 2015's filing chart still used it). Added as the LAST EB-5 alternate
   ("5th Targeted", which also matches the unspaced "EmploymentAreas" some captures carry), so a
   month printing both takes the newer name, as the pre-2022 rows already do.

Also new: `--dry-run` for `--backfill-turso`, which fetches and parses exactly as a real run and
writes nothing (not even the family-column ALTER); a test asserts it sends reads only, with the
real run as the writing control.

Files: `scripts/ingest_visa_bulletin.py`, `scripts/test_visa_bulletin.py` (+16 checks, all pass,
already in CI), fixtures `scripts/__fixtures__/visa-bulletin-2015-01.html` and `-2015-10.html`
(real captures trimmed to their charts; capture URL in each file's first line).
Probes in an isolated copy: no era gate turns 3 checks red; no Targeted row turns 4 red; the dry
run without its guard turns 1 red.

**Dry run against the real archive (10:00 to 10:05 AM EDT, reads only):** 48 of 48 months
parsed, 6 of 6 final-action categories each, family charts on all 48, dates for filing on every
month from Oct 2015 and none before, 0 failed, 0 upgraded (nothing held is touched: those
folders only hold months before Oct 2018). Spot values: Jan 2015 EB-2 India 15FEB05, Oct 2015 EB-2
India 01MAY05 final action and 01JUL09 filing, Sep 2018 EB-2 India 01JAN07.

**NOT RUN: the write.** It changes live pages the day it lands (before the one deploy), so it's
your call when. From `v2/` (it must run from `v2/`, where `.env.local` is found):
```
/usr/local/Caskroom/miniconda/base/bin/python3 scripts/ingest_visa_bulletin.py --backfill-turso --years 2015 2016 2017 2018 --months 400
```
~5 minutes, 52 archive requests at one a second. Expect "added 48, upgraded 0, failed 0" and
`visa_bulletins` at 144 from 2014-10. It rewrites the `visa-bulletin` freshness row: source
"State Dept via Internet Archive; current month from a saved page", note "144 bulletins"
(today: "State Dept via Internet Archive", "96 bulletins").

What changes on the site when it lands, all honest but visible:
- Every "pace over the archived window" figure lengthens from about 8 years to 12: the I-485
  tool's bulletin line, the board, the green card line's comparison. Each prints its window.
- The `/visa-bulletin` month strip links 48 more month pages, and the same-month tables gain
  FY2015 to FY2018 rows. A missing filing cell classifies as "unknown" (no invented move).
- `/visa-bulletin/2014-10` to `/2015-09` render the dates-for-filing table as "not listed" in
  every cell. True but unexplained. Suggested for `[month]/page.tsx` (another lane has it open,
  so not edited): when `Object.keys(current.datesForFiling).length === 0 && month < "2015-10"`,
  replace that table with: "The dates for filing chart began with the October 2015 bulletin.
  This one printed final action dates only."
- **Copy that says 84 months or 2019 is already wrong today (96 from Oct 2018) and becomes more
  wrong:** `tools/page.tsx:351` ("84 months"), `visa-bulletin/[month]/page.tsx:364` and
  `visa-bulletin/page.tsx:433` ("every bulletin since 2019"), `visa-bulletin/page.tsx:8`
  (comment), `src/emails/BulletinMoved.tsx:76` and `src/components/home/StageStrip.tsx:76`
  ("84 months"), `src/lib/glossary.ts:482` ("84 months"), `src/lib/embeds.ts:39` ("since October
  2019"), and in content: `read-your-priority-date-history`, `how-the-visa-bulletin-works`,
  `approved-i140-no-visa-number-eb2-india` ("back to Oct 2019"), changelog
  `case-status-and-first-party-data`. Suggest wording that reads the count or says "since 2014"
  after the write; left alone because several are registries or open in other lanes.

---

## S10: H-1B lottery odds by year (DONE)

Route: **`/h1b-lottery-odds`**, a static server page (no client code, no Turso read). Title "H-1B
Lottery Odds by Year" (40 with the suffix), description 146.

Top to bottom: the newest cap year's selected share as the headline (FY2026: 34.9%, 120,141 of
343,981 eligible; about 339,000 unique beneficiaries at 1.01 registrations each, so one
person's chance was close to the rate); a chart of eligible (outline) against selected (filled)
for FY2021 to FY2026 with the share over each bar; "From FY2027, the odds depend on the wage":
DHS's own estimate by OEWS level (15.29 / 30.58 / 45.87 / 61.16%) against 29.59% under the random
draw, drawn as bars with the random figure as a dashed line and labelled as DHS's estimate with
its assumptions; USCIS's full table; "What this can't tell you" (your own odds, how FY2027 turned
out, second rounds, cap-exempt jobs, selection vs approval) in a disclosure; four FAQs.

Primary sources, read 2026-09-26:
- USCIS, H-1B Electronic Registration Process (last revised 09/21/2026): the FY2021-2026 table,
  the eligible definition, and the FY2026 analysis (about 57,600 employers, about 339,000 and
  442,000 unique beneficiaries for FY2026 and FY2025, 1.01 and 1.06 registrations each).
  https://www.uscis.gov/working-in-the-united-states/temporary-workers/h-1b-specialty-occupations/h-1b-electronic-registration-process
- USCIS, H-1B Cap Season (revised 09/21/2026): weighted selection "starting in fiscal year (FY)
  2027"; FY2027 cap reached. No FY2027 registration counts published on either page.
- DHS final rule, Weighted Selection Process, 90 FR 60864 (Dec 29, 2025; effective Feb 27, 2026),
  full text via the Federal Register API: entries per level (IV four times ... I once), and the
  estimate at 60947-60948 with footnote 119's assumptions.
  https://www.federalregister.gov/documents/2025/12/29/2025-23853/weighted-selection-process-for-registrants-and-petitioners-seeking-to-file-cap-subject-h-1b

Files: `src/lib/h1bLottery.ts` (typed table with source, revision and read dates),
`src/lib/h1bLottery.test.ts` (6: every row adds up the way USCIS's columns do, the rows
USCIS prints, the rule's 1:2:3:4 proportion), the page, `src/app/__tests__/h1b-lottery-odds.test.tsx`
(5). Probe: one swapped digit in a transcribed cell turns the arithmetic test red.
Gates (10:35 AM EDT): glued text, title and description length, hygiene, grid tracks, svg titles,
form controls: all pass; eslint 0. **Add FY2027 to the table when USCIS publishes it.**

Registry lines
- Sitemap: `{ url: \`${base}/h1b-lottery-odds\`, lastModified: "2026-09-26", images: [\`${base}/og/h1b-lottery-odds.jpg\`] },`
- Rail (`dataSections.ts`): beside the LCA pages (H-1B): `{ href: "/h1b-lottery-odds", label: "H-1B lottery odds" }`.
  `palette-covers-every-page.test.ts` stays red until a nav or rail entry lists it.
- pageCards: `"h1b-lottery-odds": "H-1B lottery odds by year. USCIS's registrations and selections since FY2021, and DHS's estimate of the odds by wage level from FY2027.",`
  then `withSocialCard(..., "h1b-lottery-odds")`.
- Card spec: `{ "slug": "h1b-lottery-odds", "ground": "ink", "eyebrow": "H-1B", "title": "H-1B lottery odds, year by year", "label": "USCIS's own counts, and the new wage weighting", "shot": "h1b-lottery-odds.png", "crop": [600, 136, 2280, 1376] }`.
- llms.txt:
  ```
  {
    path: "/h1b-lottery-odds",
    label: "H-1B lottery odds by year",
    blurb:
      "USCIS's H-1B cap registration and selection counts for FY2021 to FY2026, the share selected each year, and DHS's own estimate (90 FR 60864) of a beneficiary's chance at each OEWS wage level under the weighted lottery that began with FY2027. Labelled as an estimate; no FY2027 count is published yet.",
  },
  ```
- known-routes: `"/h1b-lottery-odds",`
- Glossary (optional): "H-1B cap registration", "weighted selection".

---

## Fix: shared links opened on the default line (10:55 AM EDT, from coordinator QA)

`/tools/green-card-line?category=EW3&country=worldwide&pd=2023-05-01` opened as EB-2 / India.
The URL-writing effect ran in the same commit as the URL reader with the initial state and
replaced the link; StrictMode's second pass of the reader then read the rewritten URL. Both
`GreenCardLine.tsx` and `Eb2VsEb3.tsx` now gate the writer on a `ready` flag the reader sets.
New test in each renders in `<StrictMode>` with the shared URL already set and asserts the
selects, the date and `window.location.search` keep it (GreenCardLine 13 pass, Eb2VsEb3 7 pass).
Probe: deleting `if (!ready) return;` in both turns both tests red. `VisaChooser` holds no URL
state; the estimator's new `initialCategory` props don't touch the URL.

---

## 19: which employment green card fits (DONE)

Route: **`/tools/which-green-card`**. A form (who sponsors, what the job requires, what the person
holds, five statements to tick, country) answered live against the regulation's definitions:
each matching category with why it matched, whether it needs a PERM and a job offer, who files,
the rule, and links to its bulletin line page and, for EB-2/EB-3/EW3, the green card line for
that country. A plain not-legal-advice line sits above the form ("whether a case meets a
definition is USCIS's decision on the evidence, and an immigration attorney reads that
evidence"). Family and investment answers are pointed elsewhere, not guessed at.

Rules (`src/lib/visaChooser.ts`), each from the source, read 2026-09-26:
- On a PERM the JOB sets the category, "based on the requirements of training and/or experience
  placed on the job by the prospective employer, as certified by the Department of Labor"
  (8 CFR 204.5(l)(4)): advanced-degree job is EB-2 (plus EB-3 on the same PERM, date kept under
  204.5(e)), bachelor's job EB-3 professional, two-year job EB-3 skilled, under two years EW3,
  whatever the person holds. A person below the job's own requirement gets no category and a note.
- EB-1A: "An alien, or any person on behalf of the alien, may file" (204.5(h)(1)); no offer or
  labor certification (204.5(h)(5)). EB-1B (204.5(i)) and EB-1C (204.5(j)) only through the employer.
- National interest waiver: needs an advanced degree or exceptional ability (204.5(k)), and
  USCIS's three prongs from Matter of Dhanasar, quoted from the Policy Manual Vol. 6 Part F Ch. 5
  (current as of Sep 23, 2026).

Files: `src/lib/visaChooser.ts`, `src/lib/visaChooser.test.ts` (11),
`src/components/tools/VisaChooser.tsx`, `src/components/tools/__tests__/VisaChooser.test.tsx` (5),
`src/app/(site)/(public)/tools/which-green-card/page.tsx` (4 FAQs; title 51 with suffix,
description 155). Probes: dropping the person-meets-the-job check, and allowing the waiver without
an advanced degree or exceptional ability, each turn one test red. Site-wide gates pass
(19); eslint 0.

Registry lines
- Sitemap: `{ url: \`${base}/tools/which-green-card\`, lastModified: "2026-09-26", images: [\`${base}/og/which-green-card.jpg\`] },`
- Navigation (`TOOL_NAV_LINKS`): `{ href: "/tools/which-green-card", label: "Which green card fits" },` (the palette test needs it).
- pageCards: `"which-green-card": "Which employment green card fits. A few questions about the job and you, matched against the regulation's definitions, with what each category needs.",`
  plus `withSocialCard(..., "which-green-card")`.
- Card spec: `{ "slug": "which-green-card", "ground": "paper", "eyebrow": "Calculator", "title": "Which employment green card fits?", "label": "Matched against 8 CFR 204.5, not legal advice", "shot": "which-green-card.png", "crop": [600, 136, 2280, 1376] }`.
- llms.txt:
  ```
  {
    path: "/tools/which-green-card",
    label: "Which employment green card category fits",
    blurb:
      "A few questions (sponsor, the job's minimum requirement, the person's qualifications, five statements) matched against 8 CFR 204.5's definitions and USCIS's national interest waiver test: which of EB-1A, EB-1B, EB-1C, EB-2, the EB-2 waiver, EB-3 and EB-3 Other Workers could apply, and what each needs. Information, not legal advice.",
  },
  ```
- known-routes: `"/tools/which-green-card",`
- Calculators hub card (optional): `{ href: "/tools/which-green-card", viz: "steps" as const, icon: CompassIcon, kind: "Match", name: "Which green card fits", tone: "ink", blurb: "Which employment categories your job and background point to, and what each one needs." },`

---

## S13: when the bulletin comes out (DONE)

On `/visa-bulletin`, "When it comes out" now shows, from each bulletin's FIRST Internet Archive
capture (a floor on publication): a bar per day of the month before with the share of bulletins
already out by then, "half were out by the 13th ... nine in ten by the 22nd ... the earliest by the
6th", and, in the reader's browser, "Today is September 14. In at least N of the 96 months with
evidence, the bulletin was already out by this day" (client-side so a cached page never carries an
old today). Replaces the old sentence, which read `archived_at` (the backfill stores the LATEST
capture, so most months fell outside the prior month and were silently dropped) and printed
"1th"/"22th" ordinals.

The measurement, not guessed: `scripts/measure_bulletin_captures.py` reads the archive's index per
fiscal-year folder, fetches each bulletin's first capture and reads it with the ingest's own parser
before it counts (a capture that isn't yet a filled-in bulletin is passed over; none was). 142
bulletins, Oct 2014 to Jul 2026, all verified (10:10 to 11:05 AM EDT; the FY2024 folder's index
timed out once and was re-run with `--merge`). Written to `src/lib/bulletinCaptures.ts` (typed,
"do not edit by hand", measured 2026-09-26). It can't grow: no bulletin has been captured since
State began refusing the archive's crawler in July 2026.

**A finding that shaped the model:** 46 of the 142 were first captured only after their own month
began: every 2014-2017 bulletin on 2017-12-03 (the archive wasn't crawling these pages before
December 2017) and eight 2019-2020 months (e.g. Feb 2020 first captured Apr 3, 2020). They carry
no evidence about the day, so they are **set aside and named on the page**, never put in the
denominator. The shares are over the 96 with evidence, whose span (Jan 2018 to Jul 2026) is the
one printed. Stated bias: a bulletin published in a month's last days could be missed the same
way, which makes the days read a little early.

Files
- New: `src/lib/bulletinRelease.ts` (`releaseByDay`, `releaseSummary`, `ordinal`),
  `src/lib/bulletinRelease.test.ts` (19, including a shape check of the real table: one row per
  month, in order, no capture before the month before), `src/lib/bulletinCaptures.ts` (generated),
  `src/components/bulletin/BulletinRelease.tsx` + test (5), `scripts/measure_bulletin_captures.py`
  (`--cdx-dir`, `--dry-run`, `--merge`), `scripts/test_bulletin_captures.py` (12, offline).
- Modified: `src/app/(site)/(public)/visa-bulletin/page.tsx` (the section), `src/lib/bulletinNext.ts`
  and its test (`archiveFloorDays` deleted: nothing called it, and it described a floor the page no
  longer shows; `monthBefore` now shared).

Tests (11:15 AM EDT): unit 19 + 12 (bulletinNext), components 5, scripts 12; probes: counting late
captures as evidence turns three tests red, dating the span by all captures turns one red.
`pnpm typecheck`: **exit 0, both halves** (this run also covers S7, S10 and 19). eslint 0,
pyflakes 0, `test_main_guard.py` all pass, site-wide gates 24 pass.

For you
- **CI line** (`.github/workflows/test.yml`, beside "Visa bulletin parser contract"):
  ```yaml
      - name: Bulletin capture measurement tests
        working-directory: v2
        run: python3 scripts/test_bulletin_captures.py
  ```
- **The hub's static title says "The Next Visa Bulletin, From the Last 84"** (`TITLE`,
  `visa-bulletin/page.tsx`); production holds 96, and 144 after S11's write. The H1 already reads
  the count. A title change is an SEO call, so not touched; one option is to drop the number.
- Not verified in a browser: the day strip at 390px (it scrolls at min-width 520px) and the "today"
  line in the prior month (renders only between the 1st and last day of the month before the
  next bulletin, which today, Sep 26, it does).

---

## S12: the NVC immigrant visa waiting list (CODE DONE; the production write is yours)

Route: **`/nvc-waiting-list`**. State's yearly "Annual Report of Immigrant Visa Applicants ...
Registered at the National Visa Center as of November 1", every category, **Nov 2016 to Nov
2023**. Top to bottom: a caveat BEFORE any number, from State's own report (consular cases only,
spouses and children included; everyone adjusting at USCIS left out, so employment demand is
understated "significantly"; consulates cull cases); the newest totals (employment 260,660,
+55% in a year; family 3,773,401; everyone 4,034,061); employment categories as one-scale
per-year bars with the newest figure and the change; employment by country (newest report);
family categories the same way; a disclosure with the reconciliation, the limits and a link to
each report as read. Shows "hasn't been loaded yet" with State's page linked until the write runs.

**No browser needed after all.** travel.state.gov refuses scripts, but the Internet Archive holds
the 2017 to 2023 reports as real PDFs (7 of them, found through its index; the file names vary:
`WaitingListItem_2020_vF.pdf`, `WaitingListItem_2021vF.pdf`, so they're discovered, never built).
**No 2024 or 2025 report was ever captured.** If State has published one, it's on
https://travel.state.gov/content/travel/en/legal/visa-law0/visa-statistics/immigrant-visa-statistics.html :
save the PDF from a browser and add it with `--from-file` (together with `--archive`, or the
history is lost).

Checks, all on the real reports: each report must add up to itself (2A + 2B = F2, the family and
employment totals, skilled + other = EB-3, family + employment = grand total) or it's refused;
each report's prior-year column is compared with the previous report's own figures, and all
six overlaps matched exactly (0 restatements); the country list must sum to the employment total
or it's dropped (the totals stand). The site helper reproduces State's printed changes to the
decimal (+133.4%, +71.9%, +86.9%, +66.4%, +49.7%, -12.3%). Two real layout quirks found and
handled: "2B- Adult Sons" (2017) and "EMPLOYMENT FOURTH / TOTAL" on two lines (2021).

Files
- `scripts/ingest_nvc_waiting_list.py` (`--archive`, `--from-file`, `--dry-run`),
  `scripts/test_nvc_waiting_list.py` (16), fixtures `scripts/__fixtures__/nvc-waiting-list-2017.txt`,
  `-2021.txt`, `-2023.txt` (report text, source capture in line one).
- `src/lib/nvcWaitingList.ts` + test (7), `src/lib/turso/nvcWaitingList.ts`, the page,
  `src/app/__tests__/nvc-waiting-list.test.tsx` (6, on `src/lib/__tests__/nvc-waiting-list.fixture.json`,
  the real document the ingest builds from the seven reports).
Probes: strict labels refuse the real 2017 report; no country-sum guard turns one check red; a
removed cell space turns the page's glue check red. **Found and fixed on the way: my glue checks
in `nvc-waiting-list.test.tsx` and `h1b-lottery-odds.test.tsx` replaced tags with spaces, which can
never see glue; both now strip tags to nothing and both were probed red.**
Gates 19 pass, eslint 0, pyflakes 0, `pnpm typecheck` exit 0. `--archive --dry-run` run live
(11:45 AM EDT): 7 reports, 8 dates, 0 restated.

**NOT RUN: the write**, because it adds a `data_freshness` row (`nvc-waiting-list`, as of
2023-11-01, budget 450 days) and `check_ingest_health.py` fails on a dataset `datasetCoverage.ts`
doesn't state. After adding the coverage line, from `v2/`:
```
/usr/local/Caskroom/miniconda/base/bin/python3 scripts/ingest_nvc_waiting_list.py --archive
```
8 archive requests. Expect the health check to WARN that the source hasn't republished (the
newest report is Nov 2023, about 1,060 days old against 450; the ingest itself is fine). That warning
is true; if you'd rather not carry it, raise the budget to 1,200 in the script before running.

Registry lines
- **datasetCoverage** (`src/lib/datasetCoverage.ts`): `"nvc-waiting-list": "State's yearly count of applicants waiting for an immigrant visa at the National Visa Center, each November 1 since 2016, by category, spouses and children included; consular cases only, not adjustments at USCIS."`
- CI (`test.yml`, beside the bulletin tests):
  ```yaml
      - name: NVC waiting list parser tests
        working-directory: v2
        run: python3 scripts/test_nvc_waiting_list.py
  ```
- Sitemap: `{ url: \`${base}/nvc-waiting-list\`, lastModified: "2026-09-26", images: [\`${base}/og/nvc-waiting-list.jpg\`] },`
- Rail (`dataSections.ts`, Visa bulletin group): `{ href: "/nvc-waiting-list", label: "NVC waiting list" }` (the palette test needs it).
- pageCards: `"nvc-waiting-list": "The immigrant visa waiting list. State's count of applicants waiting at the National Visa Center by category, each November since 2016.",` plus `withSocialCard`.
- Card spec: `{ "slug": "nvc-waiting-list", "ground": "paper", "eyebrow": "Visa bulletin", "title": "The immigrant visa waiting list", "label": "Consular cases, by category, since 2016", "shot": "nvc-waiting-list.png", "crop": [600, 136, 2280, 1376] }` (shoot after the write).
- llms.txt:
  ```
  {
    path: "/nvc-waiting-list",
    label: "The NVC immigrant visa waiting list",
    blurb:
      "The State Department's yearly count of immigrant visa applicants waiting at the National Visa Center, by family and employment category, Nov 2016 to Nov 2023, reconciled report against report. Consular cases only, families included; adjustments at USCIS are not in it.",
  },
  ```
- known-routes: `"/nvc-waiting-list",`
- Later, not built: the list is the one published count of the CONSULAR side of the green card
  line (EB-3 Other Workers: 44,470 people waiting abroad, Nov 2023), which the calculator can only
  estimate. It could become a second check there.
