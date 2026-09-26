# Lane C handoff: community timelines, embeds, languages

Worktree `~/cc/pt-build/v2`, branch `build/sep26-everything`. No commits made. Every claim
below was checked by running the named test; nothing here was seen in a browser (lane rule).

## Item 18 + S9: community timelines and RFE reports (DONE)

**What it is.** A person's dates after PERM (I-140 filed and approved, I-485 filed, work
permit, travel document, interview, green card), plus an optional RFE (form, reason from a
fixed list, dates, outcome), and case facts (EB category, country of chargeability, route,
premium, I-140 office). **The PERM half is never typed**: `communityTimelines.verifyCase`
reads DOL's record from Turso (SELECT only, `lib/publicMirror`) by case number: the filing
date from `perm_case_status` (else `perm_cases.received_date`), the certification date from
the disclosure file's `decision_date` when published, else the day our sweep first saw it
CERTIFIED, and only while DOL still says CERTIFIED. **No free-text field exists anywhere**, so
the public board needs no moderation queue. No account: the browser keeps a random 64-hex key
per case in localStorage; only `sha256("timeline-key:" + key)` is stored; whoever holds the key
can edit or remove. `public` (show on the board) is OFF by default; the anonymous medians use
every visible row, and the form says so before saving.

**The board** (`/green-card-timelines`) shows stage medians (bar = middle half, tick = median,
each labelled "DOL's record" or "self-reported" with its count; no median below 5), the board
itself (one row per shared timeline: filing MONTH, category, country, route, and dots placed by
days since PERM filing; no case number, no employer, no exact PERM date) which OPENS only at 25
shared timelines, and RFE reasons and outcomes. The page's Convex read is a public query that
returns only what the page prints.

**The case page** needed NO edit: `src/components/tools/CaseMilestones.tsx` keeps its name
and props and now renders the timeline (a track of reported stops for this case, then the
form, `id="timeline"`, opened by the `#timeline` anchor or when this browser already holds a
timeline). The 14 legacy `caseMilestones` reports still count toward their stops.

**The certified email ask**: `CaseStatusChanged` takes an optional `timelineUrl`; the sweep in
`convex/caseAlerts.ts` passes `${caseUrl}#timeline` only when a PERM case's new status is
exactly CERTIFIED. No new email is sent, so **no Resend ledger line is needed**.

### Files
- NEW `convex/lib/communityTimeline.ts` (pure rules, field lists, medians, RFE summary, board rows)
- NEW `convex/lib/communityTimeline.test.ts` (21 tests)
- NEW `convex/communityTimelines.ts` (save, remove, mine, caseSummary, board [public query],
  setPermHalf, verifyCase, casesToVerify, verifySweep, hide)
- NEW `convex/__tests__/communityTimelines.test.ts` (18 tests; probed: charging a limit before
  the per-case cap read, and storing the raw key, each turned a test red)
- `convex/schema.ts`: new table `communityTimelines` (4 indexes)
- `convex/http.ts`: `POST /timeline/save`, `POST /timeline/mine`, `POST /timeline/remove`,
  `GET /timeline/summary?case=` (+ OPTIONS); body capped at 4,000 characters before parsing
- `convex/crons.ts`: `community-timelines-verify`, daily 09:20 UTC (5:20 AM EDT), at most 100 cases
- `convex/caseAlerts.ts`: passes `timelineUrl` on a PERM certification only
- `convex/_generated/*`: regenerated (dev deployment only)
- `src/emails/CaseStatusChanged.tsx`: optional `timelineUrl` paragraph + button
- NEW `src/emails/__tests__/caseTimelineAsk.test.tsx` (3 tests)
- NEW `src/lib/communityTimeline.ts` (re-export for the browser)
- REWRITTEN `src/components/tools/CaseMilestones.tsx` (the timeline form)
- NEW `src/components/tools/__tests__/CaseMilestones.test.tsx` (5 tests; probed: public
  defaulting on turns two red)
- NEW `src/components/community/TimelineBoard.tsx` (StageMedians, BoardKey, BoardTable, RfeBars)
- NEW `src/app/(site)/(public)/green-card-timelines/page.tsx` (revalidate 6h)
- NEW `src/app/__tests__/green-card-timelines.test.tsx` (4 tests)

`pnpm typecheck` clean; eslint clean on every file above; whole-site gates run: glued text,
descriptions, titles, grids, form controls, social cards, sitemap, hygiene all green.

### Registry lines for the coordinator (item 18)
- **Search palette** (`palette-covers-every-page` is RED until added): `{ label: "Green card
  timelines", href: "/green-card-timelines", group: "Data", keywords: "i-140 i-485 timeline
  community reports rfe premium ead advance parole" }`
- **Sitemap `pages.xml`**: `/green-card-timelines`
- **Rail** (`dataSections.ts`): beside the case lookup, label "Green card timelines"
- **pageCards**: slug `green-card-timelines`, alt "Green card timelines as the people waiting
  report them: PERM dates checked against DOL, the I-140 and I-485 self-reported." Card: a
  motif (no live figure), or a capture of the stage medians once rows exist. The page does NOT
  call `withSocialCard` yet (an unregistered slug fails typecheck); wrap its metadata once the
  slug exists.
- **llms.txt**: "Green card timelines: how long the I-140, I-485, work permit and green card
  took for the people who report them; PERM dates checked against DOL, everything after
  self-reported. https://permtracker.app/green-card-timelines"
- **known-routes.json**: `/green-card-timelines`
- **Navigation / footer**: optional, under Learn or Data.

### Deploy notes (item 18)
- `npx convex deploy` BEFORE the Vercel build: the page's build-time read calls
  `communityTimelines:board`, which must exist on prod (it degrades to a sentence if not).
- Firewall: none. Every new route is on `giant-dragon-464.convex.site`, called from the
  browser, the same as the milestone routes (no Vercel rule sees it).
- After deploy, prove it once: save a timeline on a certified case from the case page, read
  it back, remove it, and check `communityTimelines` holds 0 rows again.

### Unverified
- The form's look at 390px and in dark mode (no browser in this lane).
- The verifier against production Turso (tested against a faked mirror; the SQL matches the
  columns read from production with PRAGMA on 2026-09-26).

## Item 20: everything embeddable (DONE)

**What it is.** 19 embeds at `/embed/<slug>`: the case lookup, 6 estimates, 9 calculators and 3
charts (`src/lib/embeds.ts` is the one list). **An embed is the tool itself**: each route renders
the tool's own page component inside `EmbedFrame`, which hides everything except the section
marked `data-embed="<slug>"` with a CSS `:has()` rule (siblings along the path to the marker are
`display:none`; the wrappers keep width and lose vertical padding). So an embed can't drift from
its page. A title bar names the tool with a "PERM Tracker" link; the footer is the attribution
link "Open the full tool on PERM Tracker" to the full tool. Every link inside a frame opens in a
new tab, and the frame posts `{type:"permtracker:embed-height", slug, height}` to its parent
when its height changes (`EmbedRuntime`). Embed pages are `noindex, follow` (metadata and an
`X-Robots-Tag` header) with the canonical on the full tool, and are in no sitemap.

**Framing.** `next.config.ts`: the global rule keeps HSTS, nosniff, Referrer, Permissions and
COOP; `X-Frame-Options: DENY` and the CSP with `frame-ancestors 'none'` now sit on
`/((?!embed(?:/|$)).*)` (every path except `/embed` and `/embed/*`; `/embedded` still refused),
and `/embed/:path*` gets the SAME CSP with `frame-ancestors *` (one `contentSecurityPolicy()`
function builds both) plus `X-Robots-Tag: noindex, follow`. Tested by loading the real config and
applying its rules with Next's own path matcher.

**The embedded lookup** (`/embed/case-status`, dynamic) is a form and an answer card, not a
framed page section. `src/lib/turso/embedLookup.ts`: it asks DOL live under three caps (this
site 50/UTC day, all sites 5,000/day, then the site-wide discovery budget), and falls back to the
stored record, saying which one the reader is looking at ("Read from DOL just now." / "From PERM
Tracker's record, last checked with DOL <date>." / "Live checks from this site are used up for
today, so this is ..."). **A live answer for a case we already hold is never written**: the
nightly sweep turns a status difference into the event that sends alerts, and a lookup that
wrote first would swallow it. A case we don't hold goes through the ordinary discovery path
(records it, INSERT OR IGNORE), exactly as the site's own lookup does. The site key is the
Referer's hostname on the frame's first load; lookups submitted inside the frame carry it in a
hidden `site` field (spoofable, which is why the all-sites cap exists). Both counters live in
ONE `perm_docs` row per UTC day, `embed_live_<YYYY-MM-DD>` = a JSON map `{all, <site>: n}`, and
the all-sites count is charged before a site entry is written, so the row holds at most 5,000
entries and needs no pruning. Any counter failure means no live ask (stored record, no "used up"
line).

**Gallery**: `EmbedGallery` on `/badges` (`#embeds`), after the badge catalogue: one live frame
of the lookup, then every other embed grouped, each with its snippet, a copy button (the
badges' own `CopyButton`, now exported) and a preview link, then a `<details>` on sizing.

### Files
- NEW `src/lib/embeds.ts` (registry, snippet, `siteKeyOf`, `embedSiteFor`, caps 50 and 5,000)
- NEW `src/components/embed/EmbedFrame.tsx` (`EmbedFrame`, `embedCss`, `embedMetadata`)
- NEW `src/components/embed/EmbedRuntime.tsx` (new-tab links, height messages)
- NEW `src/app/embed/<slug>/page.tsx` x19 (18 import the tool page; `case-status` is its own page)
- NEW `src/lib/turso/embedLookup.ts` + `embedLookup.test.ts` (12 tests, counters run their real
  SQL on in-memory libSQL; probed: a stored case sent through discovery, and the site entry
  charged before the all-sites count, each turned a test red)
- NEW `src/components/badges/EmbedGallery.tsx`; `BadgeCatalogue.tsx` exports `CopyButton`
- `src/app/(site)/(public)/badges/page.tsx`: renders `<EmbedGallery origin={ORIGIN} />`
- `data-embed` markers on 17 tool pages + `/perm-queue` (the BacklogWall wrapper); the
  priority-date page carries two (`priority-date`, and `visa-bulletin` on the bulletin board)
- `src/lib/turso/caseLookup.ts` / `flagCases.ts`: `lookup(..., { discover: false })` option
  (default unchanged; 122 existing lookup tests green)
- `next.config.ts`: framing split as above
- `src/app/robots.ts`: `Disallow: /embed/case-status?` beside `/perm-case-status?`
- NEW tests: `src/app/__tests__/embeds.test.tsx` (36: registry = routes = page markers, each
  route imports the page its entry links, snippet, site key, style-injection refusal, a real tool
  rendered in the frame, the gallery; probed by removing one page's marker),
  `embed-case-status.test.tsx` (5), `embed-headers.test.ts` (9; probed by putting the old `/(.*)`
  back on the framing rule)

`pnpm typecheck` clean; eslint clean. Whole-site gates: my files add no finding. Red right now,
NOT from this lane: glued text / grid tracks / title length on `Eb2VsEb3.tsx`,
`GreenCardLine.tsx`, `SameDayCases.tsx`, `/tools/eb2-vs-eb3`, `/tools/green-card-line`, and the
palette gate for those two routes (plus `/green-card-timelines`, item 18's registry line).

### Firewall changes needed (item 20), for Adam or the coordinator
1. **Rule 4** (20/min per IP on `/perm-case-status?case=`): add `/embed/case-status` with a
   `case` query. Today that path only meets rule 6 (300/min per IP), then rule 12 bypasses it.
2. **Rule 1** (Meta deny on the lookup query): add the same `/embed/case-status?case=` shape.
3. **Do NOT challenge `/embed/*`** (leave it in rule 12's cheap set). My inference, not tested:
   a Bot Protection challenge inside a third-party iframe needs a cookie, and Safari and Firefox
   block third-party cookies by default, so real readers on other sites would be stuck. The caps
   plus rule 4 carry the protection instead.

### Registry lines (item 20)
- **Palette** (optional): `{ label: "Embed a tool", href: "/badges#embeds", group: "Go to",
  keywords: "embed iframe widget calculator website" }` (groups in `SearchPalette.tsx` are Data, Go to,
  Learn, Timelines and calculators)
- **llms.txt** (optional): "Embeds: every calculator, estimate and chart, and the case lookup,
  as an iframe for other sites. https://permtracker.app/badges#embeds"
- **Sitemap / social cards / known-routes**: none; embeds are noindex and not linked from nav.
- **Resend**: no email, no ledger line.

### Deploy notes (item 20)
- No Convex change. The first embedded lookup creates the day's `embed_live_*` row in Turso
  (prod `exec()` rides `TURSO_RW_AUTH_TOKEN`, already set).
- PostHog and Ahrefs load on embed pages too (root layout), so pageviews from frames on other
  sites will count under `/embed/...`. If Adam wants them out, gate on the pathname in
  `src/instrumentation-client.ts`.
- After deploy: `curl -sI https://permtracker.app/embed/rfi-deadline` must show
  `frame-ancestors *` and no `x-frame-options`; `curl -sI https://permtracker.app/tools/rfi-deadline`
  must still show `DENY` and `'none'`.

### Unverified (item 20)
- Seen in no browser: that each of the 18 framed tools shows exactly its tool and nothing else
  (the `:has()` rule on the real DOM), the starting heights, dark mode, and the live frame on
  `/badges`. Worth one pass at 390px and 1440px on the preview before deploy.
- The Vercel edge applying the split headers (tested against Next's matcher, not Vercel).

## Item 22: the guide in five languages (DONE, pending a native-speaker read)

**Page set, and why.** One page per language, each a localized version of
`/guides/waiting-on-your-green-card`: `/zh` (Simplified Chinese, `zh-Hans`), `/es`, `/pt-br`
(`pt-BR`), `/ko`, `/vi`. Each answers the five things the brief named, in order: check your case
(a form that GETs `/perm-case-status?case=`, and what the English result page shows), where DOL's
queue is (live: the analyst-review month, DOL's average days and the PERM wage-request month, as
of DOL's own stamp), the steps after PERM (ETA-9089, I-140 with the 180-day rule and premium
processing, the bulletin, I-485 with I-765/I-131, DS-260; plus "EB-1 and NIW skip PERM"), EB-3
Other Workers, and the bulletin cutoffs for the reader's own column(s) (live: EB-1, EB-2, EB-3 and
EW3, both charts; China + all others for zh, Mexico + all others for es, all others for pt, ko
and vi, with who is charged where by country of BIRTH). Then DOL's 12 PERM status words in
English with a local gloss (each checked against `permStatus.ts` so nothing is invented, NORD
included), what the page can't tell you, and the English pages it links to. The data pages stay
English (the contract's "not machine-translating the data pages").

**Rules held:** `lang` on the content wrapper (the `<html>` stays `en`, as do header and
footer); every figure, date, case number, form name and status word is `translate="no"`; dates
and numbers are formatted by `Intl` in the reader's locale; links to English pages carry
`hrefLang="en"` and say "(English)" in the reader's language; hreflang is one map
(`languageAlternates`) served to all six pages, English guide included, `x-default` = English;
the English guide gained a language switcher above its header. Each language uses the terms its
readers already use (zh: 劳工证, 排期, 表A/表B, 工卡, 回美证; ko: 노동허가, 문호, 적정임금,
비숙련직; vi: lao động phổ thông, ngày chung kết; es: USCIS's own Spanish terms, "usted"). No
dashes anywhere (tested on the rendered text). Vietnamese and Space Grotesk/Inter: next/font
self-hosts every subset and only preloads `latin`, so Vietnamese glyphs are covered; CJK falls
back to system fonts, picked correctly because of the `lang` attribute.

### Files
- NEW `src/lib/i18n/locales.ts` (registry, `languageAlternates`, `displayWidth`, `ENGLISH_GUIDE`)
- NEW `src/lib/i18n/cutoffs.ts` (newest bulletin, the four rows per country)
- NEW `src/lib/i18n/guideData.ts` (server-only, cached: processing times + bulletin, each half
  fails on its own)
- NEW `src/lib/i18n/guide/{types.ts,index.ts,zh.tsx,es.tsx,pt-br.tsx,ko.tsx,vi.tsx}` (typed copy;
  a missing field or language is a type error)
- NEW `src/components/i18n/{LocalizedGuide.tsx,LanguageLinks.tsx,guideParts.tsx}`
- NEW `src/app/(site)/(public)/{zh,es,pt-br,ko,vi}/page.tsx` (revalidate 1 day)
- `src/lib/content/createContentDetailPage.tsx`: `alternates.languages` + the switcher, only for
  a guide in the set (every other article unchanged; tested)
- NEW tests: `src/lib/i18n/__tests__/locales.test.ts` (7), `src/app/__tests__/localized-guides.test.tsx`
  (32: per language, `lang` on the content, untranslated figures, the form, own columns only, own
  script, no dashes, every link resolves, empty-data fallback, title width <= 45 and description
  <= 155 measured with CJK/Hangul counted double, route wiring; glossary keys real; English guide
  names all five back). Probed: dropping `translate="no"` turned 5 red; dropping the English
  guide's `languages` turned 1 red.

`pnpm typecheck` clean; eslint clean. Gates: grid tracks fixed in my file; glue, titles,
descriptions, hygiene, content, contrast all add nothing. The site's title/description gates
read page SOURCE and can't see copy in `src/lib/i18n/guide/*`, which is why the width test above
exists.

### Registry lines (item 22)
- **Palette** (RED until added): group "Learn", one each:
  `{ label: "中文指南 (Chinese)", href: "/zh", group: "Learn", keywords: "chinese 中文 绿卡 排期 劳工证" }`,
  `{ label: "Guía en español (Spanish)", href: "/es", group: "Learn", keywords: "spanish español green card" }`,
  `{ label: "Guia em português (Portuguese)", href: "/pt-br", group: "Learn", keywords: "portuguese português brasil" }`,
  `{ label: "한국어 안내 (Korean)", href: "/ko", group: "Learn", keywords: "korean 한국어 영주권 문호" }`,
  `{ label: "Hướng dẫn tiếng Việt (Vietnamese)", href: "/vi", group: "Learn", keywords: "vietnamese tiếng việt thẻ xanh" }`
- **Sitemap `pages.xml`**: the five paths, and give all six entries (the five + the English guide)
  `alternates: { languages: languageAlternates(path) }` from `@/lib/i18n/locales` (Next's sitemap
  supports it; Google reads hreflang from either place, and matching both is cleanest).
- **Footer / nav**: a "Other languages" line (or a Learn-column entry) listing the five endonyms,
  each with `lang` and `hrefLang`, as `LanguageLinks` renders them. Nothing links the five pages
  today except the English guide's switcher and each other.
- **llms.txt**: "The guide for the person waiting, in Simplified Chinese, Spanish, Brazilian
  Portuguese, Korean and Vietnamese: https://permtracker.app/zh, /es, /pt-br, /ko, /vi"
- **known-routes.json**: `/zh`, `/es`, `/pt-br`, `/ko`, `/vi`
- **Social cards** (optional): the pages fall back to the homepage card (English). A drawn motif
  card per language with its own title would be better; `make-page-cards.mjs` renders in Chrome,
  so CJK and Hangul titles use system fonts there.
- **Firewall**: none (cheap pages, rule 12). **Resend**: none.

### Unverified (item 22), and one question for Adam
- **The translations were written by me directly, not by a translation engine, and no native
  speaker has read them.** Before promoting the pages (nav, social posts), a read by a native
  speaker of each language is the check that matters, Korean and Vietnamese most. Facts were
  checked against the site's own sources; register and idiom were not checked by anyone fluent.
- Seen in no browser: CJK/Hangul headings at 390px, the figure tiles, the switcher on the
  English guide, dark mode.
- TODO for lane B item 19: the which-visa guide isn't built, so it isn't linked (a TODO sits in
  `src/lib/i18n/guide/index.ts`).
