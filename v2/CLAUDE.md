# CLAUDE.md — PERM Tracker v2

> **Stack:** Next.js 16.2.9 + Convex 1.42.3 + React 19.2.7 + TypeScript (strict)
> **Status:** Production | **Last Updated:** 2026-05-24

**Convex rules:** read [`convex/_generated/ai/guidelines.md`](convex/_generated/ai/guidelines.md) before writing Convex code.
**Codebase deep-dives:** [`.planning/codebase/`](../.planning/codebase/) — STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS.
**API reference:** [`docs/API.md`](docs/API.md). **PERM flow:** [`../perm_flow.md`](../perm_flow.md).
**Docs (`docs/`):** [API](docs/API.md) · [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) · [ANIMATION_STORYBOARD](docs/ANIMATION_STORYBOARD.md) · [CRYPTO](docs/CRYPTO.md) · [compliance/](docs/compliance/) (SOC 2 evidence). Feature behaviour lives in the code + codebase deep-dives, not standalone docs.

## Quick Start

```bash
pnpm install
npx convex dev      # Terminal 1
pnpm dev            # Terminal 2
```

http://localhost:3000 · [Convex Dashboard](https://dashboard.convex.dev)

## Commands

| Script | Purpose |
|---|---|
| `pnpm dev` | Dev server (Turbopack, :3000) |
| `pnpm build` | Production build (Webpack — SWC bugs only appear here, see [CONCERNS.md](../.planning/codebase/CONCERNS.md) TD-01) |
| `pnpm typecheck` | **Both** typecheckers — app *and* Convex. Always use this one. |
| `pnpm typecheck:app` | `tsgo --noEmit` (app tsconfig) |
| `pnpm typecheck:convex` | `tsc -p convex --noEmit` (Convex's own tsconfig) |
| `pnpm test` | Vitest watch |
| `pnpm test:fast` | ~1300 tests, **2 of 4 projects only** (~40s). Not a pre-push gate |
| `pnpm test:run` | **All 4 projects, 4500+ tests (~9min). Run this before every push.** |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm storybook` | Component dev (:6006) |

Full test docs: [`TEST_README.md`](TEST_README.md).

---

## Central PERM Business Logic

**ALL PERM logic lives in ONE place** — NEVER recreate deadline/validation/cascade logic elsewhere.

```
convex/lib/perm/     ← canonical source
src/lib/perm/        ← frontend re-exports
```

```typescript
// Frontend
import { calculatePWDExpiration, validateCase, applyCascade } from '@/lib/perm';
// Convex functions
import { calculatePWDExpiration, validateCase, applyCascade } from '../lib/perm';
```

Structure: `calculators/` · `validators/` · `dates/` · `deadlines/` · `recruitment/` · `cascade.ts` · `statusCalculation.ts` · `constants.ts`. See [STRUCTURE.md](../.planning/codebase/STRUCTURE.md).

### Common usage

```typescript
// Form cascade
setFormData(applyCascade(formData, { field, value }));

// Validation
const result = validateCase(formData);
if (!result.valid) { setErrors(result.errors); return; }

// Filing window
const status = getFilingWindowStatusFromCase(caseData);
```

---

## Convex Patterns

| Type | Use | Import |
|---|---|---|
| `query` | Read | `from './_generated/server'` |
| `mutation` | Write | `from './_generated/server'` |
| `action` | Side effects, external APIs | `from './_generated/server'` |

`internalQuery`/`internalMutation`/`internalAction` for server-only, called via `internal.*`.

**Auth:** `getCurrentUserId(ctx)` (throws) or `getCurrentUserIdOrNull(ctx)` from `./lib/auth`.

**Auth callbacks gotcha:** `createOrUpdateUser` in `convex/auth.ts` is NOT called for password sign-ins of existing users. Login tracking is client-side via `LoginTracker` (`src/components/auth/LoginTracker.tsx`, localStorage + 30s debounce). `afterUserCreatedOrUpdated` is never used.

**Schema changes:** edit `convex/schema.ts` — `npx convex dev` auto-applies. Index naming: `by_fieldName` or `by_field1_field2`.

---

## Date Protocol

**ALL dates are ISO strings (YYYY-MM-DD).** Never store `Date` objects.

```typescript
import { parseISO, format, addDays } from 'date-fns';
const result = format(addDays(parseISO('2024-06-15'), 30), 'yyyy-MM-dd');
```

---

## Anti-Patterns

```typescript
// DON'T: Recreate deadline logic
const expiration = addDays(determinationDate, 365); // WRONG
// DO: import { calculatePWDExpiration } from '@/lib/perm';

// DON'T: Hardcode validation rules
if (filingDate > certDate + 180) { ... } // WRONG
// DO: import { validateI140 } from '@/lib/perm';

// DON'T: Manual business day calculation
// DO: import { addBusinessDays } from '@/lib/perm';

// DON'T: Use ?? in dense expressions (SWC minifier drops vars with ~20+ ?? chains → prod ReferenceError)
const value = a ?? b ?? c ?? d ?? e; // WRONG
// DO: Use || or ternary
const value = a || b || c || d || e;

// DON'T: Store Date objects in Convex
await ctx.db.patch(id, { pwdFilingDate: new Date() }); // WRONG
// DO: ISO strings
await ctx.db.patch(id, { pwdFilingDate: format(new Date(), "yyyy-MM-dd") });

// DON'T: trust a truthiness check as a change detector
...(row.pendingField ? { notifiedAt: undefined } : {})   // WRONG: always set
// DO: compare against the current value
const changed = row.pendingField !== undefined && row.pendingField !== row.field;

// DON'T: write an unanchored regex to read a value out of a cell
/([A-Za-z]+)\s+(\d{4})/   // WRONG: "As of May 2025 ... September 2025" -> 2025-05
// DO: anchor it. A plausible WRONG value is worse than a null, because null is
// visible downstream and a wrong date is not.
/^([A-Za-z]+)\.?,?\s+(\d{4})$/

// DON'T: Import toast from sonner directly (not auth-aware, fires during sign-out)
import { toast } from "sonner"; // WRONG
// DO:
import { toast } from "@/lib/toast";

// DON'T: Put client init (posthog.init, etc.) in a ROOT instrumentation-client.ts
// With a src/ app dir, Next.js loads ONLY src/instrumentation-client.ts — root is ignored → silent outage
// DO: keep posthog.init() + initBotId() together in src/instrumentation-client.ts  // see CONCERNS TD-06
```

SWC minifier bug details: [CONCERNS.md TD-01](../.planning/codebase/CONCERNS.md).

---

## Before pushing: `pnpm test:run`, not `pnpm test:fast`

`test:fast` runs **2 of the 4** vitest projects (`unit`, `unit-isolated`). It
does NOT run `components` — which owns `src/app/**/*.test.{ts,tsx}`,
`src/components/**`, `src/emails/**` — or `convex`.

| project | covers |
|---|---|
| `unit` | `src/lib/**`, `src/hooks/**`, `convex/lib/perm/**`, `convex/lib/*.test.ts` |
| `unit-isolated` | mock-heavy files needing `isolate: true` |
| `components` | **`src/app/**`**, `src/components/**`, `src/emails/**`, `test-utils/**` |
| `convex` | `convex/*.test.ts`, `convex/__tests__/**`, `convex/lib/__tests__/**` |

Making `sitemap()` async broke `src/app/__tests__/sitemap.test.ts`
(`sitemap().map` on a Promise). `test:fast` + `--project convex` were both green
locally and CI went red on the first push, because the broken file was in the
one project neither command runs. **`pnpm test:run` is the pre-push gate.**
Same failure shape as the typecheckers below: a check that did not cover its
subject reads exactly like a pass.

**And `await x().map()` parses as `await (x().map())`.** Awaiting a newly-async
function needs `(await x()).map()`. A blanket regex inserting `await` in front
of every call site produces this silently on every chained one.

---

## Two typecheckers, and passing one proves nothing about the other

`pnpm typecheck` now runs both. It did not always, and that is how a broken
`convex/` file shipped past a green local run.

| | `tsconfig.json` (app) | `convex/tsconfig.json` |
|---|---|---|
| `lib` | `dom, dom.iterable, esnext` | **`ES2021, dom`** |
| test files | **excluded** (`**/*.test.ts`) | **included** (`./**/*`) |

Two independent gaps, either one sufficient. `Array.prototype.at` is ES2022, so
`results.at(-1)` compiles under the app config and fails under Convex's. And
because the app config excludes tests, `pnpm typecheck:app` never even opened
the file. The Convex plugin's end-of-turn hook caught it only because it runs
`convex codegen`, which typechecks with Convex's config.

**Anything under `convex/` must satisfy both.** Use `pnpm typecheck`.
`tsc -p convex --noEmit` is the pure check — `convex codegen` also uploads to
the deployment, so it is not a typecheck substitute.

---

## Sending email

**Resend does NOT throw on failure.** Verified in `resend@6.22.0`
(`dist/index.mjs`): `fetchRequest` returns `{ data: null, error }` for a 429, a
422 and a network failure alike. A bare `try { await resend.emails.send(...) }`
has a catch block that is **dead code for every realistic failure**, and any
line after the send runs as if it succeeded.

```typescript
// DON'T: the catch never fires, and the subscriber gets marked as mailed
try {
  await getResend().emails.send({ ... });
  await ctx.runMutation(internal.x.markNotified, { id });   // runs on a 429
} catch (e) { /* unreachable */ }

// DO: sendEmailWithRetry handles both shapes AND enforces the blocklist
const result = await sendEmailWithRetry(getResend(), { ... });
if (result.error) { /* log, recordError, do NOT advance state */ }
```

`sendEmailWithRetry` (`convex/lib/email.ts`) is the only sanctioned path. It
checks the returned `error`, catches genuinely-thrown network errors, retries
rate limits with backoff, and enforces `isEmailBlocklisted`. Calling the SDK
directly walks around all four — and makes `convex/lib/emailBlocklist.ts`'s
stated invariant ("no code path can send to it") false.

**The Resend account cap is 100/day and is SHARED** with password resets, OTP
and deadline reminders. Exhausting it has caused a real outage. Any new sending
path needs a budget, not just good intentions.

---

## Public unauthenticated endpoints

`convex/http.ts` carries routes any stranger can hit. Checklist, each item
learned from a real defect in `convex/queueAlerts.ts`:

- **The mutation behind the route is `internalMutation`, never `mutation`.** A
  public mutation is a second entry point that skips the HTTP layer's field
  narrowing, its length caps and its rate limit, and makes the CORS allowlist
  decorative (CORS is browser-side only; the Convex API is callable directly).
- **A per-identity limit cannot stop identity rotation.** A per-address cooldown
  does nothing against an attacker cycling fresh addresses; a per-IP limit does
  nothing against a proxy pool. **Add a global budget on the shared finite
  resource itself** — that is the only limit that cannot be rotated around.
- **Order your guards by cost.** Cheap shape checks first. Put the length cap
  *before* any regex that can backtrack: `/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`
  measured **8.2 s** on an 80k-character input in V8, and 0.005 ms with the
  length check first. `v.string()` accepts ~1 MB.
- **GET must not mutate.** Outlook Safe Links, Mimecast, Proofpoint and
  Barracuda all fetch URLs in inbound mail, so a GET that acts lets a
  recipient's own mail gateway click their links. Render a POST button instead.
- **Distinguish 400 from 429** in the response, or every typo reads as
  rate-limiting in monitoring.

---

## Action tokens (`convex/lib/unsubscribeToken.ts`)

`makeUnsubscribeToken(email, secret, purpose?)` signs `<purpose>:<email>`.
**Always pass a purpose for new callers.** Without one, every token for an
address is the same string, so a link meaning "unsubscribe me" is byte-identical
to one meaning "confirm me" and differs only in which path it is pasted into —
which let an unsubscribe link be replayed against a confirm route to undo an
opt-out.

The bare form is kept **only** for weekly-digest links already sitting in real
inboxes (`convex/notificationActions.ts`). Those have no expiry; making scoping
mandatory would silently break every one of them.

These tokens never expire and are replayable by anyone who can read the email.
Fine for "stop sending me mail" (idempotent, self-harming at worst). **Never
treat one as a fresh act of consent** — anything that grants or restores a
subscription must re-check state, not trust the signature.

---

## Convex gotchas beyond the generated guidelines

- **`ctx.scheduler.runAfter` discards the return value.** A function that
  returns `{ sent, remaining }` to a scheduler resumes nothing. If work is
  batched, it must **reschedule itself**; guard that on having made progress so
  a total outage cannot spin a timer.
- **Index field order is the difference between a bounded read and a table
  scan.** Lead with the equality predicates that mean "is this row still live",
  and put the range field last (Convex allows a range comparison only on the
  final indexed field). `.collect()` then filtering in JS re-reads every row you
  already dealt with, forever, and fails hard at the read limit rather than
  degrading. Iterate the query with an early `break` when a JS-side predicate
  remains.
- **`.extend()` / `.fields` bind validators to each other, NOT to the table.**
  The table body in `schema.ts` is derived from nothing, and TypeScript does not
  excess-property-check a spread of a non-fresh variable, so an *extra*
  validator field typechecks green and fails at runtime. Assert exactness:
  ```typescript
  type Ok = Doc<"t"> extends Infer<typeof val>
    ? Infer<typeof val> extends Doc<"t"> ? true : never : never;
  const _ok: Ok = true; void _ok;
  ```
  Probe it by adding a phantom field and confirming it goes red.
- **Patching a field to `undefined` DELETES it**, and `JSON.stringify` hides
  that: `{...(x ? {f: undefined} : {})}` prints as `{}`. Check `"f" in patch`.

---

## Code Style

- **TypeScript strict** — no `any`, `noUncheckedIndexedAccess` enabled
- **ISO date strings** everywhere
- **Central imports** — `@/lib/perm` or `convex/lib/perm`
- **TDD** — tests first for business logic
- **Named exports** preferred (default only for page components)
- **Import order** — framework → third-party → `@/` → relative → types
- **Soft deletes** — filter `q.eq(q.field("deletedAt"), undefined)`
- **Errors** — frontend: `handleOperationError()` from `@/lib/errors`; backend: `recordError()` from `convex/lib/errorRecording`

Full conventions: [CONVENTIONS.md](../.planning/codebase/CONVENTIONS.md).

---

## Integrations (quick reference — details in INTEGRATIONS.md)

- **Sentry** — lazy-loaded client (`SentryClientInit`). Frontend: `captureError` from `@/lib/sentry`. Backend: `recordError` from `convex/lib/errorRecording` (writes DB + admin email + Sentry in one call).
- **PostHog** — always import `@/lib/analytics` (wrapper with try/catch), never raw `posthog-js`. Client init (`posthog.init`) lives in `src/instrumentation-client.ts` **alongside BotID** — Next.js loads only that ONE file (a root `instrumentation-client.ts` is silently ignored), so splitting them kills one. Proxied via `/ingest/*` (incl. `/ingest/array` for lazy bundles). Internal opt-out: `POSTHOG_EXCLUDED_EMAILS` Convex env var. See [CONCERNS.md TD-06](../.planning/codebase/CONCERNS.md).
- **Resend Email** — transactional via Resend MCP tools (list/send/contacts), `curl` for threaded replies (needs `In-Reply-To` header which MCP doesn't expose), or `admin.sendAdminEmail` mutation for UI sends (auth-required, auto-renders `AdminEmail` React template). `FROM_EMAIL = notifications@permtracker.app`.
- **AI Chat** — multi-provider fallback (Groq→Mistral→Gemini→OpenRouter→Cerebras) via custom `FallbackModel` in `src/lib/ai/providers.ts`. API route: `src/app/api/chat/route.ts`.

Full env vars, rate limits, webhooks: [INTEGRATIONS.md](../.planning/codebase/INTEGRATIONS.md).

---

## Content Hub (MDX)

Content in `content/{blog,tutorials,guides,changelog,resources}/*.mdx`. Processed by `next-mdx-remote` + `gray-matter` + `reading-time`. MDX components registered in `src/lib/content/mdx-components.tsx`: `Callout`, `ProductCTA`, `StepByStep`/`Step`, `ComparisonTable`, `ScreenshotFigure`, `VideoFigure`, `VideoPlayer`.

---

## GSD Workflow

`/gsd:feature` for new features · `/gsd:quick` for small fixes · `/gsd:debug` for investigation · `/gsd:map-codebase` after major structural changes. Full command list: [root CLAUDE.md](../CLAUDE.md#gsd-workflow).

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Date off by one day | Use UTC functions |
| Validation not catching error | Check you're using the right validator |
| Cascade not triggering | Ensure `applyCascade()` called on change |
| Import not found | `@/lib/perm` (frontend) vs `convex/lib/perm` (backend) |
| `ReferenceError: _ref is not defined` (prod only) | SWC minifier bug — replace `??` with `\|\|`. See [CONCERNS.md TD-01](../.planning/codebase/CONCERNS.md) |
| `X is not defined` (prod build) | Check SWC minifier, `optimizePackageImports`, `concatenateModules`, React Compiler |
| Auth callback not firing | `createOrUpdateUser` skips password sign-ins — use `LoginTracker` |
| Toast during sign-out | Import `@/lib/toast`, not `sonner` |
| PostHog/analytics silently not capturing | Client init must be in `src/instrumentation-client.ts` (the only one Next.js loads; a root one is ignored) — PostHog + BotID coexist there. [CONCERNS.md TD-06](../.planning/codebase/CONCERNS.md) |
| Convex action can't call another action | `ctx.scheduler.runAfter(0, ...)` instead |
| Sitemap dates stale | Update `lastModified` in `src/app/sitemap.ts` |
| Typecheck green locally, Convex plugin hook fails | You ran `typecheck:app` only. `pnpm typecheck` runs both — see "Two typecheckers" |
| Email "sent" but never arrived, nothing logged | A bare `resend.emails.send()`. Resend returns `{error}`, it does not throw. Use `sendEmailWithRetry` |
| A sweep only ever processes one batch | `scheduler.runAfter` discards return values; the function must reschedule itself |

Deployment + project names: [root CLAUDE.md](../CLAUDE.md#deployment).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->


---

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

## Which federal hosts serve scripts, and which refuse (measured 2026-08-23)

| Host | Automated fetch | What lives there |
|---|---|---|
| `flag.dol.gov` | **200** | PERM processing times, the weekly ingest |
| `www.dol.gov` | **200** with a FULL browser header set | quarterly PERM disclosure files |
| `www.uscis.gov` | **200** | quarterly I-140 counts (23-65 KB) |
| `egov.uscis.gov` | **403 Cloudflare challenge** | USCIS processing times |
| `travel.state.gov` | **403 Cloudflare challenge** | the DOS visa bulletin |

**Run a control before blaming your own traffic.** cloudflare.com, discord.com
and reddit all returned 200 from the same IP in the same minute, which is what
proved the two 403s are agency policy rather than an IP reputation problem.

**Seven routes were tried on travel.state.gov and all failed:** curl with the
full header set, urllib, WebFetch, the Jina reader proxy (returns Cloudflare's
"Just a moment"), the canonical `/content/dam/.../visabulletin_<Month><Year>.pdf`
path, alternate JSON/RSS paths, and a real browser through the Chrome extension
(still on the challenge after 25s). Do not spend the session re-deriving this,
and do not defeat a government site's bot protection.

**An access matrix goes stale fast.** The June-2026 research for this project
recorded travel.state.gov as "freely scriptable, PDF and HTML both served to
scripts", verified 200. Two months later every path 403s. Re-verify before
building on a recorded result.

**A partial header set reads exactly like a dead link.** `www.dol.gov` answers
a bare UA with 403 "Access Denied" and the full `Sec-Fetch-*` / `Sec-Ch-Ua`
set with 200. Sustained traffic then earns a 403 anyway: the same request that
returned 200 came back 403 twenty minutes and 240 MB later, from curl and
urllib alike. Back off; do not go hunting for a header you are missing.

**Discover the URL, never construct it.** DOL moved its current-year disclosure
file to `/media/` while the archive stayed on `/sites/dolgov/files/ETA/oflc/pdfs/`.
A hardcoded path returns a styled 404 that looks like a dead link, and the
difference between 403 and 404 is the only thing that says which problem you have.

---

## Reading a government spreadsheet

- **XLSX omits empty cells entirely**, so indexing a row's `<c>` children by
  position silently shifts every column after the first blank. Resolve each
  cell from its own `r="A1"` reference. `scripts/lib_gov_data.py` does this.
- **A quarterly disclosure file is a window on DETERMINATIONS, not a record of
  a filing-month cohort.** A case filed 2024-07 and decided 2025-08 sits in the
  FY2025 file and is absent from FY2026, so one file shows an old cohort's slow
  tail and a new one's fast head and both look like medians. Union the files and
  de-duplicate by case number: 112,550 cases became 259,489.
- **DOL's disclosure files contain NO pending rows.** Every record has a
  decision date, so a completion fraction computed from them is always exactly
  1.0. A survivorship guard built on that ratio can never fire. Judge cohort
  maturity against DOL's published frontier instead.
- **The June-2026 cohort's raw median is 1 day**, and March-2026's is 6, because
  the only cases decided so far are instant withdrawals. Publishing either would
  be indefensible. This is why the guard exists.
- **The frontier DOL never publishes can be reconstructed backwards.** For each
  month of determinations, take the filing month at their median. That series is
  the only way to measure how fast the queue advances, because DOL publishes
  today's position and keeps no archive.

---

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

`scripts/diag_proxy.py` is the way out: it proxies the local production
server and injects an overlay printing the date field's whole ancestor chain
(display, computed width, measured width, grid template, min-width) in large
text. Serve it on the LAN, open it on the real phone, screenshot. That is one
decisive measurement instead of a fourth guess.

Gates: `form-controls-min-width.test.ts` and `responsive-grid-tracks.test.ts`.
The second one's first version matched `sm:grid-cols-2` as though it defined the
mobile track and reported every affected file clean — it now requires an
**unprefixed** `grid-cols-*`. It was also green over an unfixed file that had no
form control, which nearly read as proof it worked; fixer and gate now share one
scope.

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

## The visa bulletin, and when an archive is the right answer

travel.state.gov refuses automated clients. Seven direct routes were tried and
all refused. The Internet Archive is not a way around that: it is a public
archive of public pages built to be read programmatically, and reading it
circumvents nothing.

**The trade is freshness, and it changes the product for the better.** The
archive lags a month or two, so a "current cutoff" page would be wrong. A
HISTORY is honest by construction, and it is the more useful half anyway: this
month's number is on the State Department's own page, the direction is not.

Two things the parser must not simplify:
- **A cutoff cell is a date, or `C`, or `U`.** Treating `U` as a very old date
  reports "nearly there" at the moment the category shut.
- **Assert the column order.** The family-sponsored chart has El Salvador where
  the employment chart has India, and the assertion is what caught a
  family chart being parsed as an employment one.

**A CDX wildcard over a whole path truncates at the row limit**, and returned
bulletins from 2022 while reporting success. Query per calendar year.

## Extract shared logic the SECOND time, not the third

Evenly spaced chart ticks were written out twice. The label collision was found
and fixed on one chart, and came straight back on the other because the logic
had been duplicated rather than shared. Two callers is enough.
