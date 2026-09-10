# CLAUDE.md — PERM Tracker v2

> **Stack:** Next.js 16.3 + Convex 1.45 + React 19.2 + AI SDK 7 + Turso/libSQL + TypeScript 6 (strict)
> **Status:** Production | **Last Updated:** 2026-09-07

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
| `pnpm test:run` | **All 4 projects. Baseline 332 files / 6,444 tests (~10min). Run this before every push.** |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm storybook` | Component dev (:6006) |

Full test docs: [`TEST_README.md`](TEST_README.md).

**Two things that make a local run look worse or better than it is.**
`vitest.config.ts` sets **`bail: process.env.CI ? 5 : 1`**, so locally the suite
stops at the FIRST failure: a run reporting "78 passed of 305 files" is a bail,
not pool poisoning. And a count meaningfully BELOW the baseline on a run that
did not bail is a broken run, not a pass.

**`eslint` runs in NO workflow.** The only "Lint" step in CI is the pyflakes
pass over the Python ingests, so app-code lint errors accumulate silently (8 had
by 2026-09-01, all `react-hooks`). Run `pnpm exec eslint src convex` as part of
any audit. Note `--format unix` and `--format compact` were REMOVED from ESLint
core: passing one exits 2, and a careless `2>/dev/null` turns that into a silent
"0 errors".

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

// DON'T: call a raw calculator when a canonical composite exists
const w = calculateETA9089Window(first, last);      // WRONG: no PWD cap
// DO: the composite carries the rule the raw arithmetic cannot know —
// the window CLOSES at the earlier of first+180 and the PWD expiration,
// and isPwdLimited says when the cap applied. The deadline tool shipped
// close dates on which filing is barred by using the raw call.
const w = calculateFilingWindow({ firstRecruitmentDate, lastRecruitmentDate, pwdExpirationDate });

// DON'T: assert "obvious" PERM arithmetic in tests from memory
expect(expiration).toBe(addDays(det, 90));           // WRONG
// calculatePWDExpiration implements the OEWS wage-year rule: a January
// determination expires June 30 of THAT year, not det+90. A test asserting
// +90 days failed against the real model — which is the whole argument for
// central logic. Derive expected values by READING the calculator.

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

## A refusal must not leave the trace of a success (2026-09-04)

All three subscribe mutations wrote the row FIRST and checked the global daily
confirmation budget SECOND. So a refusal still stamped `lastConfirmationSentAt`,
and `clearConfirmationCooldown` - which exists for exactly this - is only
reachable from inside `sendConfirmation`, which the refusal branch returns before
ever scheduling.

The orphan row was not the problem. **The retry was:**

1. Budget exhausted, user told "we're busy, try later". Row stamped anyway.
2. They retry a minute later.
3. The 10-minute per-address cooldown sees the stamp the REFUSED attempt left,
   absorbs the request, and answers with the **success** message.
4. They wait for a confirmation email that was never sent and never will be.

**Charge a budget BEFORE the side effect it guards, not after.** Fixed by moving
the check above the write rather than compensating below it: nothing written,
nothing stamped. `queueAlerts` and `bulletinAlerts` needed their cooldown hoisted
out of the `if (existing)` branch first so the check could sit between cooldown
and write, preserving the invariant that a cooldown-absorbed request never
consumes budget. If a guard genuinely must run late, its compensation belongs on
the same branch, never in a function that branch does not reach.

**The three daily budgets are NOT equal: caseAlerts 15, queueAlerts 18,
bulletinAlerts 6.** A test counting to a hardcoded 15 passed against caseAlerts
and silently never exhausted queueAlerts.
`convex/__tests__/subscribeBudgetOrder.test.ts` fills until the endpoint actually
refuses and THROWS if 40 calls do not exhaust it, so a vacuous pass is
impossible. Probed by reverting the reorder.

**A silent limit is disclosed STATICALLY or not at all.** The cooldown told the
user nothing and logged nothing. It is now stated in all three forms as fixed
text, never conditional: a reply that varied with state would let anyone type an
address and learn whether it is watching a case, which for immigration filings is
a real leak. That constraint forbids a *conditional* message, not a *static* one.

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

Content in `content/{blog,guides,changelog}/*.mdx` (14, 33 and 8 pieces; the `tutorials` and `resources` directories named in earlier drafts do not exist). Processed by `next-mdx-remote` + `gray-matter` + `reading-time`. MDX components registered in `src/lib/content/mdx-components.tsx`: `Callout`, `ProductCTA`, `StepByStep`/`Step`, `ComparisonTable`, `ScreenshotFigure`, `VideoFigure`, `VideoPlayer`.

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
| Pull-to-refresh dead on mobile | `overscroll-behavior-y: none` on html/body kills the gesture (its documented purpose). Removed 2026-08-24; theme the bounce region with `html { background-color }` instead. `contain` is no escape hatch on the root |
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

## Which federal hosts serve scripts, and which refuse (measured 2026-08-23)

| Host | Automated fetch | What lives there |
|---|---|---|
| `flag.dol.gov` | **200** | processing times, AND an open batch case-status API (`POST /recaptcha/caseStatus`, 50 case numbers per request, no auth, no captcha) |
| `www.dol.gov` | **200** with a FULL browser header set | quarterly PERM disclosure files |
| `www.uscis.gov` | **200** from residential IPs; intermittently 403s GitHub's datacenter runners (2026-08-24) | quarterly I-140 counts (23-65 KB) |
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
- `scripts/diag_proxy.py` does the same via a LAN proxy of the local build —
  but this machine's firewall blocks inbound connections, which is exactly how
  the LAN route failed. Prefer the deployed `?diag=1`.

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

## The visa bulletin: three routes, and the one I wrongly ruled out

**CORRECTED 2026-08-27.** This section used to say travel.state.gov was
unreachable, full stop. Two of its conclusions were wrong.

**A REAL BROWSER GETS THROUGH.** Load the bulletin INDEX first, let Cloudflare
clear on that, then navigate to the month you want - the cleared session
carries. Measured: 10 tables, 101 cutoff dates, no challenge. Nothing is
defeated: no CAPTCHA solved, no `document.hidden` override, no forged token.
The earlier note said the extension "was still on the challenge after 25
seconds" and generalised that into unreachable; it just needed the index
first. Overriding `document.hidden` so the challenge's own proof-of-work can
finish WOULD be defeating bot detection - do not.

**Everything scripted still refuses**, re-confirmed from a GitHub runner with
controls in the same run. It 403s `robots.txt` itself, which is what settles
it as policy rather than rate-limiting. Jina returns Cloudflare's "Just a
moment" and warns "this page maybe requiring CAPTCHA".

**So there are three routes, in preference order**, and `SOURCE_RANK` in
`scripts/ingest_visa_bulletin.py` encodes exactly this so a worse source can
never overwrite a better one:

| rank | route | covers |
|---|---|---|
| 3 | `--from-file`, a page saved from a browser | the current month |
| 2 | Internet Archive | history, capped at 2026-07 (State now 403s their crawler too) |
| 1 | permtrack mirror | nothing any more; **0 rows** |

**Its clause ORDER is load-bearing.** The mirror records itself as
`permtrack.app/... (mirror; original: travel.state.gov)` - naming the original
is good provenance - so a plain substring test for `travel.state.gov` matches
the MIRROR too and ranks it as the real page. That would have made the
backfill skip every month that most needed upgrading, while reporting success.

**84 months held, 2019-10 to 2026-09, all six categories, zero mirror rows.**
Three bugs had to be fixed to get there, each invisible:

1. **The archive route searched two folder-years.** The folder is the FISCAL
   year, so November 2025 lives under `/2026/`. Everything outside that window
   was quietly filled from the mirror at three categories instead of six.
2. **Country columns were read by POSITION.** Bulletins before ~2023-04 carry
   a sixth column, `EL SALVADOR / GUATEMALA / HONDURAS`, between CHINA and
   INDIA (and that era also has VIETNAM). Reading column 3 as India would have
   published EB3 India as "Current" when it was backlogged to 15JUN12.
   Resolved by header NAME now, which handles every layout.
3. **EB5 was missing from all 18 pre-2022-05 months.** The EB-5 Reform and
   Integrity Act renamed those rows. `CATEGORY_ROWS` takes alternates.

**A parser fix must repair its own history.** The backfill used to skip any
month already archive-sourced, so improving the parser fixed nothing - the 18
short months would have sat there looking correct. It re-parses when a stored
row has fewer than six categories.

## When an archive is the right answer

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

## Per-case status comes from DOL directly (2026-08-27)

`scripts/ingest_case_status_direct.py`. This replaced mirroring permtrack.

```
POST https://flag.dol.gov/recaptcha/caseStatus
["G-100-24339-516453", ...]        <- JSON array, MAX 50
-> {"value":[{caseNumber, caseStatus, visaType, employerName,
              jobTitle, submittedDate, "@search.score"}]}
```

**THE PATH IS NAMED `recaptcha` AND NOTHING IN THE FLOW IS A CAPTCHA.**
Measured in the live page: `grecaptcha` undefined, no captcha scripts, no
`[data-sitekey]`, no challenge iframe, no hidden token. Bare curl, no cookie,
200 in 0.29 s. `robots.txt` does not disallow it. This project previously
recorded the opposite, **concluded from the path name alone**, and that
mistake cost the premise of a whole feature.

**Nothing was lost by switching**, verified field by field rather than
assumed. Status, employer, job title and submitted date matched the mirror
**8/8 exactly**. The four fields permtrack adds are derived or bookkeeping:
`filing_date` decodes from the case number's YYDDD segment (94.6% exact, rest
off by one day) and equals `submitted_date` for 409,127 of 414,050 rows;
`is_final` is a function of the status; `is_disclosed` **we compute better** -
they mark 87,820 cases undisclosed that are in the disclosure files we hold,
because their OFLC data is a quarter stale; `last_checked_at`/`verified` are
their record of when THEY looked. DOL adds `visaType`, which they do not
return at all.

### Three traps, all of which produce a wrong number rather than an error

- **The batch ceiling is 50 and it fails QUIETLY.** 100 or 200 returns
  `200 OK` with exactly 50 records. Only 400 is rejected. A loop asking for
  200 silently drops three quarters of every batch and reports success.
- **A RECONCILIATION IS NOT A TRANSITION.** The first pass found 1,328 status
  differences that were corrections of a months-stale mirror, not same-day
  events. Writing them into `perm_case_events` stamped today would have
  fabricated a one-day surge in the table that feeds the alert sweep and the
  RFI funnel. `--reconcile` corrects statuses and writes no events.
- **TWO WRITERS WITH DIFFERENT NOTIONS OF TRUTH ARE NOT REDUNDANCY.** The old
  mirror would have compared permtrack's stale values against our
  DOL-corrected rows, called the difference a change, and reverted all 1,328
  corrections - twice a day, forever, logging healthy writes. Its schedule is
  removed; `workflow_dispatch` kept as a fallback.

### Schedules

| workflow | when (ET) | why |
|---|---|---|
| `case-status-direct` full | 04:10 daily | "final" is not final: a CERTIFIED case becomes CERTIFIED - EXPIRED when the 180-day I-140 window lapses and nothing announces it |
| `case-status-direct` pending | 15:40 daily | halves worst-case staleness on the cases people have alerts on |
| `ingest-health` | 06:00 daily | the only thing that reports an ingest going quiet |
| `probe-state-dept` | 5th monthly | fails the run when travel.state.gov OPENS UP |

10,229 requests/day over ~85 minutes is **2.0 req/s** - measured before
choosing, not after. Writes stay ~1,300/day because only CHANGED rows are
written, against a 10M/month plan.

## The RFI funnel is BLENDED, and the blend must stay decomposable

Adam's call over my recommendation. `blendRfiFunnel(base, observed)` in
`src/lib/turso/rfi.ts` pools **counts**, never percentages:

```
resolved     = base.resolved  + observed.resolved
approvalRate = certified / resolved
```

One case at 100% must barely move an 83.6% rate; averaging the two
percentages gives 91.8%. That is the classic blend bug and it is why the
counts are stored as counts. Pinned by a test, probed by injecting the
averaging version.

**Three things keep it honest, and each was a bug first:**

1. **THE WINDOWS MUST STAY DISJOINT.** `ingest_rfi_funnel.py` is deliberately
   in NO workflow. Re-reading their aggregate on a schedule would absorb
   resolutions ours had already added, and the denominator would drift with
   nothing erroring.
2. **A TIMESTAMP CANNOT TELL AN OBSERVATION FROM A RECONCILIATION.**
   `perm_case_events` also holds mirror rows that logged a difference against
   permtrack's copy, written at 19:16 on the freeze date - "after" a 03:25
   freeze by any time test - while describing changes of unknown age. The
   filter is therefore on SOURCE. `DIRECT_EVENT_SOURCE` must stay
   byte-identical to `SOURCE` in the Python ingest; a drift silently zeroes
   our half forever, so a test reads the Python file and asserts it.
3. **"RESOLVED" IS NOT AN RFI-TO-FINAL TRANSITION.** Cases go
   `RFI ISSUED -> ANALYST REVIEW` and decide from there - 10 of the first 48
   events. Resolution reads from the case's CURRENT status, joined to the
   cases we watched ENTER an RFI.

**Our half overtakes theirs in ~74 days.** The disclosure fires when EITHER
half is non-empty: gating it on resolutions alone left a blended `everIssued`
rendering as single-source the moment we watched one RFI be issued.

## The rival's whole API is public, and its data is a quarter stale (2026-08-24)

permtrack.app is the namesake competitor. Every endpoint under
`permtrack.app/api/*` answers unauthenticated - all stats, the 321,725-row
case browser, the risk estimator, and the "PRO" decision predictor - so the
product is readable end to end without touching anything gated.

Two facts that reframe the rivalry, both measured:
- **`/api/stats/data-freshness` returns `oflc_through: 2026-03-31`.** Ours runs
  through 2026-06-30. They hold more history; we hold fresher data.
- **`/api/flags` shows `risk_estimator: false`, `i485_queue: false`,
  `daily_decisions: false`** - three features built and switched off in prod.

**Their moat WAS per-case FLAG scanning - and it is gone as of 2026-08-27, because DOL serves that same lookup directly (above).** The live
pending backlog (39 months, ~99k pending), daily decision counts, and the RFI
funnel all come from scanning individual case numbers on flag.dol.gov. Every
other thing they ship runs off the same quarterly XLSX we already ingest -
which is why the tier-one gaps closed in a day.

**Their formulas, decoded:** risk score is
`3.00 + Σ weight×(subsetRate − 3.00)` (SOC 0.50, state 0.20, wage 0.15, five
booleans sharing 0.15/N); predictor is `queue_position ÷ pace`, pace from the
last 28 days split weekday/weekend, walked forward business-day-aware.

**Where we deliberately diverge:** they roll their denial factors into one
letter-graded score. We publish the measured rates and refuse the blend,
because the factors are not independent and one number would read as
precision the data cannot support. `/perm-denial-risk` says that on the page,
above the bars.

Full teardown and the remaining gap list:
`~/.claude/explanations/20260619_perm_competitor_teardown/DETAILED-permtrack.md`
plus the 2026-08-24 live delta in the auto-memory
`permtrack-gap-closure.md`.

## greencardclock.com, re-measured Sep 7 2026

Full doc set: `~/.claude/explanations/20260907_greencardclock_teardown/`. The
short version: on PERM this site is decisively better (live status of every
pending case, DOL's frontier, an estimator that withholds immature cohorts;
theirs tells a March-2026 filer the case was decided in eight days and its new
"alphabet patterns" report zero pending, because it reads disclosure files
only). On the bulletin and the I-485 inventory both sites hold the same federal
tables; they divide the count by a supply guess to make a forecast, we print
the count and the measured pace, and their India queue position is a quarter of
USCIS's published sum with no stated method. They are ahead on LCA salary
tooling (explorer facets, percentiles, compare-your-offer, sponsor discovery)
and on content cadence with printed corrections. Everything worth closing can
be built from `lca_cases`, `perm_cases` and the bulletin archive in about a
week; a weekly digest is blocked by the Resend 100/day cap, not by code.

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

## Convex documents cap at 1 MB, and a "top N" may be load-bearing

The entity arrays lived inside the `permDisclosureStats` document capped at
the top 100. Measured, the uncapped set is **1.14 MB of employers alone**
against a 1 MB document limit — so the cap was an architectural constraint
wearing an editorial disguise, and removing it would have failed the store
at ingest time rather than in review.

Entities now live in `permEntities`, one row each, written in chunks of 400
with the first chunk clearing the kind. Detail pages resolve the subject via
`permEntities.getBySlug` so every entity has a page; `generateStaticParams`
prerenders only the first 100 and the rest arrive through ISR, because
prerendering 12,000 pages costs hours for pages almost nobody opens.

**The slug rules are duplicated in `scripts/store_entities.py` and
`src/lib/entitySlug.ts` deliberately** — a slug computed differently in the
writer than in the reader is a detail page that 404s from its own index — and
the Python copy is asserted against the same fixtures as the TypeScript one.

## DOL prints one firm under six spellings

Fragomen appears at ranks 1, 9, 23, 31, 50 and 57 under six slugs, because
the collision resolver appends `-2`, `-3` rather than merging. Published
total 24,059; summed across its rows, **30,180**. Each leaf page presents
itself as a distinct firm with its own "#N by volume".

The index pages disclose that one practice can appear under several
spellings. The leaf pages do not, and the ranks are wrong either way.
**Entity identity needs normalisation before ranking, not slug
disambiguation after it.**

## The live census doc, and why the lookup path must never query the mirror (2026-08-28)

`/perm-case-status?case=` is dynamic, and its read layer used to aggregate
the 414k-row mirror on every render: a full status count, an unbounded
ahead-of-month range, a whole-table month group-by, a bare COUNT(*), and a
window-function pass over `perm_cases` (no received_date index). Measured:
**~1.8M row reads per lookup** - which is how one month of crawler traffic
burned a 500M row-read budget and got Turso reads BLOCKED mid-August.

The fix is a precomputed census: `ingest_case_status_direct.py` writes
`perm_docs['live_census']` (the month x status x is_final matrix, reconciled
against COUNT(*) before writing - a mismatched census is skipped, not
served) and `perm_docs['decided_month_percentiles']` after every run. The
read layer (`src/lib/turso/liveCensus.ts`) folds everything out of one
React-cached doc read; legacy SQL survives only as the doc-missing fallback,
except the 414k status scan, which is withheld because the fallback IS the
cost bug. A doc older than 8 days is treated as absent: stale queue
positions read as current ones, which is worse than an empty state.

**Do not add per-request aggregate queries to the lookup path.** Fold from
the census, or precompute a new doc in the ingest. `perm_month_stats` is a
frozen orphan (its permtrack writer was retired 08-27) - `getQueueAhead`
reads the census now; do not resurrect the table.

## One email system: three alert tables, one consent surface (2026-08-28)

Alert kinds: per-case status (`caseStatusAlerts`), queue-month milestones
(`dolQueueAlerts`, now with a `queue` field: perm / pwd-oews / pwd-nonoews),
and visa-bulletin movement (`bulletinAlerts`). They stay separate tables on
purpose - sweep state is per-subscription - with one surface over them:

- `/prefs` (Convex HTTP) is the magic-link preference center; the site page
  is `/email-preferences`. **OFF ONLY.** The token never expires, so it is
  never consent to START mail; turning on goes through the owning flow.
- `newsSubscribers` holds product-news consent for anonymous subscribers,
  staged by a checkbox and confirmed by the SAME double-opt-in click as the
  alert (the confirmation email names both). `syncContacts` counts confirmed
  news rows into its protected set - without that, its orphan removal
  deletes any non-user Resend contact on the next sync.
- Token purposes now include `bulletin-confirm`, `bulletin-unsubscribe`,
  `prefs`. Existing purposes must never be renamed (links live in inboxes).
- **The Resend 100/day arithmetic lives in convex/caseAlerts.ts and every
  new sending path must claim a line there before it ships.** Current worst
  case: 18+10+18+6+12+6 = 70/day, leaving 30 for auth mail.

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

## Turso: production's default token is READ-ONLY on purpose (2026-08-28)

Vercel prod's `TURSO_AUTH_TOKEN` cannot write; the local `.env.local` holds
a FULL-ACCESS token under the same name. So write code passes every local
test and dies in prod with `LibsqlError: BLOCKED: SQL write operations are
forbidden` - and behind the case page's `.catch(() => null)` that rendered
as an ordinary "no record". Cost an afternoon. The posture is worth keeping
(the read layer runs on a credential that cannot corrupt the corpus):

- Web-side writes go through `exec()` in `src/lib/turso/client.ts` ONLY,
  which rides `TURSO_RW_AUTH_TOKEN` (Vercel prod env) and falls back to the
  default token in dev. Never call `turso().execute()` for a write.
- Before believing a prod write worked, check for the ROW, not the exit
  path. `vercel env pull` redacts sensitive values (`[SENSITIVE]`), so the
  prod credential cannot be probed locally - diagnose via `vercel logs`
  with a NAMED error tag (`[caseDiscovery]` pattern: every failure branch
  logs its cause; a discovery that throws is indistinguishable from a miss
  otherwise).
- The client also carries a 20s per-query deadline with one retry on a
  fresh request, and `next.config.ts` a 180s prerender budget: during
  Turso's 2026-08-28 degradation (their status page's own word), point
  reads stayed fast while scans hung with no response headers, and three
  production builds died on the default 60s. A deploy should get slower
  under a slow provider, not fail.
- Vercel builds from GIT: `convex/_generated/` must be COMMITTED after
  codegen, or the deploy typechecks against yesterday's API and fails on a
  module that exists locally.

## The corpus grows itself now: discovery, two halves (2026-08-28)

`perm_case_status` was a CLOSED set (the mirror seed; nothing added new
filings, pending could only drain). Two additions opened it:

1. **Lookup-side** (`src/lib/turso/caseDiscovery.ts`): a case-number lookup
   that misses the table asks DOL's batch endpoint live (one case, one
   request), renders the answer verbatim, and records it. Exact-match only
   (the endpoint is a SEARCH with scored neighbours - a near-miss shown as
   the visitor's case is somebody else's record). Global budget 2,000 DOL
   requests/UTC day counted in `perm_docs.discovery_budget_*`; every
   failure named in logs and degraded to the ordinary miss. NO event row -
   a discovery is an observation, not a transition.
2. **Nightly prober** (`--discover` in `ingest_case_status_direct.py`,
   rides the `--full` sweep): serials are global and sequential, so it
   walks a bounded window past the highest known serial across the last 5
   filing days. Caps: 120 requests/run (= 6,000 numbers at the batch
   ceiling, ~13x a normal day's ~460 filings), 1,500-serial span, stop a
   day code after 2 consecutive empty batches. The frontier self-heals:
   whatever a night misses, the next starts from. First real run: 38
   requests, 108 filings.

## perm_live_recent: the searchable remainder (2026-08-28)

The gap Adam hit: a case he KNEW existed (filed the day before) was
invisible to the case search and its employer's page, because those read
`perm_cases` - DOL's published files, decided-only, ending at the last
quarter (currently 2026-06-30). `perm_live_recent` is the remainder,
slugged and indexed by employer.

**THE FIRST VERSION SCOPED THAT REMAINDER BY DATE AND THAT WAS THE WRONG
AXIS (fixed 2026-08-29).** It took cases filed after the last published
MONTH, which is right for new filings and wrong for everything still
waiting: a case filed 2026-03 and still pending is not in the disclosure
files (undecided) and was not in this table either (not recent enough), so
it existed in our corpus and could be found by nobody who did not already
know its number. Measured at the fix: the table held **16,676 rows and the
true remainder was 136,886 - 120,210 missing, 97,875 of them pending**,
which is precisely the population most likely to be searching for itself.
The rule is now MEMBERSHIP, not date: a case belongs here when `perm_cases`
does not hold it. No boundary to drift, and it self-corrects when a
quarterly file lands and absorbs part of the set.

**AND THE NIGHTLY WRITE IS DIFFED, WITH A NORMALISER ON BOTH SIDES.** 137k
rows rebuilt wholesale is ~4.1M writes/month against a 10M plan to express
the few hundred rows that changed. The first diff silently never matched -
libSQL returns integers as STRINGS, so a stored `is_final` of `'0'` never
equalled the built int `0` and every row read as changed. That is not a slow
diff, it is NO diff, and it logged `ok` while rewriting all 136,886 rows.
Caught by reading the log line on a second identical run, not by review.
`live_norm()` now prepares both sides; `scripts/test_live_recent.py` pins it
and is wired into CI.

- **Storage stays separate** (published record vs live feed - different
  truths, different write disciplines; merging them is the two-writers
  flip-flop). **Experience is unified**: every search box answers from
  both, plainly labeled. `/api/perm-cases` search returns
  `{ cases, live }`; lookup returns `{ disclosed, live }`.
- Firm/state/wage searches stay published-only BECAUSE THE DATA DOES NOT
  EXIST LIVE (DOL names the firm at publication) - the UI says so in words
  instead of silently missing.
- Rebuilt wholesale by `build_entity_detail.py --live-recent-only` daily
  after the full sweep (wired in case-status-direct.yml, `|| true` - a
  rebuild failure leaves the band a day stale, never fails the sweep), and
  by the full entity rebuild. Slug = canonical entity slug when matched,
  `slugify(name)` fallback otherwise (both name-shaped, so the search
  needle behaves the same; the nightly pass canonicalizes).
- Web discovery ALSO inserts here immediately, so "search a number once,
  find it by employer seconds later" is true - pinned in
  caseDiscovery.test.ts.

## A sweep's event log is not a diary of that day (2026-08-29)

`/perm-decision-activity` now renders WHICH cases DOL moved and what each moved
from and to, out of `perm_case_events` (`src/lib/turso/changes.ts`). A count
cannot show a transition, because a count has no `from`: `ANALYST REVIEW -> RFI
ISSUED` and `RFI ISSUED -> ANALYST REVIEW` are opposite events and read
identically as "an RFI row" without both ends.

**THE TABLE HOLDS TWO CLASSES OF ROW AND ONLY ONE HAPPENED THAT DAY.** An event
is dated when our sweep SAW the difference, not when DOL made it. On 2026-08-28
the first full sweep wrote **92,113 `CERTIFIED -> CERTIFIED - EXPIRED` rows
under two timestamps** - 180-day I-140 windows that lapsed across two years and
were all noticed at once. Rendered raw that is "94,581 cases changed on 28
August", a fabricated surge on the busiest-looking day in the record. Same
defect class as the reconciliation guard one level down, which filters on
source; source does not separate these, because both are the DOL-direct sweep.

Two filters, both on what the rows MEAN, both disclosed on the page rather than
applied silently (a feed that quietly drops rows is indistinguishable from one
with no data):

1. **Expiry is not an adjudication.** `CERTIFIED -> CERTIFIED - EXPIRED` is a
   clock running out, not DOL acting. Excluded by status pair - which removes
   the backfill and is the right product rule anyway.
2. **A bulk write is not a day's work.** Any single timestamp carrying more
   than 5,000 rows is a sweep catching up. DOL's heaviest measured day is under
   2,000 and the backfill was 92k, so there are three orders of magnitude of
   headroom either side.

After filtering: 336 / 58 / 48 genuine adjudications on the three observed
days. `changes.test.ts` reads the SQL the module issues rather than mocking a
result set, because the defect lives in the predicate - shaped fixture output
would pass with either filter deleted. Both were probed by reverting them.

## Maximum combinability: what it cost, and the two bugs under it (2026-09-04)

Adam: *"you should be able to pick a firm and then the state and occupation and
such, maximum possibility."* Two things were in the way and only one of them
was a real limit.

### The filters were switched off for a cost that no longer exists

`filterAvailability` turned everything off under a firm, state or occupation
lead except the outcome and a decided-date range. The measurement behind it was
real: a SELECTIVE second equality walked the lead's whole slice.

| combination | before | after |
|---|---|---|
| biggest firm + `state='WY'` | 48,166 rows / 17.11 s | **5 rows / 0.55 s** |
| `state='CA'` + a rare SOC | 67,743 rows / 8.82 s | **0 rows / 0.43 s** |
| firm + `state='CA'` | 408 rows / 1.62 s | 100 rows / 0.66 s |

Three composite indexes close it, `decision_date` last so the ordering stays
free: `idx_pc_att_state_dec`, `idx_pc_att_soc_dec`, `idx_pc_state_soc_dec`.
`permLeadIndex` prefers a **pair of equalities over the outcome**, because no
status bucket narrows like that.

**A slice is smaller than it sounds, and that is why this was affordable.**
Measured over `perm_cases`: the biggest firm is 48,165 rows and the MEAN firm
is **66**; the biggest state 67,742 and the mean 6,677; the biggest occupation
76,524 and the mean 451. The guard was protecting against a case an order of
magnitude smaller than the entity-page reads this database already does.

### The occupation lead was losing a quarter of its cases

Not performance. `perm_cases` holds **302,081 dotted** codes (`15-1252.00`) and
**71,858 bare** (`15-1252`), and the lead matched exactly, so it answered with
whichever spelling it resolved to:

| SOC | dotted | bare | an exact match misses |
|---|---|---|---|
| 13-2011 Accountants | 3,686 | 1,207 | **24.7%** |
| 29-1141 Nurses | 9 | 4 | **31%** |

It matches `substr(soc_code, 1, 7)` now, on `idx_pc_socg_dec`. A test then
caught the follow-on immediately: the expression yields seven characters, so
binding the lead's own ten-character value matches NOTHING. `socGroup()` the
needle as well as the column. The employer path had the mirror defect - it used
`soc_code = ?` while the equality leads used the group, so one occupation
answered differently depending on which box the reader filled.

### The law firm: a missing INGEST, not a missing index

DOL publishes `LAWFIRM_NAME_BUSINESS_NAME` in both the ETA-9035 and ETA-9141
FY2026 Q3 record layouts. This site had never mapped the column, so a firm lead
read the PERM file alone and said "this firm files no wage requests" by
omission. **Measured after the backfill: Fragomen has 45,011 wage requests,
none of which were findable before.** DOL fills the column on **91.0%** of the
FY2026 wage-request rows.

**A FULL RELOAD IS NOT AFFORDABLE.** `pwd_cases` is 634,638 rows and
`lca_cases` 437,496, and `INSERT OR REPLACE` deletes and reinserts, so every
index is rewritten per row: ~10.7M writes against a 10M/month plan, the whole
month's budget for two columns. `--backfill-attorney` writes only those two
with `UPDATE`, and creates the firm indexes AFTER the pass rather than before,
so it costs one write per row - about 1.07M.

**Three bugs in it, none of which a typecheck could see, all found by
dispatching it:**

1. **`CREATE TABLE IF NOT EXISTS` can never ADD a column.** `table_ddl` is
   split from `index_ddl` now, with `ensure_columns` between: an index naming a
   column the live table has not got is a hard error, and the first run died on
   `no such column: attorney_slug` six seconds in.
2. **The backfill sat after the sha-match branch, which returns early.** During
   a backfill the file is unchanged BY DEFINITION, so it reported
   "unchanged; skipping" and never ran.
3. **500 separate UPDATEs per request measured 986 rows / 20 s** - 3.6 hours
   for `pwd_cases`, over the workflow's own 230-minute timeout. The cost is per
   STATEMENT. One `UPDATE ... SET x = CASE case_number WHEN ... END WHERE
   case_number IN (...)` per 200 rows: **1,233 rows/s**, 147,244 rows in 148
   seconds. Proved against a real SQLite first - each name and slug lands on
   its own case number, and a row the file does not mention keeps its value.

**A quarterly file only carries its own quarter's determinations**, so one
backfill covers one file. `--fy 2024` and `--fy 2025` fill the history.

**GitHub's concurrency group keeps at most ONE pending run**, so dispatching
three at once cancels the middle. Dispatch sequentially.

### Two DOL links went to a page that cannot answer them

Reported by Adam. Two PERM surfaces told someone holding a case number that
"DOL's own system" and "DOL's own status page" were the authority on that case,
and linked to `flag.dol.gov/processingtimes`, which publishes queue averages
and cannot look a case up. The wage-request and LCA equivalents already used
`case-status-search`, so the three programs disagreed. Both use the shared
`DOL_CASE_STATUS_URL` now.

`dol-outbound-links.test.ts` gates the class, because `audit_internal_links.py`
only sees internal links. **Its first version reported three findings and all
three were false** - a schema `description` four lines above an unrelated
`isBasedOn`, and two paragraphs where one sentence names the case-status search
and the NEXT one links to processing times. Scoped to the sentence containing
the link, and probed both directions.

**`perm-only` and `walks-the-slice` are deleted, not left behind.** Nothing
sets them any more, and a refusal reason no code can produce is documentation
that lies.

## The day feed asked one question when it holds two (2026-09-03)

`/perm-decision-activity` offered a `<select>` of days, built from
`perm_case_events`. That log records when our sweep SAW a change, so it starts
2026-08-26 and cannot be extended backwards: DOL returns a case's CURRENT
status and never says when it changed. The picker therefore looked capped at a
week, and Adam asked why.

**The cap was the picker, not the data.** Every published table carries an
indexed `decision_date`, and it is by far the larger half of the record:

| | earliest decision | rows |
|---|---|---|
| `perm_cases` | 2023-10-01 | 373,939 |
| `pwd_cases` | 2023-10-01 | 634,638 |
| `lca_cases` | 2025-10-01 | 437,496 |

So "what did DOL do on 12 March 2025" was always answerable, with the wage,
worksite and occupation attached. Measured that day: 576 PERM, 1,301 PWD.

**THE TWO DIMENSIONS ARE NEVER SILENTLY MERGED**, and that is the whole design.
"Decided on this day" and "changed status on this day" have different coverage,
and a decision is only one of the things the event log records - it also carries
RFIs issued, holds and appeals. They render as two labelled sections
(`DecidedTable` and `ChangeTable`) with two row shapes, because one wider table
would leave half its columns blank and the reader could not tell which blanks
are DOL withholding and which are nothing happening.

| dimension | source | reach | carries the wage |
|---|---|---|---|
| decided | quarterly files | 2023-10-01 → 2026-06-30 | yes, with state and SOC |
| observed | our sweep's event log | 2026-08-26 → today | no |

**There is a real gap, 2026-07-01 to 2026-08-25**, between the last published
file and the first observation. `coverageFor` reports `uncoveredDays` so the
page can say "we hold nothing for these dates" rather than render an empty
table, which a reader correctly reads as "DOL did nothing". It closes from the
left when DOL publishes Q4 FY2026, and it never grows.

**A DISABLED FILTER MUST FOLLOW THE SELECTION, NOT A BLANKET RULE.** The page
used to render wage, law firm, worksite and occupation as four permanently dead
selects captioned "not on a live record". True of a live row, and false of the
three years of published rows the picker could not reach. They are now enabled
whenever the selection touches the published window, and the explanation panel
is a `<details>` that opens itself only when it does not. It carries a `key`
tied to that state so a remount re-applies `open`; an `open` prop alone sticks
at its first value.

**SORTING IS NOT FILTERING AND THEY FAIL DIFFERENTLY.** A filter on a wage
cannot evaluate a row whose wage is unknown, so it must drop it. A sort just
puts unknowns last, which `sortRows` already does both ways. They had been
switched off together, disabling sorting for a reason that only ever applied to
filtering.

**Cost, because Turso bills rows read.** No `COUNT(*)` over a range: counting a
year walks millions of index entries for one number. An exact count runs only
for a single day (a few thousand entries) and a range reports what it fetched.
Every read is `LIMIT`-capped and ordered by the indexed column, so a ten-year
range costs the same as a one-day range - *provided the filter is indexed*,
which is why `RANGE_MAX_DAYS_UNINDEXED` (92) bounds a wage bound, the one
filter no index leads with. Verified: `SEARCH ... USING INDEX idx_pc_decision`
and `idx_pc_state_dec`, no `SCAN`.

**Carry `wage_unit`.** `pwd_cases` and `lca_cases` quote hourly as well as
yearly, and a real row on the first test day was `9.75 HOURLY`. Rendered
without its unit that is "$10" beside six-figure salaries. `perm_cases` has no
such column, so PERM rows print the wage alone.

Modules: `src/lib/dateCoverage.ts` is the PURE half (a plain module, because the
browser needs the same arithmetic the queries are bounded by - a page that
enables a control the route cannot serve is the invariant the case search
already protects); `src/lib/turso/decidedDays.ts` is `server-only` and holds the
reads; `/api/decided-cases` is a sibling of `/api/case-changes`, not a mode on
it. A refusal there is a 400, never a 200 with no rows, or "too expensive" and
"DOL decided nothing" become the same response.

**Two things the observed half got wrong that only showed as "nothing
happens".** It fetched `/api/case-changes` for any date, including ones outside
its 400-day window, so an older date sat on "Loading…" forever. And the
"Earlier day" button was disabled whenever the date was not in the calendar's
day list, which is every published-only date. Both were invisible until the
picker could reach those dates.

## The employer's initial: real, small, and SHOWN not sold (2026-08-29)

DOL works each filing month alphabetically by employer, so the initial is a
genuine ordering term and every rival estimator uses it. What none of them
publishes is its SIZE, and the size is the whole question.

**Measured over 339,518 decided cases** (`scripts/build_alphabet.py` ->
`perm_docs.alphabet`, surfaced on `/perm-queue`):

| | |
|---|---|
| A, the fastest letter | **11.4 days under** the corpus mean |
| Z, the slowest | **15.7 days over** |
| the whole alphabet, end to end | **about 27 days** |
| per-month A-I vs S-Z gap | median **+8.2d**, range **-7 to +36** |
| months where the order REVERSED | **6 of 30** |

permupdate prints this same term as **-80 to +80 days** and its FAQ calls the
initial roughly 80% of the outcome - the same effect inflated about sixfold.

`estimateQueueDecision` accepts `letterDeltaDays` and shifts every model by it,
because the ordering acts within a filing month and every model is anchored to
one. Three rules keep it honest, and they are the whole design:

1. **It is never invented.** The caller passes the measured delta from
   `perm_docs.alphabet` or passes nothing. There is no fallback constant.
2. **It is printed with its own number and its own size** ("Employers starting
   with Z: +16 days... the whole alphabet spans about four weeks, and in a
   sixth of filing months the order ran backwards"). Folding it into the date
   is the difference between using an input and appearing to - and stating the
   magnitude is what stops this becoming the thing it guards against.
3. **It is applied BEFORE the elapsed filter and cannot rescue a past date.**
   An overdue case still gets no date; a fortnight does not drag a
   months-elapsed model into the future.

**Keep it in proportion when tempted to weight it harder: our own measured
median error is ~50 days and this term moves a date by at most 16.** It is
inside the noise floor. It earns its place as a specific, personalised output
the reader can see was used - not as a lever.

On `/perm-case-status` it costs the reader no input at all: DOL names the
employer, so the initial comes from a fact already on the page.

## An estimate whose date has passed is not an estimate (2026-08-28)

A Nov 2024 filing rendered "likely decision window November 2025 to March
2026" in August 2026: for a month the frontier has passed, every
filing-anchored model's date has already elapsed. `estimateQueueDecision`
now WITHHOLDS elapsed models centrally (every composing surface inherits
it); the timeline page renders the overdue truth instead (queue passed
your month by N; a case still pending is usually in an audit/RFI/hold ->
CTA into the per-case lookup), and the case page returns the no-date
refusal with the measured age. Presentation rule from the same review:
lead with the strongest model's own date ("Most likely: around X") with
the full window right under it - an anchor plus honest spread, never a
bare range and never a blended number. Predictions worth scoring go in
`../.planning/prediction-ledger.md` BEFORE the outcome.

## Turso forbids ANALYZE, so an index has to win on its own shape (2026-08-30)

`db.execute("ANALYZE")` returns `SQL not allowed statement: ANALYZE`, and
`sqlite_stat1` does not exist on this database. Every plan is therefore chosen
from SQLite's no-stats heuristics, which has two consequences worth knowing
before adding an index:

- **Design the index so the query cannot be served by a worse one.** Lead with
  the equality the query filters hardest on, and put the ordering column last
  so the sort comes free. `perm_case_status` had `case_status_month (month,
  status)` and `case_status_final (is_final, filing_date)`; a per-status list
  matched neither well and read all ~98,000 pending rows to return 974.
  `case_status_stage (current_status, is_final, filing_date)` serves it
  directly.
- **AN `EXPLAIN QUERY PLAN` IN THE SAME PIPELINE AS ITS `CREATE INDEX` REPORTS
  THE OLD PLAN.** The statement is prepared against the schema as it was when
  the pipeline opened, so the new index is invisible to it. This looked exactly
  like "SQLite is ignoring my index" and cost a detour through storage classes
  and stats before a second, separate call showed it had been right all along.
  Re-run the EXPLAIN in a fresh request.

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

**Where to check this, not the workflow log:**
`bing.com/webmasters/indexnow` lists every URL Bing received and when.

## A prefix range on the leading index column forces a sort, always (2026-09-02)

The employer searches over `pwd_cases` / `lca_cases` are
`employer_slug >= ? AND employer_slug < ?` ordered by `received_date DESC`.
`EXPLAIN QUERY PLAN` shows the index being used AND a `USE TEMP B-TREE FOR
ORDER BY`, which reads every row for that employer to return five.

**The obvious fix does not work, and it was measured rather than assumed.**
Adding `case_number` as a third index column (so the index covers the full
`ORDER BY received_date DESC, case_number DESC`) changed the plan **not at
all**. The reason is structural: with a RANGE on the leading column, rows come
out ordered by `employer_slug` first, so any ordering that crosses several
slugs must be sorted. Only an equality on the leading column lets the index
supply the order.

The index kept its two-column shape and the comment now records the
measurement. The sort is bounded by one employer's filings, which is the
point - the read never touches rows belonging to anybody else. **This is the
counterpart to the `idx_pe_kind_decided` win: an expression index fixed that
one because the filter was an equality plus an expression, not a range.**

**Re-EXPLAIN in a FRESH request**, as always here: an EXPLAIN in the same
pipeline as its own CREATE INDEX reports the old plan.

## revalidateTag would be a silent no-op here (2026-08-30)

Tags attach to data through `fetch` with `next.tags`, `unstable_cache`, or
`cacheTag` inside a `"use cache"` scope. This app uses none of them - Turso is
read through a raw libSQL client - so `revalidateTag('anything')` returns 200,
logs nothing, and leaves every prerender in place. Same family as the
server-side concurrency check whose only client never sent the header.

**`revalidatePath` with a LITERAL path is the mechanism that works**, and it is
also the right shape: `/perm-employers/[slug]` carries `revalidate = 2592000`
because ~21,495 live-only pages on a short window is what took Vercel's ISR
write meter to 100%. A tag over all of them would expire all of them at once
and reproduce exactly that. `POST /api/revalidate-live-employers` takes the
few hundred slugs the nightly diff says moved; `build_entity_detail.py` writes
`changed-employer-slugs.json` (busiest first, capped at 800 to match the
route), and `case-status-direct.yml` posts it. **Never the
`('/perm-employers/[slug]', 'page')` pattern form** - that expires all ~33,700
employer pages in one call.

`export const revalidate` is route-segment config: one statically analysable
value per segment. Two render branches in one route file cannot have two
windows, which is why this exists at all.

**The second one is `POST /api/revalidate-dol` (2026-09-01), and it takes NO
input.** The homepage band says "Live from the Department of Labor · <date>",
where the date is DOL's own as-of stamp parsed from their table caption, not our
fetch time. The ingest runs daily but the pages carrying that number sit on
`revalidate = 86400`, so on the day DOL moves the fresh figure could be in Turso
while every page served the old one for up to another 24 hours: worst case ~48h
behind DOL, on a band whose whole claim is that it is live. `page.tsx` had said
"The ingest should also revalidate on demand" since it was written.

Two design points worth keeping:

- **A fixed list, not caller-supplied paths.** The employer endpoint must accept
  slugs because which employers moved is only known at runtime. Here the set is
  static (the ten ISR pages that read `getProcessingTimes()` or
  `lib/turso/estimate`), so taking no input removes path validation, traversal,
  and any way to aim the endpoint at something else. `/perm-queue/[month]` and
  `/perm-case-status` are deliberately excluded, each with its reason in the
  route, and `route.test.ts` re-derives the list from the app tree so a new page
  cannot quietly start serving a stale figure. Both drift guards were probed by
  breaking them.
- **Gated on DOL actually republishing**, via a `dol_changed` output the ingest
  computes BEFORE its write (the table is keyed on `perm_as_of`, so
  `INSERT OR REPLACE` destroys the evidence). DOL moves roughly weekly, so
  firing every night would expire these pages on the ~29 days a month nothing
  changed, and every expiry a visitor walks into is a paid ISR render for an
  identical number.

## ISR cost: what actually drives it, and two models that were wrong (2026-09-01)

**A WRITE UNIT IS 8 KB, NOT A PAGE.** Vercel: *"One write unit equals 8 KB of
data written to the ISR cache."* So 951,650 units over five days is **~7.6 GB**,
which at this site's page sizes is ~29,000 regenerations, not 951,000. Reading
units as pages overstates the rate by ~33x. Corollary: **page SIZE is the bill**.
Measured: `/` 320 KB (40 units), `/perm-wages/[slug]` 330 KB (42), `/perm-queue`
289 KB (37), `/tools` 178 KB (23).

**EVERY DEPLOY STARTS THE ISR CACHE COLD. (Corrected 2026-09-02; the 09-01
version of this paragraph said the opposite.)** The earlier text quoted the
storage-retention sentence ("all the data you write remains cached for the
duration you specify...") as if it covered deployments. It does not. Vercel's
ISR page: *"It is scoped to a specific deployment where each deployment
generates its own cache"* and *"each new deployment uses its own ISR cache and
does not reuse the cache from a previous deployment."* The cache-status page
lists a deployment as a cause of a **Cold** miss: *"after a new deployment
(Vercel scopes cached responses to the deployment that produced them)"*. The old
cache survives only so rollbacks work. So after every production build, each
ISR path is regenerated and WRITTEN on its first request, and "unchanged output
costs nothing" cannot help, because the new cache holds nothing to compare
against.

**Measured: five production builds in the 24 hours around 2026-09-01 (`vercel ls`:
09:38, 10:33, 21:43, 23:04, 23:57 EDT) -> $3.23 of ISR writes on the Sep 1 usage
line, ONE day** (~808k units, ~6.5 GB, roughly 20-25k regenerations), against $3.81 for
the five days before it. **Deploy count is an ISR lever, not only a
build-minutes lever.** Corollary: an entity window of 2592000 is really
min(30 days, time to next deploy); with daily pushes that is about a day, so
raising windows buys nothing until pushes are batched. A comment-only change
under `src/` (the `Footer.tsx` doc commit) is a full cold-cache event, because
`ignoreCommand` cannot tell it from code. The 31-day eviction rule still holds
within one deployment.

**UNCHANGED OUTPUT COSTS NOTHING**, so unexpected writes mean genuine
non-determinism in the render. Checked here and ruled out: every `new Date()` in
an ISR page is date-only (`.slice(0,10)`) on a page that revalidates daily.

**What actually drove writes, in order:**
0. **Deploys.** Each one cold-starts the whole ISR tree (above). Five in 24h
   cost more than the previous five days combined.
1. **Crawlable surface.** Entity pages ARE the sitemap (20,960 of ~21,110 URLs)
   and each crawler visit to a lapsed page is a paid regeneration. Cut 35% by
   raising `MIN_TOTAL_FOR_PAGE` 3 -> 5 (16,309 -> 9,646 employers). **REVERSED
   2026-09-10: the floor is 1 and the surface is 78,600 URLs** - builds were
   the bill, not crawls; see "Every entity page is indexable now". This
   paragraph is kept as the record of what was believed and why. Nothing
   404s: sub-floor pages still render, they go `noindex` and leave the sitemap.
2. **Windows shorter than the data.** `/perm-queue`, `/perm-queue/[month]`
   (~39 pages) and `/perm-decision-activity` sat on `revalidate = 3600` while
   their own comments said the data "moves daily" and "quarterly" - ~984
   regenerations/day expressing at most one change. Now 21600 (6h).
3. **Page size**, which is where the next section went wrong.

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

## Turso bills rows READ, and two queries read 143k rows per entity page (2026-09-02)

The Aug 28-31 invoice charged **7.75 billion rows read** ($7 over the plan's
1B), and by the afternoon of Sep 2 the new cycle had already read **11.58
billion** against a 2.5B allowance. Writes were nowhere near the cap. Turso's
own dashboard (`app.turso.tech`, sidebar "Usage") is where to read this; the
CLI is not installed here and the platform API needs a token we do not hold.

**EXPLAIN QUERY PLAN over the read layer found the cost.** Every employer,
firm and occupation page render ran:

| query | plan before | rows per render |
|---|---|---|
| `nameVariants`: `merge_key = ? OR merge_key LIKE ?` | walks the whole kind (`idx_pe_kind_total (kind=?)`) | 71,512 |
| `fieldDistribution`: `(IFNULL(certified,0)+IFNULL(denied,0)) >= ?` | walks the whole kind | 71,512 |
| `count(*) FROM perm_entities WHERE kind = ?` | covering index, every entry | 71,512 |

~213k rows per render, times the tens of thousands of regenerations a cold
ISR cache produces after each deploy, is the invoice. Fixes, each verified by a
fresh EXPLAIN (an EXPLAIN in the same pipeline as its CREATE INDEX reports
the OLD plan):

- **A range beats OR + LIKE.** `merge_key >= root AND merge_key < root || '!'`
  captures exactly `root` and `root <suffix>` (space, 0x20, is the last
  character below `!`, 0x21) and is served by the existing `(kind,
  merge_key)` index.
- **An expression index serves a filter on an expression**, if the SQL text
  matches the index expression exactly: `CREATE INDEX idx_pe_kind_decided ON
  perm_entities (kind, (IFNULL(certified, 0) + IFNULL(denied, 0)))` turned the
  cohort read into `SEARCH ... (kind=? AND <expr>>?)`, 9,176 rows. Created
  live; it took effect for the deployed code immediately because the text
  already matched.
- **Ranks are dense 1..N per kind** (measured `MAX(rank) = COUNT(*)`), so the
  kind's size is one read from the top of `idx_pe_kind_rank`, not a count.
- `perm_cases` had **no index on `received_date`**; `idx_pc_received
  (received_date, days)` covers the cohort-duration fallback.

**How to audit this again:** pull every SQL literal out of `src/lib/turso`,
bind `?` to placeholders, `EXPLAIN QUERY PLAN` each against production with
the local token, and read for `SCAN`. Crude extraction mis-parses concatenated
strings (they show as `WHERE x`); those need a manual EXPLAIN. Also: LIKE with
a prefix does NOT use an index on a BINARY-collated column (LIKE is
case-insensitive by default), which is why the FLAG prober's `LIKE
'G-100-26238-%'` reads were rewritten as primary-key ranges too.

**robots.txt now disallows `/perm-case-status?`.** Every case number on the
site links to a lookup URL; each is a dynamic render that can ask DOL live,
and a crawler walking thousands of them is pure cost. The bare page stays
indexable.

**Turso offers a one-time "Vegas Blackout"** on the Databases page: erase one
day of usage, no questions asked. Use it on the worst day of a runaway cycle.

## Every FLAG program shares one endpoint and one serial counter (2026-09-02)

DOL's batch case-status endpoint serves every foreign-labor program with the
same record shape: PERM (`G-100-`), prevailing wage requests (`P-100-`) and
H-1B LCAs (`I-200-`, `I-203-`; `I-201-`/`I-202-` returned nothing in sampled
windows). FLAG's own page lists all three. And **every program draws from ONE
serial counter**: on day code 26239 (2026-08-27), serials 199900-199949 held
PERM cases already in our corpus, 14 H-1B LCAs, 2 `I-203` LCAs and a run of
PWDs. So the serial range the PERM corpus knows for a filing day IS the range
to probe for that day's other programs. Roughly a third of the counter is
LCAs, a quarter PWDs, a tenth PERMs; it advances ~3,000 a day.

**Two probes said no and were misleading.** DOL's 2019 example number from
the form documentation and an invented 2026 number both returned `[]`. The
endpoint is not fuzzy across prefixes and 2019 cases are not indexed. Probing
serials known to be live on the same day settled it in one request.

`scripts/ingest_pwd_status_direct.py` is the multi-program prober: it walks
each day's serials once, tries prefixes in measured hit-rate order
(`I-200-`, `P-100-`, `I-203-`, then the rare two) and drops a serial the
moment a prefix claims it, ~180 requests per filing day. Writes are batched
(one round trip per row made 1,457 rows take twelve minutes). Separate tables
per program (`pwd_case_status`, `lca_case_status`, plus events), because the
PERM tables feed the census, stage pages, RFI funnel and alert sweep, all
written against a PERM vocabulary. **Ten P-/I- rows had already leaked into
`perm_case_status` through the web lookup's discovery path** before
`discoverCase` refused non-PERM prefixes; they were deleted 2026-09-02.

Read side: `src/lib/turso/flagCases.ts` is one factory (lookup with
discovery, employer search with title/month filters, browse, summary doc);
`pwdCases.ts` and `lcaCases.ts` are its instances, `flagCasesApi.ts` the
shared route handler. Final-status sets are pinned against the Python
`PROGRAMS` dict by `pwdCases.test.ts` / `lcaCases.test.ts` via a shared
helper that is NOT a test file: importing one test module from another drags
its `vi.mock` registrations along and the second file's mocks silently lose.

`/perm-case-status` accepts all three prefixes (P- and I- checked FIRST,
because the PERM shape rule accepts any letter). The wage-request panel
composes `estimatePwdQueue` from the same DOL snapshot the calculator uses.
Pages: `/pwd-cases`, `/lca-cases`. Workflow: `pwd-status-direct.yml` (daily
pending + discovery, weekly full, dispatchable backfill, resumable via
`perm_docs['flag_backfill_progress']`).

## Slug "shadowing" between live and published: measured, and not a thing

A live-only employer whose slug collides with a published one is unreachable,
and its cases would be listed under the published employer's name. Measured
2026-08-30 over 37,813 live slugs: **zero genuine collisions**. 5,083 slugs
carry several spellings and every sampled one is a single company
(`DISH NETWORK LLC` / `DISH NETWORK L.L.C.`, `Cuboid, LLC` / `CUBOID, LLC`),
which is the merge working. A first pass reported 263 "true collisions" and
**all 263 were the normaliser I wrote to find them** - the tenth time a new
gate's first run was mostly the gate.

The one real defect underneath it: `modalNames` counted the vote on the STORED
string, and HTML collapses whitespace, so `LMR LLC\t` and `LMR LLC` are the
same pixels. 24 live-only pages told the reader the employer "also filed as" a
name that renders identically to the heading above it. The vote is pooled on
the rendered form now; case and punctuation still count as real spellings,
because a reader can see those and disclosing them is the feature.

## Status cohorts: one stage is not like the others (2026-08-30)

`/perm-rfi-audit/[stage]` lists the cases at a review stage. Measured pending,
DOL's fixture excluded: ANALYST REVIEW **93,219**, then RECONSIDERATION APPEALS
2,335, APPLICATION ON HOLD 1,855, RFI ISSUED 974, BALCA APPEALS 351, NORD
ISSUED 108, and four stages holding 2 to 9. That is one stage and then
everything else, so `stageListing()` has two floors rather than one rule:

- **too-large** (> 20,000): not listed. ANALYST REVIEW is the ordinary queue
  and `/perm-queue` already draws it month by month against DOL's published
  position. The route list comes from `reviewStages()`, which excludes the
  queue group, so it has no page at all.
- **too-small** (< `SMALL_STAGE_MAX`): rows withheld. `getSmallStageRecords`
  already prints these WITHOUT case numbers on purpose; a second, more
  identifying copy of four people's applications is not more browsable.
- in between: listed, oldest filing first, capped at 250 with the remainder
  stated in words.

**No pagination, deliberately.** Reading `searchParams` would make all five
dynamic. The list answers "how long have these waited"; "is mine one of them"
is already answered better by `/perm-case-status`, which asks DOL live.

Two invariants: the count comes from `getReviewStages()` on both the hub and
the leaf (two totals for one cohort on two linked pages would discredit both),
and the employer slug is **JOINED from `perm_live_recent`, never slugified from
the name** - a derived slug 404s on exactly the employers DOL spells several
ways. `/perm-employers?q=` is an API route, not a page param: linking to it
returns 200 and silently drops the query.

## Vercel binds env at DEPLOY time, so a new secret needs a rebuild (2026-08-30)

`vercel env add REVALIDATE_SECRET production` succeeded and `vercel env ls`
showed it, and the endpoint still answered **403 to the correct secret** -
because the running deployment was built before the variable existed.
`process.env.X` in a route handler resolves against the environment bound at
build. A `vercel redeploy <url>` fixed it in one step.

**Read what the endpoint WROTE, not that it returned something.** The 403 was
indistinguishable from a wrong secret, and shipping on the assumption that
"env var set + route deployed = wired" is exactly the failure this repo keeps
meeting. After the redeploy the live dispatch returned
`{"revalidated":1,"skipped":2}` for a payload of one good slug, `../..` and
`BAD` - which proves the guard and the action in one call.

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

## The Turso retry excluded the failure it was written for (2026-08-31)

`withDeadline` in `src/lib/turso/client.ts` guarded itself with
`!String(e).includes("turso query deadline")`, so it retried **only the deadline
it raises itself**. Production threw `SocketError: other side closed` inside
`TypeError: fetch failed` on a `perm-employers/[slug]` server component - a
dropped keep-alive connection, the most retryable error there is, and the exact
case the helper's own comment says it exists for.

- **The reason is in `e.cause`.** `String(err)` on undici's wrapper is exactly
  `"TypeError: fetch failed"`, so a message-only predicate can never see
  `other side closed`, `ECONNRESET` or a DNS failure. The chain is walked now.
- **READS ONLY.** `exec()` shares the helper and writes; "other side closed"
  does not say whether the server processed the statement, so a retried INSERT
  could double-apply. `retryTransient` is a parameter for that reason.
- `clientRetry.test.ts` builds a real `cause` chain in every fixture - a test
  putting the reason in the message would pass against the broken version. It
  lives in `unit-isolated` because it mocks `@libsql/client` and calls
  `vi.resetModules()`.

## Where to look when something is broken in production

| surface | access |
|---|---|
| **PostHog** | MCP, connected — project 322551. **Exception autocapture is OFF**, so its error counts are a floor, not coverage |
| **Sentry** | **No MCP exists.** Read the alert emails; the Gmail OAuth token under `~/emails/gmail-cleanup/` works |
| **Convex** | `mcp__convex__logs` with `status: "failure"`, and `mcp__convex__insights` |

**Check Sentry's `environment` tag first.** The DEV environment reports to the
same production project, so an alert with `server_name = Adams-MacBook` and a
`127.0.0.1` URL is a local blip rather than an incident.

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

## The auth pages, and the research behind them (2026-08-31)

`/signup` is a full-bleed, full-height **60/40 split** (pitch left, form right).
`/login` is a **bare centred card**. Both lost the hand-drawn SVG diagram they
carried and show a real product screenshot instead.

**The split is Adam's call, made twice, the second time after I argued against
it.** Keep the objection in view: `login-02` and `signup-02` in the shadcn block
library are verbatim *"A two column login page with a cover image"*, and of
seven auth pages readable live on 2026-08-31 - Vercel login **and** signup,
Resend, Cal.com, GitHub, Supabase, Railway - **none used a split screen**. Full
research, with sources and what could not be verified:
`~/.claude/explanations/20260831_auth_page_research/AUTH-PAGE-PATTERNS.md`.

**What keeps it from being the template is the left half's content**: the live
federal queue from the same `getProcessingTimes()` snapshot `/tools` uses,
dated. That is Railway's "All systems operational" idea. A fabricated
testimonial beside a form is the loudest documented template tell, so nothing
here is invented and the screenshot captions say "demo account".

Rules that came out of building it:
- **`revalidate = 86400`, not `force-static`** - the page prints a live figure.
- **A figure DOL did not publish is dropped, never rendered as a dash.**
- **The panel is dark in BOTH themes.** `bg-foreground text-background` is this
  site's inverted band (95 uses) and it flips to near-white in dark - right for
  a stat card, a white slab across 60% of a viewport. Light gets the ink, dark
  gets `--card`, and muted tones inside use **opacity on currentColor** because
  every `--background`-derived token inverts too.
- **`flex-col-reverse` below `lg`** puts the form first on a phone while source
  order stays pitch-then-form for the grid. No `order` utilities, one image.
- **`minmax(23rem, 2fr)`** on the form column: a fixed fraction of a 1024px
  screen falls under the card's own width.
- **`/login` kept its card**, which also matches the verified asymmetry: Vercel's
  `/login` carries no marketing and even inverts the method order.

**Form correctness, each against a primary source:**
- Sign-in's identifier is `autocomplete="username"`, not `email`. MDN pairs
  `username` with `current-password`; `email` + `new-password` is the sign-up
  pair.
- The verification field is **ONE input** with `autocomplete="one-time-code"`
  and `type="text"` (numeric strips leading zeros). **WCAG 2.2 SC 3.3.8 fails
  any authentication step forcing manual transcription**, so the six-box OTP
  component is an AA failure unless it distributes a paste.
- WCAG 2.2 SC 3.3.7 means step two shows the email rather than asking again.
- **Open, flagged not done:** web.dev says drop "confirm password" outright. It
  is contained to `SignupPageClient` and `ResetPasswordPageClient`.

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

## A shared count with two different dates is the same bug as two counts

## A shared count with two different dates is the same bug as two counts

The stage pages read `getReviewStages` on the hub AND the leaf specifically so
one cohort cannot show two totals. It shipped showing one total with two
DATES: 965 cases "as of August 30" on the hub, the same 965 "as of August 27"
on the leaf, because the hub took the latest `seenTo` across all stages and
the leaf took its own. **A figure and its stamp are one claim.** Both read the
per-stage value now. The global maximum survives only as the fallback for a
stage holding nothing, which has no observation of its own.


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

## A disclosure load starves the site's reads, measured (2026-09-02)

While `ingest_flag_disclosure.py` wrote a 147k-row file, an ordinary
`GROUP BY state` over `perm_cases` (a different table) was sampled every ten
seconds and went from **~0.3s to a worst of 59.2s**. In the same window a
production build's prerender blew its **90-second** query deadline twice on
`/tools/salary-explorer` and only survived on the third attempt of three.

**The load is a background chore and the site is not**, so the writer yields:
`WRITE_PAUSE_S = 0.35` between write requests (2,000 rows each), which adds
about 26 seconds per 147k rows. `--pause 0` disables it. Probed by timing
`write_cases` against a fake driver at pause 0 and 0.2.

Two things this explains that looked like other bugs. A build failing on a
query that is normally instant is not a slow query, it is a busy primary; and
"Turso is degraded" is worth checking against **our own** writers before their
status page.

## History loads one fiscal year at a time (`--fy`)

`ingest_flag_disclosure.py --program pw --fy 2025` takes that fiscal year's
newest file rather than the newest overall (a completed year's Q4 file covers
the whole year). Three rules make it safe to run beside the quarterly load:

- **It never stamps freshness.** That row describes the newest quarter and
  stays with it; a 2024 file is history, not fresh data.
- **Load records are keyed per FILE** (`flag_disclosure_pw:<name>`), with the
  old per-program key read as a fallback, so a year load cannot masquerade as
  the latest quarter and cause a needless reload of it.
- **Every load or skip writes `perm_docs['flag_disclosure_summary_<program>']`**
  (rows, date span, files), so the web never counts the table on a render.

Loaded so far: FY2026 Q3 and FY2025 for `pw` (396,781 rows, received from
2021-10-18, decided through 2026-06-30).

## The two halves of a FLAG program, and why both are read

DOL exposes each program twice and neither half is sufficient:

| | live endpoint (`flag.dol.gov`) | quarterly disclosure file |
|---|---|---|
| covers | anything DOL indexes, pending included | decided only, to the last quarter |
| freshness | today | up to three months behind |
| **the wage** | **never** | yes, with SOC and worksite |

So `/pwd-cases`, `/lca-cases`, the P- and I- lookups and the employer band all
read both and merge one row per case (`src/lib/flagMerge.ts`): the live row
wins for status, the file supplies the wage. A case only the file holds is
listed after, labelled as the file. Both halves use the SAME `slugRange`, so
one needle cannot answer differently on the two sides.

**`flagMerge.ts` is a plain module, not an export from the browser component**,
because the employer page is a server component and a function exported from a
`"use client"` file is a client reference on the server, not a function.

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

## The stage pages: a 19.56s query that only Google saw (2026-08-31)

`getReviewStages()` is a CTE over ~98,000 pending rows with three window
functions, `COUNT(DISTINCT employer_name)` and three joins. Measured against
production: **19.56s cold, 2.49s warm**, against the read layer's 20s deadline.
Blew it, retried, blew it again, threw - so all ten stage pages 500'd on a cold
render while returning 200 to anyone whose region had it cached.

Google's Inspection Tool refused to index two of them. Sentry named it
verbatim: `turso query deadline (20000ms, attempt 2): WITH pend AS (`.

**Two of my own diagnoses were wrong first.** I timed `listStageCases`
(0.27-0.82s) and concluded "not a timeout" - wrong query. Then I blamed a
concurrent audit script for competing on cold renders - also wrong; it
reproduced with the site idle. Only the Sentry trace plus a direct timing
settled it. **Time the query in the stack trace, not the one you assume.**

Now precomputed into `perm_docs['review_stages']` by
`ingest_case_status_direct.py`, read by `src/lib/turso/rfi.ts`, same shape as
`live_census`:

- **Raw numbers in the doc.** The editorial guards (`MIN_BAND_N`, `n >=
  cases/2`) stay in TypeScript where they are already probed, and are called
  with the doc's fields under the SQL row's names, so the published page cannot
  diverge from the fallback.
- **It must reconcile or it is not written.** `sum(stage.cases)` must equal a
  separately-counted pending total. **That guard fired on its second real run**
  against a concurrent sweep (98,210 vs 98,009) and left the previous good doc
  live.
- **Its own `data_freshness` row at 3 days**, shorter than the reader's 8-day
  cutoff on purpose: the reconciliation guard can skip the write while the
  sweep still stamps itself green, so without a row of its own a doc that
  quietly stopped being written would age out in silence.
- **The live query is kept as the fallback.** A missing doc degrades to a slow
  page, never a blank one.

## Vercel: builds are the bill, not traffic (2026-08-31)

$20.05 of a $20 credit, and the breakdown is not where anyone assumes:

| line | cost | share |
|---|---|---|
| **Build CPU Minutes** | **$13.20** | **66%** |
| Observability Events | $2.49 | 12% |
| ISR Writes | $2.29 | 11% |
| Speed Insights Plus | $0.65 | 3% |
| **Function Invocations** | **$0.12** | 0.6% |

**Crawler traffic across 21,110 sitemap URLs costs 12 cents.** Deploys cost
~$0.60 each. Read the real numbers with `npx vercel usage`, and the per-build
breakdown with `npx vercel inspect <deployment-url> --logs`.

What was wrong, all found in one build log:

- **`VERCEL_FORCE_NO_BUILD_CACHE` was set** (228 days old). Worst of both
  worlds: recompile from scratch every time AND still spend 1m12s building and
  uploading a 617 MB cache nobody restores. Deleted.
- **Build machine was Elastic**, which Vercel auto-scales to **Turbo (30
  cores)** "based on recent build usage" - the more you deploy, the bigger the
  machine, the faster the burn. Billed in CPU-minutes, so 30 cores x 6 min =
  ~180. Pinned to **Standard (4 vCPU)**. If a build nears the 45-minute
  ceiling, Enhanced is the next step.
- **Every push built everything**, including script- and docs-only pushes.
  `vercel.json` `ignoreCommand` now skips a build when nothing outside
  `scripts/`, `.github/`, `.planning/`, `docs/`, `*.md` and tests changed.
  **Probe it in BOTH directions** before trusting it: one `src/` file must
  force a build, and `content/`, `convex/` and `public/` must never be skipped.
  A wrongly-skipped build is a change that silently never ships.
- **`PRERENDERED_ENTITY_HEAD = 25`** (was 100 x 3). Entity details were 303 of
  483 prerendered pages; `dynamicParams` is true, so every slug still resolves.
  483 -> 259 pages, static generation 104s -> 75s locally.

**Speed Insights and Observability were NOT cut, reversing an earlier
recommendation of mine.** Speed Insights carries real RUM (211 samples on `/`
scoring 80) and PageSpeed's "No Data" is CrUX, a different and much larger
sample - so it is the only real-user measurement this site has. $1.81 of a $14
bill against $13.20 of builds: the lever is deploy count, not add-ons.

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

## Discovery is one serial walk, and it carries its day code (2026-09-06)

The nightly PERM prober had recorded nothing since **Sun Aug 30, 9:46 AM ET**
and every run said "ok". It anchored day codes to TODAY and serials to its
last hit, and abandoned a day after two empty 50-number batches. On Aug 30 it
walked into the Aug 28 overnight lull (serials 200,247 to 200,394 are all LCA
and PWD), met two empties, and stopped; because the frontier only moved on a
hit, every night after asked the same 100 serials, and from Sep 2 the 5-day
window no longer contained the frontier's own day code. Seven runs printed
"10 requests, 0 new cases recorded" and stamped freshness. ~2,500 PERM
filings were missing before a human noticed. The PWD/LCA prober seeded its
windows from PERM's recent rows, so it printed "discover: 0 requests" too.

**Three measured facts about DOL's counter drive the design** (all in
`scripts/lib_flag_serials.py`, pinned by `test_flag_serials.py`):

- **One counter across every program.** A serial exists under exactly one
  prefix, and DOL returns NOTHING for `G-100-26240-200300` when that serial is
  an `I-200` (probed Sep 6). Existence is never implied; it is asked.
- **Six digits, zero-padded.** `P-100-26161-003499`. The PWD backfill
  formatted serials bare and asked for numbers DOL never issued, which is why
  the post-wrap half of June 2026 could not be found by construction.
- **It wraps at 1,000,000.** 999,997 on Jun 10 2026, then 000001. A day's
  MIN/MAX read as (1, 999,997); the backfill walked from serial 1, burned its
  4,500-request cap, and sat on day 26161 from Sep 3.

`run_discovery` in `ingest_case_status_direct.py` is now a serial-major walk:
the cursor is a `(day_code, serial)` pair in `perm_docs['discovery_frontier']`,
advanced only by confirmed hits; each 10-serial span is asked for **all five
busy prefixes at once** (G-100, G-200, I-200, P-100, I-203: ~70% of the
counter) under the cursor's day code and then under each later code up to
today; PERM hits are inserted here and P-/I- hits handed to the PWD module's
`insert_hits`, so those tables' frontiers move WITH PERM's. G-200 is 22 to 30%
of PERM filings and the old prober never asked for it. Two consecutive spans
that no prefix claims are the edge. ~215 requests a night at steady state.
Recovery: dispatch `case-status-direct.yml` with `mode=discover`,
`discover_cap`, and `frontier=YYDDD:SERIAL`; the run records "partial" on
its cap and resumes from the doc.

The PWD prober's `day_windows` splits a day at any serial gap over 50,000,
clamps every window to 20,000 with a `::warning::`, and pads candidates. Its
daily in-pass discovery is gone (delegated to the walk); `--discover` and
`--backfill` keep the day-window probe.

## The health check measures progress now, not activity

Every line in `check_ingest_health.py` used to answer "did the job run" and
"did it exit 0", the two questions a deadlock passes. `lca-status` read
"2026-09-06 ok" with the note "0 checked, 0 moved" over a table whose newest
filing was Aug 27. Three changes, each pinned by `test_ingest_health.py`:

- **Runs are keyed by filename AND mode.** Filename-only let Monday's clean
  `--pending` row erase Sunday's failed `--full` row before the 6 AM cron
  looked; the weekly job could fail every week and never be reported. The
  workflow failure hooks record the mode (`--script "x.py --$MODE"`).
- **`check_frontier`** judges the walk's own cursor (5 days; measured normal
  lag 0 to 2, a Friday filing after a Monday holiday is 4). Not
  `MAX(filing_date)`: a visitor looking up a fresh case inserts a fresh row
  and keeps that number green with the prober dead.
- **`check_discovery_yield`** fails when the last four walks inserted nothing.
  Every walk now records its own `ingest_runs` row, including the nightly one.

Also: a pass that checked 0 cases stamps no freshness (the LCA daily pass is
0 every day; its weekly window pass stamps it with an 8-day budget);
`record_ingest_failure.py` reads its row back and catches `SystemExit`,
which is what a missing credential raises.

## The Sunday PWD/LCA sweep is a rolling window, and never writes a no-op

The weekly full pass walked all 405,566 rows and needed ~230 minutes against
a 170-minute timeout, so it died at 65% every Sunday and, walking in
case-number order, never reached the same newest ~100k LCA rows. It re-checks
filings from the last 180 days (PWD) and 90 days (LCA) now, on the
`(filing_date, case_number)` index. The `else` branch that stamped
`last_checked_at` on every unchanged row (~300,000 UPDATEs a Sunday for 54
transitions, each maintaining every index) is gone; the site reads the
sweep's own record instead. Four duplicate indexes on `pwd_case_status` and
one on `pwd_case_events` (an older naming scheme, created by nothing) were
dropped.

## Meta's crawler was 65% of all traffic, and pages were never the lever

The Firewall Traffic tab on Sep 6: **Facebook, Inc. (AS32934), 553,800 of
~852,000 requests in 24 hours**, one JA4 fingerprint, dozens of rotating
`57.141.18.x` addresses, and only 72.6k of them honest
(`meta-externalagent/1.1`); the rest wore browser user agents and ignored
`robots.txt`. It spent the 2,000/day DOL lookup budget by 5 AM daily.
Entity pages were **2.6%** of requests. Three rules, dashboard only:

1. Deny AS 32934 on `/perm-case-status?case=` (link-preview agents exempt).
2. Rate-limit AS 32934 **keyed on JA4** to 30/min, 429 (Meta AI may still
   index the data pages; Adam's audience lives on WhatsApp and Facebook).
3. Rate-limit `/api/*` to 60/min per IP, 429.

Function-log rate fell from ~17 req/s to ~0.35 req/s within two hours. The
managed "Bot Protection" and "AI Bots" toggles stay in **Log**: enforcing
them would challenge the nightly `/api/revalidate-*` POSTs and the AI
crawlers this site wants. **Vercel Hobby is unreachable regardless of pages:**
its 1M edge-requests/month cap counts cached hits and pauses the project when
exceeded; humans alone are ~2M. The floor is Pro at ~$20 flat once the
crawler and the proxy are fixed. Vercel Support confirmed non-commercial use.

## Corrections to earlier claims in this file, measured 2026-09-06

- "A quarterly file only carries its own quarter's determinations" is wrong
  for PW and LCA: the Qn file is **cumulative for the fiscal year**
  (FY2026_Q3 holds 147,226 PW rows against 249,486 for all of FY2025).
- `/signup` was fully dynamic despite `revalidate = 86400`: the (auth)
  layout's cookie read wins. It now carries `force-static` beside the daily
  window, the shape `/login` already had.
- Sentry Session Replay was removed Aug 29; the privacy policy said otherwise
  until Sep 6, and omitted Ahrefs Web Analytics and the Senja widget.
- "Ten leaked P-/I- rows deleted 2026-09-02": two `P-100-` rows survived
  (written between the guard commit and its deployment) and were counted as a
  2-case PERM review stage; deleted Sep 6. `G-200`, `G-300` and `G-400` are
  real PERM office codes, not leaks.
- The disclosure workflow wrote ~455,000 documents into Convex tables nothing
  reads (`permCases`, `permEntities`, `permWageStats`); that is what tripped
  the Convex plan on Aug 25. The steps are gone and the tables are empty.
  `uscisI140:storeStats` stays: two tool pages read `api.uscisI140.getLatest`.
- `AGE_DAYS` (stage medians) is now filing date to TODAY on both sides. It
  was filing date to `last_checked_at`, a column the sweep never wrote (the
  mirror's July stamp, or NULL for 12,187 rows).
- The case page's "Status seen" date now comes from
  `perm_docs['sweep_coverage']` (the sweep's own finish date) via
  `src/lib/turso/sweepCoverage.ts`; it used to quote the mirror's stamp and
  told pending beneficiaries their case "has not been looked at since" July.
- The test fixture in `test_flag_disclosure.py` lacked the two attorney
  columns the parser has emitted since Sep 4, so CI was red from **Thu Sep 3,
  10:44 PM ET** and vitest had not run in CI for 25 pushes. Green again on
  `22b42a8b`.

## The four exposures closed on Sep 7 2026, and what each one costs to keep

Adam asked whether "the same things can't happen again, or the same class, or
even not like it". The honest list of what was still exposed after the Sep 6
work, and the fix for each:

**A parser that emits plausible wrong values.** Both loaders resolve columns
by header name and refused only when a REQUIRED column was missing; a column
DOL renamed logged "(no column for ['wage']; those land as NULL)" and the run
reported success. `scripts/lib_load_guard.py` now fingerprints every load
(which columns resolved, blank share per column, median wage per unit,
rows with impossible values) and the loaders compare it with the previous
load of the same program BEFORE writing: a lost column, a blank share up 25
points, a median moved by half, or over 1% impossible rows refuses the file
with nothing written. Thresholds are MEASURED margins: over 634,638 PW and
437,496 LCA rows the worst impossible-value share is 0.06% and blank shares
are stable to under a point between quarters. `ingest_flag_disclosure.py`
does one extra parse pass (about a minute) and stores the fingerprint in
the load record; the PERM parser puts its fingerprint (resolved columns
keyed per FISCAL YEAR, because a quarter's filename changes every quarter)
into `perm-cases.ndjson.gz.meta.json` and `turso_migrate.py` judges it
against `perm_docs['perm_cases_fingerprint']`, recorded only after VERIFY.
`--accept-drift` overrides the drift half for a human who read the log;
nothing overrides impossible values. The first guarded load of each program
has no baseline and records one. `test_load_guard.py` probes every branch.

**A backfill that stops chaining.** A leg that died before moving the
frontier printed "no progress; not chaining" (by design) and nothing ever
restarted it. The progress record now carries `from`, `to`, `complete` and
`lastDayDoneAt` (moved only when the frontier moves); the scheduled daily
PWD run asks `--resume-check` and dispatches ONE leg when an incomplete
backfill has been quiet 20 hours. One a day, so an outage cannot loop it.
`check_backfill` in the health check fails at 7 days without movement.

**Slug suffixes that shifted each quarter.** `turso_migrate_public.py`
dropped the entity table and reassigned `-2`/`-3` by volume order, so two
spellings of one firm swapped URLs when the busier one changed.
`plan_sticky_slugs` reads the live slugs first: an entity keeps its slug,
newcomers get the first free suffix, every prior slug stays reserved, and
each slug nobody kept gets an alias row to the busiest holder of its merge
key or the run REFUSES (`--allow-vanished` to proceed). Occupations are
keyed by SOC code as well as title: 54 titles sit under two codes each, and
keyed by title alone the pair swapped every rebuild. Live control over the
real table: reversed volume order keeps 78,600 of 78,600 slugs.

**A crawler on paths the four rules do not cover, with no alert.** Vercel's
only firewall alert fires at 100,000 requests per 10 minutes, ten times the
Meta crawler's rate. Two things: Bot Protection moved from Log to
CHALLENGE (verified bots, Googlebot to PerplexityBot to facebookexternalhit,
are excluded by IP range and reverse DNS, never by user agent; the bypass
rules cover what the directory lacks: WhatsApp, Slack, Discord, Telegram
previews, `/feed.xml`, `/llms.txt`, the revalidate POSTs by secret header,
and the site's own audit scripts by `x-permtracker-audit`), plus rule 5, 300
requests a minute per IP on page paths. And `check_lookup_demand` in the
health check fails when a day's live DOL lookups exceed five times the
30-day median with a floor of 500, the number that crawler moved first.

Also fixed on the way: a failure row recorded under the bare filename (the
pre-Sep-6 hook shape) could never be superseded because every later run is
mode-keyed; a later clean run of the same script now clears it.

## The Firewall as of Sep 7 2026: Challenge mode, nine rules, and the order that makes them safe

Bot Protection is in **Challenge** (was Log). Vercel evaluates only requests that
are neither a verified bot nor a real browser, and verification is by IP range,
reverse DNS or Web Bot Auth, never by user agent. Its own log for the day before
the flip: 25.4k requests it would have challenged, every one a browser user
agent (one literally HeadlessChrome) from Tencent, Azure, AWS, Datacamp and
Google Cloud addresses. Verified crawlers never reach that evaluation, and the
directory covers Googlebot, Google-InspectionTool, Bingbot, Applebot, GPTBot,
OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot, PerplexityBot,
Meta's three crawlers, facebookexternalhit, Twitterbot, LinkedInBot, Chrome
Lighthouse, Ahrefs and Semrush. **A challenge answers HTTP 429**, not 403.

Custom rules run top to bottom, before the managed ruleset, and **a Bypass
skips every rule after it, managed ones included**, so order is the design:

| # | rule | why it sits here |
|---|---|---|
| 1 | Deny AS 32934 on `/perm-case-status?case=` (previews exempt) | Meta's crawler |
| 2 | AS 32934, 30/min keyed on JA4, 429 | Meta AI may still index, not 40x a day |
| 3 | `/api/*`, 60/min per IP, 429 | backstop |
| 4 | `/perm-case-status?case=`, 20/min per IP, 429 | the expensive path, any network |
| 5 | Bypass when `x-permtracker-audit` exists | the site's own audit scripts skip Bot Protection AND rule 6, because `audit_all_pages.py` walks 61 URLs faster than 300 a minute |
| 6 | 300/min per IP on paths not under `/_next/`, 429 | a runaway script that passes the challenge |
| 7 | Bypass user agents WhatsApp, facebookexternalhit, Slackbot, Discordbot, TelegramBot, SkypeUriPreview | link previews the directory does not verify; iMessage claims facebookexternalhit from Apple addresses, so it is unverified too |
| 8 | Bypass `/feed.xml`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, `/sitemaps/*` | cheap static files read by unverified tools |
| 9 | Bypass `/api/revalidate-*` when `x-revalidate-secret` exists | the nightly POSTs from GitHub Actions |
| 10 | Bypass `/api/cron/*` when the user agent contains `vercel-cron` | Vercel's own cron invocations of the dispatcher. **A condition on the `authorization` header never matched** (measured 9:08 AM Sep 7: the secret-bearing request was still challenged), while the same request with Vercel's documented `vercel-cron/1.0` user agent passed. Spoofable, and harmless: the route itself demands `CRON_SECRET` |

AI Bots stays on **Log**. `scripts/probe_firewall.sh` proves all of it from
the laptop in one run and is the thing to re-run after any change.

**What Challenge mode deliberately costs:** a script calling `/api/*` without
the audit header is challenged (Vercel: "Direct API calls from scripts, cURL
or Postman will fail"). The site's own pages call those routes from a browser
that already holds a challenge session, so nothing on the site breaks; the
change is that third parties cannot script the JSON routes any more. A bypass
on those paths would re-open the exact vector rule 4 closes, so it is not
added. `docs/API.md` documents Convex functions, not those routes, so no
published contract changed.

**Two traps in the rule editor.** The natural-language generator inverts
negative operators ("does not start with" came out as "Starts with"; last night
"does not contain" came out as "Contains"): read the generated condition and
fix the operator through its dropdown by reference. And the page drops any text
typed in the same automation batch as its own load; type in a later step.

## GitHub's scheduler runs this repo's crons hours late, every day (measured 2026-09-07)

Every "04:10 ET" and "06:00 ET" in this file is the DECLARED time. The
measured time is two to seven and a half hours later, on every one of the
last nine days:

| workflow | cron (UTC) | measured delay, Aug 29 to Sep 6 |
|---|---|---|
| processing-times-ingest | 07:00 | +239 to +452 min |
| case-status-direct, daily full | 08:10 | +219 to +277 min |
| case-status-direct, pending | 19:40 | +118 to +137 min |
| pwd-status-direct, daily | 09:40 | +140 to +190 min |
| ingest-health | 10:00 | +196 to +444 min |

So the "4:10 AM" sweep has been finishing around 9 to 10 AM ET, and the
health check reads it around 9:30 to 10:30 AM, and on Mon Sep 7 at 8:45 AM
nothing scheduled had fired at all yet. GitHub documents that `schedule`
"can be delayed during periods of high loads" and that delayed runs may be
dropped; it does not document delays of this size. The weekly CodeQL cron on
the same repo fired 3 minutes late the same morning, so it is per-workflow
queueing, not the repo being disabled (every workflow reads `active`).

Consequences: any freshness budget or "checked today" claim must allow for
a run landing in the afternoon; a dispatch by hand is the reliable way to get
a sweep at a chosen time; and the fix, if the delay matters, is to trigger
`workflow_dispatch` from a precise external clock (a Vercel cron job hitting
a small route that calls the GitHub API with a fine-grained token scoped to
`actions: write` on this repo) rather than trusting `schedule`.

## Vercel's clock dispatches the GitHub jobs (2026-09-07)

Because GitHub's `schedule` fired every cron here hours late (previous
section), the daily ingest jobs are now Vercel cron jobs. `vercel.json`
carries six entries pointing at `/api/cron/dispatch/<job>`; the route
(`src/app/api/cron/dispatch/[job]/route.ts`, table in `../jobs.ts`)
verifies the `Authorization: Bearer <CRON_SECRET>` header Vercel adds to
every cron invocation, refuses unknown jobs, skips a workflow that already
has a run inside 20 minutes (Vercel documents that cron delivery can
duplicate), and fires `workflow_dispatch` on `adamjali/perm` with the job's
inputs. Pro invokes within the minute; the test next to the route holds the
job table and `vercel.json` together so a job cannot exist in one and not
the other.

| job | workflow, inputs | UTC |
|---|---|---|
| `processing-times` | processing-times-ingest.yml | 07:00 daily |
| `case-status-full` | case-status-direct.yml, mode=full | 08:10 daily |
| `pwd-daily` | pwd-status-direct.yml, mode=pending | 09:40 daily |
| `ingest-health` | ingest-health.yml | 10:00 daily |
| `pwd-weekly-full` | pwd-status-direct.yml, mode=full | 10:40 Sundays |
| `case-status-pending` | case-status-direct.yml, mode=pending | 19:40 daily |

**Two secrets.** `CRON_SECRET` was generated here and added to the
production environment on Sep 7. `GITHUB_DISPATCH_TOKEN` is the fine-grained
personal access token `permtracker-cron-dispatch` (no expiry, repository
access limited to `adamjali/perm`, permission Actions: read and write,
Metadata read-only), created 9:24 AM Sep 7 with Adam approving GitHub's
sudo prompt on his phone. It reached Vercel by Cmd+C in the token page and
`pbpaste | vercel env add GITHUB_DISPATCH_TOKEN production --sensitive`,
so the value never passed through a transcript. If the token is ever
missing the route answers **500 "GITHUB_DISPATCH_TOKEN is not set"** and
nothing is dispatched. **Vercel binds env at deploy time**, and
`vercel redeploy` of a docs-only commit is SKIPPED by the ignore rule (a
9-second "Canceled" deployment), so binding a new variable needs a build
that carries a change under `src/`. The Firewall bypasses `/api/cron/*` for the
`vercel-cron/1.0` user agent every cron invocation carries (rule 10); a
rule keyed on the `authorization` header was tried first and never
matched, so the WAF evidently cannot see that header. Measured, not
assumed: with the secret and a curl user agent the route was challenged,
with the secret and `vercel-cron/1.0` it answered.

**Proven 9:40 AM Sep 7 and the `schedule:` blocks removed.** A dispatch
through the route answered 200 at 13:40:43 UTC, GitHub created run
34128732840 one second later and it finished green. The three data
workflows (case-status-direct, pwd-status-direct, processing-times-ingest)
no longer carry a `schedule:` at all, or the sweep would run twice a day:
once on time from Vercel, once hours later from GitHub, with the concurrency
group queueing the second rather than dropping it. `ingest-health` keeps its
GitHub schedule as a second, independent clock on purpose: if Vercel's cron
ever stops, the late GitHub run is what reports the silence. The route's
20-minute guard covers Vercel's own duplicate deliveries only.
The PWD daily pass carries its resumer step on the dispatched run too
(`inputs.mode == 'pending'`), not only on the `schedule` event.

Prove a dispatch with `npx vercel crons ls` and a manual invocation, then read
`gh run list --event workflow_dispatch`. A green Vercel cron log line is not a
run; the run is.

## The residential runner: www.uscis.gov from this Mac (2026-09-07)

`www.uscis.gov` serves residential addresses and 403s GitHub's datacenter
runners on some days (four refusals with backoff on Sep 7). Three fetches
depend on it: the I-485 inventory (monthly), the I-140 quarterly counts and
the I-140 trends (both best-effort in the Federal data ingest). Nothing else
on the site treats datacenter and residential addresses differently: DOL's
disclosure files are the opposite case (they 403 this laptop, not GitHub),
`flag.dol.gov` serves both, and `egov.uscis.gov` and `travel.state.gov`
challenge every script from any address, so only a browser clears them.

`scripts/residential_job.sh <i485|i140>` is the runner, driven by two launchd
agents (`scripts/launchd/*.plist`, installed by `scripts/launchd/install.sh`,
which fills the repo path and reloads them; safe to re-run). GitHub keeps
trying first; the Mac tries the day after:

| job | GitHub tries | this Mac tries (local time) |
|---|---|---|
| `i485` | 04:00 ET, 6th to 10th | 10:30, 6th to 10th |
| `i140` (counts, Convex store, trends) | 8th of Jan/Apr/Jul/Oct, 20th monthly | 10:45 on the 9th and 11th of those months, and the 21st monthly |

Three levels of retry: the scripts' own four attempts with backoff, five
calendar days a month from each side, and launchd running a job that fell
due while the Mac slept as soon as it wakes. Failures are recorded through
`record_ingest_failure.py` under the bare script name, so the health check
sees them and a later clean run from either side supersedes them; a whole
month lost trips the dataset's own freshness budget (45 days for I-485, 135
for the I-140 pair). Logs are one file per run in
`~/Library/Logs/permtracker/`, pruned at 60 days by the wrapper; a lock
directory keeps one run per job. The wrapper fast-forwards `main` first so
the laptop runs the same code as the runner, and names every path because
launchd hands a job almost no PATH (node lives under nvm here).

Proven Sep 7, 10:20 AM: both agents kicked through `launchctl kickstart`
finished rc=0, I-485 fetched four months from USCIS, the I-140 store was
correctly refused as unchanged, trends verified 66 rows, and the health
check read every run clean. Needs the Mac logged in and not shut down.

**The Mac wakes itself at 10:25 AM every day (set by Adam, Sep 7 2026,
10:37 AM ET):** `pmset -g sched` reads "wakepoweron at 10:25AM every day".
It covers the asleep case only: FileVault is on, so a powered-off Mac stops
at the disk-unlock screen, and a logged-out Mac has no session for the
agents to run in. Reverse it with `sudo pmset repeat cancel`; remove the
agents with `launchctl bootout gui/$(id -u)/app.permtracker.i485` (and
`.i140`) and delete the two plists from `~/Library/LaunchAgents`. GitHub's
own attempts and the health check's freshness budgets are unaffected by
either.

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
domain for us and for permtrack.app alike; keeping the name is Adam's call and
the fix is entity confidence, not markup. Registration order (RDAP): permupdate
Mar 2025, **permtracker.app Nov 25 2025**, permtrack.app Mar 22 2026,
perm-timeline Mar 26, immilane Apr 11, permqueue Apr 27 2026. Being first
carries no weight with Google; references, an About page and stability do.

## Social cards: one real picture per page, and the illustration that was there (2026-09-07)

Adam noticed Google Images showed permtrack.app as "actual screenshots" and us
as something random. Measured: every one of our ~13,758 URLs declared the same
`og:image`, `public/og-image-base.png`, an AI-drawn isometric laptop whose
screen read "Immigration Case Tracking Dashboard, Client J. Doe, I-140,
Biometrics, Interview, Approved" (USCIS steps, an invented client, the old
"Deadline Tracking" tagline). The homepage had one `<img>` (a decorative
background, no alt), every chart is inline SVG, and the only real screenshots
were inside the guides. permtrack.app has no images in its pages either; what
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

## The next visa bulletin, computed rather than predicted (2026-09-07)

`/visa-bulletin` answers the seasonal question ("what will October do, when
does it come out") from the archive instead of with a dated article. It reads
the 84-month bulletin series and USCIS's monthly I-485 inventory, both of which
the ingests keep current, and it changes state on its own: before a bulletin it
tabulates what every earlier bulletin for that calendar month did per category
and country (`sameMonthMoves` in `src/lib/bulletinNext.ts`, measured against
the month before, non-date transitions NAMED rather than numbered), beside the
inventory ahead of each cutoff (`computeI485Position` at the cutoff's own
month); the day a bulletin lands it leads with "what the {month} bulletin did"
and rolls forward. The only publication evidence the archive carries is the
Internet Archive's first-capture day (`archiveFloorDays`), printed as a floor.
It prints NO spillover figure: the number is not published on the day and
every number on the internet for it is a guess.

Two things this page must never do: forecast (the pace doc in
`src/lib/turso/bulletin.ts` explains why), and pair a move across a gap (a year
whose prior month is missing is skipped, or two moves read as one).

**The I-485 tool prints one "when" line now**, `monthsToReach`: the gap
between the final-action cutoff and the reader's date divided by the pace
measured over the archived window, with the window and its retrogression count
printed beside it, and withheld when the category is current, shut or did not
advance (EB-2 India in September 2026 is shut, and the line says so). **Its
trend chart splits USCIS's two pending statuses** (visa number available vs
awaiting one), which is the part USCIS owns against the part the bulletin owns.

**Family-based categories are NOT in the I-485 tool and cannot be**: USCIS
publishes the inventory by priority date and country for employment-based
categories only. A rival's "family-based" analyzer is not built on an inventory
that exists; the honest counterpart would be family-based CUTOFF history, which
needs the bulletin ingest to parse the family charts and the 84 months
re-fetched from the Archive. Not done; recorded so nobody builds counts that
have no source.

## The weekly digest is built OFF, and the flag is the only switch (2026-09-08)

`convex/newsletter.ts` composes a Tuesday issue from the record the ingests
already hold (DOL's queue, the newest bulletin's final-action moves against
the month before, the week's Federal Register documents) and stores it as a
`newsletterIssues` row with status `preview`. **Nothing is sent unless the
deployment carries `NEWSLETTER_ENABLED=1`.** With it set, `sendBatch` mails
confirmed subscribers under `NEWSLETTER_DAILY_CAP` (default 30) charged
BEFORE each send through the shared rate-limit table, and reschedules itself
24 hours later for the rest, guarded on having made progress.

- **Consent is the alert forms' second checkbox**, staged by
  `stageNewsletterFor` and confirmed by the SAME click that confirms the
  alert. The preference center (`/prefs`, kind `newsletter`) turns it off;
  nothing can turn it on but the owning flow. The confirmation emails name
  the digest when it was ticked (an optional prop, because links already in
  inboxes predate it).
- **The composition is pure** (`convex/lib/newsletterCompose.ts`, tested) and
  the HTML (`src/emails/BulletinWeekly.tsx`) renders from the same object, so
  the two parts cannot disagree. A section with nothing to say is left out.
- **The admin panel shows the latest issue's text** and the list's staged and
  confirmed counts (`summarizeNewsletter` in `convex/lib/newsletterSummary.ts`,
  a plain helper: `adminSignals` reading it through `ctx.runQuery(internal.…)`
  closed a type cycle through `_generated/api` that typed the whole query
  `any` and surfaced as implicit-any errors in unrelated tests).
- **Proven on the dev deployment 2026-09-07, 11:59 PM ET, flag off:** one
  issue built from real data ("DOL at November 2025, 5 cutoffs moved in the
  September 2026 bulletin"), status `preview`, zero sends, and an independent
  Python recount of the two bulletin blobs agreed exactly (5 advanced, 25
  held, 0 back, of 30).
- **Flipping it on is a Resend decision first.** The ledger in
  `convex/caseAlerts.ts` puts the worst day at exactly 100 with the cap at 30,
  which is the free tier's whole allowance.

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

## The full build of Sep 8 2026: what landed, and the five things it taught (2026-09-09)

Ledger: `.planning/full-build-2026-09-09.md`, every item ticked or marked left
off. Shipped in twelve commits after the parity build: five statutory
calculators, the status dictionary, six situation guides, the glossary, the
corrections log, the estimate scorecard, comparisons and a document checklist,
the first data note, badges, user-reported milestones, account-free push
alerts, the social-post and translation scaffolds, OFLC announcements and
California WARN notices in the record, the prevailing wage levels tool, and the
family-sponsored bulletin charts. Deploy was HELD throughout.

- **`flag.dol.gov/recaptcha/wageSearch` is an open JSON endpoint, like the
  case-status one.** The FLC Data Center redirects to FLAG's wage search; its
  bundle names `/flag/api/getAreaOptions?state=&year=` and a POST to
  `/recaptcha/wageSearch` with `{collectionType:"alc", year, socCode, area,
  areaType:"bls_area", rdFlag:"BOTH"}` that answers the four OEWS levels in a
  quarter second, no captcha in the flow. `/tools/wage-levels` reads it through
  two validated, CDN-cached routes. The series year is the July that opened it.
- **Whitespace text nodes inside `<tr>`, `<thead>` or `<select>` are a
  hydration error, not a glued-text fix.** The `{" "}` habit that keeps
  adjacent text apart is wrong between `<th>`/`<td>` siblings and between
  `<option>`s; React reports "whitespace text nodes cannot be a child of <tr>"
  and the client tree diverges. Put the space between text-bearing inline
  siblings only.
- **The bulletin's family charts parse with the same code as the employment
  ones**, keyed by row label (F1, F2A, F2B, F3, F4) and country heading. The
  fixtures were trimmed to the employment tables, so the family checks run on
  the full July 2026 replay. **`web.archive.org/web/<ts>id_/<url>` served a
  2 KB stub for a page the plain replay served whole**: the ingest uses the
  plain replay and so must anything that reads the archive.
- **A refetch after a write must bypass the browser cache when the GET is
  cached.** The milestone summary carried `max-age=300`; the count did not
  move after a successful report until the refetch used `cache: "no-store"`.
- **DOL OIG has no parseable report list** (a search page and yearly PDFs);
  the OFLC announcements page is a browser-visible list that scripts can read
  only from GitHub's runners, so its parser runs there and its fixture is the
  page text captured in a browser. WARN: California publishes a spreadsheet,
  Texas a challenge page, Washington a search form, New York an HTML list;
  only California is read and the page says so. **Superseded 2026-09-09**:
  all four are read now, see "WARN in four states" below.

## WARN in four states, social cards for every page, and the posting request proved (2026-09-09)

**WARN.** Measured from this laptop on Sep 9: New York's current notices are a
Tableau Public dashboard, and Tableau Public serves any view as CSV
(`.../views/<workbook>/<sheet>.csv?:showVizHome=no`, 194 rows for 2026); the
"legacy" HTML list is one page per notice for 2023 to 2025 and is not read.
Washington's database is an ASP.NET grid at `fortress.wa.gov`, 15 rows a page
newest first, paged by WebForms postback (`__EVENTTARGET=ucPSW$gvMain`,
`__EVENTARGUMENT=Page$N`, each page's hidden fields signing the next request;
jumping past the visible pager answers 500, so the walk is sequential). Texas
posts one spreadsheet per year (`warn-act-listings-<year>-twc.xlsx`) behind a
bot challenge that answers scripts with HTTP 202 and a 2 KB page; the real
browser gets the file, so `--state tx --from-file` is the fallback and the run
records `partial` when the runner is challenged. `ingest_warn.py` loads each
state on its own, refuses a state with zero rows, writes per state, and one
state's outage cannot cost the others. Ids are shared through `assign_ids`
(state, dates, company, county, an extra like the address or city, a sequence
number). Fixtures: the real Texas 2026 file, eight New York rows, one
Washington page. Live dry run: CA 192, NY 194, WA 180, TX challenged, 131 of
566 matched to a PERM sponsor. Open question: whether GitHub's runner is
challenged by Texas too; the first weekly run answers it.

**Social cards.** Every public page now names a card: 29 more, rendered by
`make-page-cards.mjs` from 1440-wide captures taken by `scripts/shoot.mjs`
(serial, one Chrome). **The captures are 2x (2880x1600), so the crop is in
capture pixels: `[600, 136, 2280, 1376]`, double the extension's
`[300, 68, 1140, 688]`.** The three A-to-Z browse pages and the preference
center take drawn motifs (`grid`, `window`). The card gate's "exactly one page
names the slug" used a bare substring and counted the methodology page, which
lists every dataset name, as a second page for `i140-trends`; it matches the
slug as the card argument now.

**Posting.** `post_to_x` and `post_to_linkedin` take their URL as a parameter,
and `test_social_post.py` points the real request at a local server and reads
back what X would receive: the OAuth 1.0a header with all seven parameters and
a signature recomputed from the header's own nonce and timestamp over the URL
actually requested, the JSON body, the content type. What remains is the
credentials, which are Adam's to create (an X developer app under the persona,
four secrets on the repo), then one dispatch with `post=true`.

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

## Pressure needs a PAUSE; a dropped socket does not (2026-09-09)

Two production builds failed prerendering `/tools/salary-explorer` on
`SQLITE_NOMEM`, with a successful redeploy in between. The retry was already
allow-listing that code (added 2026-09-03 for this same page) and it still did
not help, because **`withDeadline` retried immediately and only once.** An
instant retry is exactly right for `other side closed` (the point is to ride a
new connection) and close to useless for memory pressure: the far end ran out
of room to answer, and milliseconds later it still has none.

Pressure now gets a third attempt with a real wait (1.5 s, then 3 s); network
errors and the deadline keep their single immediate retry, pinned by a test
that a dropped connection still stops at two. The queries themselves are not
the defect: by hand, the two window functions behind that page ran in **0.8 s
and 2.8 s**. They are simply the largest memory consumer in a build that
prerenders many pages at once, so they are the first to lose under contention.
The deeper fix, if it recurs, is the established one: precompute into
`perm_docs` the way `review_stages` and `live_census` were.

## The due-check routine, and why the manual steps stay manual (2026-09-09)

Three things cannot be automated, and the obstacle is a browser challenge or
Adam's own account, never a missing scheduler:

| task | why not | how often |
|---|---|---|
| the current visa bulletin | travel.state.gov 403s every script as policy, and USCIS's chart page carries **no cutoff dates**, only a link back to State (checked 2026-09-09) | monthly, mid-month |
| Search Console reindex | no API; Google's Indexing API is `JobPosting`/`BroadcastEvent` only | after each deploy |
| Table V and the limits sheet | same Cloudflare | yearly |

A Claude routine changes none of that: it runs headless on a data-center
address, which is exactly what gets refused, and routines cannot push to main
anyway (Anthropic's git proxy rewrites every routine push onto a `claude/*`
branch). **What a routine CAN do is the part that actually failed: reading the
alert.** `trig_01U2UC9qeUvdft461DoV785m` ("PERM Tracker Due Check") runs
Mondays and Thursdays at 9 AM ET on `claude-opus-5`, push notifications on, and needs **no
secrets at all**: it reads the ingest-health conclusion from GitHub's public
API, reads "the newest bulletin we hold is <Month Year>" off our own
`/visa-bulletin` page, and asks the Internet Archive's CDX index whether State
has published the next month. A capture is proof it is out; an empty result
after the 18th is stated as probable, never certain, because the Archive lags
publication by a few days. Silent one-liner when nothing is due. **Proved by a manual fire on 2026-09-09: 62 seconds, and it returned "nothing due. Health check green, newest bulletin September 2026."** The one thing that needed a second attempt is worth keeping: our own page is server-rendered React, so a sentence in the copy is split by JSON punctuation in the raw HTML and a naive `grep` for it matches nothing; strip `\`, `"` and `,` first.

**Our own firewall challenges a bare script with HTTP 429**, so anything
reading permtracker.app from outside needs the `x-permtracker-audit` header
(Firewall rule 5). That is why the routine sends it.

## WARN, measured from a runner, and three bugs the measurement found (2026-09-09)

**Texas is automatic after all: the state open data portal serves the same
notices.** `data.texas.gov` dataset `8w53-c4f6` is a Socrata feed, no challenge,
**2,367 notices back to 2019-01-04** where the agency spreadsheet holds one
calendar year. It is the automatic source; the spreadsheet is an optional
top-up for the freshest weeks, because the portal trails it (portal to
2026-06-23, sheet to 2026-09-04). They merge exactly: mapped onto the same
fields, the same notice hashes to the same id from either, verified 69 of 69
on the weeks they share, and a top-up adds only what the portal lacks (27
rows). **Search the state's open data portal before accepting a scraped page
as the only source.**

**Two sources need a rank, or the staler one reverts the fresher every week.**
The portal and the spreadsheet disagree on revised worker counts (FreshRealm:
161 on the sheet, 176 on the portal). The weekly portal run overwrote the
sheet's correction every time until `write()` compared `rank_of(source_url)`,
the same guard `ingest_visa_bulletin.py` already carries. **And the worker
count is not part of a notice's identity** for the same reason: with the count
in the hash a revision became a second row instead of an update.

**Texas refuses data-center addresses exactly as it refuses this laptop.** A
throwaway probe branch ran on GitHub runner 52.155.33.249: both the WARN page
and `warn-act-listings-2026-twc.xlsx` answered **HTTP 202 with zero bytes and
`text/html`**. `urlopen` does NOT raise on that, it returns `b""`, and the
parser's `startswith(b"PK")` guard is what turns it into a refusal message.
So Texas is loaded by hand from a browser fetch, permanently, and the page
says so.

**An expected refusal must not mark a run partial.** `check_ingest_health.py`
counts `partial` in `BROKEN_STATUSES`, so classifying Texas as a failure would
have painted the weekly WARN run red **forever**, which is precisely the alarm
fatigue that let the I-485 outage sit unread for four days. States carry a
`browser_only` flag; their refusal is logged and named in the run note, and the
run still records `ok`. Staleness is not lost: **each state stamps its own
`warn-notices-<st>` freshness row**, written only when that state actually
writes, with its own budget (21 days for the three automated ones, 45 for
Texas). The health check reads every row in that table dynamically, so a single
state going quiet surfaces on its own without the job crying wolf.

**Three bugs, each found by a measurement rather than by review:**
1. **An id component a parser forgets to name is invisible.** `assign_ids`
   pops one private key, `_extra`; `parse_california` still emitted `_address`,
   so the address dropped out of every hash, every id changed, and the next
   load wrote a **duplicate of every row** (384 rows for 192 notices). The test
   is general: **no parsed row may retain a key starting with `_`**, plus every
   row has a unique id. It immediately found the second instance,
   `parse_washington_page` never calling `assign_ids` at all, so
   `--state wa --from-file` would have written rows with no id.
2. **libSQL returns integers as STRINGS, again.** The change check compared a
   stored `'42'` with a parsed `42`, so nothing ever matched and an identical
   re-run rewrote all 566 rows while logging "wrote 566". Same defect
   `live_norm()` exists for in `build_entity_detail.py`. `_cmp()` now shapes
   both sides; an unchanged load writes **0**.
3. **A single-state run must not stamp the dataset-wide freshness row**, or
   `--state tx` moves the whole dataset's `as_of` to whatever one state holds.

Loaded: California 192, New York 194, Texas 96, Washington 180, 174 matched to
a PERM sponsor.

## The spillover, from the Department's own two PDFs (2026-09-09)

`scripts/ingest_visa_limits.py` reads two files the State Department publishes
once a year and writes `perm_docs['visa_annual_limits']`; `/visa-bulletin`
renders "The spillover, as the Department set it" from it and prints nothing
when the document is absent. **The Annual Numerical Limits sheet** for the
fiscal year (linked from the Immigrant Visa Statistics page; FY2026 lives at
`/content/dam/visas/Statistics/Immigrant-Statistics/Annual  Numerical  Limits
- FY2026.pdf`, with double spaces) gives the employment worldwide total, and
that total minus the statutory 140,000 IS the year's spillover from unused
family numbers: **FY2026 is 186,000, so 46,000 spilled over, marked estimated
pending the official determination.** **Table V of the Report of the Visa
Office** (FY2024 at `.../AnnualReports/FY2024AnnualReport/Table V.pdf`) gives
numbers used per preference in four parts; the parser takes each part's
"Grand Totals" line and refuses unless family plus employment equals the
grand total (215,959 + 167,394 = 383,353 for FY2024, leaving 10,041 family
numbers unused for FY2025). Earlier years' limits sheets were not found at the
FY2026 URL pattern, and the 2025 report is not published yet.

**Getting a file off travel.state.gov.** The site refuses scripts and the
headless DevTools Chrome sits on Cloudflare's "Just a moment" forever; the
Claude-in-Chrome extension in Adam's real browser clears it after the bulletin
index loads. A `fetch` from the page to a local receiver is blocked by the
page's connection policy, but a plain form POST is not: build a form with
`enctype="text/plain"`, put the page's `outerHTML` (or a PDF's base64) in a
textarea, point it at a local HTTP server on 127.0.0.1 and submit. The body
arrives as `name=<value>`; strip the prefix. That route brought both bulletin
pages and both PDFs across in one session without a tool result carrying them.

**Deploy checklist for this batch:** `npx convex deploy -y` (three new tables,
two new HTTP route families, a cron); set `NEWSLETTER_ENABLED=1` and
`NEWSLETTER_DAILY_CAP=15` on prod Convex; add a Firewall bypass for `/badge/*`
so GitHub's camo proxy is not challenged; then push and the GSC queue in
`.planning/gsc-reindex-queue-2026-09-08.md` plus the new pages.

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
| `z-[60]` | bottom-fixed chrome: ScrollToTop, SelectionBar, ChatWidget, ReadingProgress, and the mobile data drawer |
| `z-50` | `AuthHeader` and its dropdowns |
| `z-10` | `Footer` |

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

## Every emailed link is branded, and the guard nearly made them all 404

The preference-centre email pointed at the raw Convex deployment host, so a
subscriber got a link on a domain they had never heard of and an unstyled
plain-text page. Two halves:

- **`src/emails/EmailPreferencesLink.tsx`** is a real React Email template. The
  off-only rule sits ABOVE the button, because a person clicking through must
  read what the link can do before they act, not after.
- **`convex/lib/links.ts`** is the one place `SITE_URL` and `actionUrl` live
  (they had been copy-pasted into four modules), and `next.config.ts` rewrites
  `/prefs`, `/unsubscribe`, `/queue-alert/*`, `/case-alert/*` and
  `/bulletin-alert/*` onto the Convex site host.

**THE REWRITE IS GUARDED ON AN ENV VAR, AND THE OBVIOUS ONE IS NOT ON
PRODUCTION.** `NEXT_PUBLIC_CONVEX_SITE_URL` is not set in Vercel prod, so a
rewrite array guarded on it would have been silently empty and every branded
link in every email would have 404'd - with a green build and no error. It
derives the host instead:

```ts
const convexSite =
  process.env.NEXT_PUBLIC_CONVEX_SITE_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL?.replace(".convex.cloud", ".convex.site");
```

**Check that a guarded config actually registers in the environment it ships
to.** `vercel env ls` before trusting a `?:` in `next.config.ts`, and remember
that env binds at DEPLOY time here.

## The sign-up fork: say who the product is for, before the form

Beneficiaries were signing up for an attorney case-management tool. `/signup`
now leads with `SignupAudienceFork`, a caution bar (repeating 45-degree tape,
an offset lime slab, a black warning tile breaking the top edge) carrying two
doors - `/perm-case-status` for someone waiting on their own case,
`/perm-queue` for the queue - each firing
`analytics.capture("signup_fork_taken", { door })` so the split is measured
rather than assumed.

The onboarding role step gained **"Waiting on my own case", listed FIRST**, and
`RoleStep` routes it to `/perm-case-status` instead of into the app.

**The paid beneficiary product is PARKED, deliberately.** This is signposting,
not a tier. Nothing here promises a plan, a price or a feature.

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

## What is licensed, and what cannot be (2026-09-10)

Three different things, and conflating them is what makes a data site's legal
page wrong:

| thing | status |
|---|---|
| DOL's and State's underlying figures | **17 U.S.C. §105**: no copyright in a work of the United States Government. Nobody can license them, us included |
| our COMPILATION of them | **Feist, 499 U.S. 340**: "facts are not copyrightable"; a compilation earns thin protection through "selection, coordination, or arrangement" |
| our code, prose, design | ordinary copyright, `LICENSE` at the repo root, all rights reserved |

So `/terms` §6 states the two layers separately, §4 names bulk extraction of
the compilation as the thing not permitted, and the Organization is **PERM
Tracker LLC** in the agreement and binding clauses. `structuredData.ts` points
every Dataset's `license` at that anchor.

**GitHub showing "other" for the licence means nothing legally.** Their
`licensee` library could not match our custom text against a known SPDX
licence, so it labels it `other`. It is not a defect and not a warning.

## The search palette must cover every page, and a test says so

`palette-covers-every-page.test.ts` walks the public app tree and asserts each
page is reachable from `SearchPalette`'s static index. Its first run found the
three A-Z browse hubs missing (57 of 61). A palette that silently omits pages
is worse than no palette: it answers "no results" for something the site has.

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

