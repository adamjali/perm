# Full search audit of permtracker.app — do all of this, measure everything

Audit and fix everything that affects how permtracker.app appears in Google, in AI answers, and
to any crawler. Don't take my word for any of it — **measure each item and print what you
measured next to the verdict.** A check that can't see its subject reads exactly like a pass.

## Research first

- **Use context7 for the Next.js Metadata API** — `generateMetadata`, the `metadata` export,
  `title.template`, `alternates.canonical`, `robots`, `openGraph`, `icons`, `sitemap.ts`. This is
  a Next 16 App Router codebase and the metadata surface has changed across versions; don't work
  from memory.
- **Use Google's own documentation as the primary source** for anything about search behaviour —
  context7 serves library docs and has nothing on Google. Read the actual pages:
  `developers.google.com/search/docs/appearance/` for site-names, snippet, title-link,
  favicon-in-search, structured-data; and `/crawling-indexing/` for canonical, sitemap,
  url-structure, robots.
- Search the web for anything current that the docs don't settle. State which claims are Google's
  own words and which are third-party.

## What to check, and how

### 1. Enumerate from the sitemap, never from memory
```bash
curl -s https://permtracker.app/sitemap.xml | grep -o "<loc>[^<]*</loc>" | sed 's/<[^>]*>//g'
```
31 URLs as of 2026-08-24. **Audit every one.** I previously audited 16 of them and reported the
site "clean" — the 15 I skipped held every real defect. Print the count you actually checked.

### 2. Titles and descriptions, every URL
- title ≤60 characters (`layout.tsx` appends `" | PERM Tracker"`, which costs 15 of them)
- description ≤155 characters — past that Google truncates mid-sentence
- no duplicates of either across the site
- every indexable page has both
- `noindex` pages are exempt; confirm which are `noindex` rather than assuming

### 3. Which text Google is ACTUALLY using
This is the one that bites. Google may ignore your description entirely and assemble the snippet
from the top of the page body. On a sibling site the SERP read
*"Junk removal, demolition and cleanouts (904) 556-0314 North East Florida. Call or text
(904) 556-0314 (904) 556-0314"* — four phone strings, all from the header chrome.

- Extract the visible text of each page, find the H1, and **count how many times the primary CTA
  and any phone/email appears before it. Two is the ceiling.**
- If a real SERP snippet looks wrong, **trace each fragment to a character offset in the page**
  before changing anything. Fixing description length is wasted work if the description was never
  in play.

### 4. Glued text — React ships this by default
JSX removes a newline sitting between two tags, so `<A/>` newline `<B/>` renders with **zero
characters between them** and every DOM walker reads one run. Google's snippet extraction is
`textContent`-shaped and ignores CSS layout — proven, it printed a flex-column pair glued in a
sibling site's listing.

permtracker read `BlogTutorialsGuidesChangelogResources` and `Sign InSign Up` until this was
fixed. **Re-verify it stayed fixed, and check the pages I could not reach**, especially
`/tools/*`, `/blog/*`, `/guides/*`, `/tutorials/*`, `/resources/*`:
```bash
python3 ~/.claude/skills/site-forge/scripts/fix-glued-text.py <dir-of-fetched-html> --check
```
Three shapes produce it: `</Tag>` newline `<Tag`, `)}` newline `{cond &&`, and a `.map()` (React
renders array items with nothing between them — needs a Fragment carrying the key plus a trailing
`{" "}`). A fourth is a text node running straight into an opening tag: `Label<small>Detail`.

### 5. Site name
Google's `WebSite` structured data is the primary signal, but it falls back to the bare domain
"if our system is less confident in a name you provided", corroborating against `og:site_name`,
the `<title>`, headings and other homepage text. Verify all of those agree. permtracker looked
correct when I checked; confirm nothing has drifted.

### 6. Favicon
Google requires a square favicon, recommends **larger than 48×48**, and requires that
**Googlebot-Image** can crawl it. Declare the sizes the file really contains — an `.ico` holding a
48px frame but marked `sizes="32x32"` tells Google 32. Verify with the right agent:
```bash
curl -A "Googlebot-Image/1.0" -o /dev/null -w "%{http_code} %{content_type}\n" https://permtracker.app/favicon.ico
```
Keep the favicon URL stable — do not cache-bust it.

### 7. Structured data
Validate every type actually emitted (`WebSite`, `Organization`, `SoftwareApplication`, `FAQPage`,
`BreadcrumbList`) against Google's structured-data docs and the Rich Results Test. Check the
calculator pages specifically — a tool page may qualify for types it isn't using. Never invent
`aggregateRating` or review markup about your own product; Google doesn't support self-serving
review snippets and it's a manual-action risk.

### 8. Crawlability and AI answers (AEO)
- `robots.txt` reachable, names the sitemap, blocks nothing it shouldn't
- no stray `X-Robots-Tag` headers
- fetch as `Googlebot` and confirm 200 and full content — this is an SSR app, so check the HTML
  actually contains the copy rather than an empty shell
- confirm GPTBot, ClaudeBot, PerplexityBot, Google-Extended and CCBot are **not** blocked, since
  the goal is to be quotable in AI answers
- every canonical is self-referential and absolute; no cross-page canonical mistakes

### 9. Internal linking and orphans
Count inbound internal links per URL. **A page linked only from its siblings, or only from a
noindexed 404, is an orphan** — that happened on a sibling site and took five landing pages out of
the crawl. A JS-driven list is not internal linking; if data lives in a `<script type="application/json">`
block, the crawlable `<a>` elements have to exist separately.

### 10. Performance and Core Web Vitals
Run Lighthouse via `npx --yes lighthouse@latest`, one instance at a time. Never compare scores
across environments — same machine, two builds, or the number is meaningless.

## How to work

- **Measure, don't assert.** Every claim gets a number or a quote from a primary source next to it.
- **Print what you inspected before any verdict** — how many URLs, how many elements.
- **Probe every check you write with a deliberately broken input** and confirm it fails. A new
  checker's first run is usually mostly false positives; sample before quoting a total.
- **Beware stale build output.** `.next` caches hard; wipe it before trusting a measurement, and
  kill any orphaned `next-server` (it holds `.next/lock` and makes the next build fail with "a
  previous build that didn't exit cleanly").
- **Screenshots from an automation tab do not composite images** — every photo comes back a grey
  box while the image is provably loaded. Use headless Chrome for anything a human will look at.
- **Don't promise rankings.** You can verify technical correctness. Whether Google shows a site
  name, a sitelink or your description is Google's decision and can take days to weeks.

## Deliver

A list of what you measured, what was wrong, what you changed, and what you deliberately left
alone with the reason. Re-run every check afterwards and show the before/after numbers.
