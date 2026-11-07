# Search: sitemaps, Search Console, titles and structured data

The sitemap and its families, IndexNow, Search Console, titles and descriptions, structured data, robots.txt, the brand query, and the audits that walk the site's pages.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## An audit that walks PAGES cannot see routes, libs or generated files (2026-09-05)

The September audit fixed **41** places where a reader would form the wrong
belief about what this site can look up, after Google's AI Mode twice said it
could not check a pending `P-` case. It walked live pages. Two of the most
machine-read surfaces on the site are not pages, and both still said **"check any
PERM case number"** afterwards:

- **`llms.txt`** is a route handler (`src/app/llms.txt/route.ts`). Its blockquote
  summary is the single most quotable line on the site for an LLM, and it also
  omitted `/case-search` entirely - the one capability, searching one employer
  across all three programs, that nothing else on the internet does.
- **the JSON-LD `description`** in `src/lib/structuredData.ts`, which renders on
  EVERY page.

**Enumerate surfaces by how they are READ, not by whether they are pages.** A
sweep of the live pages themselves came back clean (0 findings, with a control
proving the scan was alive), so the page audit had held perfectly; its scope was
the defect. `three-programs-in-machine-copy.test.ts` gates both surfaces on the
three prefixes being present, deliberately not on phrasing - a gate that judged
framing semantically would flag every honest mention of PERM on a PERM site.

**Google's Dataset parser does not walk the schema.org class hierarchy.** Search
Console flagged `creator` on `/perm-processing-times` as "Invalid object type".
The value was `GovernmentOrganization`, which IS an `Organization` by schema.org's
own definition - **the more precise answer was the rejected one**. Exactly one
item was affected because every other Dataset takes its creator as an `@id`
reference to the shared Organization node in `getDatasetSchema`; only that page
hand-rolled an inline creator. `dataset-creator-type.test.ts` gates inline
creators to the bare types.

**What was measured and left alone**, because measurement said it was fine:
`pnpm audit:pages` returns **0 findings across 61 URLs covering all 39
templates**; robots.txt allows every AI crawler (it names eleven SEO scrapers to
block and zero AI ones); the "as of" date in `llms.txt` is DOL's own stamp rather
than our staleness; and content freshness is strong (guides median age 2 days,
`dateModified` exposed in JSON-LD) against the ~90-day decay window the current
AEO guidance describes. Core Web Vitals reads "No data" in Search Console because
CrUX needs more traffic than 2,261 clicks a quarter, which no code change fixes.

---

## Auditing every page: read the sitemap, and decode before you measure

`pnpm audit:pages` (scripts/audit_all_pages.py) walks every URL in
the live sitemap (298 of them) and checks status, title, description length,
h1 count, canonical, and that the data-fed pages are not silently rendering
their empty state. It reads the sitemap rather than a hand-kept list, because
a page nobody remembered is the page that breaks.

**Its first run reported nine over-length descriptions and two were the
detector.** It measured the raw `content="..."` attribute, where every
apostrophe is `&#x27;` - six characters where the reader and Google see one.
A 150-character description reported as 160. **This fires on OUR copy
specifically**, because house style is contraction-heavy, and passes clean on
generic prose: the same shape as the meta-description regex bug already in the
global CLAUDE.md. Unescape before measuring, and probe with six fixtures
(three that must flag, three that must not, including an entity-heavy
150-character control).

**Its second run found the other half: ten occupation TITLES over the limit,**
because a SOC title is itself up to 79 characters ("Secretaries and
Administrative Assistants, Except Legal, Medical, and Executive") and the
template was padding it with " PERM Salary and Filings | PERM Tracker".
The SOC title IS the searched phrase, so the fix is to add the qualifier only
when there is room and to pass `title: { absolute }` above 60 characters,
which drops the brand suffix rather than crowding out the phrase people
actually type. Max rendered title went 118 -> 79.

## IndexNow was telling Bing about 5 URLs, not 13,758 (2026-09-03)

`scripts/indexnow.mjs` fetched `/sitemap.xml` and submitted every `<loc>` it
found. **That file is a sitemap INDEX**: its five entries are other sitemaps,
not pages. So the script submitted five `.xml` files, IndexNow returned 200
because a sitemap URL is a legal thing to submit, and the workflow went green
every deploy for weeks.

**The artefact is what caught it.** Bing Webmaster's IndexNow report lists what
was actually received, and the recent rows are `sitemaps/pages.xml`,
`employer-1.xml` and so on, while the last real page URLs went in on **25
August**, the day before the sitemap was split. The exit code said success the
whole time.

This is the likeliest mechanism behind the AI-citation gap: Bing's index feeds
Copilot, and the site has **zero** AI citations for prevailing wage, LCA and
case-status meaning. Those pages were never submitted.

The script now walks the index one level down, batches at IndexNow's documented
10,000-URL limit, and **refuses to report success if the walk yields under 100
URLs**, because silently submitting a handful was the original bug. Verified
before and after: 5 URLs then, 13,758 across five child sitemaps now.
**78,913 across nineteen children as of 2026-09-10**, after the entity floor
dropped to 1 - the walk and the 10,000-URL batching handled it unchanged, which
is the check that the fix generalised rather than fitting one shape.

**Changed pages only, since Oct 11 2026.** Every deploy had resent all
311,450 sitemap URLs (eight deploys that day). IndexNow's own FAQ: "Submit only
when content has changed. Do not resubmit unchanged URLs", and each URL counts
toward the site's crawl quota. A deploy now sends the pages it changed
(`gsc_queue.mjs --indexnow-list`: static pages, articles, a changed family's
sample pages) and the nightly sweep sends the employer pages whose live rows
moved (`changed-employer-slugs.json`). A manual run still sends everything,
which the FAQ allows after a migration. `indexnow-script.test.ts` holds the
file mode. The same fix found `gsc_queue.mjs` dropping every changed article
missing from `known-routes.json` (44 of 55 guides); articles count by their file now.

**Where to check this, not the workflow log:**
`bing.com/webmasters/indexnow` lists every URL Bing received and when.

## I "fixed" the indexing of six pages that were already indexed (2026-09-04)

**READ THIS BEFORE BUILDING ANY INDEXING THEORY. The premise was never checked
against Search Console, and it was false.** I believed `/pwd-cases`,
`/lca-cases` and `/case-search` were stuck in "Discovered - currently not
indexed". Inspected in GSC the same day: all three answer **"URL is on Google /
Page is indexed"**, and so do all three `/browse` hubs. Six for six. The
correlation I built on it (every data page carrying `PageBasics` is indexed, the
three without it are not) was real arithmetic over a made-up dependent variable.

**What IS unindexed is a different population and two orders of magnitude
bigger: 19,931 URLs, "Discovered - currently not indexed", last crawled `N/A`.**
The examples are almost entirely `/perm-attorneys/<slug>` and its siblings.
Google has never spent a crawl on them, which is a crawl-BUDGET decision about
the entity long tail, not a defect on any hub page.

The lever Google documents for that is duplicate content ("eliminate duplicate
content to focus crawling on unique content rather than unique URLs"), and the
entity pages are where it bites. Measured over 8 attorney pages, chrome and
shared template excluded: each serves ~1,430 words of which only **~350
five-word runs are its own**, so roughly **three quarters of every entity page
is boilerplate**. That is the real thing to attack, and it is untouched.

**The work that came out of the wrong premise still stands on its own**, because
the duplication it removed was measured rather than assumed. `/pwd-cases` and
`/lca-cases` were **75.2% identical**; they got a `PageBasics` block each. A
sweep of all 39 public pages then found the three A-Z `browse` indexes were
**worse** (67-72% shared) than the pages I had been asked about: they render from
one component and served the same ~470 words with a noun swapped. Each got a
per-kind note. None of that was wasted, and none of it was what I claimed it was.

**THE FIRST MEASUREMENT WAS MOSTLY MEASURING CHROME, and acting on it would have
meant padding pages for nothing.** Header, nav, footer and the shared provenance
block are ~300 words that every page carries on purpose. On a 530-word index
they drown the body copy, so every short page reads as ~60% duplicated whatever
it says. Dropping the 5-grams that appear on more than half the pages (that is
chrome, by definition) gives the real number:

| page | raw | chrome excluded |
|---|---|---|
| `/pwd-cases` | 60.6% -> 41.1% | **14.9%** |
| `/lca-cases` | 66.6% -> 44.4% | **16.2%** |
| the three `browse` indexes | 72% -> 63% | **32-36%** |

The browse trio's remainder is one genuinely identical sentence stating one
genuinely identical rule (an entity earns a page at three filings). Rewriting
that three ways would move the duplication rather than remove it, so it stays.
`scripts/` has no gate for this on purpose: the threshold that would catch a
real duplicate cluster also flags every short page, which is how the first run
of nearly every gate in this repo has gone.

Re-measure with `dup2.py`'s approach (chrome-excluded 5-grams) against a BUILT
site, never the source, and never against a metric that has not been shown to
separate chrome from copy.

**AND THE FIGURE THIS WHOLE SECTION RESTS ON WAS NINE DAYS STALE.** The Pages
report footer reads **"Last update: 8/27/26"**, so "19,931 discovered, currently
not indexed" describes 27 August, not the day it was read. **Read a dashboard's
own last-updated stamp before treating anything on it as current.** URL
Inspection is live, the Pages report is not, and re-inspecting three pages from
that same examples list ~11 hours later found them disagreeing in both
directions: one obscure firm page had become **indexed with nobody requesting
it**, the household-name firm was unchanged, and a third had gone back to
**unknown to Google**. Google is working the queue on its own, prominence does
not predict the order, and the duplication theory looks weaker still. Re-inspect
a handful in a week and read the trend rather than spending the quota on it.
(The quota is ~11/day, not the 4 first recorded here - see below.)

## The brand query, the About page, and the 60-day title freeze (2026-09-07)

Search Console, exact query "perm tracker", the homepage's own daily line:
**690 to 849 impressions a day through Aug 24, 410 on Aug 26, then 1 to 27 a
day from Aug 27 on**, while the query itself kept 300 to 670 a day site-wide
going to `/faq` and `/terms`. The homepage title was rewritten on Aug 24 and
the product's self-description removed on Aug 26; the drop lands one crawl
later. The Aug 29 fix (the brand inside the H1, lowercase domain as
`alternateName`) moved nothing in nine days, so **the H1 was not the cause**.
Terms ranking for a brand query is the tell: Google could not find a page that
describes the brand and took the page that says the name most often.

What Google's site-names doc lists that we lacked, and what shipped:

- **`/about`** (`src/app/(site)/(public)/about/page.tsx`): who runs it, since
  when (domain Nov 2025 per RDAP, live Jan 2026 per the Wayback Machine),
  the data sources, and what it is not. `AboutPage` schema whose `mainEntity`
  is the shared Organization `@id`.
- **`src/lib/constants/about.ts`** is the single source for the About page,
  the homepage block, the Organization schema (`founder` Person node,
  `foundingDate`, `sameAs` to Medium and Product Hunt; LinkedIn sits on the
  Person node, because a person's profile is not the brand) and, through
  `ARTICLE_AUTHOR`, every byline. They cannot drift; `about-surfaces.test.ts`
  asserts it and that every surface links the route (Learn menu, footer,
  sitemap, llms.txt, homepage block).
- **ONE PERSON IS NAMED, EVERYWHERE: Sabrina Soltau, immigration attorney
  (owner's decision, Sep 7 2026, 8:43 PM ET).** The page had launched that
  afternoon naming two people; the second, and every link that carried a
  personal GitHub or X handle (footer, About contact line, contact page and
  settings "report a bug" links into the repo's issue templates, the repo in
  the Organization `sameAs`), were removed the same evening. Bug reports and
  ideas go to `mailto:support@permtracker.app` with a pre-filled subject.
  `about-surfaces.test.ts` greps the six identity surfaces for the old
  handles and title. The repository still lives under the personal handle
  and the cron dispatcher still targets it; that is a GitHub-side move
  (transfer to a brand-named org), not a site edit. Her portrait
  (`public/about/sabrina-soltau.jpg`, 640x800, supplied by the owner) is on
  the About card and on her Person node as `image`; the test asserts the
  JPEG header matches the declared size. Medium (`@permtracker`: About text,
  short bio, pronoun removed) and the Product Hunt maker bio were edited the
  same evening and verified on their public pages; both accounts keep the
  brand's green PT avatar.
- **The homepage carries an "About PERM Tracker" H2 again**, plain
  server-rendered prose with no Motion wrapper, and **its FAQ dropped from
  eight to three**: six were byte-identical to `/faq`, and Google chose `/faq`
  for "what is PERM Tracker". One page answers each question now.
- **Homepage title: `PERM Tracker: PERM Processing Times, Case Status and
  Alerts`, FROZEN until 2026-11-07.** Three rewrites in six days cost the brand
  query. The scoreboard is that daily line, read weekly.
- Product Hunt (`producthunt.com/products/perm-tracker`) and its maker profile
  were edited the same day to the current definition; they had said "for
  immigration attorneys" since February and are among the few outside
  references Google has for the name.

**Two facts the About page deliberately does not claim**: that the person
named has waited on a PERM case of her own (the page says she files them, and
that her clients' questions shape the site), and that anybody reviewed the
deadline logic. `about-surfaces.test.ts` fails on a first-person waiting
claim.

**"PERM Tracker" is a generic name shared with a rival**, and Google's doc
says it will not show a generic or shared site name, so the SERP prints the
domain for us and for the rival tracker alike; keeping the name is Adam's call and
the fix is entity confidence, not markup. Registration order (RDAP): the rival dashboard
Mar 2025, **permtracker.app Nov 25 2025**, the rival tracker Mar 22 2026,
and three smaller rival sites between Mar 26 and Apr 27 2026. Being first
carries no weight with Google; references, an About page and stability do.

## Google was printing copy the audit had already fixed, from MDX frontmatter (2026-09-10)

Adam sent a screenshot of the SERP for the brand query. Our `/guides` result read:

> The complete guide to tracking PERM cases, from creating your first case to
> mastering deadlines, recruitment, notifications, and the AI assistant.

That is the pre-audit, attorney-software framing, and it is the third form of
one lesson. The September audit fixed **41** places where a reader would form a
wrong belief; a later pass caught the two most machine-read surfaces that are
not pages (`llms.txt`, the shared JSON-LD `description`). **MDX frontmatter is
the third class, and it is the one Google actually prints as the snippet.**

The article's BODY had already been corrected - it opens "PERM Tracker is free,
and it has two halves", names the public lookup, and names the P- and I-
prefixes. Only `content/guides/getting-started.mdx`'s `description` and
`seoDescription` were stale, and those are the only two strings a searcher ever
sees.

**Swept every description-shaped string on every surface** - MDX frontmatter,
page and route `metadata`, `generateMetadata`, `structuredData.ts`,
`pageCards.ts`, `navigation.ts`, `dataSections.ts`, the manifest, `llms.txt`,
layouts, OG and Twitter blocks: **164 strings across 87 files, three stale.**
The guide's two, and `/terms`, which described the site as "PERM labor
certification case management software". Everything else was already current.

**Two things the sweep flagged and left alone, both correctly:**
- `content/blog/best-immigration-case-management-tools.mdx` - the article's
  SUBJECT is case-management software. It is a comparison piece.
- Three strings inside the AUTHENTICATED app (a dashboard empty state's "Get
  started by creating your first case", the product tour's "the AI assistant"
  and "in real time"). That half of the product IS case-management software,
  its activity feed IS reactive, and a gate flagging those would be wrong and
  suppressed within a week.

**A SECOND SWEEP, of LENGTH rather than framing, found eight more.**
`pnpm audit:pages` reported exactly one over-length description (`/badges`, 251
chars) while **eight** were live. It samples **3 URLs per template**, and
`/tools/*` and `/visa-bulletin/*` are not templates in the sense that matters:
each of those pages carries its own hand-written `metadata` and merely shares a
URL prefix. The other seven sat on URLs it never fetched (170 to 220 chars).

Measured every one of the **60 static public pages** live instead of sampling
them: eight over, none under. All shortened.
`page-description-length.test.ts` is the durable gate - static and exhaustive
where the live audit is live and sampled, with the 251-char string as its
control. Neither replaces the other: the static one cannot see a description
assembled at request time, and the live one cannot see an unsampled URL.
Dynamic segments stay out of scope on purpose, because one `generateMetadata`
really does serve every slug there.

`public-descriptions.test.ts` gates the framing class: it scans frontmatter across all
three content directories, asserts it scanned a plausible number first, carries
the exact string Google printed as its control, and holds its one written
exception to a stated reason. Probed both ways - restoring the real string goes
red, and so does a NEW article shipping attorney-only framing.

**Off-site properties were checked too and are current**: the GitHub repo
description leads with the federal data and names all three programs, and
Medium and Product Hunt were rewritten on 2026-09-07.

## Every entity page is indexable now, and three things had to move first (2026-09-10)

Adam: *"nah i want all"*, overruling a recommendation to lower the floor from 5
to 3 as a measured experiment. `MIN_TOTAL_FOR_PAGE` is **1**, so the sitemap
advertises **78,600** entity URLs (71,512 employers, 5,678 attorneys, 1,410
occupations) across **18 child files** instead of 13,579 across 3.

**The floor existed for a cost reason that turned out to be pointing
elsewhere.** It was raised 3 -> 5 on 2026-09-01 to cut the crawlable surface
35%, on the belief that crawls of the entity tail drove the ISR bill. Measured
again: builds were 66% of that bill and are fixed, the crawler that mattered
(Meta, 553,800 requests a day) is answered by the firewall for 81 cents, and
what remains scales with **deploy count**, because every deployment cold-starts
the whole ISR cache. The 2026-09-01 decision was sound on the evidence it had;
the evidence changed.

**What this does NOT buy, so nobody reads the page count as a result.** Google
already holds 19,931 of these URLs in "Discovered - currently not indexed" with
no crawl date: it has seen the tail and declined it. Adding URLs to a sitemap
does not change that, and ~75% of an entity page is boilerplate, which is the
thing that actually gates indexing. This is a cheap bet, not a fix.

**Three things had to change with it, each measured on production:**

1. **The sitemap read the whole kind per chunk.** `entityEntries` fetched every
   row and `.slice()`d in JS - affordable at two employer chunks, and at
   fifteen it is ~1,085,000 rows a day to emit the same files. `LIMIT/OFFSET`
   is NOT the fix: `idx_pe_kind_total` orders by `total`, so `ORDER BY rank`
   on top of it is `USE TEMP B-TREE FOR ORDER BY` and every chunk still sorts
   all 71,512 rows. **Measured on employer chunk 12: OFFSET 4,858 ms, rank
   range 459 ms.** `getEntitySlugWindow` reads `WHERE rank > lo AND rank <= hi`
   off `idx_pe_kind_rank`. Ranks are dense 1..N per kind (re-verified: MAX(rank)
   == COUNT(*) for all three), so the windows partition the kind exactly -
   proved by rebuilding both multi-chunk kinds window-by-window and diffing
   against the old whole-fetch: **byte-identical, zero duplicates**. Chunk count
   comes from `countEntityRanks` (MAX(rank), one index read) rather than a
   989 ms `count(*)`, because the windows must cover every rank whatever
   fraction of them earns a URL.

2. **The bulk dump keeps its own floor.** `MIN_TOTAL_FOR_BULK = 5`.
   `/api/perm-entities/<kind>` hands its whole result to one caller in one
   response and the search palette downloads it as a client-side slice; at the
   page floor that is 69,204 employers instead of 9,176 - a page-weight problem
   and a one-request copy of the compilation that §4 of the Terms tells other
   people not to take. They were one constant only because they used to want
   the same answer.

3. **The A-Z browse pages had no cap and would have shipped a 3 MB page.**
   Measured live BEFORE the change: `/perm-employers/browse/s` is **600.6 KB**
   at 953 names against 218.6 KB at 51, so chrome is ~205 KB and a name costs
   ~0.42 KB. At floor 1 that bucket holds **6,813**, which renders at ~3.1 MB
   and ~390 ISR write units per regeneration. `BROWSE_MAX = 1000` caps the
   RENDERED list only - every entity keeps its URL and stays in the sitemap -
   and the page states the remainder in words, the shape `stageListing()`
   already uses.

**The cap introduced a wrong answer that had to be caught separately.** The page
says "the busiest is X" and "the smallest carry N" as claims about the LETTER,
and both were `entries.reduce(...)`. Over a capped slice they silently become
claims about the first thousand names alphabetically: **S would have named
Salesforce at 1,373 filings, when the real busiest is Stoughton Trailers at
1,878, sitting at alphabetical position 5,568 of 6,813.** They are computed over
the full set inside `browseBucket` now. The sort also happens BEFORE the cut -
cutting in SQL would take an arbitrary 1,000 by storage order and label them
"the first 1,000 alphabetically".

**Every gate here was probed by reverting it, and two were blind on the first
run**, which is the usual rate in this repo:

- `live-only-employers-unindexed.test.ts` asserted the window reads
  `MIN_TOTAL_FOR_PAGE` with `/getEntitySlugWindow[\s\S]*?MIN_TOTAL_FOR_PAGE/`.
  `[\s\S]*?` runs PAST the end of the function into `countPageworthy` 300
  lines later, so it passed over a window whose floor had been replaced with a
  bare `1`. Assertions are sliced to the function body (`fnBody`) now.
- `sitemap.test.ts` was blind to a builder that ignores its `chunk` argument -
  the mutation that ships fifteen identical employer files - because every
  fixture held fewer rows than one chunk. It now arranges a corpus spanning
  three chunks and asserts the union covers every rank exactly once.

**Its floor assertion (`floor >= 3`) is deleted, not relaxed.** It was written
to keep the crawlable surface small; a test that forbids the number the owner
chose is a stale opinion with a red light. What replaced it is the invariant
the number stood in for and which holds at any value: the sitemap and the
page's own `robots: noindex` must read the SAME constant, or one of them is
wrong about every entity in the gap.


## Rich Results and DefinedTermSet: what is and is not a rich-result type (2026-09-14)

Google's Rich Results test on `/perm-case-statuses`: **2 valid items, 0
errors**, the missing `aggregateRating` is optional and deliberately absent (a
self-serving rating on a reference page would be exactly the markup the
2026-08-13 scope lesson warns about). `DefinedTermSet` is NOT a rich-result
type, so the test says nothing about it; validate it by fetching the page and
asserting every `DefinedTerm.url` anchor resolves to a `<details id=...>` in
the same HTML (32 of 32 did). `validator.schema.org` cannot be driven through
the extension (hash navigation, see the global ladder); curl and parse.

## The homepage owns the brand query again: both halves, at the top (2026-09-15)

Search Console, exact query "perm tracker", 3 months: `/faq` 885 clicks at
position 5.8, the homepage 787 at 6.2, and the two daily lines are mirror
images from Aug 25 - the homepage fell to near zero the day its title was
rewritten and its self-description removed, and `/faq` rose the same day.
Google had swapped which page represents the site for its own name. Not a
canonical problem (Google's chosen canonical is the homepage, crawled that
afternoon). `/faq` simply defined the product first and said the name 60 times
to the homepage's 34.

Adam's brief: *"make sure homepage has BOTH sides of everything... not just
benef and not just att."* Measured before: four sections for the person
waiting, one short panel for the practitioner, a definition describing only the
data site, a closing call speaking only to attorneys. What shipped:

- **The definition directly under the H1**, both halves in one sentence, plain
  server prose (`ABOUT_ONE_LINER` plus the two-halves sentence).
- **`AudienceBlocks`** replaces `AttorneyPanel`: one H2 ("Both sides of a PERM
  filing"), two mirrored H3 cards of equal shape and list length, each fed by
  `ABOUT_TWO_HALVES` in `constants/about.ts` so no surface can drift to one
  side. The attorney card carries what `/for-attorneys` kept to itself.
- **Six FAQ entries, three per side.** The four brand-defining questions moved
  OFF `/faq` and onto the homepage (reversing the Sep 7 trim, which had moved
  them the other way and handed `/faq` the query); `/faq` keeps the process
  questions. `about-surfaces.test.ts` asserts the split in both directions.
- **Two-door closing call**: check a case, start tracking cases.
- **The brand name links home from the footer and the About page**; the header
  logo had been the only such link.
- **Homepage URL with its trailing slash** in the sitemap: the canonical form
  and the one Google inspects; without it the inspection read "no referring
  sitemaps".
- **Title unchanged**, frozen until 2026-11-07.

Verified on the dev render: both halves present in order, outline
1-2-2-2-3-3-3-3-2-3-3-2-2-2-2 with no skips, the repo's glue audit at 0 (a
quick regex said 44 and 41 on the untouched production page - the instrument,
not the page). Scoreboard: the homepage's daily line for the exact query,
weekly; a reversal should show inside two to three weeks.


## The Sep 16 batch: month pages in the sitemap, the policy page rebuilt, the digest repaired (2026-09-16)

One push after one gate, because every deploy cold-starts the ISR cache.
Ledger: sitemap family, policy page, digest fixes (flag still off), two
shared-component floors, and the notes below.

**The `/perm-queue/<month>` family is in the sitemap now.** Forty generated,
indexable, linked pages that no sitemap advertised, and Search Console had
`/perm-queue/2025-11`, the month DOL was adjudicating, as "URL is unknown".
`pagesEntries()` lists every month with at least one case from the SAME
census the hub builds its strip from and the month route peeks before
rendering (an empty month 404s there, so it is omitted here), gated on
`MIRROR_COMPLETE` like the hub, stamped with the sweep's own finish date.
`sitemap.test.ts` gained the family test, the census-read-fails test, and a
**tree-walking coverage test**: every `[param]` directory under the public
tree must have at least one URL in the sitemap, so the class cannot recur.
Probed by emptying the block: two tests red. **Sep 24: the family indexed on its own.** Four of
four month pages sampled in Search Console were "URL is on Google" without a request, 2025-03
crawled Sep 19 with `/perm-queue` as the referring page, so the months left the GSC queue.

**`/policy-changes` is visual now, and every date on it is the Register's.**
The ingest asks the Federal Register API for `effective_on`,
`comments_close_on`, `comment_url`, `citation`, `action`, `dates` (the
DATES paragraph verbatim), `correction_of` and `pdf_url`; `ensure_columns`
adds them to the live table (`CREATE TABLE IF NOT EXISTS` never adds a
column), and the write signature includes them so a moved effective date is
a write. Three rules in `keep()` now, the third new: agency housekeeping
(Performance Review Board appointments, advisory-committee meetings) is
dropped; a Labor Department SES appointment notice had matched "labor
certification" and sat beside the H-1B fee rule for six days. Corrections
(`C1-<number>`) are folded into the document they correct by the read layer,
not deleted. `src/lib/policyFeed.ts` is the pure half: feed partition,
comment-window state (open THROUGH the close date), effective-date state
(UPCOMING vs IN EFFECT, never a bare boolean), the ledger, and the
twelve-month strip geometry; 16 tests. The page: a ledger (`RecordStrip`),
an SVG strip (marks by type, comment windows as bars on their own lanes,
OFLC ticks, today), then every document as a collapsed `<details>` whose
summary is badge, date, agency, title and the one date that matters, whose
body is the abstract whole, the DATES paragraph, citation, links, and the
first page as printed. OFLC's announcements are partitioned by topic tag:
the 250 on this site's programs are listed (eight rows, then folded by
year), the 354 on H-2A, H-2B and CW-1 are counted and linked. Measured on
the dev render: visible words 2,270 with lead sentences on every row, 1,254
without them; DOM 8,559 either way; glue 0 with a control.

**The visual is the printed first page, not a screenshot, and the reason is
policy.** `federalregister.gov` answers a headless browser with a CAPTCHA
interstitial ("programmatic access to these sites is limited to our
developer APIs"): 21 captures, 21 identical files, caught because the byte
sizes matched before anyone looked. Not defeated. `govinfo.gov` serves the
same document's PDF to a plain request, and `scripts/render_policy_pdfs.py`
renders page one at 100 dpi in sixteen grays, lossless WebP (86 KB against
177 KB lossy on the same page; a lossy encode spends its bytes on the edges
of letters), writing `src/lib/policyShots.ts` as the typed manifest so every
`<img>` declares the file's real size, which `policy-changes.test.tsx`
re-reads from the WebP header. Re-run it when the feed gains a document; a
document without a capture renders no figure.

**Strip rules that came out of measuring it.** Marks are not links: at 390px
a mark is 11px and a hit area big enough overlaps its neighbours, so the
list is the navigation and each mark carries a `<title>`. SVG `<text>` and
`<title>` glue like any text: a trailing space inside each. Labels sit at
each month's middle so the end labels stay inside the box (measured at
1440: first label at 30, last at 926 of 976). Closed comment windows are
`fill-foreground/35`, not `fill-border`: the border token is ink in light
mode and a closed window drew as black as a proposed rule's mark. Overlapping
windows get lanes by interval, marks by proximity. The container scrolls at
`min-w-[880px]` so the 16-unit labels never fall under 14px.

**Two shared components moved to the 14px label floor:** `RecordStrip`'s
date column and `FinePrint`'s summary were 12px mono. `RecordStrip` also
keys rows on route plus label now; three ledger figures pointing at one
`#register` anchor threw React's duplicate-key error on the dev overlay.

**The digest, still off, is fixed for the day it is switched on** (fork
agent, 23 + 5 tests): `sendBatch` retries a `{error}` once before advancing
the cursor (it used to skip a failed address forever), the preferences link
is built through `links.ts` (it was on the raw Convex host), the subject is
capped at 78 characters dropping movement parts first, `summarizeNewsletter`
carries a `health` line the admin panel shows (off with the preview count,
ok inside 8 days, warn past it), the recipient's own watched case opens the
issue, two doors close it, and the figures are email-safe tables.

**Instruments this batch relied on:** the chrome-devtools MCP for real
viewports (390 mobile, 768 tablet, 1440; light and dark), with the
same-origin iframe sweep unusable here because the site's frame headers
block it; the stale devtools profile lock from Sep 14 had to be cleared
first. A production build wipes `.next/` on start, so a scratch log or
capture under `.next/` is gone the moment the build begins; and the build
outlives the Bash tool's 10-minute cap only when launched detached.

**Five smaller things from the same day, each of which cost a retry:**
- **Two writers sharing a table must both NAME their columns.** The OFLC
  writer inserted into `policy_notices` positionally (`VALUES (?,?,?,?,?,?,?,?,?)`),
  which the Federal Register feed's eight new columns would have broken on the
  next run with "table has 17 columns but 9 values were supplied".
- **The Vercel CLI prints its tables to STDERR.** `npx vercel inspect <url>
  2>/dev/null | grep Ready` is an empty pipe, and a wait loop on it runs to
  the tool's ceiling. Use `2>&1`.
- **Calling a template FUNCTION returns its child element, not an element of
  the template.** `CaseStatusChanged(props)` yields the `<EmailLayout>`
  element, so overriding `props` on that result changes nothing and a test
  built that way passes for the wrong reason. Build the props object and call
  the function again with the override.
- **`next/image` rewrites `src` through its loader**, so a static render
  contains `/_next/image?url=%2Fimages%2F...`; a test that looks for the raw
  path finds nothing. Match on the file name.
- **The Next dev overlay's "1 Issue" badge is readable without a browser
  click**: `document.querySelector("nextjs-portal").shadowRoot`, click the
  button whose text matches `Issue`, read the dialog text. The console was
  empty while the overlay carried React's duplicate-key error.

## The live-only employer pages are indexable and advertised (2026-09-17, 1:56 AM EDT)

Adam: *"everything"*, after the middle path (index only the 678 live-only
employers with five or more cases) was recommended and the arithmetic laid out.
Recorded so the reasoning survives the reversal:

| set | pages |
|---|---|
| live-only employers (in the live feed, in no published file) | 22,313 |
| with 2 or more cases | 4,029 |
| with 5 or more | 678 |
| with 10 or more | 204 |
| with exactly one case | 18,284 |

**What changed.** The page's live-only branch emits no `robots` directive (it
carried `index: false, follow: true` from the day it shipped). The sitemap
gained a fourth child family, `live-employer-N.xml`, listed from
`perm_live_only_index`: a table `build_entity_detail.py` writes every night
beside the live remainder, one row per live-only employer with a dense rank
ordered by first filing then slug (so a night's arrivals mostly append and
the rank windows stay stable), diffed on write like the live table. The
sitemap reads it through a rank window exactly as the entity children do,
stamps the sweep's finish date, and lists no live children at all when the
table cannot be read, so a failure in this family cannot take the other
three down. `live-only-employers-indexed.test.ts` replaces the file that
pinned the opposite decision and asserts the invariant that survives it: the
page and the sitemap read one source, and the page never asks not to be
indexed.

**What was said would happen, so it can be checked against the 9/27 report.**
Google is already declining 63,218 published tail pages ("Discovered,
currently not indexed") and refused 84 crawled ones on Sep 15; these pages
are thinner, so the expected outcome is a larger discovered-not-indexed
figure and a small gain in the index, with no penalty (Google does not punish
a site for pages it chooses not to index). The one real cost is crawl: a site
of ~100,000 daily-changing URLs is the shape Google's crawl-budget guidance
addresses, and every crawl spent on a one-case page is one not spent on the
published tail. The upside is search presence for a new sponsor's own
workers, who type the company name plus PERM, and those pages are the only
ones on the internet naming such a sponsor before DOL publishes it.

**Seeded by hand** once with `build_entity_detail.py --live-recent-only`
before the deploy, so the sitemap index listed the family from its first
build rather than after the next nightly run.

## A sitemap INDEX and its children are read on different clocks (2026-09-21)

Google had never seen 22,467 pages, and nothing in any report said so. The
five `live-employer-*.xml` children shipped 2026-09-17; Search Console's
"Sitemaps read" list held **19 of the 24**, and the five new ones were absent.

**The proof is arithmetic, and it is the way to detect this class:** GSC's
"Total discovered pages" was **78,954**, and the sum of the 19 children it
lists is **78,954 exactly**. A child Google has not read contributes zero, so
comparing the headline figure against the sum of the rows names the missing
ones without guessing.

**Why it happened, and the rule that follows.** Google re-fetches children it
already knows on its own schedule (these were read Sep 14 to 20) but discovers
a NEW child only by re-reading the INDEX - and the index's own "Last read" had
been stuck at **Sep 11**. So:

- **Adding URLs to an EXISTING child propagates on its own.** The ~40
  `/perm-queue/<month>` pages went into `pages.xml` on Sep 16 and were indexed
  within days with nobody requesting them.
- **Adding a NEW child does not.** Resubmit the index in Search Console the
  same day you add one (paste the FULL URL - a Domain property rejects a bare
  path with "Invalid sitemap address"). That moved Last read to Sep 21.
- IndexNow is unaffected: `scripts/indexnow.mjs` walks the index itself every
  deploy and had been submitting all five children (101,394 URLs, accepted).
  Bing knew; only Google did not.

## A third-party audit's counts are a sample of its own crawl cap

Ahrefs reported 23 issues over permtracker. Its dashboard said, in its own
words, *"The crawl has reached the maximum number of internal pages"* - 5,002
of ~78,600, **6% of the site**. Consequences worth internalising before acting
on any of it:

- **Every delta is mostly resampling.** `+396`, `+285`, `+84`, `+4,606`,
  `+547` all arrived the week the live-only employer pages became indexable:
  its crawler followed them and its 6% shifted onto that new population.
- **Its counts UNDERSTATE a systematic defect.** It found 88 over-length
  titles; measuring all 354 static pages found **134**, 96 of them one
  template.
- **Five of its issues were artefacts of the cap itself** (indexable-page-not-
  in-sitemap, pages-removed-from-sitemaps) or of features it cannot observe
  ("changed pages not submitted to IndexNow", while our own run submitted
  101,394 URLs and was accepted).
- **But its one ERROR was real and exactly right.** `/perm-employers/compare`
  was `noindex` AND listed in `pages.xml`. Read the errors closely and treat
  the warning COUNTS as shape, not size.

## The Sep 23 audit batch: BotID's scope, per-page sitemap dates, a guard that hid a failure (2026-09-23)

An outside production audit (another session, read-only here) listed eight items; each was
re-measured before it was changed. What it taught, beyond the commits:

- **An UNLAYERED rule beats a layered remap, whatever the specificity.** In-article links were
  #2ECC40 on #FAFAFA (2.05:1) although `.text-primary` maps to `--primary-text`: the
  `.prose-neobrutalist a { color: var(--primary) }` rule sits outside `@layer`, so it won. It
  paints with `--primary-text` now; `prose-link-contrast.test.ts` checks the rule and the token's
  contrast, with the lime itself as the failing control.
- **A JSX `<title>` takes ONE child.** `<title>{s.label}{" "}</title>` threw React #418 on every
  load of /uscis-processing-times. Put the anti-glue space inside one template literal.
  `svg-title-single-child.test.ts` scans every `<title>`; its first version matched the word
  "<title>" in two comments, so it strips comments first.
- **A file-based OG image attaches to EVERY page in its segment**, so the card route must resolve
  exactly as the page does: published record, then the live-only record, 404 only when both miss.
  ~22,600 live-only employer pages advertised a 404 card until it did.
- **BotID starts only in the signed-in app.** It guards one route, `POST /api/chat` (AI quota).
  At init it only wraps fetch and XMLHttpRequest; its challenge scripts (c.js, Kasada's p.js)
  load when a protected request fires. `components/security/BotIdInit.tsx` starts it once from the
  (authenticated) layout; `botid-scope.test.ts` keeps the BotID client out of public code and the
  protected list equal to the routes calling `checkBotId()`. Basic checks are free; Deep Analysis
  is $1 per 1,000 `checkBotId()` calls on Pro (Vercel's BotID page).
- **Live-only employer URLs carry their own lastmod.** `perm_live_only_index.last_changed` is the
  newest `perm_case_status.fetched_at` among an employer's cases, as an Eastern date (fetched_at
  is written on first record and again only when status, employer or title changes). The sweep's
  finish date is only the fallback. First fill: 22,599 dated, 29 distinct days, 1,459 in the
  last week, where every URL used to say "today".
- **Nothing may follow a script's `if __name__ == "__main__":` guard.** `refresh_recent_12m` was
  defined below it from Sep 7 to Sep 23, so every nightly call raised NameError inside a
  try/except that logged "FAILED" while the run said ok; 3,224 of 77,190 twelve-month counts were
  stale when the fix ran. `scripts/test_main_guard.py` (in CI) parses all 88 scripts; its first
  run also found `test_social_post.py`'s two HTTP tests below the guard, never run by CI.
- **The Senja label hook must not give up on a timer**: the embed is lazy, so the link can arrive
  long after mount. And **`disable_surveys: true`** keeps posthog-js from loading surveys.js on
  every page; the Surveys product is off on the project.
- **A local full-suite timeout under a loaded machine is not a failure of the change.** One
  15-second convex test timed out at a load average near 100 (another session's ffmpeg render);
  it passed alone in 9.4 s and the rerun with `--testTimeout=45000` passed 408 of 408. Check
  `uptime` before re-reading a timeout as a regression.

## Oct 6 2026: titles and descriptions for the searches people make

The owner asked for every title, description and H1 to be checked for what gets a click, then for a
plain, natural set: "no salsey desperate weird unnatural". Method and what changed:

- **Read Search Console first** (3 months to Oct 5: 6,190 clicks of 158,000 appearances, 3.9%). Export the
  Performance report to Google Sheets (no file download, which bricks the browser extension), read each tab
  with `fetch(.../gviz/tq?tqx=out:csv&sheet=<tab>)` from the sheet's own tab, and summarise in the page;
  a POST from that tab to a local receiver stalls on Chrome's local-network prompt. Per-page queries come
  from the report URL with `&breakdown=query&page=!<url>` (exact) or `page=*<part>` (contains).
- **The site was technically clean** (603 pages: every title under 60 with the brand, one H1, no duplicate
  titles, no missing descriptions), so the work was wording. Titles name the searched phrase and what the
  page holds: the homepage "PERM Tracker: Free PERM Case Status and Processing Times" (the Nov 7 freeze lifted
  by the owner Oct 6), /faq, /for-attorneys, /guides, /calculators, /perm-case-statuses, /perm-attorneys,
  /about (it read "About PERM Tracker | PERM Tracker"), /methodology; employers "<name> PERM and Green Card
  Sponsorship", occupations "<job> PERM Salaries", queue months "<month> PERM Filings: Where They Stand",
  bulletin lines "<line> Visa Bulletin Cutoff and History".
- **Employer descriptions lead with the cases still waiting** when there are any (`lib/pendingSnippet.ts`,
  one point read of `perm_entity_pending`), and mention the approval rate only when the page shows one.
- **Industry titles were cut mid-word by `.slice(0, 60)`** ("... (except Physi") and the description
  repeated the cut. `lib/industryTitle.ts`: the name without its parenthetical plus the NAICS code (people
  search by code), the code first when that won't fit 60, never a cut word.
- **Stale figures in text that doesn't update itself**: the 2026 processing-times post said DOL was on
  November 2025 (DOL's Sep 22 figure is December 2025); its description no longer carries a figure. The
  priority-date guide's title said "84 Months" of an archive that now reaches 2005.
- **Not changed, on purpose**: names stay as DOL prints them, capitals included. 19,064 employer and 1,037
  firm names are all capitals, the stored spellings are slugs (no case), and a rule can't tell DEL or REY
  from IBM or USA, or write JPMorgan or McKinsey. The homepage's 5-star rating markup is policy-compliant
  (visible on the page) and stays.
- **What can't be fixed by wording**: the "perm tracker" search (58k appearances, about 5th) is shared with
  rivals of near-identical names; /tutorials and /resources still collect about 5,700 appearances while
  Google catches up with their 308s to /guides.
- **/faq opens with the case lookup and four tool tiles** (processing times, live data, calculators, for
  attorneys). Google sends a large share of the "perm tracker" search there (September: /faq 1,160 clicks, the
  homepage 906), and PostHog showed where those visitors went next, 30 days to Oct 6, scraper browsers excluded:
  of about 1,200 visits that began on /faq, 278 went to the homepage, 263 left, 221 to the case lookup, 176 to
  processing times and 154 to /tools. The questions are unchanged below. **The case number box says what to do
  without a number** (`CaseLookupForm`, so on /faq, /perm-case-statuses and the lookup page alike): "Don't have the
  number? Find the case by employer name", to /case-search, which reaches pending cases. Many people waiting never saw
  their receipt; the lawyer filed it.
- **A layoff notice no longer lands on a tiny namesake** (`sponsor_matcher` in `scripts/ingest_warn.py`). Washington's
  "Amazon" notices had matched a one-filing employer named "AMAZON"; an exact match under 30 filings now gives way to
  the busiest employer whose key begins with the same words, with ten times the filings and 100 in all, the keyless
  lookup's rule and numbers (`test_warn.py` holds them together). Measured first on production: it moved that one
  company and no other, so Amazon.com Services LLC's page lists its three notices. Branch-named notices ("Amazon -
  SJC13") still match nothing; the rule never adds a match. The question list's `ScrollReveal`
  logs a dev-only hydration warning (server `opacity:"1",transform:"none"`, client `opacity:1`); nothing on screen
  differs, and it predates this change.


## Oct 7 2026: the structured data, checked against Google's own rules

Google's rules for every type the site emits were read from its own pages on Oct 7 2026 and kept,
quoted and dated, in `~/.claude/explanations/20261007_structured_data_rules/GOOGLE-RULES.md`. One
page per template (97, from the sitemaps) was crawled and each of its 1,798 nodes checked against
schema.org's published vocabulary and Google's required fields. The checker was probed with six
planted defects first, and caught all six; schema.org's own validator refuses after about 19 pages
from one address, so it can't carry a full pass.

- **The Organization carries what Google lists and we can truthfully fill**: description (the
  one-liner and both halves, `ORGANIZATION_DESCRIPTION`), the WebSite's alternate names, email, the
  filed address (`POSTAL_ADDRESS_PARTS`, which also builds `POSTAL_ADDRESS`) and a
  `disambiguatingDescription` (`DISAMBIGUATION`, also near the top of llms.txt). No phone or tax id
  exists to publish yet; add the EIN as `taxID` once it's issued.
- **`applicationCategory` must be one of Google's 22 app types** (`GOOGLE_APP_CATEGORIES`).
  `WebApplication` is a schema.org type and not on the list; the site is `ReferenceApplication`, the
  calculators `UtilitiesApplication`.
- **Speakable points at elements every article renders once** (`.article-description`,
  `.article-content > p:first-of-type`): "first h2 + p" matched nothing on 8 of 77 articles. It's a
  US, news-only beta for Google; harmless here.
- **List pages are Google's summary shape** (position, url, name). The nested Article stubs with no
  headline, image or author are gone; each article's own page carries the full Article.
- **Kept on purpose:** FAQPage (no Google rich result for anyone since May 7 2026; other engines
  read it), Dataset (only Google's Dataset Search since Nov 5 2025), the homepage and article
  videos (valid, but no video result where the video isn't the page's main content), HowTo on
  guides with steps (no Google result since Sep 13 2023), the app's rating (a SoftwareApplication,
  visible on the page, from users, with a way to leave one).

## Oct 11 2026 (evening): list pages, IndexNow, and pictures that drifted

**List pages open with their answer.** `src/components/data/IndexHeader.tsx` (`IndexHeader`, `IndexSearch`) puts a list's headline figures beside a search box. The box is a plain GET form into the table's anchor with `?q=`, which `FilterableStatTable` reads on load, so it works before any script and the address can be shared. Used on `/perm-employers`, `/perm-attorneys`, `/perm-wages`, `/perm-cases` (its box goes to `/perm-case-status?case=`), `/pwd-cases` and `/lca-cases`. Occupation pages use the employer page's `ProfileHeader`/`Chapter`/`ChapterNav`; `/perm-processing-times` and `/perm-denial-risk` got the part bar.

**IndexNow: changed pages only.** IndexNow's FAQ (indexnow.org/faq, read Oct 11 2026): "Submit only when content has changed. Do not resubmit unchanged URLs", and every URL counts toward the crawl quota. Each deploy had sent all 311,450 sitemap URLs. Now `indexnow.yml` lists the pages the deploy changed since the commit live before it (`gsc_queue.mjs --indexnow-list`: static pages, articles, a changed family's sample pages) and sends those with `indexnow.mjs --urls`; `case-status-direct.yml` sends the employer pages whose live rows moved (`changed-employer-slugs.json`). A manual dispatch still sends everything. Verified on the first live run: 2 pages sent, 200 OK. `indexnow-script.test.ts` holds the file mode (exact pages, nothing for an empty list, nothing off the site), probed red.

**`gsc_queue.mjs` dropped changed articles.** It filtered articles through `scripts/known-routes.json`, which lists only 11 of 55 guides, so most article edits never reached the Search Console queue, the warm list or the Cloudflare purge. An article counts by its file now.

**Pictures drift when their page changes.** 47 article pictures were captured from pages redesigned today. Re-shoot with `scripts/capture_article_heroes.mjs <base> <out> <slugs>` (dev server on production data) then `make_article_heroes.py --captures <out>`, and `shoot.mjs` + `optimize-shots.py` for the page shots. Check each `h:` clip heading still exists: several were renamed. `article-pictures.test.ts` now fails a figure whose `aspectRatio` differs from its file. Read each caption against the new picture: five described something the shot never showed (`shoot.mjs` can't type into a form).

**Two charts that would have lied.** Layoffs by month climbed where each state's coverage began (Texas back to 2019, New York this year), so `/layoffs` draws by publishing state with each state's window. Monthly decisions were 33 horizontal rows; as columns with a dashed median, October 2025's 21 decisions read as the gap they were.

**Capturing production can trip the defense.** Headless page captures of production from this Mac (two widths a page, many pages, plus the 119-page glued-text sweep) made this address the busiest on the site: 795 page requests in 45 minutes, 19 answered busy. With an Amazon-hosted crawler already challenged, the app ran full and the automatic defense put Under Attack Mode on at 6:37 PM EDT Oct 11, so every visitor met a browser check until it stood down. Capture the dev server on production data; capture production only a few pages at a time, and never during a deploy.

**Disk.** The dev server's `.next/dev/cache` grew to 5.9 GB and the disk reached 36 MB free mid-capture (ENOSPC). Stop the dev server and delete `.next/dev/cache` and old capture folders between long QA runs.
