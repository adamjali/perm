# CLAUDE.md — PERM Tracker v2

> **Stack:** Next.js 16.3.4 + Convex 1.42.3 + React 19.2.7 + AI SDK 7 + TypeScript (strict)
> **Status:** Production | **Last Updated:** 2026-09-01

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
| `pnpm test:run` | **All 4 projects. Baseline 306 files / ~6,096 tests (~10min). Run this before every push.** |
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
   raising `MIN_TOTAL_FOR_PAGE` 3 -> 5 (16,309 -> 9,646 employers). Nothing
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
