# The public site: pages, layout, pictures and copy

How the public pages are built and the defects found in them: glued text, iPhone layout, motion and loading states, the header and data rail, charts, social cards and pictures, articles, calculators, the employer and list pages.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## SEO: JSX glues adjacent element text (2026-08-23)

`<A/>` newline `<B/>` in JSX renders with **zero characters between them**, so
`Blog` + `Tutorials` reads as `BlogTutorials` to anything that walks the DOM.
Google's snippet extraction is textContent-shaped and ignores CSS layout — proven
the same day, when it printed the identical defect verbatim in a sibling site's
search listing. permtracker.app had **624 joins across its 11 public pages**; they are
**fixed and gated**. Re-verified live 2026-08-27: 44 pages scanned from the
sitemap, **0 glued pairs**, and the sweep prints a control string so a blind
run cannot read as a pass. Full recipe, scope and verification loop:
[`v2/CLAUDE.md`](v2/CLAUDE.md), section "Glued JSX text".

**The source-level gate is not the authoritative one** - it cannot see
`.map()` output, custom components, `motion.*`, or conditionals. Run
`scripts/audit_glued_text.py` against rendered pages.


## SEO: JSX glues adjacent element text, and Google reads it (2026-08-23)

JSX removes a newline that sits between two tags, so perfectly formatted source

```tsx
<NavLink href="/blog">Blog</NavLink>
<NavLink href="/tutorials">Tutorials</NavLink>
```

renders as `>Blog</a><a …>Tutorials` with **zero characters between them**.
Anything that walks the DOM reads one run. `permtracker.app` currently serves:

```
PERM TrackerHomeProcessFeaturesFAQDemoLearn BlogTutorialsGuidesChangelogResources Sign InSign Up
```

**This is not theoretical.** On the same day, Google's search listing for a
sibling site printed the identical defect verbatim — a flex-column brand lockup
came out as "North East FloridaJunk Removal". Measured with a browser: the glue
is absent from `innerText` and present in `textContent`, so **Google's snippet
extraction is textContent-shaped and ignores CSS layout entirely.**

**Scope: 624 joins across the 11 public pages.** The authenticated app is behind
a login and is never crawled, so it is out of scope on purpose — there are 1,804
sibling boundaries codebase-wide and touching them all is churn for no benefit.

**The fix, by shape:**

| Shape | Fix |
|---|---|
| `</Tag>` newline `<Tag` | `{" "}` between them |
| `)}` newline `{cond &&` | `{" "}` after the `)}` |
| `.map(x => (<NavLink key=…/>))` | wrap in `<React.Fragment key=…>` with a trailing `{" "}` — React renders array items with **nothing** between them, so a separator has to be part of each iteration |

Every affected container here is flex with a `gap`, so the inserted space is
visually inert. Verify by measuring the rendered header before and after.

**Check it with:**

```bash
pnpm build && pnpm start
for p in "" demo blog tutorials guides changelog resources faq contact privacy terms security tools; do
  curl -s -o "/tmp/pt/${p:-index}.html" "http://localhost:3000/$p"; done
python3 ~/.claude/skills/site-forge/scripts/fix-glued-text.py /tmp/pt --check
```

**Two traps found while doing this.** `.next` caches aggressively — wipe it
before trusting a measurement. And a stale `next-server` holds `.next/lock` and
makes the next build fail with "a previous build that didn't exit cleanly";
`pgrep -f next-server`, then kill by PID.

**Status: NOT FIXED.** The work was reverted mid-session by a concurrent Claude
session in this repo. The recipe above is complete and verified against the
build; it needs one uninterrupted pass.

---

## One cookie read in the root layout made the ENTIRE site dynamic (2026-08-26)

`ConvexAuthNextjsServerProvider` wrapped the root `src/app/layout.tsx`. It reads
the session cookies, and **a cookie read in the root layout opts every route in
the app out of static rendering** - including a public marketing page that never
mentions auth.

**Measured on the live site before the fix:** every public page served
`cache-control: private, no-cache, no-store`, `x-vercel-cache: MISS` on every
request, and the build's route table was `ƒ` end to end. `export const revalidate`
was set correctly on those pages and was being silently ignored, because a
dynamic route has nothing to revalidate.

**It explained three separate open bugs at once**, which is why it went
undiagnosed for so long - each looked like its own problem:
- **"Blank white page instead of the preloader" on first navigation.** No HTML
  existed yet; the browser was waiting on a server render. No curtain can paint
  before the document does. Four earlier preloader fixes were all aimed at the
  wrong layer.
- **Vercel Fluid CPU at 77% of the plan cap.** Every visit paid a full server
  render plus its Turso queries.
- **"ISR isn't working"** despite `revalidate` being set on every data page.

**The fix is scope, not configuration.** Convex Auth's own docs say to wrap
"the parts of your app that interact with Convex functions" - the provider now
wraps `(site)/(auth)` and `(authenticated)` only. Verified by the route table
flipping to `○` with 1d revalidation across the public tree, and on the deployed
site by `x-vercel-cache: PRERENDER` then `HIT`.

**The general rule: anything in the root layout that reads cookies, headers, or
`searchParams` makes the whole app dynamic.** Check the built route table for
`ƒ` on pages that should be static, and check `cache-control` on the deployed
site - a page that should be prerendered and says `no-store` is the tell.

## Next 16 renamed middleware to proxy, and the export counts too

`src/middleware.ts` became `src/proxy.ts` and `export default` became a named
`export const proxy`. This repo had done the first half and not the second, and
the symptom is nasty: **`next dev` works, `next build` compiles all 59 pages,
and then `Collecting build traces` dies with ENOENT on
`.next/server/proxy.js.nft.json`.** Next emits `middleware.js` down the legacy
path for a default export while the tracer keys off the FILE name and looks for
`proxy.js`.

**A warm `.next` hides it entirely.** A stale `proxy.js.nft.json` from an older
build satisfies the tracer, so the failure only appears on a clean build, which
is what CI and a fresh clone do.

Convex Auth still documents only the default export, so export both from one
handler:

```ts
const handler = convexAuthNextjsMiddleware(...);
export default handler;      // Convex Auth's documented shape
export const proxy = handler; // what Next 16 looks for
```

Verify by `rm -rf .next && pnpm build` and confirming `.next/server/proxy.js`
and `proxy.js.nft.json` exist. `middleware.js` present instead means it is
still on the legacy path.

---

## Glued JSX text: the defect that keeps coming back

JSX strips the whitespace between two elements on separate lines, so

```jsx
<p>Petitions waiting</p>
<p>{count}</p>
```

reaches the DOM as `Petitions waiting89,215` to every extractor that walks it.
CSS hides it because the children are block or flex, so it is invisible in a
browser and wrong everywhere that matters. Google has reproduced the glued form
verbatim in a search listing.

It came back twice in one session: a sweep fixed 609 across the app, then a new
component introduced four more days later, then the gate written to catch that
missed six more because it scanned the components and not the pages. Fix is an
explicit `{" "}`. Gate is `no-glued-jsx-text.test.ts`, and it asserts it scanned
a plausible number of files first.

**Verify on the BUILT page, not the source.** The count that matters is what an
extractor reads out of the rendered HTML.

### A source-level gate cannot see most of it (measured 2026-08-24)

`no-glued-jsx-text.test.ts` reported clean while **153 real pairs** were being
served, and the live site was serving **172** — among them
`PrivacyTermsSecurityContact` in the auth footer and
`All2026auditbest-practices` on every content index. Five blind spots, four of
them structural and unfixable in a source scan:

| Shape | Why the pattern misses it |
|---|---|
| `{items.map(...)}` | the glue is between ARRAY ELEMENTS; there is no newline between two tags in the source at all |
| `<NavLink>`, any custom component | not in any HTML tag list |
| `<motion.h1>` | renders an `<h1>` under a dotted lowercase name |
| `</p>{cond ? (…) : null}<p>` | the next token is `{`, not `<`, and the glue only exists in the branch that renders nothing |
| `</h3>{/* Consequence */}<p>` | a comment renders nothing but stops a whitespace-only pattern matching. **House style here: 26 pairs across 21 files hid behind it.** |

The gate now handles comments and `motion.*`. It still cannot see the other
three, so **the authoritative check is the rendered one**:

```bash
pnpm build && PORT=3100 pnpm start
python3 scripts/audit_glued_text.py --base http://127.0.0.1:3100   # exit 1 on any
```

Two things that script gets right and an obvious version does not. **Adjacency
is not glue** — two icon-only links have no text between them and are fine, so
it requires a word character on BOTH sides; a first pass without that reported
293 where 153 were real. And **read forward from AFTER the opening tag**: an
earlier version started inside it, so the first character was always `>` or a
space, and it reported zero over a page with fourteen pairs. It was caught by
probing with six fixtures, three that must match and three that must not.

**Fix for a `.map()` is a keyed `Fragment` with a leading `{" "}`.** A
whitespace-only text node between flex or grid items is not rendered as an item,
so it costs nothing visually.

**Scope is public pages.** The authenticated app is behind a login and is never
crawled. Extending the gate to every capitalised component tag produces **517
findings across 118 files** and a sample showed most are `</FormField><FormField>`
and `</Section><Section>` block containers — a noise count, not a defect count.

---

## A form control overflowing on iOS is the ANCESTOR's fault, not the control's

Reported three times from Chrome on iOS: the date fields on a calculator page
run past the card's right border and off the screen. Desktop measures the same
elements as perfectly inside their container.

**The first two fixes were wrong, and they were wrong in the way the whole
internet is wrong about this.**

### `min-w-0` on the control is a no-op

WebKit's UA stylesheet (`Source/WebCore/css/html.css`) sets, for every temporal
input:

```css
input:is([type="date"], [type="time"], [type="datetime-local"], …) {
  display: inline-flex;
  overflow: hidden;
}
```

So the control is a flex **container**, not a flex **item** — and `min-width:
auto` only resolves to a content-based minimum for flex and grid *items*. On
anything else it is already `0`. Worse, the popular "date inputs have a large
intrinsic minimum" story is false: because that `overflow: hidden` sits on the
element itself, its automatic minimum size is **0** in both engines
([csswg-drafts#6347](https://github.com/w3c/csswg-drafts/issues/6347)).

`min-w-0` earns its place on an **ancestor that really is a grid or flex item**.
Never on the control.

### The actual cause: a grid with no mobile column track

Thirty-one grids across the app declared only `md:grid-cols-3` or
`sm:grid-cols-2`. Above the breakpoint that is `repeat(N, minmax(0, 1fr))`,
which cannot exceed its container. **Below it there is no
`grid-template-columns` at all**, so items land in an implicit column sized by
`grid-auto-columns: auto` — a content-sized track.

Phone-only, and invisible from a desktop twice over: desktop sits above the
breakpoint, and a narrowed desktop window still renders in Blink, where a date
control's content contribution is small. WebKit sizes that control from its own
stylesheet, its own padding and `system-ui`.

Two utilities, doing two different jobs. Both are required:

| Utility | Floors | Why the other is not enough |
|---|---|---|
| `grid-cols-1` | the **track** → `repeat(1, minmax(0,1fr))` | a grid *item*'s own `min-width: auto` still resolves to a content minimum inside a floored track |
| `[&>*]:min-w-0` | the **items** | a content-sized track overflows no matter how small the items are willing to go |

Applied from the container rather than by editing every wrapper `<div>`, so it
cannot miss one. Verify the arbitrary variant actually compiled —
`.\[\&\>\*\]\:min-w-0>*{min-width:0}` must be in the built stylesheet. One
that fails to generate leaves an inert class behind and looks exactly like a fix.

Scope is **files containing a form control**, because that is where the content
contribution comes from the user agent rather than from us. Text is not in
scope: it wraps, so its min-content is one word.

### Do not paste the blog-post CSS on top of Preflight

An earlier draft added Bootstrap's `::-webkit-datetime-edit { display: block }`
and `::-webkit-date-and-time-value { text-align: left }`. **Tailwind v4's
Preflight already ships a better version:**

```css
::-webkit-date-and-time-value { min-height: 1lh; text-align: inherit }
::-webkit-datetime-edit       { display: inline-flex }
```

`text-align: inherit` beats iOS's UA `center` *and* survives RTL, which `left`
does not; `inline-flex` + `min-height: 1lh` is a deliberate vertical-centring
pair. Because author rules in `globals.css` land after Preflight, those
overrides **won** — the "fix" would have undone it. Bootstrap's recipe is
written against a vanilla baseline. Only `max-width: 100%` is kept, which
Preflight does not set.

`appearance: none` is deliberately unused: it defeats native control sizing but
drops the themed height ([ionic#28495](https://github.com/ionic-team/ionic-framework/pull/28495)),
and the `width: 100%` bug it works around is reported fixed in iOS 18.

### This cannot be reproduced locally, and that is not a shortcut

Playwright **refuses to install WebKit on macOS 12** (this machine). There is no
iOS simulator without Xcode, and macOS Safari takes the non-iOS branch of that
same UA stylesheet. Ionic hit the identical wall and said so: their Mobile
Safari emulation did not reproduce the on-device rendering either. Blink can
prove *no regression* and that nothing in the chain refuses to shrink. It cannot
prove the fix.

The way out is measurement on the device. Two instruments exist; use the
second first:
- `src/components/diag/ViewportDiag.tsx` ships in the public layout, inert
  until the URL carries `?diag=1`, then prints viewport truth (including
  `visualViewport.scale` — silent iOS zoom), every element wider than the
  viewport with the true source marked `ROOT>`, and the date field's ancestor
  chain. This is what actually settled the bug: one screenshot from the phone
  named the input itself, at 412px inside a 356px parent, `minw=107px`.
- `scripts/diag_proxy.py` (deleted Oct 1 2026) did the same via a LAN proxy of the local build —
  but this machine's firewall blocks inbound connections, which is exactly how
  the LAN route failed. Prefer the deployed `?diag=1`.

Gates: `form-controls-min-width.test.ts` and `responsive-grid-tracks.test.ts`.
The second one's first version matched `sm:grid-cols-2` as though it defined the
mobile track and reported every affected file clean — it now requires an
**unprefixed** `grid-cols-*`. It was also green over an unfixed file that had no
form control, which nearly read as proof it worked; fixer and gate now share one
scope.

## Calculator tools: warnings above results, withhold on nonsense

The 2026-08-24 audit standard for the /tools suite, now pinned by
`PermDeadlineCalculator.test.tsx`:

- Free-text date tools guard shape (`DATE_RE` + try/catch) and ride
  `DateInput`'s 1900-2100 clamp. Everything else is select-driven so invalid
  input cannot exist.
- **Cross-field nonsense warns and withholds rather than computing quietly.**
  Reversed recruitment order still yields plausible-looking dates
  (opens=last+30, closes=first+180 usually keeps opens<closes), so without an
  explicit warning nothing ever LOOKS wrong. The warning band renders ABOVE the
  date rows: a date computed from suspect input must not read as more
  authoritative than the doubt about the input.
- Every data-fed view keeps an empty state linking the primary source, for the
  deploy-skew window.

## Extract shared logic the SECOND time, not the third

Evenly spaced chart ticks were written out twice. The label collision was found
and fixed on one chart, and came straight back on the other because the logic
had been duplicated rather than shared. Two callers is enough.

---

## A chart legend that says the opposite of what it draws (2026-08-25)

The priority-date chart drew a shaded bar for every month with no plottable
cutoff, at two opacities, and captioned all of them as *"a month with no visa
numbers at all"*. But there are **two non-date states and they are
opposites**: `C` means the category was open to EVERY priority date, `U` means
it was shut to all of them. The lighter bar meant the exact reverse of what
the caption said, on 20 of 60 category/country combinations.

**Two shapes that differ only in opacity will get one caption.** If two states
need different words, give them different colours. They are now lime and rust
with a `<title>` each, and the caption names both.

The same file joined its cutoff points into one `<polyline>`, so a run of
closed months was bridged by a smooth rising segment — drawing movement
through a period when the category was shut and nothing moved. **A gap in a
series is a BREAK, not a point to interpolate through.** Split into segments
at every gap.

## An axis label belongs at its own coordinate

`DeadlineWindowDiagram` drew the right-hand rail LINE at `px(lastDate)` and
its LABEL at a fixed `W - PAD.right`. Whenever the filing window was not
capped by the wage expiration — the ordinary case — the label sat **204 units
away from the date it named**, printed under a different date that the axis
never labelled at all. On a page headed "These are not estimates."

**A line and its label are one thing and share one coordinate.** They were
only ever correct when the two dates coincided.

## The public IA is two audiences with mirrored priorities (2026-08-28)

Beneficiary order: track my case -> alerts -> data -> the app. Attorney
order: the software -> track a case -> data. Structural consequences:
- The homepage hero is a GET form into `/perm-case-status?case=` (no client
  JS; the page's existing shareable contract). The stage-aware estimate
  (`src/lib/caseEstimate.ts`, composing `estimateQueueDecision` with
  `queueForecast`'s measured stage percentiles) renders on the case page
  under the federal record, labeled "Estimate - not a promise", with the
  alert form directly beneath. Appeals get a refusal with the measured age.
- The practitioner pitch lives WHOLE on `/for-attorneys`; the homepage
  keeps a slim panel. Do not move attorney-addressed H2s back to the
  homepage: heading structure is what answer engines aggregate into "what
  this product is", and that exact defect is why AI overviews called this
  attorney-only software.
- One nav on every public page (`PUBLIC_NAV_LINKS`), plus the Cmd+K palette
  (`src/components/search/`) over pages, tools, articles and the entity
  `?q=` route, with case-number and YYYY-MM detection. The palette lazy-
  loads on first open; keep it that way.
- `PageBasics` (`src/components/data/PageBasics.tsx`) is the educational
  layer on the data pages: visible Q&A prose, questions phrased the way
  people search ("approved", "audit"), stats dated. Schema-only facts score
  zero retrievals in the best published test; FAQPage markup is dead as a
  Google lever (May 2026) - visible text is the mechanism.

## A loading.tsx above a segment makes every notFound() a soft 404 (2026-08-28)

Measured live: junk entity slugs answered HTTP 200 with a "not found" body
and an injected noindex - each one a cold render feeding the Vercel bill.
Any loading boundary above a segment makes Next stream "200 OK" before page
code runs, after which `notFound()` thrown ANYWHERE - **generateMetadata
included; the first fix assumed metadata beat the stream and measurement
said no** - swaps the UI but never the status.

Three mechanisms fix it, all shipped and pinned by
`src/app/__tests__/not-found-status.test.ts`:
1. Content routes (blog/guides/changelog) export `dynamicParams = false` -
   the slug set is complete at build, so junk 404s with no render.
2. Entity + queue-month routes throw `notFound()` in `generateMetadata`
   (the earliest decision point).
3. The shared `(public)/loading.tsx` is GONE - it was also a stale HOME
   skeleton flashing under every data page. Only `/perm-case-status` keeps
   a segment-local one (genuinely dynamic, ~0.7s, no miss state that needs
   a status code). Removing it exposed one `useSearchParams()` without its
   own Suspense (the boundary had been masking it) - budget for that when
   removing any shared boundary.

The wire check is the only real one: `curl -sI` junk + control URLs on a
CLEAN build (`scratchpad/status-matrix.sh` pattern: 8 junk must 404, 7
controls must 200).

## The RSC payload model is INVERTED, and I shipped on the wrong one

Half a cached entity page is the RSC flight payload (**163 KB of 330 KB,
49.4%**; most frequent keys `className` x846, `children` x711, `style` x197).
The intuitive read is that a component with no interactivity is "stored twice"
and converting it to a server component halves the page. **Backwards:**

| | in the payload |
|---|---|
| **client** component | a compact client REFERENCE (module id + props) |
| **server** component | its FULL rendered element tree, serialized |

Converting markup-heavy `Footer` client -> server made **every page bigger**:

    /tools            181,750 -> 191,266 B   +9,516
    /perm-queue       295,935 -> 305,451 B   +9,516
    /perm-wages/...   338,201 -> 347,581 B   +9,380

Identical +9,516 on two unrelated routes = the component's constant per-page
cost, **+1 write unit on every page**. Reverted; the full account is in
`Footer.tsx`. **The payload shrinks by rendering less, not by moving
boundaries.** The "~25% available" estimate that motivated this is retired, and
the "2%" once claimed for `QueueMonthChart` was probably noise against a
differently-dated production build.

## `@phosphor-icons/react`'s main entry is client-only

It calls `createContext` at module scope for its `IconContext`, so **a server
component importing it fails the build** with
`TypeError: (0 , d.createContext) is not a function`, naming webpack bootstrap
and no source file. Use **`@phosphor-icons/react/ssr`**, which ~60 files here
already do.

Finding it took four builds of guessing and then one pass of evidence: take the
module id from the frame, locate it in `.next/server/chunks/*.js`, and read what
it requires. **The stack names the IMPORTER, not the thrower.** Do not iterate
on production builds to find this class of bug.

**There are ZERO real cases of this in the codebase** (measured 2026-09-02):
118 value imports of the main entry, none from a server file; 58 value imports
of `/ssr`; 4 type-only imports of the main entry, which are erased at compile
and emit no runtime require.

I previously recorded `chat/tool-icons.tsx`, `empty-states/EmptyState.tsx` and
`error/ErrorDisplay.tsx` here as dormant traps. **That was a false positive** -
all three import the main entry as `import type { Icon as PhosphorIcon }`, and
two already take their value icons from `/ssr`. The detector did not separate
`import type` from `import`, the same distinction applied correctly to
`convex/react` in the same session. When auditing, match
`^\s*import\s+(?!type\s)` and intersect with files lacking `"use client"`.

**Related and kept: 25 modules had no client boundary of their own** (6 found by
walking the import graph from server entry points, 4 calling `createContext`
directly, 19 with value imports of `convex/react`). They worked purely by
inheriting somebody else's boundary. A type-only importer,
`cases/detail/case-detail-types.ts`, correctly needs nothing - type imports are
erased at compile, so a blanket fix would have been wrong there.

## The header publishes its own height, and it is not 71px (2026-08-31)

`AuthHeader` measures itself with a ResizeObserver and publishes two variables.
Nothing may hardcode the header height again; treat a surviving `4.5rem` or
`71px` as a bug.

| variable | value | consumers |
|---|---|---|
| `--site-header-h` | **live** | the mobile data drawer and its handle - things that hug the bar |
| `--site-header-max-h` | never shrinks | `main` padding in `(public)` and `(auth)`, the sign-up split's `100dvh` arithmetic, the desktop rail's sticky offset |

**Why it cannot be a constant.** Measured on `/tools` across twelve widths:
**99px at 320-390** (the logo lockup wraps), **71px at 414-768**, **99px again
at exactly 1024** (the desktop nav appears and wraps), **71px at 1440** - and it
shrinks on scroll (`py-3` -> `py-1.5`, so 99->87 and 71->59) and shifts with the
security banner. Content-dependent at both ends, so no media query encodes it.
The 1024 case was a live desktop defect nobody had noticed.

**Why two variables.** A reservation that followed the live height would reflow
the entire page on every scroll. `main` previously reserved 72px for a bar that
is 99px on a phone; nothing was clipped only because every page adds its own top
padding, so it was absorbed by accident rather than by design.

**`ro.observe(el, { box: "border-box" })` is load-bearing.** A ResizeObserver
watches the CONTENT box by default and this bar shrinks by changing its own
padding, so the observer never fired: the variable sat at 99 while the bar was
87, and the drawer floated 12px below the header with the page showing through.
`offsetHeight` was already correct - only the observed box was wrong, which is
why reading the code found nothing.

**A width change resets the high-water mark**, since a ResizeObserver alone
cannot lower one.

## The data rail, and why each part of it is shaped that way (2026-08-30)

`DataNav.tsx` is gone. `dataSections.ts` (the map) + `DataRail.tsx` (the rail) +
`DataShell.tsx` (mounted in the public layout) replace it, and pages no longer
pass an `active` prop - `sectionForPath()` derives it, longest match first.

The redesign came out of "ugly lazy low effort ai slop", and every decision in
it was a defect first:

- **A full-height spine, not a card.** The column `self-stretch`es with one
  right border; the nav inside is `sticky`. The first version was a bordered box
  that ended two thirds down the page over a tall empty column, and
  `railLeft: 0` measured true the whole time. A screenshot showed the card.
- **The current tab is a rectangle from the screen edge crossing the spine**,
  the same shape whether it is Overview or a leaf. The label keeps its indent;
  that is what says "inside this group". Size carries the hierarchy instead.
- **The group's lime marker shows only while the group is SHUT.** Open, it sat
  above an already-lime leaf and read as fill leaking out from behind the header.
- **NO `overflow-y` on the desktop nav.** One axis set to `auto` makes the other
  `auto`, which clips the protrusion the whole design is built on. The rail is
  at most Overview plus five groups plus one open group, so it fits.
- **Each group's `<ul>` is 16px wider than the rail** (14 of reach + 2 of
  shadow) so the current tab can cross the clip box that makes the `0fr`
  collapse work. Its bottom padding is conditional on `isOpen`, or a shut group
  leaks 2px of lime - `overflow` clips at the padding box.
- **Collapsible on desktop, default open, and it PUSHES**: 272px -> 48px with
  the content on `flex-1` taking the space back. Collapsed, the column drops its
  border, because a full-height rule down 48px of nothing reads as a leftover.
- **Mobile is a drawer at `z-[60]`, above the header's `z-50`.** A 44px caret
  handle at `top-[72px]`; the tap-target floor is why it cannot shrink into the
  41px gap under the header, and `max-lg:pt-3` on the shell buys the rest. Open,
  the handle rides to the top of a drawer that reserves `pt-[72px]`, so no
  selected row can ever sit beside it.
- **Sticky `top` must equal the column's own top** - `calc(4.5rem + banner)`,
  the same expression `main` pads by. At 5rem the rail drifted for the first 8px
  of scroll. Desktop also sets `overscroll-behavior-y: none` **only at `lg`+**:
  the root-level version was deliberately removed once because it kills
  pull-to-refresh, which is a touch gesture.
- **`lg:flex`, never bare `flex`, on the shell.** As unconditional flex the
  mobile disclosure became a flex sibling of the article and the nav measured
  32,268px tall.

## A `route.ts` may export ONLY the known handler names

An extra export fails Next's route type generation:

```
Property 'DOL_PAGES' is incompatible with index signature.
  Type 'readonly [...]' is not assignable to type 'never'.
```

**It appears only in `next build`, after a full compile.** `pnpm typecheck`,
`next dev` and the tests all pass, because the error is generated against
`.next/types/...` which does not exist until the build makes it. Put a shared
constant in a sibling module instead - `api/revalidate-dol/paths.ts` beside its
route, the same way `api/chat/create-tools.ts` does.

## The article set, and the defect that caused it (2026-09-03)

Google's AI Mode told Adam, twice and confidently, that this site cannot look
up a pending prevailing wage case by its `P-` number, and that DOL hides
pending PWD records from the public. Both are false. **It reached that
conclusion by reading our own pages**, which makes it our defect and not its.

An audit of 34 live pages found **41 places where a reader, or a machine, would
form a wrong belief about what we can do.** The worst was the homepage FAQ
answer to "What exactly does PERM Tracker do?" saying "check any PERM case
number" - the single passage an answer engine is most likely to lift as the
product definition. All 41 are fixed in `e424f38a`.

**The other half is saying it out loud.** `content/guides/` now carries 37
pieces: twelve capabilities with an explainer and a walkthrough each, plus one
overall guide for the person waiting. The rules that keep them honest:

- **Every article states what it CANNOT tell you.** That section is why the
  rest is believable, and it is checked.
- **Screenshots are captured, not pasted.** `scripts/shoot.mjs` shoots the live
  site one browser at a time (parallel headless Chrome has crashed this machine
  twice) from `scripts/article-shots.json`; `scripts/optimize-shots.py` takes
  retina PNGs to WebP, measured at 55.7 MB -> 1.91 MB. Re-run both when the UI
  changes, or the figures become lies.
- **A viewport shot, not a full-page one.** The first run captured whole pages
  and produced strips up to 13,552px tall; 24 of 26 were unusable as a figure.
- **`scripts/audit_articles.py` is the gate** and it must stay aligned with
  `content-frontmatter.test.ts`, which caps descriptions at 155. The two
  disagreed on the first run (160 vs 155) and the repo's suite caught it.

**THE GATE'S FIRST RUN REPORTED 26 PROBLEMS AND 8 WERE THE GATE**, which could
not distinguish an article ASSERTING "real time" from one denying it or
debunking the myth. It now understands negation, and three accurate uses are
classified with a written reason each, with the count printed so the exception
list cannot grow in silence.

## Motion's `initial` is an SSR inline style, and it hid the whole site (2026-08-31)

`initial={{ opacity: 0 }}` is not a client-only instruction. Motion serializes
it as an **inline style during server rendering** so the element does not flash
before hydration. Put one on a wrapper around `{children}` and the prerendered
HTML ships that content invisible.

`PageTransition` did exactly that in the public layout. Measured on the live
site:

    <main id="main-content" ...>
      <div style="opacity:0;transform:translateY(8px)">   <- 266KB of 296KB

**90% of every page's bytes, on all ~298 sitemap URLs.** Three consequences,
and only the first is a performance problem:

1. FCP/LCP gated on the whole JS bundle, for a page whose HTML arrived at
   20ms. PageSpeed mobile: FCP 3.0s, LCP 5.8s, **element render delay
   2,470ms**, TTFB 20ms. The server was never the problem.
2. With JS disabled or broken the page is permanently blank below the header.
   A decoration had become a hard dependency for reading the site.
3. **Invisible on desktop**, which scored 96 with the defect fully present.

It was in three separate places, each needing a different fix:

| Component | Shape | Fix |
|---|---|---|
| `PageTransition` | entrance, wraps every page | `initial={mounted ? {...} : false}` |
| `ArticleHeader` / `ArticleBody` / `ContentHero` / `ContentGrid` | entrance | `useHasHydratedOnce()` |
| `ScrollReveal` | scroll-gated | BOTH `initial` and `animate` - `animate` also resolves to "hidden" on a server, because `isInView` is false there |

`src/hooks/useHasHydratedOnce.ts` is the shared answer: false on the server and
on the session's first client render, true for every mount after. So the first
paint is never hidden and client-side navigations still animate, which is the
only time a "transition" is perceptible anyway. It uses module state rather
than `useState` deliberately - these components remount on every navigation, so
a per-instance flag would kill the animation permanently instead of moving it.

**`whileInView` reveals BELOW the fold are deliberately left hidden.** That is
what the animation is for. The rule is positional, not categorical.

### The gates, and why the first two were blind

`scripts/audit_ssr_visibility.py` reads the sitemap, carries a control string,
prints its counts before its verdict, and **fails only on content hidden ABOVE
the `<h1>`** - a bare `opacity:0` count would flag every content page forever
and be ignored within a week. Probed against production while production was
still broken: 12/12 findings, exit 1. It later found `/for-attorneys` on its
own, which no amount of reading had.

    python3 scripts/audit_ssr_visibility.py --sitemap https://permtracker.app/sitemaps/pages.xml

**A component test for this CANNOT live in the existing vitest projects**, and
two attempts passed against a deliberately broken component before that was
understood. Two independent reasons, either one sufficient:

- all three projects run **happy-dom**, so `window` exists and Motion takes its
  CLIENT path, applying `initial` through the DOM instead of serializing it;
- `vitest.setup.ts` **mocks `motion/react` wholesale**.

Hence the `ssr` vitest project: `environment: "node"`, **no setupFiles**, and
it owns `*.ssr.test.{ts,tsx}`. Both are load-bearing.

## Social cards: one real picture per page, and the illustration that was there (2026-09-07)

Adam noticed Google Images showed the rival tracker as "actual screenshots" and us
as something random. Measured: every one of our ~13,758 URLs declared the same
`og:image`, `public/og-image-base.png`, an AI-drawn isometric laptop whose
screen read "Immigration Case Tracking Dashboard, Client J. Doe, I-140,
Biometrics, Interview, Approved" (USCIS steps, an invented client, the old
"Deadline Tracking" tagline). The homepage had one `<img>` (a decorative
background, no alt), every chart is inline SVG, and the only real screenshots
were inside the guides. The rival tracker has no images in its pages either; what
Google shows for it is three per-page social images that are real screenshots
(`og-timeline.jpg`, `og-cases.jpg`, `og-map.jpg`) beside a text default.

What ships now:

- **`public/og/<slug>.jpg`, one 1200x630 card per public page (27)**,
  rendered by `scripts/make-page-cards.mjs` in Chrome with the site's own
  fonts: the house frame (paper, ink or lime ground with the dot texture), the
  page's title and a one-line label on the left, and a REAL screenshot of the
  page inset on the right with a hard shadow. Indexes and legal pages get a
  drawn motif instead, because a screenshot of a list of cards or of legal
  prose says nothing. **Nothing on a card is a live figure**: a static image
  of a number that moves weekly is wrong by the second week, so the label
  states what the page is. Screenshots were captured from the local build
  through the Chrome extension at 1440 wide (`scratchpad/og-shots/`), header
  and rail cropped off (`crop: [300, 68, 1140, 688]` for rail pages).
- **`src/lib/pageCards.ts`** is the registry (slug -> alt text) and
  **`withSocialCard(metadata, slug)`** in `socialCard.ts` wires a card into a
  page on BOTH surfaces. Twitter is set explicitly because the root layout's
  file-convention image otherwise wins there: a page overriding only
  `openGraph.images` ships the new picture to WhatsApp and Slack and the old
  one to X. The three `generateMetadata` pages (`perm-case-status`,
  `perm-queue/[month]`, `perm-rfi-audit/[stage]`) wrap their return the same
  way with their parent's card.
- **The root `/opengraph-image` serves `public/og/home.jpg`** and the
  illustration is deleted. Any page without its own card falls back to the
  real homepage.
- **Entity pages generate their own card per entity** (`src/lib/entityOg.tsx`,
  `opengraph-image.tsx` under `perm-employers`, `perm-attorneys` and
  `perm-wages` `[slug]`): the name, the kind and the filing count from DOL's
  files, cached 30 days like the page. No approval rate and no rank on the
  card, because the page withholds those below its population floors and a
  card cannot carry the footnote.
- **The sitemap carries `<image:image>` for every static page's card** and
  the `urlset` declares the image namespace. Entity cards are not in the
  sitemap: 13k image URLs that each cost a generation is the ISR bill again.
- **`social-cards.test.ts`** holds the three parts together: a registry entry,
  a file at exactly 1200x630 under the 300 KB cap (read from the JPEG's own
  SOF marker), and a page that names the slug through `withSocialCard`.

Regenerate a card when a page's look changes: capture it, then
`node scripts/make-page-cards.mjs <spec.json> <shots-dir> --only <slug>`. The
three spec files used on Sep 7 are in the session scratchpad; the card fields
are `slug, ground, eyebrow, title, label, shot, crop` or `motif`.

## Equal z-index is not a tie: the later element in DOM order wins (2026-09-09)

Two bugs reported separately were one defect. The back-to-top button was
painted over by the footer at the bottom of every long page, and the header's
Learn dropdown was clipped. Both because `Footer` carried `relative z-50` and
so did `AuthHeader` - and at an equal z-index the painting order is DOM order,
so the footer, rendered last in `(site)/layout.tsx`, won both fights.

**The fix is the footer, not the things it covered.** It is `z-10` now. Raising
the button to `z-[60]` alone would have left the dropdown clipped, because the
dropdown cannot outrank its own header's stacking context by raising itself.

House layers, and nothing may hardcode a competing value:

| layer | who |
|---|---|
| `z-[100]` | the Cmd+K search palette |
| `z-[60]` | bottom-fixed chrome: ScrollToTop, SelectionBar, the open chat panel, ReadingProgress |
| `z-50` | dialogs, popovers, dropdowns, tooltips (portalled, so they also paint after the header) |
| `z-[45]` | `SiteHeader`, its menus and the phone menu (since Oct 24 2026; it was `z-40` from Oct 15) |
| `z-[41]` | the data menu's phone handle |
| `z-40` | the data menu's phone panel, and the chat bubble (since Sep 29 2026: dialogs and menus draw over it) |
| `z-10` | `Footer` (since then: no z-index at all, in normal flow) |

*(Updated Oct 24 2026. The footer row and the `AuthHeader` name were history: `footer-stacking.test.ts` holds the
current order, header below dialogs and above the data handle and panel.)*

`scroll-to-top-stacking.test.tsx` and `footer-stacking.test.ts` pin the
relationship rather than the numbers. **`elementFromPoint` is the decisive
check** - a computed z-index tells you what a rule says, not who actually
receives the click.

## A fixed negative margin cannot cancel a variable auto margin (2026-09-09)

The data rail was reported as "not snapped to the left edge at some screen
sizes". `DataShell` wrapped everything in `mx-auto max-w-[1600px]`, and the
rail tried to reach the viewport edge with a negative margin. Above 1600px
`mx-auto` contributes `(vw - 1600) / 2` per side - a number that changes with
every pixel of window width - and no constant can subtract it. Measured: a
**155px gap at 1920**.

**The fix is to delete the centring wrapper, not to compute against it.** The
shell is `w-full` now and each page sets its own measure (`max-w-3xl` through
`max-w-7xl`), which is what a full-height spine down the screen edge requires.
`rail-fits.test.ts` gates it.

Related and already documented above: `lg:flex`, never bare `flex`, on that
shell.

## A `<details>` accordion needs TWO rules to re-expand at a breakpoint

The footer is six `<details>` columns: an accordion on a phone (1,882px tall
became 630px) and a plain six-column block on desktop (760px became 550px).
**Collapsing is free and expanding is not.** A closed `<details>` hides its
content in the UA shadow tree, so `display` on your own element is only half
of it:

```css
@media (min-width: 64rem) {
  .footer-col:not([open]) > .footer-col-body { display: flex; }
  .footer-col::details-content { content-visibility: visible; }
}
```

Engines that hide the slot need the first; engines that use `::details-content`
need the second. Ship both.

**SEO is not affected either way**: the links are in the HTML whether the
element is open or shut, which is the whole reason this is a `<details>` and
not a JS disclosure.

**And the footer had a layout bug that survived trimming links**:
`xl:grid-cols-5` with six cells wraps to two rows, so the footer stayed 754px
after the content shrank. Count the cells before choosing the track count.

## Nav parity comes from ONE source, or the two copies drift

The Learn dropdown and the footer's Learn column had diverged. Both now render
from `FOOTER_COLUMNS` in `src/lib/constants/navigation.ts`, whose Learn column
IS `LEARN_NAV_LINKS` (the same array the header spreads) and whose Calculators
column is `TOOL_NAV_LINKS.slice(0, 6)` plus an explicit "All N calculators"
link that counts the array rather than restating a number.
`footer-nav-parity.test.ts` gates it.

## The badge endpoint: 35 figures, and two traps worth keeping

`/badge/<kind>[.<style>][.<theme>].svg` serves shields-style SVG badges of
DOL's own published figures. `BADGE_DEFS` in `src/lib/badge.ts` holds 35
definitions across four groups; `src/lib/badgeRender.ts` draws three shapes
(`shield`, `card` with a sparkline, `bar`) on two grounds.

- **The first three ids are FROZEN** (`perm-queue`, `perm-days`, `pwd-queue`).
  They are pasted into READMEs we do not control; a renamed id is a broken
  image in somebody else's repo.
- **Every figure is one DOL publishes, and each carries its date.** No
  estimates, no derived rates. A badge is the least-supervised surface on the
  site: it renders inside someone else's page where nobody will ever see our
  caveats.
- **A cross-origin SVG must contain no `<script>`, `<style>`, `<foreignObject>`,
  `xlink:href` or `<image>`** or sanitisers (GitHub's camo included) drop it.
- **`route.ts` may export ONLY the known handler names**, so `parseBadgePath`
  lives in a sibling `parse.ts`. That failure appears only in `next build`,
  during route type generation - never in dev, typecheck or tests.
- **`DOL_PAGES` is DERIVED from `BADGE_KINDS`.** Adding six badges without
  adding them to the revalidation list shipped six endpoints serving figures
  up to a day stale; the full suite caught it, and the fix was to stop keeping
  a second list by hand.

## The corrections log is ONE changelog entry, in the same shape as the rest

Adam: *"all the corrections, they should be under 1 changelog and follow same
format as others"*. It has now moved three times: its own `/corrections` route,
then a block below the changelog timeline, then fourteen special-cased rows
interleaved INTO that timeline (its own dot colour, its own badge, its own
three-part prose block), and now `content/changelog/corrections.mdx` - an
ordinary post with the frontmatter every other one has, `category: "Correction"`.

`src/lib/corrections.ts` and its test are deleted; `ChangelogTimeline` lost its
`corrections` prop, its two-kind `Entry` union and every `isCorrection` branch,
and is a plain list of posts again. `/corrections` still 308s, now to
`/changelog/corrections` rather than the index above it: a reader typing that
URL wants the corrections, and there is a page for exactly that again.

**Moving typed data into prose is where a standard goes quietly missing**, so
the gate moved with it rather than being dropped.
`corrections-entry.test.ts` asserts the post has every frontmatter key, a
description within the same 155-char cap, at least the fourteen entries it
moved with, that each names its page and date and carries **It said**, **What
was true** and **What changed**, and that the post's own date equals its newest
correction. Probed three ways: drop a part, delete an entry, or skew the date,
and it goes red.

## A wrapper that is always rendered eats the caller's gap (2026-09-10)

Adam, from a phone screenshot of the signed-in drawer: the gear sat against
"SETTINGS" while "SIGN OUT" beside it had normal spacing. Both rows carry the
SAME classes - `flex items-center gap-3 py-3 px-2` - so the CSS was never the
difference.

**Measured, in this order, because the obvious answers were both wrong:**

1. Read both rows: identical `gap-3`, identical `size-4`. Not a class typo.
2. Rendered the two Phosphor glyphs side by side in a browser: **box gap 12.0px
   and visual gap 13.5px for BOTH.** Not the icons.
3. Measured Adam's actual screenshot (1320px wide, 3.38x): **SETTINGS 1.8px,
   SIGN OUT 12.7px.** So it was real, and it was in the component.

The cause is `NavLink`. **`showLoading` defaults to `true`**, so it ALWAYS wraps
its children in `<span className="inline-flex items-center">` - the spinner has
to be mounted before it can read `useLinkStatus`. That wrapper is then the
link's only flex child, so the caller's `gap-3` applies to exactly one element
while the icon and label sit inside a separate, gapless formatting context and
touch. Sign Out is a plain `<button>` whose children ARE direct flex items,
which is why it looked right.

Reproduced and fixed in a browser before touching the app: direct children
**12.0px**, today's wrapper **0.0px**, wrapper with `gap: inherit` **12.0px**.
The screenshot's 1.8px is the gear glyph's own right-side whitespace inside its
box, which is why it was not exactly zero.

**The fix is `gap-[inherit]` on the wrapper, and inherit rather than a literal
is the point** - it cannot drift from whatever the caller asked for, and a
caller with no gap is unaffected because `normal` inherits as `normal`.

**It was three call sites, not one**: `AuthHeader` (gap-2), `Header` (gap-3),
`ArticleHeader` (gap-1). Fixing the call site would have left the other two.

**Verified the arbitrary variant actually compiled**, because an inert class
looks exactly like a fix: `.gap-\[inherit\] { gap: inherit; }` is in the built
stylesheet, and on a live page the wrapper computes `gap: 4px` under
`ArticleHeader`'s `gap-1`. `nav-link-gap.test.ts` gates the mechanism (happy-dom
has no layout, so it asserts the wrapper exists and inherits rather than
hardcodes); probed by reverting the class and by hardcoding `gap-3`.

## A date range has THREE states, and "not active" was rendered as "ended" (2026-09-10)

Adam: *"make sure ended isn't just dates cause if future? maybe inactive is
better?"* He was right, and it was live.

`isActive(d, today)` is `startDate <= today && today <= endDate`, which is
correct. Both debarment surfaces then rendered `!isActive` as **"(ended)"** -
and `!isActive` covers two OPPOSITE situations: a period that has run out, and
one that **has not started**.

**Measured over the 105 rows we hold: 97 in force, 7 ended, and one that had not
begun** - Jevon Natali DBA: Jevon Natali Farms, H-2A, barred **2026-11-01 to
2027-10-31**. `/debarments` was greying that row out and captioning it "(ended)"
52 days before the bar took effect. `DebarmentNotice` on an entity page was
worse, because it says it in a sentence: *"was barred from filing in the past;
the period has ended"* - every clause false, on the page of a sponsor somebody
may be about to sign with.

**"Inactive" would have fixed the falsehood and it is still the wrong answer.**
It is accurate for both cases, and that is the problem: a FUTURE debarment is a
warning and a PAST one is history, and flattening them tells a reader "nothing
here" about the single most important row on the page. `phase()` returns
`"upcoming" | "in-force" | "ended"`.

Both dates are `NOT NULL` and `ingest_debarments.py` skips any row missing
either, so the three states are total - there is no fourth case to design for.

Rendering rules that came out of it:
- **An ended row is dimmed; an upcoming one is not.** Dimming was doing the
  same damage as the label.
- **The label states the STATE, not the date** ("(not started)"), because the
  period is already the first half of the same cell.
- **The notice's lede is ordered by what the reader needs**: in force today
  beats barred-from-a-known-date beats finished.
- The page's summary counts it: *"97 debarments in force today of 105 on the
  lists, and 1 that has been ordered but has not begun."*

**The general rule: any classification derived from a date range against `now`
has three outcomes, and a boolean can only carry two.** Before rendering
`!inRange` as a past-tense word, ask what the future case looks like. Grep for
this shape wherever a start and an end are compared to today.

**And an adjacent silent failure found while checking the same data.** The WHD
parser drops any row whose period will not parse - `if not start or not end:
continue` - with no count. A date-format change on DOL's page would shrink the
list while the run logged "N rows" and read as healthy, which is the load-guard
lesson in miniature. It now counts drops, names the first ten and prints
`::warning::`, with a header-row exception so the table heading is not counted.
Probed by reverting: `test_debarments.py` goes red.

## The design pass: measure prose against data, then collapse the walls (2026-09-13)

Adam: *"the MAIN thing is just not so much text plz... visual heavy not word
heavy, no fluff"*, and then, when I proposed leaving four pages alone: *"no you
shouldn't leave anything alone check and fix everything plz."*

**"Too much text" has no scale until something known-good is put through the
same instrument.** `scripts/audit_visible_text.py` counts, per page, the words
a reader FACES (excluding the body of any closed `<details>`), the words in the
DOM (what a crawler reads), and splits the visible ones into PROSE (`<p>`,
`<dd>`) and DATA (`<td>`, `<li>`). Controls, same instrument: gov.uk's
visas-and-immigration browse page **670** words, stripe.com's payments docs
**470**, react.dev/learn **2,087**. Our own best pages already sat at parity
(`/about` 496, `/lca-cases` 653, `/tools` 715).

**The prose/data split is what turns a word count into a decision.**
`/debarments` reads as one of the wordiest pages on the site at 2,112 visible
words and is **16% prose** - 105 real debarment rows. `/glossary` at 2,825 is
**95% prose**. Those need opposite responses, and "trim the long pages"
without the distinction deletes the data. The split was wrong twice before it
was right (a backwards nesting test double-counted a `<p>` inside a `<td>`;
overlapping prose tags then reported 4,692 prose words on a page with 2,825
visible ones, impossible on its face). It uses a depth mask now.

**What got collapsed, and what makes that safe.** Every list-of-definitions
wall became native `<details>`: the term, its status string, its live count
and the FIRST SENTENCE stay visible, the rest opens on demand. Measured on
`/perm-rfi-audit`: visible 3,277 -> 2,431, DOM 3,411 -> **3,505** - less for a
reader and MORE for search, because `<details>` keeps its body in the DOM open
or shut. `collapsed-dictionaries.test.ts` and `glossaryGloss.test.ts` assert
the three things that make it safe rather than assuming them: the long-form
field must still RENDER (trimming it is deleting, not collapsing), no entry may
be `open`, and an anchor id stays on the `<details>` element so a jump from a
nav or a DefinedTermSet `@id` lands on the visible row whether or not the
browser auto-expands it. `splitLead` cuts on ". " so "20 CFR 656.40" is never a
sentence boundary.

**Pages converted, measured after (visible words, and DOM before -> after):**

| page | visible | DOM |
|---|---|---|
| `/perm-rfi-audit` | 3,277 -> 2,431 | 3,411 -> 3,505 (glosses are new content) |
| `/glossary` | 2,825 -> 1,573 | 2,887 -> **2,887, to the word** |
| `/perm-case-statuses` | 2,583 -> 1,272 | 2,645 -> **2,645, to the word** |
| `/methodology` | 1,778 -> 1,025 | 1,840 -> 1,885 |
| `/debarments` | 2,112 -> 1,979 (the rows stay) | 2,174 -> 2,185 |

DOM parity to the word on both dictionary pages is the proof that this was
collapsing and not deleting. The glossary's first version rendered each lead
sentence twice (desktop summary, mobile body) and read 3,941; rendering it once
put the count back to the original. And moving the leads into `<summary>`
blinded the instrument's prose column to them until `summary` was added to its
prose tags - it read 80 prose words on a page showing 56 lead sentences.

**The five chart pages, done on a second instruction** (*"lets do 1, 3, 4 for
now"*), under a stricter rule because their prose is captions, not a list: a
caption of up to ~30 words under its heading stays; anything longer keeps its
first sentence and puts the rest behind FinePrint; a multi-paragraph narrative
keeps its first paragraph. Measured in PRODUCTION, visible words before -> after:

| page | visible | DOM | why it moved that much |
|---|---|---|---|
| `/case-search` | 790 -> 630 (-20%) | 1,026 -> 1,017 | three of four caveats collapsed; lede is one sentence |
| `/perm-queue` | 1,186 -> 1,045 (-12%) | 1,549 -> 1,524 | the five-paragraph narrative under the h1 keeps one |
| `/perm-denial-risk` | 2,336 -> 2,292 (-2%) | 2,457 -> 2,447 | its words are 1,241 of DATA and captions under 30 |
| `/calculators` | 1,024 -> 1,006 (-2%) | 1,086 -> 1,091 | a routing table, illustrated cards, one 45-word caveat |
| `/` | not edited | | every paragraph is 16 words or under except the About block, rebuilt 2026-09-07 for the brand query with the title frozen to 2026-11-07 |

The small DOM drops are the tightening rewrites, ten to twenty-five words each,
and they are cuts, not collapses - said so in the commit. The next cut on the
two -2% pages is captions under 30 words or the PageBasics Q&A layer, and that
is a decision, not a defect.

**The last cut, on the third instruction** (*"continue and finish plz"*): the
PageBasics Q&A layer collapses AT THE COMPONENT - each question an `<h3>`
inside a native `<details>` summary, so the outline carries it and the answer
is in the DOM for every crawler - across all twelve pages that render it, and
the captions under 30 words on `/perm-denial-risk` and `/calculators` are
TIGHTENED, not collapsed (a twenty-word caption behind a toggle is worse than
the caption). Production, visible before -> after, DOM before -> after:

| page | visible | DOM |
|---|---|---|
| `/case-search` | 790 -> 462 (-42%) | 1,026 -> 1,017 |
| `/pwd-cases` | 626 -> 444 (-29%) | 715 -> **715** |
| `/lca-cases` | 568 -> 413 (-27%) | 653 -> **653** |
| `/perm-rfi-audit` | 3,277 -> 2,332 (-29%) | 3,411 -> 3,505 |
| `/perm-queue` | 1,186 -> 956 (-19%) | 1,549 -> 1,524 |
| `/calculators` | 1,024 -> 913 (-11%) | 1,086 -> **1,086** |
| `/perm-denial-risk` | 2,336 -> 2,276 (-3%) | 2,457 -> 2,431 |

Three pages hold their DOM to the word; the small drops are the caption
tightenings and the rewritten ledes, ten to twenty-five words each, and they
are cuts. `/perm-denial-risk` moves 3% because 1,241 of its words are table
rows and its captions were already under 30 words - what is left there is the
data. No test asserted on PageBasics' old markup; the collapse is verified as
SERVED by counting `<details>` inside each page's "The basics" block in
production (7 or 8 per page, none open).

**MEASURE THE PRODUCT, NOT THE DEV SERVER.** On dev, `/case-search` read 1,108
visible / 1,495 DOM after the cut - UP from 790. Production, same instrument,
same minute: 630 / 1,017. Dev mode renders extra text on that page (the
`useSearchParams` boundary's fallback plus dev-only markup); the number that
describes the site is the one taken from the site. Every after-state in this
section is from production.

**The heading outline is part of the same job.** `scripts/audit_headings.py`
walks the sitemap (not a hand-kept list - the first run against one I typed
from memory reported two 404s that were my own guessed paths) and found 7 of
165 pages with a finding: the same eight stage names as headings twice on
`/perm-rfi-audit`, "By offered wage" appearing twice over two different
quantities on `/perm-denial-risk`, and h1->h3 skips on `/blog`, `/guides`,
`/perm-by-state` and `/tools/green-card-timeline`. A row label beside a number
is a `<span>`, not an `<h4>`; a card title's level is a prop, because it
genuinely differs between an index page and a "Related posts" strip.

## Glued text, fourth container: `<th>`, SVG `<text>`, injected markup, toggle rows (2026-09-13)

The rendered audit against production found 99 pairs the source gate passed,
in four shapes the earlier sweeps never touched:

| shape | fix |
|---|---|
| `<th>` header cells (every `<td>` had been fixed, no `<th>` had) | `{h}{" "}` inside the cell, same as `<td>` |
| SVG `<text>` in the badge renderer, one badge running into the next | a trailing space inside the `<text>` element |
| `dangerouslySetInnerHTML` of a badge SVG on `/badges` | `__html: \`${v.svg} \`` |
| a row of toggle `<button>`s (chart mode, table mode) | `{children}{" "}` in the button |

39 cells across 18 files, then **0 glued on 74 of 74 production pages** by
`audit_glued_text.py` over the sitemap. The source gate cannot see any of
these (a header cell and a data cell are the same shape to it; SVG and
injected strings are not JSX). The rendered audit is the authority; run it
against PRODUCTION, because dev renders `/case-search` with extra copy and
reports a number the live site does not have.

## The dictionaries collapse; the words stay (2026-09-13)

Adam: "not so much text... visual heavy". Five reference pages (`/glossary`,
`/perm-case-statuses`, `/perm-rfi-audit`'s stage glossary, `/methodology`,
`/debarments`) and the `PageBasics` Q&A layer on twelve data pages now render
each entry as a native `<details>`: the lead sentence in `<summary>`, the rest
in the body. Measured on production after deploy:

| page | visible before | after | DOM (unchanged) |
|---|---|---|---|
| `/glossary` | 2,825 | 1,573 | 2,887 |
| `/perm-case-statuses` | 2,583 | 1,272 | 2,645 |
| `/perm-rfi-audit` | 3,277 | 2,332 | |
| `/methodology` | 1,778 | 1,025 | |
| `/case-search` | 790 | 462 | |

**Why `<details>` and not a JS disclosure**: the text is in the HTML whether
open or shut, so Google (textContent-shaped) and the Cmd+K palette lose
nothing, and the DOM word count is the proof: it matched the audit's
prediction to the word. Rules: the anchor `id` sits on the `<details>`, so
`/glossary#pwd` still lands; a `<h3>` inside `<summary>` keeps the outline
(the headings audit reads it); the lead renders ONCE (the first pass rendered
it in both halves, DOM 3,941 instead of 2,887, caught by the count);
`splitLead()` splits on `". "` because "20 CFR 656.40" contains a period.
`DisclosureList` in `FaqList.tsx` is the shared shape; nine hand-rolled
`<details>` remain and could migrate to it.

`scripts/audit_visible_text.py` measures visible against DOM and prose
against data (a depth mask, because overlapping tags double-count: its first
version reported 4,692 prose words on a 2,825-word page, and the impossible
arithmetic is what exposed it). `scripts/audit_headings.py` reads the sitemap,
re-bases child sitemaps that point at localhost, and found 7 outline defects
across 165 pages. A hand-typed URL list in its first version invented two 404s.

## A metadata branch that returns no `openGraph` inherits the ROOT layout's

Next 16 merges metadata SHALLOWLY, which `openGraphBase.ts` already documents
for the case where a page overrides `openGraph` and loses `siteName`. The
mirror case bit here: `perm-employers/[slug]` returns two different objects,
and the live-only branch returned `title`, `description` and `alternates` with
no `openGraph` at all. So every one of 22,467 pages served a correct canonical
naming itself and an `og:url` naming the HOMEPAGE, with the site's generic
tagline as `og:title`. Shared on WhatsApp or Slack they rendered as the
homepage card.

**When one route has several metadata branches, diff them field by field.** The
published branch had been right since the day it shipped, which is exactly what
makes the other one easy to miss - the file looks like it handles OG.

## A bare string child renders BESIDE the stamp, not inside it (2026-09-22)

`QueueStamp` took `children` and rendered them as a sibling of its offset lime
table. A string child therefore became a bare text node right after `</table>`,
and because the slab is offset with negative margins, "DOL's own stamp ..." sat
UNDER the lime block in the Sep 22 digest preview. The owner saw it before I did.
Fix: a string child gets its own `<Text>` with a top margin; element children pass
through. The test asserts the paragraph shape (`<p ... margin-top:14px>DOL's own
stamp`) and that nothing text-shaped follows the table directly; it was probed red
against the old component.

**Render the stored issue with the real template before calling a digest fixed.**
`npx convex data newsletterIssues --prod --format jsonl` gives the issue's `data`
JSON; an entry under `node_modules/.cache/qa/` (so `node_modules` resolves) that
imports `BulletinWeekly` and `@react-email/render`, bundled with
`node_modules/.bin/esbuild --bundle --platform=node --format=cjs --jsx=automatic
--alias:@=./src`, renders the same HTML Convex will send. The unit test proves the
shape; the render is what the owner reads.

## Seven USCIS guides in one pass, and five small instruments (2026-09-22)

The guides (`content/guides/uscis-receipt-number`, `i485-vs-i485j-supplement-j`,
`what-emma-told-you`, `uscis-processing-times-median-vs-80-percent`,
`fastest-field-office-eb-i485`, `approved-i140-no-visa-number-eb2-india`,
`ead-and-advance-parole-timelines`) each carry a "What this can't tell you"
section and say plainly which facts have no primary page: USCIS's "80% of cases
over six months" definition survives only in the Internet Archive's Jan 30 2024
capture of `egov.uscis.gov/processing-times/more-info` (live and later captures
403); no USCIS page uses the term "combo card"; the ten receipt digits are
decoded nowhere official; and the sanctioned Case Status API returns human text,
never the FTA/H008 codes Reddit trades in.

- **Count description lengths with the script, never by eye.** By-eye counts were
  over on 9 of 14 fields by 1 to 11 characters. `page-description-length.test.ts`
  and `audit_articles.py` are the instruments; `content-frontmatter.test.ts` caps
  `description` only, so `seoDescription` is held by the audit alone.
- **`audit_articles.py` reads the whole file, comments included.** A pending
  figure spec inside an MDX comment must not carry `src="/images/content/shots/…"`
  or the audit reports a missing shot for a figure that is not there yet.
- **`json.dump` reformats a hand-styled JSON file.** `article-shots.json` is one
  spec per line; append in that style and check the diff is additions only.
- **In the I-485 field-office file, the "Texas" and "California" rows under the
  state headers are service centers** (SSC, WSC), not field offices.
- **Glossary `see` links are gated on the page existing**, so a glossary entry for
  a page another lane is still building goes red until that lane lands; that is
  the gate working, not a wrong link.

## Sep 30 2026: one picture per load

Adam: *"no multiple loads, or flashes and then load again"*. Two audits and a frame-by-frame
recorder (`~/.claude/skills/site-forge/scripts/film-load.mjs`, CDP screencast plus a DOM probe;
`film-sheet.py` makes the contact sheet; run from `v2/` so `@playwright/test` resolves) found pages arriving as two or three different pictures in a row. The rules:

- **A loading.tsx renders the page's OWN loading component, never a skeleton of its own.**
  Dashboard: `DashboardSkeleton` (each widget's exported skeleton, in the page's layout). Cases,
  case detail, edit, calendar, timeline: the skeleton the page renders while its query loads.
  Notifications and case status: the page itself / its shared shell. Two drawings of one page
  drift, and a click showed both. `loading-transitions.test.ts` fails on `<Skeleton` in any
  loading.tsx.
- **No loading.tsx on prerendered pages.** Static routes prefetch whole; their skeletons only
  showed on an unprefetched click and matched nothing (an article opened from outside its
  section got the LIST skeleton, because a section's loading.tsx wraps its `[slug]` too). No
  group-level loading.tsx either: `(authenticated)/loading.tsx` showed a generic skeleton
  before each page's own. /reset-password is force-static like /login and /signup.
- **No keyed page transition.** `PageTransition` faded on pathname, and the pathname commits
  WITH the loading state, so it faded the skeleton and swapped the page in unanimated; it also
  remounted the data rail on every click, and under reduced motion changed element type after
  hydration and remounted the whole page. Deleted.
- **Nothing above the fold animates in on mount.** Article header/body, content hero,
  ContentGrid (`AnimatePresence initial={false}`: filtered-in cards still animate), changelog
  line, the cases grid, calendar, timeline rows, the Overview tab (animates only after a tab
  switch), settings, the chat bubble. `useHasHydratedOnce` captures once per MOUNT: read per
  render, a phone's `useIsMobile` settle flipped first-paint ScrollReveals to hidden.
- **Never `animate-in` with an `animationDelay` on a loading state.** tw-animate's fill mode does
  not hold the first frame, so each block showed, vanished, then faded back. Gated.
- **Public data tools render in full on the server.** `SearchParamsBoundary`
  (`src/hooks/useUrlSearchParams.ts`) makes a tool's Suspense fallback the tool itself under
  `WithoutSearchParams`, where `useUrlSearchParams` returns empty params and never calls
  `useSearchParams` (which bails the boundary out of the prerender). Seven pages shipped a
  one-line "Loading…" and grew hundreds of pixels at hydration. Any new tool that reads the URL
  uses `useUrlSearchParams` and sits in a `SearchParamsBoundary`.
- **Tables keep their rows while the next page loads.** `usePublicQuery` returns `previous`
  (the last answer for any url); LiveCaseBrowser, FlagCaseBrowser and the admin users table dim
  the old rows instead of collapsing to one line.
- **Signed-in navigation is warm.** `WarmAppQueries` in the app layout subscribes to the
  dashboard, case list (`defaultCaseListQueryArgs`, the page's own builder), calendar and timeline
  queries with the pages' EXACT arguments (a different arg,
  "skip" included, is a second subscription), and `experimental.staleTimes.dynamic = 30` reuses a
  visited page's payload for 5 minutes (it was 30 seconds; each signed-in click still showed 0.5 to 1.3 seconds of skeleton while the server re-sent a shell). Saved case filters and the timeline's saved range are
  read before the first query, not after it (each loaded its list twice).
- **The home curtain** is server markup first in `<body>` (root layout, every route, hidden
  unless `html[data-pre]`), lifts at DOMContentLoaded (not window.load) with the 600ms floor and
  1200ms cap, and slides away over the page (`data-pre="leaving"`); no scroll lock, no DOM
  injection, no client-navigation curtain (`HomeCurtainNav` deleted).
- **The header is one line at every width from 400px.** Desktop nav starts at `xl` (it needs
  1,137px); below 400px the logo wraps and `globals.css` defaults `--site-header-max-h` to 99px
  there (71px elsewhere), so `<main>` reserves the right space before any script runs.
- **Turnstile reserves its 65px** when visible, and reads the theme at first render.

Not done, measured: the header link spinner still widens the label on a SLOW navigation
(rare now that pages prefetch); the article table of contents appears after hydration (it sits
in a fixed-width sidebar, so nothing moves); the signed-in skeletons were then measured on production in Adam's browser and resized;
after that, clicking dashboard, cases, calendar and timeline showed ONE state each, no skeleton,
once the first case-list visit of the session had loaded its code
(deadline hub, case summary, calendar filters and grid, case filter bar and cards); the timeline
grid's height follows the number of cases, so its skeleton cannot know it.

### Shipping it (Sep 30 2026, 6:55 to 7:48 AM EDT): what the deploys taught

- **The first build failed and only a build could have caught it.** Next prerenders a route's
  `loading.tsx` at build time; `/perm-case-status`'s loading header read `?case=` with no Suspense
  boundary and the build stopped ("useSearchParams() should be wrapped in a suspense boundary").
  Its fallback is now the same header with an empty box. There is no local build here (it would
  read the retired Turso database, billed per row, or need a read-only sqld token minted as root),
  so a change to anything Next prerenders gets its deploy's Build step watched before it is called
  shipped.
- **Measured on production after deploy** (recorder, 12 public loads and clicks): no skeleton
  cycles; layout shift 0 on nine, under 0.06 on the rest (the header gaining Sign in on
  /reset-password, the heading font swapping in, the attorney page's decorative shapes). Header
  71px at every width from 400, 99px below, equal to the CSS default. Signed-in, in Adam's Chrome:
  four skeletons were resized from measurement (deadline hub was 28px tall, case summary 59px
  short, calendar filters 36px short, case filter bar 60px short); with the case list and timeline
  warm too, dashboard, cases, calendar and timeline each open in ONE state after the first case
  list visit of a session.
- **`staleTimes.dynamic` is 300**, not 30: each signed-in click still showed 0.5 to 1.3s of
  skeleton while the server re-sent a client shell.
- **A truncated `.next/dev/types/routes.d.ts` refused a push**: a running `pnpm dev` (not ours)
  wrote a shorter file over a longer one and the old tail stayed. Read the file's END; delete
  `.next/dev/types` (generated) and push again; leave the other session's dev server running.
- **`scripts/film-load.mjs` lives in the site-forge skill now**; the copies under
  `node_modules/.cache/qa/` are scratch and a reinstall wipes them.


## Sep 30 2026 (morning): the two timelines, and a report that counted fixed failures

Adam's phone screenshot of /timeline: markers on top of case names, "no dates" boxes over names,
one-letter months, squares covering squares. Then *"not only the layering but clashing, overflow,
fit, and the titles/header"*. Both timelines (the page and the case page's) share one set of parts
now (`src/components/timeline/`), and the rules that made them fit:

- **A sticky column must sit ABOVE what scrolls under it, and nothing between may make a stacking
  context.** The label column carries `Z_INDEX.stickyLabel` (35: above bars 10, markers 20, today
  line 20 and its label 30, below a hovered marker 40); the row's content area has no z-index, so its
  children compete with the column one by one. A z-indexed row made the whole row one layer and the
  markers slid over the names.
- **A month is at least 44px** (`MIN_MONTH_PX`): the grid's min width is `var(--tl-label) + months x
  44px`, so a phone scrolls sideways instead of squeezing months to one letter, and
  `useScrollToToday` opens with today a third of the way in. Month labels are always three letters.
- **Dates too close to tell apart share ONE square that says how many it holds** (replaced lanes
  the same afternoon). `groupMarkers` joins dates less than a 22px square apart at the narrowest
  month width (`MIN_MONTH_PX`), so a group never splits when the screen widens; the square sits at
  the group's middle, in the stage's colour when every date shares a stage and plain when they
  don't, and its tooltip and label list every date. The lanes version put up to three same-coloured
  squares in a tower with a "+N" chip beside them, and Adam's phone read it as *"the + and the
  multiple dots and same color"*: a stack of look-alike squares is noise, a count is a fact.
- **A square never sits half under an edge.** Its left is `clamp(12px, var(--x), calc(100% -
  12px))`, set as a Tailwind class with `--x` inline (happy-dom drops an inline `clamp()`, so the
  tests read `--x`). A date on the first or last day of the range sat half behind the name column.
- **The colour key sits above the grid**, in the page and its loading skeleton alike; below it, a
  phone met it only after scrolling past every case.
- **A tooltip mounts only while hovered.** The range bar's invisible tooltip still counted toward
  the scroll width, and the case timeline scrolled 33px past its last month on a phone.
- **The "no dates" note is sticky** beside the label column, and reads "No dates" under 360px.

QA ran in Storybook (`Timeline.stories.tsx`: cases built to break it) through the devtools browser
at 320, 390, 768 and 1440, light and dark, measuring overlaps, clipping and page overflow; the
signed-in pages need a sign-in the automation browser doesn't have.

**The morning report ranked fixed failures as FAILING.** Sep 30's email said "GitHub Actions is
FAILING: 7 failed" when all seven workflows had passed again since. `daily_monitor.py` now ranks only
a workflow whose newest completed run failed (`recovered()`); the others read "failed, then passed at
<time>". Every item on that report was a Sep 29 leftover of the server move, already fixed.

**Next prerenders every loading.tsx, and a test now does the same.** `loading-prerender.ssr.test.tsx`
renders each one with no URL and `useSearchParams` throwing Next's bailout (layout auth and Convex
stood in), so a loading state that reads the query string outside a Suspense boundary fails in
seconds instead of failing the deploy, as the 6:54 AM EDT deploy did. Probed with that exact mistake.

## Oct 1 2026: the visual pass, one email list, breadcrumbs, and a cleanup

- **One list of every email** (`convex/lib/mailKinds.ts`, re-exported at `src/lib/mailKinds.ts`): name,
  one-line description, cadence and where to start each kind. The emailed preferences page renders from a
  shared HTML shell (`convex/lib/mailPages.ts`) and the same rows as Settings > Notifications
  (`MailSubscriptionsCard`, through `emailPrefs.mine` and `turnOffMine`). The address always comes from the
  token or the signed-in account, never from a row id, and both routes only turn mail off. Kind ids that
  appear in emailed links are never renamed.
- **One breadcrumb bar on every public page** but home (`components/layout/SiteBreadcrumbs.tsx`), its trail
  named from the menus by `lib/breadcrumbs.ts`. The bar emits the BreadcrumbList when the trail ends at the
  page; a detail page the menus can't name calls `breadcrumbSchema(path, name)`. Never two lists on a page;
  a test reads the page files and fails on a top-level page the menus don't name. The small all-caps
  labels above H1s that repeated the section are gone; where one carried a date, the date moved into the intro.
- **Every chart explains itself on hover or tap** through `components/data/ChartTips.tsx` (marks carry
  `data-tip`, lines split on `\n`; arrows, Home, End and Escape work too).
- **Less visible text**: dataset coverage folds under the source lines (`DataProvenance`); visible
  paragraphs of 40+ words went from 106 to 59 across the public pages (the rest are legal pages, rare
  error states and sentences built from live figures); 12px text became 14px on public pages by an AST
  codemod that skips SVG. The signed-in app still has 12px in places, to be checked in a browser.
- **The attorney hero is an example docket** (`components/home/DeadlineDocket.tsx`), computed at build by
  the central deadline rules, replacing an AI illustration that carried a generator's watermark.
- **Switching a calendar type off now removes its events from Google Calendar.** The settings page calls
  `users.updateUserProfile`, which saved the switch and nothing else; the function that scheduled
  `googleCalendarActions.bulkDeleteEventsByType` had never been called. The update now schedules it for
  each type that goes from on to off (`convex/users.test.ts`, probed).
- **Cleanup**: about 90 dead source files, 18 public Convex functions with no caller, the retired Convex
  mirror modules (their tables stay in the schema), completed migrations (checked in production first),
  12 unused packages, the UI barrel, and in `scripts/` the shared database helpers moved into
  `lib_db.py` and `lib_slugs.py`, with 15 scripts and the two USCIS workflows deleted.
- **Convex queries and mutations deny cryptographic randomness**, so `crypto.randomUUID()` there fails in
  production while edge-runtime tests pass. Entry ids come from `convex/lib/ids.ts` `newEntryId(prefix)`.
- **No comment names the owner or quotes chat.** A comment states the rule. Comment-only rewrites were proved
  by printing each file's AST without comments before and after and comparing.
- **Deleting a route leaves stale generated types** (`.next/types`, `.next/dev/types/validator.ts`) that fail
  `typecheck:app` with "Cannot find module". They're generated: delete them.

## Oct 4 2026 (evening): a search that ignored twenty presses, a pattern no month matched, and a clearer alert

**A form's submit reads the boxes themselves** (`src/lib/forms/formText.ts`). PostHog recorded an
iPhone (Chrome for iOS 154) on /perm-cases at 5:59 PM EDT: a name typed and two months picked,
Search pressed twenty times, the form's own submit event firing each time, and not one request,
because the component's copy of the name was empty while the box showed it. Chrome for iOS runs
its own form script on the page (`__gcruniqueid` attributes in the autocapture chain), and React's
value tracker can then treat real typing as no change. `formText(form, name, state)` reads the
field from `FormData` at submit and falls back to state when the form doesn't carry it (no
`name`, disabled). When the two disagree it sends `form_field_desync` with the field's name and
the path, never the value, so how often this happens is measured. The /perm-cases forms, the
wage-request and LCA search, the all-programs search box and the email box on the five alert
forms read their fields this way; each of those fields now carries a `name`. The sign-in, sign-up and
reset-password forms gate their buttons on React's copy (a disabled button until the email looks
valid), so reading at submit can't help them: `useFormDomSync` (`src/hooks/useFormDomSync.ts`)
listens on the form natively for input, change and leaving a field and copies each named field's
value into its setter, so an autofill React never heard about still wakes the button.

**Every search press is answered.** A name under two letters, an empty case box, and a month box
holding something that isn't a month each print a `role="status"` sentence instead of doing
nothing. The /perm-cases forms are also seeded from the URL (`case`, `field`, `q`, `title`,
`from`, `to`), so a press before the page's script has loaded, which submits the form the plain
way, still runs the search after the reload.

**The /perm-cases month boxes carried `pattern="\\d{4}-\\d{2}"`.** In a JSX attribute a
backslash is not an escape, so the browser saw a literal doubled backslash and no month could
ever match. Chrome and iPhones draw a month picker and ignore `pattern`; Firefox (and any browser
without `type="month"`) draws a text box, applies it, and refused the search outright. Reported
through the contact form on Oct 4, 5:31 PM EDT. The pattern is gone; `MONTH_INPUT_RE` was
already the check, and an unreadable month is now named. `CaseBrowser.test.tsx` holds both, each
probed red against the old code.

**The defense's alert says what filled the app.** The 2:07 PM EDT Under Attack Mode alert said
"0 people shown the busy page", which read as a false alarm. It wasn't: about 880 addresses asked
for search and employer pages once or twice each, 841 page requests got the busy reply in three
minutes, and Under Attack Mode cut traffic from about 960 a minute to about 90. A scraper never
draws the busy page, so the people count stays at zero. `what_filled()` and `lead()` in
`bin/permtracker-defend` now open the email with the refused count, the browser labels and the
busiest sections; installed on the server by hand (scripts/oracle isn't deployed by a push).

**A storage spy on `window.localStorage` can't be undone on happy-dom or jsdom**: the storage
object is a Proxy. `SavedReceipts.test.tsx` faked a refusing browser that way, and under CI's
shuffle the fake leaked into the next test, so Tests was red on main from 12:15 PM EDT. It now
swaps the whole `window.localStorage` getter and restores it in a `finally`; reproduced on 3 of 6
seeds before, green on 8 of 8 after.

**robots.txt's `Disallow: /api` blocked `/api-terms`**, because a robots path is a prefix, and
Search Console listed the page "indexed, though blocked by robots.txt". robots.ts had a comment
warning about exactly this. `PUBLIC_UNDER_A_DISALLOW` re-opens such pages with an allow rule (the
longer rule wins, RFC 9309), and `robots-public-pages.test.ts` walks every page under the public
tree with that longest-match rule; probed red with the allow removed. Of 5,577 sitemap pages
checked against the live file, `/api-terms` was the only one blocked.

## Oct 5 2026: a law firm can claim its page (free)

- **The check is DOL's own record.** `scripts/build_firm_domains.py` (monthly, `firm-domains.yml`, on GitHub's
  runners because www.dol.gov refuses the server) keeps only the email DOMAINS the newest PERM (`ATTY_AG_EMAIL`), PW
  and LCA (`AGENT_ATTORNEY_EMAIL_ADDRESS`) files print beside each firm, in `firm_email_domains`, per program. Personal
  mail and a domain on more than 3 firms never count. A claim from a domain tied to the firm (2+ filings, or every
  emailed filing of a small firm; `claimVerdict` in `src/lib/firmProfile.ts`) verifies on the emailed click; anything
  else waits for the admin (Admin > Firm claims). A claim the admin rejected or revoked never verifies itself again.
- **Links that grant expire** (`convex/lib/expiringToken.ts`): 7 days to confirm, 2 days to edit, the expiry inside
  the signature. The alert tokens never expire and are only for turning mail off.
- **What shows**: `firmProfiles` (website on the verified domain unless the admin approves another, a 600-character
  plain-text description with no links, phones or names, languages, offices, practice focus), in a "From the firm"
  block marked as the firm's own words. The page reads it with `queryStatic` on its 30-day window, and every change
  POSTs `/api/revalidate-firm` with `REVALIDATE_SECRET`, set on Convex production Oct 5 2026 from the server's
  `/srv/permtracker/app/env/production.env` by pipe (never printed; read back by name only).
- **First real load, Oct 5 2026, 5:34 AM EDT**: 8,486 firm and domain pairs (PERM 3,155, PW 2,777, LCA 2,554), read
  back from the table. DOL's FY2026 Q3 sheets declare 596,000 to 846,000 styled empty rows past their last case;
  the script counts them as `blank`, so its case counts now equal the files' (112,550 / 147,244 / 437,496). The dry
  run had read them as 925,430 "rows" without a firm, which looked like a misparse and changed no pair.
- **Email**: its own pool, `firmClaim`, 10 a day, charged before anything is staged; a full pool queues (`kind: "firm"`).
- **Routes**: `/firm-claim/request` and `/firm-claim/edit-link` (JSON, to the .convex.site twin); `/firm-claim/confirm`
  and `/firm-claim/edit` are emailed links, rewritten in next.config.ts and relayed by nginx with the other email links.

## Oct 5 2026: a firm's own words wait for review

The owner's call, Oct 5: nothing a law firm writes shows on its page until the admin has read it. Until then a
domain-verified claim published its profile the moment the link was clicked, and every later edit went live at once
(only a website off the verified domain waited).

- **`firmProfiles` holds two versions now**: the top-level fields are the APPROVED one, the only one the page reads;
  `pending` is what a verified firm sent (with the claim that sent it, `pendingAt` indexed for the admin list), and
  `lastReview` keeps the newest decision and a declined version so the firm can fix and resend it. A row can exist
  with nothing approved, which shows nothing; `publishedAt` is set on the first approval.
- **What waits**: a domain-verified claim's first profile and every later edit (`submitProfile` in
  `convex/firmClaims.ts`). What doesn't: a claim the admin approved by hand (the admin read the profile with it),
  taking a profile down, putting an approved one back up, and a version with nothing in it.
- **Admin > Firm claims** lists "Profile changes waiting" with each changed field before and after, a flag for a
  website off the verified domain, Approve (publishes, refreshes the page, emails the firm) and Decline with an
  optional reason (the page keeps what it showed; the firm gets the reason and finds its text on the edit page).
- **How the admin hears about it**: one email a day at most, sent when the first item arrives
  (`noteReviewWaiting`, a 24-hour limit charged before it's scheduled), and the 7:30 AM morning report's "Law firms
  waiting for review" section, which lists every firm and how long it has waited, marked to watch until it's done.
  The per-claim admin email it replaces could have sent ten a day.
- **The switch for later**: `FIRM_PROFILE_REVIEW` on the Convex deployment, `manual` (default) or `auto`. The automatic
  check (`autoReview`) isn't built and holds everything, so `auto` can't publish unread words; its comment says what
  it should check and where it would run (the app's AI provider fallback, or a Claude routine).
- The decision emails ride `sendOrQueue` outside the `firmClaim` pool: one per admin click.

## Oct 5 2026: what checking the new pages in a browser found

- **DOL's live wage search names a series by the June that CLOSES it.** `year: 2027` answers with the July 2026
  file's figures; the tool sent 2026 for "July 2026 to June 2027" and showed last year's levels from Sep 9 until
  this fix. Checked against DOL's own downloadable tables for two occupations, and the area list follows the same
  rule (Connecticut's new area names arrive at 2026, the year its 2025-26 file first printed them). The site keeps
  naming a series by its July (labels, stored tables, DOL's file names); only `dolSearchYear` in
  `src/lib/wageLevels.ts` adds one. The live search answers series from July 2022 on.
- **Some DOL levels are already yearly.** Rows labelled "Annual Wage" (teachers, professors, pilots, athletes;
  60,919 in 2026-27) hold yearly amounts, and the 2021-22 and 2022-23 files carry no label at all. `toYearly` in
  `src/lib/db/reference.ts` is the one conversion: as published when DOL labels the row yearly or an unlabelled
  level is $5,000 or more (no hourly level in any year passes $807, no yearly one falls under $15,080), else hourly
  x 2,080. Multiplying a pilot's $139,960 gave $291 million on Appleton, WI's city page.
- **A city in several counties lists them all** (`city_geo.counties`, JSON) and says how many DOL wage areas they
  fall in (`city_geo.wage_areas`): 310 of 3,555 cities span several counties, 73 of them across wage areas. The
  wage area shown is the one at the city's center, and the page says so. The reader selects `*`, so a table
  loaded before those columns existed still answers.
- **`PayBands scale="auto"`** gives each row its own scale when one axis would squeeze a row under 12% of the width
  (city pages compare jobs paying $30k with pilots at $360k); one job across areas keeps the shared axis.
- **A source line must be a readable name.** Six new loaders stamped bare URLs as `data_freshness.source`; State's
  had a 56-character first segment with no break, and two pages scrolled 75px sideways at 320 wide. Each loader
  now stamps a `SOURCE` name, the six production rows were renamed in place, and `DataProvenance` wraps anywhere.
  Ten older datasets (WARN states, visa limits, the H-1B hub) still print addresses; they wrap now.
- **A share is never rounded to 1 while a denial exists** (`src/lib/api/share.ts`; the extension's
  `certifiedPercent`): Google's 1,608 certified and 4 denied had printed as "100%".
- **The H-1B lists on city pages** are 44px rows now (the links were 24px). The bulletin line page's alert form
  still has the shared 24px date-picker button; that's the shared DateInput, not this batch.
- **The dev server sends `X-Frame-Options: DENY`**, so the same-origin iframe sweep can't run against it.
  `node scripts/phone_sweep.mjs <base> <path>...` does it in one headless browser at 390 and 320 wide: page scroll
  width, the culprit when it overflows (it hides each section of `<main>` in turn), text under 14px, standalone tap
  targets under 43px. Its first run was mostly itself: the phone menu drawer sits off-screen on purpose, and a link
  clipped inside a truncated row isn't overflow, so only the page's own scroll width is a verdict.
- **`node scripts/gsc_queue.mjs`** lists the public pages changed since the Search Console queue's last commit
  (new pages, pages whose own content changed, one sample per changed family; files feeding more than 15 pages are
  left to the sitemap's lastmod). It shares `scripts/lib_page_inputs.mjs` with `page_dates.mjs`, so the queue and
  the sitemap dates agree on what a change touches. Run it after every deploy; the automatic round runs it too.
- **Cloudflare kept the pre-deploy HTML for up to a day** (`s-maxage=86400`; a deploy clears nothing there), so the
  table fix above stayed invisible until the copies were purged by hand. The deploy workflow now runs
  `node scripts/gsc_queue.mjs --since <push's before> --purge` after the switch: the same page list, sent to
  Cloudflare's purge API, the homepage by its exact URL and everything else by prefix (a family's prefix covers every
  page in it, query strings included). It compares commits only, because the build has already rewritten tracked
  files by then. Cloudflare DOES store click data (corrected Oct 10 2026: the BYPASS this said was measured on a
  307; a real `?_rsc=` answers MISS, then HIT), and a prefix purge drops it with the page. Free plan: 5 prefix requests a minute, 100 prefixes each; chunks wait 13 s. It needs
  `CF_PURGE_TOKEN` (Zone > Cache Purge on permtracker.app only) and `CF_ZONE_ID` (set Oct 5) as repo secrets;
  without the token, on a manual run, or when Cloudflare refuses, it says so and the deploy carries on.
  `--dry-run` prints the list and sends nothing. Its first run in CI (the deploy of `452c3281`, Oct 5) compared against
  `22a3f9be`, found no public page changed and stopped before needing the token.
- **A build that dies in `next/font` with "Cannot read properties of null (reading '1')"** is Google Fonts answering
  the runner with something its parser can't read; nothing in the push caused it. Re-run the failed job (Oct 5: the
  re-run of the same commit built and deployed).
- **Testing Library's cleanup is registered in `vitest.setup.ts`.** It registers itself when first imported
  (`globals: true`), and the `unit` project shares a worker between files (`isolate: false`), so only the first file
  got the hook: `useFormDomSync.test.tsx` found the test before's `<input>` still in the page. Reproduce a shared-pool
  leak with `--no-file-parallelism --no-cache` and the files in size order: vitest runs a file that failed last
  time FIRST, so a plain rerun passes and proves nothing.
- **Run the rendered glued-text audit BEFORE the push** (`python3 scripts/audit_glued_text.py --base
  http://localhost:<dev port>`; it rewrites the sitemap's paths onto the base). Run only after the deploy, it found
  9 glued pairs in the new tables' `<th>` and `<caption>` text ("JobBLS median") that the source gate can't see.
  Every header cell and caption carries a trailing `{" "}`, exactly like a data cell.
- **`make-page-cards.mjs` reads its fonts from `.next/static/media`**, which only a production build writes; a
  worktree with only a dev server has none, so copy the two `.woff2` files from a checkout that built.

## Oct 6 2026 (afternoon): the case page answers first, accounts say who they're for, alerts get rated

The owner asked whether the site gets people where they need to be (14 days of PostHog: 35% of visits look
up a case; case alerts are the weakest step, about 2.5% of lookup visits) and whether sign-ups land in the
right place. What changed:

- **The case page's answer card names the estimated date** ("Estimated decision: around October 27, 2026")
  with an "Email me changes" button that jumps to the alert form (`#watch`) and a link to the estimate panel
  (`#estimate`). The estimate is built ONCE in `CaseStatusResult` (`buildCaseEstimate`) and handed to both the
  card (`NextSteps`) and the panel (`CaseEstimatePanel`), so they can't name different days; with the date
  above, the panel leads with the window instead of repeating it (`dateShownAbove`). Measured on a dev server
  against production data at 390 wide: the date is 1.3 screens down; it was below the record cards, which
  sat at 4.1 screens. The case-number plate and the record card now sit below the alert form: the card
  already states the status, the filing date and the queue.
- **The homepage board says "Decided Oct 5"**, a date: "DECIDED MON" in capitals read as "decided month".
- **Three glued pairs on the case page** (the estimate's fine print, the same-day strip, the status
  explainer) were fixed. The sitemap-driven audit never sees `?case=` pages, so check one by hand with
  `glued_pairs()` from `scripts/audit_glued_text.py` after changing that page.
- **Every account is marked by who it's for** (`convex/lib/audience.ts`, from the onboarding role in
  `userProfiles.jobTitle`): practice (attorney, paralegal, HR, employer, or a typed title naming that work),
  own case, other, or no role. The admin page has "In practice" and "Tracking own case" cards and a "For"
  column; the morning report splits accounts and sign-ups the same way. Nobody is turned away; "Other" stays
  its own bucket (owner, Oct 6: keep it).
- **"Waiting on my own case" is listed first and gets its own step** (`OwnCaseStep`): one case-number box,
  then `caseAlerts.watchMyCase` watches it on the account's own address. A verified account (Google, or a
  password account with its code) starts watching at once with no confirmation email; an unverified one
  takes the ordinary double opt-in through `subscribe`. The wizard ends there (step `done`) and opens the
  case page. "Don't have the number?" goes to `/case-search`.
- **A case's last alert asks "How useful were these alerts?"** with five boxes (`RatingRow`), **only while
  `ALERT_RATING_ENABLED=1` is set on the Convex deployment** (`ratingsOn()`; off until the owner has seen the
  pages, set by hand). Each box opens `/case-alert/rate` (Convex, `convex/alertRatings.ts`, relayed by nginx like
  every alert link) with the pick marked; the GET records nothing, the tap on that page is the POST that does.
  The thanks page matches the score (`ratingWords`): a 4 or 5 is thanked and offered the Senja review link
  (`REVIEW_URL`), a 3 is asked what would have made it a 5, a 1 or 2 gets "Sorry they fell short" and "What went
  wrong?". The note (plain text, 1,000 characters) has "Leave my email off this note": the row then keeps only
  `key` (SHA-256 of address and case, for one row per person and case) and drops the address and case number for
  good. "What comes next" follows the final status (`nextSteps`): certified goes on to the green card, denied to
  the denial guide. The link is signed for `alert-rating` only and a rating is kept only for a case that
  address watched. The morning report shows the week's count, average and newest notes once anyone rates. The
  final alert also drops "It isn't a decision on your case", which a final status contradicts.
- **The admin user CSV had one more heading than cells** ("Firm Name" with no value), so every column after
  "User Type" sat under the wrong heading. Fixed, with Role and For columns, and a cell a spreadsheet would
  run as a formula is written as text.

### The funnel round, same afternoon: every door leads to a case

PostHog, 14 days, scraper browsers left out: employer pages are the biggest way in (3,237 sessions, 63% leave
after one page, 15% reach a case lookup), then the case page (2,691), the homepage (1,856), law firm pages (615,
89% one page, 2% lookup), the wage-request and LCA pages, the timeline calculator (317, 6% lookup) and guides
(249). What changed:

- **`CaseNextStep`** (`src/components/tools/CaseNextStep.tsx`) is the one next step for someone waiting on a
  case: a question in the page's terms ("Waiting on a case with Adobe Inc.?"), the case-number box (the
  compact `CaseLookupForm`, its help line read by screen readers only), "Don't have the number?" and one extra
  step. It sits under the header on all three employer page variants (the published one after its debarment
  and WARN notices; extra = follow by email) and on law firm pages, at half a screen on a phone. The bottom
  `DecisionEstimatorCard` (which only linked to the calculator) is deleted.
- **Every article's ending sent its readers to sign up.** `ContentCTA` said "Check any case number for its live
  DOL status" over one "Get Started Free" button to `/signup`, under all 53 guides (47 written for people
  waiting on their own case), the blog and the changelog. It now leads with `CaseNextStep` and gives people who
  file cases a smaller door to `/for-attorneys`. Probably one source of the "Other" and no-role accounts.
- **Queue month pages** carry the next step ("Filed in February 2026?") and, while DOL hasn't reached the
  month, a queue alert that starts on that month (`QueueAlertForm defaultMonth`).
- **The timeline calculator's answer** is followed by "Email me when DOL reaches <month>" (to its alert form,
  `#queue-alert`) and "Have the case number? Check the case itself".
- **The no-record result** offers the employer search beside "check the digits".
- **The funnel can be counted now.** `case_lookup_submitted` (`{ source }`, from `CaseLookupForm` when a page
  names itself) and `alert_signup` (`{ kind, outcome, ... }`, `src/lib/alertSignupEvent.ts`, from all four alert
  forms; never the address). Before this, PostHog had no event for an alert sign-up at all.

## Oct 7 2026: the data rail has group icons

Each of the rail's eight groups carries one Phosphor icon (`GROUP_ICONS` in `DataRail.tsx`, typed by
`DataGroup`, so a new group without one fails the typecheck), its name in sentence case in the
heading face (it was mono capitals) and how many pages it holds; the caret moved to the right. The
48 pages keep no icons: most have no picture that tells them apart, and one that doesn't separate
rows is decoration. Collapsed, the rail is a strip of Overview and the group icons, the group
holding the page lit; a group's square opens the rail at that group with focus on its heading, and
each toggle hands focus to the one that replaces it. The groups render in both the desktop rail and
the phone panel, so their ids carry where they are (`rail-…`, `panel-…`); they had been duplicated.
`DataRail.test.tsx` holds the icons, the spoken names ("Case tools, 7 pages"), unique ids and both
strip behaviours; row heights didn't change, so `rail-fits.test.ts` holds as before.

## Oct 9 2026 (morning): stale figures, from a screenshot of the homepage

The owner's phone showed the homepage reading "Checked against DOL 4:01 PM ET, Oct 2" and "DECIDED THU" on
Oct 9. Every server-side copy was current, checked in this order:

| layer | what it held | how it was checked |
|---|---|---|
| the origin (both copies) | Oct 8, 3:59 PM | `curl -H "Host: permtracker.app" http://127.0.0.1:8081/` on the server |
| Cloudflare | Oct 8 | its Cache Rule respects the origin; nginx sends `Cloudflare-CDN-Cache-Control: max-age=600, stale-while-revalidate=3600, stale-if-error=86400` |
| the browser's HTTP cache | re-fetches | a local page with the homepage's exact header, opened three times in Safari and in Chrome (navigation and link click): a new copy each time |
| the service worker | never caches documents | `src/app/sw.ts`: documents are `NetworkOnly` |

"DECIDED THU" is the board's format before Oct 6, so the page was drawn by code no server has run since: a
tab or home-screen page left open. **`RefreshWhenStale`** (`src/components/ui/refresh-when-stale.tsx`, in
the public layout and `EmbedFrame`) calls `router.refresh()` when a page becomes visible again (a tab
switch, an unlocked screen, a back-forward restore, coming back online) and its figures are 30 minutes old
or more. `router.refresh()` keeps what the reader typed.

**Typed DOL figures.** DOL's average and queue month were typed into seven places ("about 372 days as of
August 2026", "working cases filed around September 2025") while DOL said 336 days and December 2025.
`lib/dolNow.ts` words them from the processing-times snapshot with DOL's date; `<DolNow />` puts them in
an article (`show="average"` or the default whole sentence) and the FAQ reads them on render (it's on
`revalidate-dol`'s list now, with a daily window). Blog posts gained the guides' daily window.
`no-typed-dol-average.test.ts` fails on a typed one; a sentence about what DOL said on one named day, beside
what other tools said that day, is a dated record and is listed there by file.

**`PageBasics` answers can read live figures** (`figures=` prop, an answer may be a function of them). The
two "how many" answers (I-485 pending, EB-2 India awaiting a visa) read their page's own figures; the
others dropped counts that only restated the page.

**next-mdx-remote 6 strips every JavaScript expression by default.** `blockJS` defaults to true since the
Feb 12 2026 upgrade (the fix for CVE-2026-0969, which is about compiling untrusted MDX), so each
`<ComparisonTable rows={[...]} />` got no rows and rendered nothing, and every `<Step number={1}>` lost its
number: 47 of 79 articles, live, for eight months. Nothing errored and no gate looked for a table. Every MDX
source here is a file in this repo, so `createContentDetailPage.tsx` sets `blockJS: false` and keeps
`blockDangerousJS: true`. Measured before and after over all 79 articles on a dev server: every page 200,
tables 0 to 1+ on 24 articles, step numbers back on the rest. `ComparisonTable` cells are React nodes now,
so a cell can hold `<DolNow />`. Article table headers went from 13px to the 14px floor (an unlayered
`.prose-neobrutalist thead th` rule in `globals.css` sets them, whatever the component's classes say).

**The dev server's Turbopack cache filled the old Mac's disk** after about 200 routes were compiled for
link checks (`ENOSPC`, and then the Bash tool itself couldn't start). `rm -rf .next/dev/cache` freed 8.5
GB and regenerates. Stop the dev server when a sweep is done.

**Scanner and in-app-browser noise (Oct 9 2026, 5:30 AM EDT).** A WordPress scanner (one address, 14
requests in 3 seconds on Oct 8) POSTed to `/index.php`, Next answered 500 and Sentry opened two issues.
nginx now answers `.php` paths and the WordPress folders (`/wp-admin`, `/wp-content`, `/wp-includes`,
`/wp-json`, `/wordpress`) with its own 404 before the app, as the first regex location (nginx takes the
first regex that matches), anchored so an employer page like `/perm-employers/wordpress` never matches;
`test_nginx_conf.py` holds all three, with two probes. Installed by hand and reloaded; new workers
confirmed. PostHog's filter drops errors that name another app's in-app bridge, a crypto wallet's
`window.ethereum` or an iPhone web view's `window.webkit.messageHandlers` (`fromInjectedBridge` in
`src/lib/exceptionNoise.ts`); the wallet one tripped the new-error-type alert at 3:27 AM EDT.
GitHub's secret-scanning alert 1 (a "Stripe webhook signing secret") was the Python package's made-up
test key; resolved as used in tests, and the key is split in two in the test so the pattern can't
match it again.

## Oct 10 2026 (night): the "reading 'call'" crash, found

A Sentry email (issue 53, a signed-in visitor on an employer page, 3:55 PM EDT) carried the stack that settled it.
The page ran today's webpack runtime, and one chunk it loaded carried `?dpl=87cd0b41…-1`: a build from Sep 29.
Module 36243 in that old file asked for a module the live build doesn't have. Sentry decoded the old frame with the
old build's source map, which is why it named `motion-dom@12.43.0` (we've shipped 13.4.1 since Sep 30).

**The mechanism.** Next decodes navigation data, loading every chunk it names, and only THEN compares the
response's deployment with its own (`fetch-server-response.js`, `segment-cache/cache.js`). Every build's files stay
downloadable from `shared/`. Webpack's chunk and module numbers repeat between builds, and all builds pushed into
one global list, `webpackChunk_N_E`. So stored navigation data from an older build put old chunks into the live
page: an old file could claim a chunk number the live build later needed (that chunk never loads; its modules are
missing), or old code ran and asked for old modules.

**Where the old data came from.** The browser: Next labels every shareable response `s-maxage=…,
stale-while-revalidate=30931200`, nginx passed it to browsers unchanged, and Chrome and Edge reuse a stored response
under that label for up to a year. An 11-day-old payload can only be the browser (Cloudflare's own copy lives 10
minutes plus an hour, from `Cloudflare-CDN-Cache-Control`). This is why it hit returning desktop Chrome and Edge,
almost never Safari, never a headless scraper (empty cache every visit), about half a second after load
(prefetches), and why it began after the move off Vercel, which rewrote that header for browsers.

**The fixes.**
- **nginx sends browsers `public, max-age=0, must-revalidate`** for every response the app marks shareable
  (`$pt_browser_cc`, installed 7:56 PM EDT; Vercel's header). Cloudflare still reads its own header: pages and
  navigation data showed HIT on a second request after the change. Private answers pass through unchanged.
  `test_nginx_conf.py` holds it, with three probes.
- **Each deployment has its own chunk list** (`chunkLoadingGlobal` in `next.config.ts`, from `DEPLOYMENT_ID`), so
  an old build's files register where the live runtime never looks, whatever route they arrive by (the browser,
  Cloudflare's copy in the hour after a deploy, a tab left open across one). Cost: every chunk's name changes on
  every deploy, so returning visitors download the scripts again once per deploy, and `shared/` grows by about
  11 MB a deploy (210 MB on Oct 10; nothing prunes it yet).
- **The crash recorder reads every chunk list** (`lists` in `chunkDiagnostics`): a second list on a page is an
  older build's files, named by its deployment. **Sentry files every missing-module crash as one issue**
  (`fingerprint`), where each build's new minified names had opened a new one (4Y, then 53).

**Ruled out on the way:** the duplicate chunk ids the recorder kept reporting ([823, 3204, 6061, 8442] and others)
are the same chunk emitted under several names in one build (same code, different minified parameter names);
an overlap scan found no pair of files in the live release that could drop a module.


## Oct 11 2026 (early morning): a visual pass, and what the owner kept

Commits 92c3a199, d2665337, f87729f0, c777a395, 28d22c4e. Before and after captures are on the
Design canvas "PERM Tracker page redesigns" (claude.ai artifact); the prose measurements on the
Dashboard "PERM Tracker redesign tracker".

- **Film posters.** `public/videos/explainer-*-thumb.webp` are the films' play buttons (FilmPlayer
  draws nothing over them), so they carry the title, the audience, Play with the running time, and a
  real product frame. The Oct 7 re-cut replaced them with the end card. `node scripts/make-film-posters.mjs`
  rebuilds them (ffmpeg, ffprobe, Chrome): each film's `at` second and `crop` sit in its `FILMS` entry,
  chosen clear of the burned-in caption. Re-run after any re-cut.
- **Homepage.** The definition under the H1 stays word for word (`about-surfaces.test.ts`); the two
  halves are two short icon lines. Questions are two columns, 16px answers, no eyebrow or fade-in.
- **One motion moment: `TapeReveal`** (`components/tools/TapeReveal.tsx`, CSS in `globals.css`,
  `[data-tape]`). `QueueTape reveal` (homepage only) fills the cleared months left to right, then
  lands "DOL is here". The server renders the tape filled; the client arms it only when it starts
  below the fold, never under reduced motion or without IntersectionObserver. Animate the flag with
  `transform`, never `translate`: Tailwind's `-translate-x-1/2` is the `translate` property, and
  animating it knocks the flag off-centre.
- **The data pages' top.** `WatchLink` (`components/tools/WatchBanner.tsx`) renders inside
  `SiteBreadcrumbs` on data pages (`isDataPath && showsWatchBanner`), outside the breadcrumb `<nav>`:
  a lime tab flush right, a 44px bell square below `sm`, the pitch beside it from `xl`. The rail's
  collapse control is a 44px `SidebarSimpleIcon` button in the rail's top corner (`-mt-1` takes the
  nav's 4px top padding so `rail-fits.test.ts` keeps its 40px), and the first square of the strip.
- **Glossary map.** `GLOSSARY_STAGES` (`lib/glossaryStages.ts`): six stops in order plus two groups
  beside the road; `glossaryStages.test.ts` fails on a term placed twice, missing, or unknown. Letter
  headings are `<h3>` under "A to Z".
- **Counts as numbers.** Status meanings: the count is the row's number (`Count`) with a bar against
  the busiest status in its group (`ShareBar`); the date is said once per section. The RFI page's
  stage glossary keeps a short date under each count (stages are read on their own days). Count
  links are 44px with a negative margin so rows don't grow.
- **Owner's calls.** He undid a re-layout of /press and the firm's-site section ("i actually like the
  old press and firm pages"): both are back at 3c5eb93d with two fixes kept (`break-words` on the
  credit box, the checker iframe `h-[18.5rem] sm:h-[15rem]`), and the newspaper specimen quotes the
  live hold count. A recheck proposes; it doesn't redo an approved layout.
- **Instruments.** `node scripts/phone_sweep.mjs <base> <paths>` for 390/320; compare its counts
  against production before calling a finding new (several were). `audit_glued_text.glued_pairs()`
  on each changed page's HTML. The homepage FAQ hides answers with CSS rows, so
  `audit_visible_text.py` counts them as visible: its homepage prose share overstates.

## Oct 11 2026: every article picture its own, articles by topic

**Topics.** Guides and blog posts are filed by `category` under `src/lib/content/topics.ts` (guides:
start, case-status, queue, deadlines, wages, employers, green-card, seasonal; blog: data-notes,
explainers, practice). The listings are one section per topic with topic buttons and a search box
(`ContentListing`); the article header names the topic and links to its section. Changelog keeps
Release, Feature or Correction. `article-topics.test.ts` holds both, and titles are sentence case
(`seoTitle` stays Title Case for search).

**Pictures.** Every article's header picture and every picture or recording inside it is its own;
`article-pictures.test.ts` fails on any repeat and on an uncredited figure. Where they come from:

| file | what it says |
|---|---|
| `scripts/article-heroes.json` | each article's header: a licensed photo, a page of the form it explains, an app tour picture, or a capture of the site |
| `scripts/article-figures.json` | pictures inside an article, keyed `<type>/<slug>/<name>`, kept at their own shape |
| `scripts/capture_article_heroes.mjs` | one Chrome, one page at a time. Clips: `h:` (the heading's section), `hp:` (its parent), `from:` / `fromm:` (from the heading down, as wide as its parent / the page's main), `cap:` (an agency table by its caption, clipped on screen), `sel:`. Options: `fill` (type into boxes), `css`, `clock` (Storybook runs on the tour's recording day), `ready`, `settle` |
| `scripts/make_article_heroes.py` | 1600x1200 WebP headers, figures at their own shape |
| `scripts/record_tour_videos.mjs` | 5 app recordings from the Storybook tour: dates typed, deadlines worked out. Frames from Chrome's own screencast, put together by the conda ffmpeg (Playwright's video recorder needs its own ffmpeg download, an install) |

- **Run the site captures against the local dev server on production data**; production answers a
  script's `?case=` lookup with Cloudflare's challenge. Real case numbers come from the read-only
  database; pick large employers' cases, never a small business's denial.
- **The capture hides `.fixed`** (site header, floating buttons), which also hides the tour's chat
  panel: that capture overrides it with `css`.
- **Tour app sections put their heading in a header block**, so `h:` catches only the heading; use
  `fromm:`. The edit form mounts a section's fields when it scrolls into view: scroll to the section
  above first (`scroll`), or the clip is an empty box.
- **Storybook's first load after a lockfile change re-bundles dependencies for minutes** and every
  story shows "No Preview" meanwhile: wait for `#storybook-root` to hold text.
- **An agency page can reflow when a screenshot stretches to full height** (flag.dol.gov's clip came
  out one table low): `cap:` clips from the screen after scrolling the table to the top.
- **The articles' remaining February screenshots are in old changelog entries**, where showing the
  interface as it shipped is the point.

**Fixed on the way:** case pages and alert emails said statuses came "via a third-party mirror"
(DOL directly since Aug 27); a priority-date FAQ said nothing reached the page from State (read daily
since Sep 26); **I-203 is the E-3 LCA** (DOL's file: I-200 H-1B, I-201 and I-202 H-1B1 Chile and
Singapore, I-203 E-3 Australian), not an H-1B one; the case card tab printed "I140" (it now uses
`STAGE_VISUALS[...].label`); the queue stage colours match the month page (line ink, out of order
amber, appeals red); `hover:text-primary` and its group-hover and focus forms paint the lime ink in
light mode (they were 2.05:1 on paper, in 151 files).

**A stale Turbopack cache makes every nested route 404 on the dev server**: stop it, `rm -rf
.next/dev`, start again.

## Oct 11 2026 (afternoon): employer pages in parts, sources on screenshots, answers before input

**The employer page** (`perm-employers/[slug]`, published branch) is a `ProfileHeader` and seven `Chapter`s under a
sticky `ChapterNav`: right now (live queue, follow, newest filings, layoffs), how long, every program, against others,
the work, history, notes. The bar sits at `--site-header-h` and marks the part on screen (IntersectionObserver,
`-25% 0px -65% 0px`); below `lg` it pads past the data rail's fixed 44px handle. Debarment and the too-few-cases band
sit inside the header ABOVE the stat grid (`EntityContext.test.tsx` reads the page source for that order). The median
wage card drops out when there's no median; `ingest_perm_disclosure.py` now writes `medianAnnualWage` per employer and
law firm, which fills at the next disclosure load. Law firm and other entity pages still use the old layout; the three
parts are built to be reused there.

**Where pending data comes from, inside the box.** On Oct 10 and 11 an X account (70K views on one post) posted
screenshots of Microsoft's and TCS's newest LCAs from our employer pages; replies asked where the data came from,
since DOL hadn't published its next quarterly file. Checked first: the ten LCAs in the screenshots matched DOL's live
service exactly (status, employer, title, filing time), and so did 100 of 100 sampled held Microsoft PERM cases. The
gap was ours: the boxes didn't say. `FromDolLive` ends both pending-filing lists with DOL's case-status service and a
link to flag.dol.gov, and every "DOL's daily check" in visible copy now names the service. **Never reply on X for the
site without the owner's yes**; a reply text was offered, not posted.

**Answers before input.** An embed sits in someone else's page at a fixed height, and a bare form in a blank frame
reads as unfinished. `DateRuler` draws a deadline as a ruler (ink for days gone, lime for days left, today, ticks with a
keyed list under the bar so no label can run off a phone screen) and draws it hatched before a date is entered: RFI
deadline, wage determination validity, priority date retention, H-1B six years. Citations fold under "The rules behind
it" (`RuleNotes`). Wage levels draw a four-step ladder (DOL's guidance names: entry, qualified, experienced, fully
competent), offers a box strip (middle half, median, the offer), lottery odds show DHS's chart before a lookup, and the
lookup embed shows `CaseNumberAnatomy` (moved out of the homepage hero) and DOL's queue month and average. No pulse on
a loading ghost: the house rule bars looping animation.

**Two pushes went red on whole-tree gates that `pnpm check` doesn't run**: `responsive-grid-tracks` (a grid holding
form controls needs `[&>*]:min-w-0`) and `no-glued-jsx-text` (`</p>` then `<p` on the next line needs `{" "}` even when
the paragraph ends with a space). The deploy waited for the suite as designed, so nothing broken shipped, but the widget
fixes from the morning sat undeployed until the next green push. Run `pnpm exec vitest run src/app/__tests__` (about two
minutes) before pushing new components.

**Capturing**: Chrome's full-page screenshot tiles past 16,384 px and repeats the top of the page; `seg-shot.mjs`
(scratch, `node_modules/.cache/qa/`) scrolls in 1,400 px steps instead.

## Oct 11 2026 (night): "did you mean" everywhere, the About page, the 404

**One matcher, `src/lib/fuzzy.ts`.** `fuzzyScore(query, candidate)` is the best of two readings:
word by word (exact, prefix, or within an edit allowance set by the word's length: none for 3
letters or fewer, 1 to 3 above; swapped neighbours count as one edit) and letters only (spaces
taken out, so "walmart" finds Wal-Mart and "j p morgan" finds JPMorgan). A query at the start of
a word scores above both, and one ending on a word boundary above that, so "intel" ranks Intel
Corporation over Intellectt. `rankFuzzy` ranks a short list; `FuzzyIndex` serves a long one,
picking candidates by letter triplets (rare ones first) and weighting equally close names by
filings (`0.85 + 0.15 * min(1, log10(1 + n) / 3.5)`), so "amazn" means Amazon. Tests:
`src/lib/__tests__/fuzzy.test.ts`, each probed red. On 298,000 real employer names it answered
in 1 to 200 ms.

**`GET /api/suggest?kind=employer|attorney|occupation|all&q=`** (`src/lib/db/nameSuggest.ts`):
every employer with a page (published, live-only, no-PERM), law firm and occupation, held in each
web process for six hours. 400 for a bad kind or a query outside 2 to 80 characters, 503 when the
names can't be read, `s-maxage=3600` when complete. Types live in `src/lib/search/suggestTypes.ts`
(the reader is server-only). `published` says a name has a PERM entity page (the comparison picker
offers only those).

**A large read starves inside a busy web process.** The first deploy loaded 20,000-row windows and
every one missed the read layer's 20-second deadline in production, while the database returned
the window (2.6 MB) in 0.19 s and a bare `@libsql/client` read it in 0.65 s on the same server.
The web copy was rendering pages. Now: 5,000-row windows, one source at a time, the event loop let
go between windows, the index built in slices (`FuzzyIndex.build`), and a search waits at most 2 s
per kind (`indexReady`) before answering with what's ready, naming the rest in `warming` (not
cached); `useNameSuggestions` asks once more 4 s later. Measure a slow read in a bare process
before blaming the database: `ssh` and import `lib-esm/http.js` from the release's pnpm store.

**Where "did you mean" shows** (`DidYouMean`, `useNameSuggestions`, `nameSuggestionChips` in
`src/components/search/DidYouMean.tsx`): the 404 (`NotFoundSuggestions` + `suggestForPath` in
`src/lib/search/didYouMean.ts`, which recognises a family address even with its name mistyped);
the palette (cmdk's `filter` is the site's matcher, and a forced-mount "Did you mean" group of
names); `FilterableStatTable` (server names with `suggestKind`, else its own rows by
`suggestText`); the case search, the PERM and wage-request/LCA browsers and the comparison picker
(a chip re-runs the search under that name); and, as the closest items shown in place of nothing,
the article listings, policy documents, debarments, the change feed and the app's timeline picker.
The page index the palette and the 404 share is `src/lib/search/siteIndex.ts`.

**The 404 page** is prerendered, so it reads the address in the browser
(`useSyncExternalStore` for mounted, no state set in an effect); it keeps answering 404 and
noindex. Inside the site layout (an entity page's `notFound()`) it renders under the site header.

**The About page** is built in one frame per section: the definition beside the portrait on a lime
slab with the live-since date stamped on it, who runs it with her bar record, both halves as the
app's real pages (`AppWindow`), the sources as an HTML flow, the homepage's record ledger
(`RecordStrip`, so the page moved from force-static to a daily window and joined
`api/revalidate-sweep/paths.ts`), the changelog's dated milestones, three refusals, one contact
band. Ink panels are `bg-foreground text-background dark:bg-card dark:text-foreground` with lime
as `text-primary-on-ink dark:text-primary-text`. "Nothing is modeled or crowd-sourced" was false
(estimates, people's own timelines) and now says estimates are graded on the scorecard.

**Smaller:** OPT employer tables show 25 rows and fold the rest, each total printed by its bar on a
phone; the scorecard shows its first two readings and folds the rest; the bulletin board says the
33 "open to every date" lines once as chips; the bulletin matrix tints Current and Unavailable;
the RFI stage line reads "DOL's record prints it as ..."; calculators and About lose their
all-caps labels. `svg-title-single-child.test.ts`'s floor is 3 (the About diagram's `<title>` left
with it).

**Capturing:** `node_modules/.cache/qa/` holds `top-shot.mjs` (1440 and 390), `dark-shot.mjs`,
`embed-shot.mjs` (560 and 360) and `load-shot.mjs` (waits for load, for /login and other pages
with sign-in widgets that never go network-idle). A PIL crop past an image's bottom fills black:
not a page defect. A dev capture right after an edit can beat the recompile.

## Oct 21 2026 (night): image-led pages, scroll stages that stay smooth, and pictures of the site's own pages

The owner's direction since Oct 21: the picture is the content, few words. What's built and how to extend it:

- **Two shapes, and only one page gets the moving one.** `TourStage` (`src/components/home/TourStage.tsx`) pins its
  bands in a sideways ribbon stage; only the attorney page uses it ("keep that sideways scroll for attorney page, rest
  dont need it"). Everywhere else a page is a run of `StageBand`s (`src/components/scroll/StageBand.tsx`): full-width
  paper and ink bands, words on one side, a real picture on the other, stacked. Props: `pinned` (only inside
  `TourStage`), `bleed` (the picture runs off the right edge; off for a picture whose point is at its right, like the
  extension's panel), `measure` (the page's own column, so the band's left edge lines up with the page heading).
  The homepage road (`RoadStage`) and the guides and blog topic cards (`TopicStack`) are the other two pinned pieces,
  kept by the owner.
- **Scroll stages write CSS variables registered non-inherited** (the `@property` block at the top of
  `globals.css`), each on the element that reads it, once per animation frame, skipping frames where nothing moved
  (`useScrollStage`, which no longer writes `--progress`). Before: the guides card stack restyled every card on every
  frame, 1,110 ms of style work over one scroll and 9 jerky frames in 100; after, 76 ms and 1 in 100 (A B B A, a
  Chrome trace; `~/.claude/skills/site-forge/scripts/scroll-perf.mjs`). A new per-frame variable gets an `@property`
  line, and a pseudo-element can't read one from its parent.
- **Topic cards take the height the pinned frame leaves** (`--card-h`, at most 600px) and drop the blurb under 840px
  of screen height and the third article under 700px, so the "All N" button keeps its room
  (`node_modules/.cache/qa/card-fit.mjs` checked 9 screen sizes).
- **Pictures of the site's own pages** come from `scripts/page-pictures.json` (url, clip, sample inputs, alt text
  with the figures it shows): `CAPTURE_SPEC=scripts/page-pictures.json node scripts/capture_article_heroes.mjs <base>
  <dir>/light [keys]`, again with `CAPTURE_DARK=1` into `<dir>/dark`, then `python3 scripts/page_shots.py <dir> <set>`,
  which writes `public/images/<set>/` and the set's typed table (`calculatorShots.ts`, `dataShots.ts`). Captions date
  every capture; re-take a set when the page it shows changes. The capture script hides the data rail and waits for
  any other headless Chrome.
- **For a developer the answer is the picture**: `CodeWindow` (`src/components/marketing/CodeWindow.tsx`), a real
  request and its reply as text, dated (the keyless employer lookup on /developers, the live security headers on
  /security). Badges and open data already open with their real thing and have no band.
- **Small pictures answer the mouse part by part** (`src/components/ui/spot-motion.tsx`; parts marked by
  `scripts/spot-pictures/build.mjs`), fetched with `cache: "no-cache"` so an old copy can't stop them.
- **A full-page capture shows below-fold sections blank** (`AutoReveal` holds them until they scroll into view):
  scroll the page through first, or measure the boxes. **The breadcrumb's "Updated" date ends with a space**: it ran
  into every page's H1 as text ("2026Live"), found by the glued-text audit only when a class name changed its window.
- Ledger: `.planning/image-led-2026-10-21.md`.

## Oct 25 2026: PERM by the numbers

`/perm-by-the-numbers` is one board of the totals DOL's own case records add up to and DOL doesn't publish, one count per
tile with its chart (owner: visual first; "only us, or only our group", never an estimate or a grade on it). The
scorecard, estimates and grades are for the owner and are never pitched or listed as something the site offers.

- **New reads live in `src/lib/db/byTheNumbers.ts`** (new filings by week, job and employer from `perm_live_recent`,
  employers new to PERM from `perm_live_only_index`, RFIs per week from `perm_case_events`, the bulletin months held),
  each bounded by a date and an index; the shaping is `src/lib/byTheNumbers.ts`, tested. A failed read throws, so the
  page keeps its last good render. Weekly filings start the day after the newest published decision: before it, a
  decided case lives in `perm_cases` and is missing from the live table, so a week would read short.
- **"New to PERM"** means a first case in our live record within 90 days and no decided case in DOL's files back to
  October 2015 under the same slug (`perm_cases`, `perm_cases_history`). A company that filed before under another
  spelling can still appear, and the tile says so.
- **The parts:** `ColumnChart` (soft fill with an ink cap for 3:1, lime for "now", hatched while a week is still
  filling, `grow` to fill a tile) and `BulletinCalendar` in `src/components/numbers/`. The page reads the census,
  holds, pulse, RFI clock, wage-request summary, DOL's readings and the bulletin, so it sits on the sweep, DOL and
  bulletin refresh lists.
- **The nightly check as a card sorter** (`src/components/figures/card-sorter/`, the anatomy kit): cards leave a
  hopper, pass under the reader (DOL's case-status search) and drop into six pockets, one batch of 100 at tonight's
  shares (largest-remainder `apportion`, spread by `interleave`). The stacks show the batch, the legend every pocket's
  real total. Pause button; drag and scroll move it; still under reduced motion. Flying cards move between the deck
  layer and each pocket's own layer, because a pocket's dividers sit in front of one pocket's cards and behind the
  next one's.
- **Its first fit cut the machine off at the top**: `fitProjection` was given the hopper and the floor but not the
  body's own top corners, which are the highest point on screen. Give the fit every top corner of every big solid.

## Oct 25 2026 (afternoon): the attorney hero is one picture at every width

Live 2:38 PM EDT (`af10f52b`, `-f when=now` on the owner's "live now"). Below 1280px the case card had dropped under the
dashboard picture; now `AttorneyHero` is an `@container` and the hub, the card and the reminder keep their places,
sized by share of its width and in container units (`AppWindow fluid` for the window chrome). The captions read
"Sample cases." and the firm badge shows one tile, swapped by theme. Rules in `docs/DESIGN_SYSTEM.md`, "Pictures".
