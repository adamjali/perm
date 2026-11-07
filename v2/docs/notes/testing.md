# Tests, CI, gates and the tools that measure

Vitest and CI traps, the gates and how to probe them, dependency upgrades, the dev server, captures, and the instruments that misled.

The sections below were moved word for word from `v2/CLAUDE.md` (and the first ones from the root `CLAUDE.md`) on Nov 7 2026, in their original order, oldest first. A pointer elsewhere that says "see v2/CLAUDE.md, section X" means the section headed X in this folder. New lessons go at the end of the file that fits, under a dated heading.

## Verification traps this session actually hit

- **The LSP reported stale diagnostics roughly eight times**, naming exports
  that exist and tables that had just been generated. `pnpm typecheck` is
  authoritative; the editor squiggles are not.
- **A required prop fed by a Convex query is undefined during deploy skew.**
  Adding a field to a query without redeploying the functions made
  `frontierHistory.length` throw and took the whole page down to nav and footer.
  A frontend deployed ahead of its backend hits the same window in production.
  Default the array.
- **`[^>]*` in an SVG attribute regex runs into `fill-opacity="0.7"`,** whose
  tail is literally `y="0.7"`, so every label reported y=1. Measure text with
  `getBBox()` in the browser, not with a regex and a characters-times-7 estimate.
- **Checking only the anchor point misses a label that overflows.** "Jun 2026"
  centred at x=704 in a 720-wide viewBox is inside by its anchor and 15px past
  the edge by its box. Anchor the end labels inward.
- **Ticks taken as every nth point plus the last one leave a short final gap.**
  Space them evenly across the series including both ends, or the last two
  labels collide while the rest look fine.
- **SVG axis text scales with the viewBox.** 13px in a 720-unit box rendered at
  5.5px in a 306px phone column. Give the drawing a min-width and let it scroll
  in its own container rather than picking one font size that is wrong at one end.
- **`nohup cmd &` makes the harness report the WRAPPER finishing, not the job.**
  A 5-minute build "completed" in seconds with no `.next/server`. Use the tool's
  own background flag.
- **A deploy watcher's marker must be unique to the NEW deploy, and in the
  artefact that actually changed.** One watcher fired instantly because its
  marker was already satisfied by the previous deploy; a second spun forever
  because it grepped served HTML for copy that only renders after user input —
  client-component strings live in the JS chunks
  (`/_next/static/chunks/app/**/page-*.js`), not the page HTML. Grep the chunk.
- **Assert the port, not the status code.** `pnpm dev` found 3000 taken and
  silently used 3001; the 200s came from another session's server and one page
  even returned a stale 500. `lsof -nP -iTCP:<port> -sTCP:LISTEN` before trusting
  a local check, and never kill a process you did not start.

---

## A debug marker chosen to be visible is visible to everyone

`XPROBEX` shipped to production in the site header, between Sign In and Sign
Up. It was a sentinel someone used to check that a whitespace fix had applied,
and it survived because the change it arrived with was 34 files of
near-identical `{" "}` insertions that got characterised by diff statistics
rather than read.

**Reading a diff means reading it.** `+609/-636 lines, all JSX space
insertions` was true and still hid a string rendering on every page.
`src/app/__tests__/no-debug-artifacts.test.ts` is the cheap gate.

## CI shuffles test order on purpose, so green locally proves less than it looks

`vitest.config.ts` sets `sequence.shuffle: !!process.env.CI`, and the workflow
runs `pnpm test:run --retry=2`. A test that relies on a previous test's mock
passes in source order and fails on CI.

`vi.clearAllMocks()` clears CALLS and keeps IMPLEMENTATIONS, so a
`mockReturnValue` set in one test survives into the next. Two `sitemap.test.ts`
tests were built on that and went red on CI while all 4,734 passed locally.

**Reproduce it before diagnosing** — the local repro is one flag:

```bash
CI=1 pnpm exec vitest run src/app/__tests__/sitemap.test.ts \
  --project components --sequence.seed=8
```

Every test arranges its own state. Do not paper over it by defaulting the value
in production code: `getAllPosts()` reads the local content directory and always
returns an array, so a default there only hides the next badly-arranged test.

## Phosphor `*Icon` migration: DONE, via an AST codemod (2026-09-01)

`@phosphor-icons/react` 2.1.10 deprecated every bare icon name in favour of a
`*Icon` suffix. Migrated in commit `a0614fd6`: **177 files, 628 import
specifiers, 559 identifier references, 0 bare specifiers left of 636.**

**It was done with a TypeScript AST codemod and could not have been a regex.**
The bare names are ordinary English words that also appear here as user-visible
copy and inside string literals: `Archive Case`, `"Bookmark case"`,
`<span>Calendar sync`, `Send a test`. Measured first: **~206 of ~960
occurrences sat in JSX text, strings or comments**, so `\bArchive\b` would have
shipped `ArchiveIcon Case` to users. `JsxText` and `StringLiteral` are not
`Identifier` nodes, so walking identifiers cannot reach them.

Three cases the codemod has to special-case, all real here:
- An **aliased** import keeps its local name (`{ Building as Building2 }` ->
  `{ BuildingIcon as Building2 }`, no reference edits) - 187 of 628.
- A **shorthand** property is also the object's KEY. `RoleStep`'s `ICON_MAP`
  keys are looked up by string, so a rename silently stops the icon rendering
  and a skip leaves a dangling binding. Expand: `{ Briefcase: BriefcaseIcon }`.
- **`vi.mock` factory keys are export names**, so the "skip property keys" rule
  is backwards inside one. See below.

## A `vi.mock` factory replaces the module, so its keys are EXPORT names

`RouteError.test.tsx` mocks `@phosphor-icons/react` **and**
`@phosphor-icons/react/ssr` (the second because `ErrorDisplay` has no
`"use client"` and resolves to the SSR entry). When the source moved to
`*Icon`, the stale mock keys made every render in that file throw:

```
No "ArrowCounterClockwiseIcon" export is defined on the "@phosphor-icons/react" mock
```

**Nothing was type-wrong** - a mock factory is untyped against the real module -
so `pnpm typecheck` and `pnpm build` both passed. Only running the suite found
it. This is the concrete reason `pnpm test:run` is the gate and a typecheck is
not a substitute. Any library-wide rename must sweep `vi.mock` factories and
every entry point of the package.

## Two dependency facts that a green build will not tell you (2026-09-01)

**`@sentry/nextjs` is pinned to `~10.70.0` on purpose**, and `dependabot.yml`
ignores `>=10.71.0`. 10.72+ stopped depending on
`@apm-js-collab/code-transformer-bundler-plugins` and **vendors** it, copying an
ESM file into their CJS build whose first executable line is
`fileURLToPath(import.meta.url)`. Vitest cannot resolve that to a `file://` URL,
so the import throws `ERR_INVALID_URL_SCHEME`. Measured on 10.73.0: **24 test
files failed and 109 more never ran**, 2,759 tests collected against a 6,092
baseline - while **the production webpack build compiled clean**. A build-only
check would have shipped it.

**The AI SDK is on v7, and no provider declares a peer on `ai`.** `ai` 7.0.87
pulls `@ai-sdk/provider` 4.x, which is `LanguageModelV4`; `FallbackModel` in
`src/lib/ai/providers.ts` implements that interface directly, so the class, its
`specificationVersion` and the `wrapMistralModel` middleware all move with a
major. Because the providers declare no peer on `ai`, **a spec mismatch is a
runtime failure, not an install error** - `pnpm install` will assemble a broken
set happily. Before any `ai` major check (1) which `@ai-sdk/provider` major it
pulls and (2) whether the third-party providers have a release;
`@openrouter/ai-sdk-provider` is the gating one.

v7 renames, migrated on the **`ai` package only**: `system` -> `instructions`,
`onFinish` -> `onEnd`, `generateObject` -> `generateText` with
`Output.object({ schema })`. All three old forms remain as working
`@deprecated` aliases. **`useChat`'s `onFinish` in `@ai-sdk/react` is NOT
deprecated** - a blanket rename breaks chat persistence.

## The rendered audits against a LOCAL build: the sitemap points at localhost:3000 (2026-09-08)

`.env.local` sets `NEXT_PUBLIC_APP_URL=http://localhost:3000`, so a local
production build's sitemap carries `http://localhost:3000/...` in every
`<loc>`. `audit_ssr_visibility.py` and `audit_internal_links.py` fetch those
locs as written, so serving the build on port 3100 makes every page report
`Connection refused` and the link crawl find zero targets, while the server
itself is fine (same pid before and after, curl 200). Serve the build on
**port 3000** (`PORT=3000 pnpm start`) and pass `--base http://localhost:3000`;
`audit_glued_text.py` and `audit_all_pages.py` rewrite paths onto the base and
work on any port. Both were green on the first run against 3000. The
visibility audit over all 275 pages takes longer than the 10-minute tool
ceiling here; run it in the background to a log.

Two gates that had been lying quietly: `audit_page_registration.py` opened
`DataNav.tsx`, deleted on Aug 30, and had crashed on every run since (it now
checks every data-reading page is reachable from the rail map in
`dataSections.ts`, by href or by prefix); and the social-card gate resolved a
slug to a directory of the same name, which no page under `/tools` or
`/perm-employers` satisfies (it now searches the public tree and requires
exactly one page to name the card).

**The link audit reported a working CSV download as DEAD (2026-09-09).** Its
href regex stopped at `?`, so `/api/stage-cases?stage=…&format=csv` was fetched
as `/api/stage-cases`, which answers 400 by design. A page is the same page under
any query string; an API route is not. It keeps the query for `/api/` hrefs now
and drops it everywhere else. Same run: two "topic mismatch" findings were the
allowlist, not the links. `TOPICS["visa bulletin"]` predated `/visa-bulletin`
and its family page, so a correct link to the bulletin page was flagged for not
pointing at the calculator. **When a gate flags a page that shipped after the
gate was written, suspect the gate's own list first.**

**A native select clips its chosen label at the chevron, and a phone cannot
expand it (2026-09-09).** Adam read "Employer, 26 or more full-time em" on the
fees calculator at 390px. Two fixes, one per class of label. Literal option
labels are measured by `scripts/audit_placeholders.py` against the same 220px
budget as placeholders (six were over, up to 355px; all shortened, with the
detail moved into the helper text under the control), and the scanner was
probed with a long and a short fixture before its first real run. Labels that
come from DOL's data (an OEWS area up to 73 characters, an occupation title up
to 79) cannot be shortened, so the four selects that carry them render
`SelectedInFull` beneath the control: the chosen label in full, shown only
when it is long enough to be at risk. Helper text and descriptions wrap and
need nothing; placeholders were already gated.

**Every mapped item and every table cell carries its own space.** The rendered
glued audit found 257 pairs on five new pages that the source gate passed clean:
176 on `/layoffs` alone, all table cells. The fix shape is `{" "}` INSIDE the
cell (`<td>…{" "}</td>`) and inside each mapped `<li>`, or a keyed `Fragment`
with a leading space for a strip of `<a>`s, never text between `<tr>` or
`<option>` siblings, which React rejects at hydration.

**An edit script that asserts BEFORE writing aborts every edit after the
failing one, and a commit message written from the plan then lies.** A
five-description fix landed as three, twice, because a length assertion on
the first string raised before the loop reached the rest, and the commit
named all five. Make each edit independent (report and continue), and write
the message from `git diff`, not from the intent.

**The homepage's About block carries the record ledger** (`RecordStrip.tsx`):
five counts from `perm_docs` point reads, each with the date it is true for,
set as a definition list in the same 800px measure as the prose. The first
version was a five-card strip in a wider band and Adam called it slop on
sight: two left edges, uneven wrapping, a stock stat kit. The rule that came
out of it: a row of figures under prose is a LEDGER in the prose's own
column, not a band of cards.

## Dismissing a code-scanning alert: 280 characters, and reasons with SPACES

Two rounds of ~100 dismissals failed before the message was read. The API
caps `dismissed_comment` at **280 characters** and answers 422 with the exact
count; a probe with a five-character comment succeeded, which made it look
like a secondary rate limit and sent the next attempt down the wrong path.
`dismissed_reason` must also be one of `"false positive"`, `"won't fix"`,
`"used in tests"`, `"mitigated"` **with spaces**, not underscores. And
`?per_page=100` is one PAGE, not the total: the count read 100, then 61 after
96 dismissals, because more were waiting behind it. Walk the pages.

**Semgrep scans test fixtures as if they were our source.** One saved State
Department bulletin, checked in so the parser can run against the real page,
raised **95 `missing-integrity` alerts** about script tags the State
Department wrote. `.semgrepignore` excludes `**/__fixtures__/` and
`**/fixtures/` now, for the reason it already excluded lockfiles.

## A gate that excludes files by a string will exclude the comment explaining it

`dataset-license.test.ts` skips pages that build their Dataset through the
shared helper, and it did that with `src.includes("getDatasetSchema")`. **The
one page it needed to check carries a comment naming `getDatasetSchema`**, so
the gate skipped exactly the file it was written for. Probing found it - the
mutation dropped the finding count 1 -> 0 and the test stayed green.

Match a CALL, not a mention: `/getDatasetSchema\s*\(/`.

Same family as the `[\s\S]*?` assertion that ran past its own function, and as
`no-glued-jsx-text.test.ts` matching its own fixtures. **A gate's exclusion
list is code and gets probed like code.**

The underlying defect: Search Console reported "Missing field 'license'" on
Datasets. Fourteen of sixteen pages inherit `license` from `getDatasetSchema`;
`/visa-bulletin/family` hand-rolled its Dataset and had none. Every Dataset now
carries `license: ${baseUrl}/terms#intellectual-property`.

## The search palette must cover every page, and a test says so

`palette-covers-every-page.test.ts` walks the public app tree and asserts each
page is reachable from `SearchPalette`'s static index. Its first run found the
three A-Z browse hubs missing (57 of 61). A palette that silently omits pages
is worse than no palette: it answers "no results" for something the site has.

## Killing the dev server mid-write corrupts the types the PRE-PUSH hook reads (2026-09-13)

`git push` was refused by the pre-push hook with 38 errors, every one in
`.next/dev/types/routes.d.ts` and `.next/dev/types/validator.ts`:

    .next/dev/types/routes.d.ts(182,11): error TS1002: Unterminated string literal.

`pnpm typecheck` had exited 0 minutes earlier, and no source file was at fault.
Next writes those route types continuously while `next dev` runs, and the server
had been killed (`pkill -f "next dev"`) part-way through a write, leaving a
truncated file that `tsgo` then parsed on the next invocation.

**`rm -rf .next/dev/types` and re-run.** They are generated and gitignored.
Do NOT reach for `rm -rf .next` - the build cache is expensive here and is not
what broke.

Two things worth keeping from it:

- **A green typecheck is only green for the tree as it stood at that moment.**
  This one passed, then a background process corrupted an input to the same
  check. The pre-push hook is the gate that matters because it runs last.
- **Read the paths in a failure before believing it is yours.** Thirty-eight
  errors naming only `.next/` is a generated-artifact problem; the same output
  skimmed reads like a broken change and invites reverting real work.

## A test whose subject reads the clock, and which does not set the clock (2026-09-13)

CI went red with five assertions in `src/lib/__tests__/permCaseNumber.test.ts`,
all `expected undefined to be '<a date>'`, while the identical suite had just
passed locally at **6,957 / 0**.

**The failure pattern named the cause before any code was read.** Every 2024
case number decoded; every 2025 and 2026 one returned null, and so did
`G-100-24366` (31 December 2024). `parseCaseNumber` refuses a date more than a
day in the future, because a case number from the future is a typo. So the
environment believed it was some day between 2 July and 30 December 2024.

Two conditions had to meet, and neither is visible from a local run:

- the `unit` project runs **`isolate: false`** for speed, so every file in a
  worker shares one environment and a mocked `Date` outlives the file that set
  it;
- **`sequence.shuffle` is CI-only**, so the order that puts the leaker first
  never happens locally.

`src/lib/utils/__tests__/date.test.ts` sets `2024-12-24` in each test and
restores with `vi.useRealTimers()` in a **`beforeEach`, not an `afterEach`** -
which protects its own tests and leaves the clock mocked once the file ends.

**Three separate things went wrong in diagnosing it, all worth keeping:**

1. **A first probe cleared the guilty file.** Running `date.test.ts` then a
   probe file reported `2026`, so I ruled it out. The probe was fine and the
   conclusion was wrong: nothing reproduced the cross-file hop locally, even
   single-worker with the leaker first.
2. **`vi.setSystemTime` WITHOUT `vi.useFakeTimers` mocks Date only**, so
   `vi.isFakeTimers()` answers **false** while `new Date()` still answers 2024.
   A guard that tests for fake timers first sees nothing. Restore
   unconditionally.
3. **`reporters: process.env.CI ? ["json", "github-actions"] : ["default"]`**,
   so running a diagnostic under `CI=1` printed no console output at all and
   the guard looked like it had found nothing. Reproduce CI's *shuffle* with
   `--sequence.shuffle=true` and leave `CI` unset, or the instrument is mute.

**THE FIX THAT DOES NOT DEPEND ON THE DIAGNOSIS: the test pins its own clock.**
A test whose subject reads `new Date()` and which never fixes the date is
order-dependent by construction, whatever else is cleaned up. Proved by a
hostile control - a 2024-12-24 clock forced before EVERY test, strictly harsher
than any real leak - under which the unpinned file reproduces the exact CI error
and the pinned one passes 17/17.

Two more, because the class is worth closing rather than the instance:
`date.test.ts` now restores on the way out, and `vitest.setup.ts` carries a
global **`afterAll`** (per file) `vi.useRealTimers()`.

**THE FIRST VERSION OF THAT GLOBAL WAS AN `afterEach`, AND IT BROKE A CORRECT
FILE.** `convex/lib/perm/validators/pwd.test.ts` freezes one clock in a
`beforeAll` and restores it in `afterAll`; its later tests rely on that clock,
and a per-test reset handed them the real date mid-file, so a
"determination date in the future" rule fired at three shuffle seeds that had
passed before. A file owning its clock for its own duration is legitimate.
What must never happen is that clock reaching the NEXT file - and `afterAll`
in a setup file runs at the end of every test file, which is exactly that
boundary and nothing narrower. Measured: seeds 3, 11 and 2024 all 3,044/3,044
after the rescope. (The diagnostic's line about `pwd.test.ts` "leaving fake
timers on" was reporting mid-file state, not a leak - the same instrument,
misread.)

## README figures, and `vercel ls` (2026-09-13)

The README claimed 306 test files and a cadence that had changed. Every count
in it now matches `pnpm test:run`'s baseline and the CI badge reads the test
workflow's own status. And `vercel ls | grep -m1 perm-` matches the HEADER
row, not the newest deployment; skip the first line or match the URL shape.

## A leaked mock pair turned CI red for two days while every local run passed

`sitemap.test.ts` arranges `countLiveOnlyRanks -> 12,000` with a matching
`getLiveOnlySlugWindow`. `vi.clearAllMocks()` clears CALLS and keeps
IMPLEMENTATIONS, so both leaked. In source order they stayed a matched pair;
under CI's `sequence.shuffle` they came apart, a child was emitted for a window
that returned nothing, and the "0 rows" guard threw. Red from 2026-09-17
(`3aa1699f`, the live-only sitemap family) to 09-19, with `pnpm test:run` green
locally the whole time. **Production was never affected** - the live sitemap
served all five live-employer children throughout.

The fix is the rule this repo already states: every test arranges its own
state. The `describe`'s `beforeEach` now resets both mocks to the safe default
and the tests that care opt in.

**Reproduce it with `CI=1`, and read the JSON, not the console.** Under `CI=1`
the reporters are `json` + `github-actions`, which MUTE the summary - a run can
look like it printed nothing at all. `coverage/test-results.json` carries
`success`, `numFailedTests` and the failing titles.

## Scope a bulk replace by FILE, not by string - the third instance

Trimming 38 over-length titles with a repo-wide string replace went wrong in
two ways in one pass, and both were found by reading the diff rather than by
the script:

1. One guide's `seoTitle` was **byte-identical to a blog post's display H1**,
   so the replace rewrote the blog's visible heading and left the guide
   unfixed. Same family as a rival's name corrupting `permtracker.app` in a blanket scrub, and as
   `have` contracting where it is not an auxiliary.
2. Five changelog posts define no `seoTitle`, so the script changed their
   editorial `title` - the headline shown on the timeline. The right fix was
   to ADD a short `seoTitle` and leave the headline alone.

**The gate that caught both is one line: `git diff -U0 | grep -E "^\+title:"`,**
a count of the field that must NOT change. Assert it is empty, the way the
scrub asserted 614 occurrences of our own domain before and after.

**And do not push docs while a build is in flight.** `vercel-ignore.sh` diffs
against `VERCEL_GIT_PREVIOUS_SHA`, the last commit Vercel DEPLOYED - not the
last one pushed. A docs-only push made while the code build is still running
therefore diffs against the previously deployed commit, sees the `src/` changes
still in flight, and starts a SECOND full production build. That is the script
working exactly as rule 1 intends (an incomplete diff must never skip), and it
still costs a second cold ISR cache over ~78,600 pages. Land the docs commit in
the same push as the code, or wait for Ready.

## Three forks in one tree, and the captures that came from the local build (2026-09-22)

The USCIS batch ran as three forks on disjoint lanes with the coordinator holding the
registries and the deploy. Rules that held: a handoff is a claim and its tests are re-run
before it is folded in; registry lines come back as text (sitemap `build.ts`,
`dataSections.ts`, `pageCards.ts`, `llms.txt`, `datasetCoverage.ts`, `known-routes.json`,
the glossary) and the coordinator applies them; no lane launches a browser. One lane
added another lane's missing `DataSection` key to keep typecheck green, which is the
right call when the key is the only thing standing between two lanes.

**Captures come from the LOCAL production build when the live site lacks the page.**
Track C's shot specs pointed at `https://permtracker.app/...` for pages not yet
deployed. A scratch copy of the specs with the host rewritten to `http://localhost:3000`
(`PORT=3000 pnpm start` on the fresh build) drove `scripts/shoot.mjs` with `SHOT_OUT`
pointing at the scratchpad; the six PNGs were copied into
`public/images/content/shots/`, `optimize-shots.py` made the WebPs, and the PNGs were
deleted before the commit. Cards: 1440x900 captures, `make-page-cards.mjs` with crop
`[600, 136, 2280, 1376]`. One clip was wrong on the contact sheet (`main section` caught
the "access is pending" panel, not the form) and was re-shot with `main form`; a caption
that described a figure the page cannot yet show ("two dated readings") was rewritten to
what the figure shows. **Look at the contact sheet before the captions ship.**

**`known-routes.json` is hand-styled; append in its style.** `json.dump` rewrote the
whole file once (it happened to already be sorted, so the diff was small, but the
next time it would not be).

**The digest's new read was probed on the deployed Convex with a past-dated build.**
`npx convex run newsletter:buildIssue '{"weekOf":"2026-09-01"}' --prod` with
`NEWSLETTER_ENABLED` still unset stored a preview whose text carried the USCIS section
with the four medians production holds, and sent nothing. The scratch row stays; the
Sep 29 issue still reads the quarter as news because `previousUscisQuarter` looks at
the newest EARLIER issue, which is Sep 22's. Never run `buildIssue` for the current week
after the flag is on: it schedules the send.

## The GSC timers die with the session, and a continuation counts (2026-09-23)

The Search Console timers (`CronCreate`, `7 15,17,19 * * *`) fired Sep 20 to 22 at
3:15, 5:15 and 7:37 PM ET (the scheduler's jitter), last at **Tue Sep 22, 5:17 PM**. The
jobs were gone after the context continuation at 7:18 PM, so Wed Sep 23's 3:07 PM round
never ran. (Corrected 7:40 PM Sep 23: the next continuation, ~5:45 PM Sep 23, kept
`d001ea00` alive, so a continuation does not always end the process. The check stands; the
cause of the Sep 22 loss is not established.) Recreated at 3:52 PM Sep 23 (job `d001ea00`, expires after 7 days)
with a one-shot catch-up at 3:58 PM. Recover the prompt from the transcript, not memory:

```bash
/usr/local/Caskroom/miniconda/base/bin/python3 - <<'PY'
import json, glob, os
last = None
# the session transcripts live under ~/.claude/projects/<cwd with / as ->/
for f in glob.glob(os.path.expanduser("~/.claude/projects/" + os.getcwd().replace("/", "-") + "/*.jsonl")):
    for line in open(f, errors="ignore"):
        if '"CronCreate"' in line:
            for b in (json.loads(line).get("message") or {}).get("content") or []:
                if isinstance(b, dict) and b.get("name") == "CronCreate":
                    last = b["input"]
print(last["cron"]); print(last["prompt"])
PY
```

Then point its queue line at the ledger's newest "## Queue after ..." section before
recreating it. The rounds now commit ONLY the ledger file, so a round can't sweep another
change in the working tree into its docs commit.

## Sep 30 2026 (midday): Audit 11, and dates that share a square

Audit 11 (`../.planning/github-audit-history.md`) and the second timeline pass, both deployed the
same day (`10dc8232`, `59863b95`, `8435aca3`).

- **motion 13.4.1 and svix 2.5.0**, Dependabot PRs #33 and #35 closed as superseded with a reason
  each. motion 13's one break drops the optional `@emotion/is-prop-valid` detection, never installed
  here; the `ssr` vitest project (real motion) and the live SSR-visibility audit (475 of 475 pages)
  show nothing above the fold ships hidden. svix 2 stops parsing JSON inside `Webhook.verify`;
  `convex/http.ts` ignores its return and parses the body itself, and live `/resend-inbound` still
  answers 401 to a forged signature. **svix is bundled into Convex, so a bump that touches no file
  under `convex/` still needs `npx convex deploy -y`.**
- **`pnpm audit` sees what Dependabot doesn't**: 0 open Dependabot alerts beside 2 high and 3
  moderate advisories. Override floors `brace-expansion >=5.0.12 <6`, `moment >=2.31.0 <3`,
  `fast-uri >=3.1.8 <4`, each capped at its major so a floor can't pull in the next one.
- **The 7-day `minimumReleaseAge` chooses the version**: `pnpm add motion@^13 svix@^2` installed
  13.4.1 and 2.5.0 while 13.4.6 and 2.6.0 were a day old. Read changelogs up to what installed.
- **`audit_ssr_visibility.py` judges inline `style` attributes only** (`hidden_styles`, with
  `test_ssr_visibility.py` in CI): the home curtain's `opacity:0` rule in `<head>` made 80 of 80
  pages "fail" once it shipped.
- **IndexNow retries a server error**: one Cloudflare 520 on `live-employer-3.xml`, while the
  server warmed a fresh deploy, failed the run. Sitemap fetches retry 5xx, 429 and network errors
  after 5, 15 and 30 s and fail after four tries; a 404 fails at once.
- **Dates too close to tell apart share one numbered square**, replacing the morning's lanes and
  "+N" (Adam, from his phone: *"what’s going on with the + and the multiple dots and same color?
  and left side edge? etc?"*). `groupMarkers` in `src/lib/timeline/positioning.ts` joins dates
  less than a 22px square apart at `MIN_MONTH_PX`, so a group never splits on a wider screen;
  `groupPosition` puts the square at the group's middle. Same stage: the stage colour with
  `STAGE_ON_FILL` text; mixed: plain. Every square's left is `clamp(12px, var(--x), calc(100% -
  12px))`, set as a Tailwind class with `--x` inline, because happy-dom drops an inline `clamp()`
  and the tests read `--x`. The colour key (`TimelineLegendCompact`, with a "Dates close together"
  swatch) sits above the grid in the page and in its skeleton. Measured in Storybook at 320, 390
  and 1440: 15 squares, 0 overlaps; in dark, the counts read 4.83:1 on PWD blue, 5.38:1 on
  recruitment purple and 18.97:1 on the plain squares.
- **Storybook's dark theme is a class its decorator owns.** `withThemeByClassName` puts `dark` on
  `<html>`; devtools' `colorScheme` emulation doesn't change it, and a class added by script is
  removed again. **`&globals=theme:dark` on the iframe URL works** (measured Oct 15 2026, against
  this note's Sep 30 claim; the story needs a few seconds to finish preparing): wait for the class, then read a computed
  background before believing a dark check. `scripts/capture-tour.mjs` does this.
- **Wait on a commit's runs by `headSha`**: `gh run list --commit <sha>` returned nothing here;
  `gh run list --json headSha,name,status,conclusion` filtered on the SHA works.
- **A screenshot shows where the reader scrolled.** I called scroll-to-today broken from Adam's
  screenshot; he had scrolled past it. Nothing changed there.

## Oct 24 2026 (afternoon): a route lost under another commit, and every update at once

**A commit can delete a route and nothing fails.** `58db2f37` (Fri Oct 23, 9:34 PM EDT) added `/review/note` and
`/review/prefill` to `convex/http.ts` and, in the same edit, replaced the whole visa-bulletin block: OPTIONS and POST
`/bulletin-alert/subscribe`, GET and POST `/confirm` and `/unsubscribe`, and the two category sets. The form kept
posting, the emails kept carrying links, and everything answered 404 until 12:13 PM Saturday, when the block came back
unchanged from `58db2f37^` and Convex was deployed. Read from Convex and PostHog: no bulletin confirmation or alert went
out in the window, and the form recorded no sign-up attempt (4 in the 30 days before). Checked live on both
permtracker.app and the `.convex.site` origin, then end to end with the owner's address: sign-up, the confirmation
email, confirm, a signed unsubscribe link; the test row was removed with `testData:removeOwnerBulletinTest`, which
refuses an address holding any real bulletin watch, because one bulletin link confirms or stops every watch an address
holds.

**`src/app/__tests__/convex-routes-exist.test.ts`** reads the router's registrations (literal paths, constants such as
`RATING_PATH`, and the `for (const path of [...])` loops) and checks four kinds of pointer against them: every
`actionUrl("/...")` in `convex/` needs a GET, and an unsubscribe link a POST too; every `post:` button and `action="/..."`
form on a Convex-rendered page needs a POST; every `convexSiteUrl("/...")` in `src/` needs a route, and an OPTIONS
beside a POST; every Convex rewrite family in `next.config.ts` needs a route, and nginx's relay must carry every emailed
link. Probed by removing the bulletin block again: three of its checks fail and name each path.

**Every update in one batch** (versions and reasons: `.planning/VERSION-DECISIONS.md`, "October 24 2026"). Next 16.4.3,
`@sentry/nextjs` ~10.75.2, Storybook 10.6.2, React 19.3.1, jsdom 30.1.3, happy-dom 21.0.4 and the rest of Dependabot's
#64 and #62, with the overrides tightened. Three versions younger than the 7-day floor are excluded by exact version in
`pnpm-workspace.yaml`, each with its removal date. `pnpm audit` went from 21 advisories (5 critical, 7 high) to none,
with and without `--prod`. The Next font patch is gone (16.4.3 has the fix); the Storybook adapter patch carried over to
10.6.2, which still lacks the field.

**Two things the batch taught:**
- **happy-dom 21 matches CSS attribute selectors with case, as the spec says; 20 didn't.** Two timeline tests asked for
  `aria-label*="1st Sunday ad"` and `"RFE due"` and had passed against labels reading "1st Sunday Ad" and "RFE Due", the
  ones the Sep 29 sentence-case pass missed (`src/lib/timeline/types.ts`, `milestones.ts`, the calendar filter). The
  labels are sentence case now, and "Addl Method #N" reads "Additional method #N".
- **This Mac's shell runs `/usr/local/bin/node` (22.22.1), not nvm's.** jsdom 30 needs 22.22.2+ or 24.15+, so run the
  suite with `PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH"` in front (24.22.1 installed Oct 24 2026). CI runs 24.x.

**ESLint had 8 errors on `main`, none from the batch** (the hooks plugin is 7.1.1 on both): the two conveyor figures
bumped a running total inside a `.map` callback (a plain loop now), the notification list read and wrote a ref during
render to keep the last page on screen (state set during render now, as its `tabSeen` already did; Convex's `useQuery`
returns the same object until a new result arrives, so it can't loop), and one `let` that never changed. A test now
holds the kept page, probed by dropping it. `pnpm exec eslint src convex`: 0 errors, 36 warnings.

**The morning report runs `pnpm audit`** (`run_audit` in `scripts/daily_monitor.py`, production and full, output
captured and never printed). A critical or high advisory in what the site ships fails the security section, a moderate or
low one warns, one only the test and build tools reach is a line, and an entry in `ACCEPTED_ADVISORIES` is a line until
its review date, then warns. An audit that couldn't run warns. `daily-monitor.yml` installs pnpm and Node for it; the
audit reads the lockfile alone, so there's no install.

**The DACA lines on `/uscis-processing-times`** read "(DACA)" (the I-821D line carries the anchor `#daca`), and each says
its pending count includes first-time requests: USCIS accepts them but doesn't process them (its DACA page, "Last
Reviewed/Updated: 01/24/2025", read Oct 24), and a request is rejected unless filed with its I-765. USCIS's workbook
doesn't split first-time from renewal, so no share is printed. The page's questions, the site search (daca, deferred action,
i-821d) and llms.txt point there. No DACA section: the site's subject is work-based immigration (owner's call, Oct 24).

**The phone menu covers the data menu's handle again.** The handle sits at `z-[41]` on the assumption that the header
is at 50, and the Oct 15 header had gone to `z-40`, so it drew over the open phone menu's first row (reported from an
iPhone). The header is `z-[45]` now; `footer-stacking.test.ts` holds the handle and panel under it. The house layer
table above was updated with it.

**The weekly digest may send 30 a day** (`NEWSLETTER_DAILY_CAP=30` on production, from 15; the code's default and the
email ledger already counted 30).
