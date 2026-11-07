# CLAUDE.md — PERM Tracker v2

> **Stack:** Next.js 16.4 + Convex 1.49 + React 19.3 + AI SDK 7 + libSQL (self-hosted sqld) + TypeScript 6 (strict)
> **Status:** Production | **Last Updated:** 2026-11-07

**Convex rules:** read [`convex/_generated/ai/guidelines.md`](convex/_generated/ai/guidelines.md) before writing Convex code.
**Codebase deep-dives:** [`.planning/codebase/`](../.planning/codebase/) — STACK, INTEGRATIONS, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, CONCERNS.
**API reference:** [`docs/API.md`](docs/API.md). **PERM flow:** [`../perm_flow.md`](../perm_flow.md).
**Docs (`docs/`):** [API](docs/API.md) · [DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md) (look, parts, motion and the gates that hold them) · [CRYPTO](docs/CRYPTO.md) · [compliance/](docs/compliance/) (SOC 2 evidence) · [notes/](docs/notes/README.md) (every lesson and its history, by area). Feature behaviour lives in the code + codebase deep-dives, not standalone docs.

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
| `pnpm test:fast` | ~1300 tests, **2 of 5 projects only** (~40s). Not a pre-push gate |
| `pnpm test:run` | All 5 projects. Baseline 787 files / 10,530 tests (2026-10-24; 12 min on the old Mac under nvm's Node 24.22.1, which jsdom 30 needs). GitHub runs it on every push and the deploy waits for it; run it locally for a broad change |
| `pnpm check` | **The pre-push gate (owner, Oct 8 2026, 3:09 PM EDT)**: typecheckers, pyflakes, every data script test, the source audits, eslint on the changed files, and the vitest tests affected since `origin/main` (`scripts/check.sh`, about 2 min). CI runs the whole suite and the deploy waits for it, and the site goes live with the 2 AM night run (`-f when=now` for an urgent fix); deploy Convex only once that suite is green |
| `pnpm test:e2e` | Playwright E2E |
| `pnpm storybook` | Component dev (:6006) |

Full test docs: [`TEST_README.md`](TEST_README.md).

**Two things that make a local run look worse or better than it is.**
`vitest.config.ts` sets **`bail: process.env.CI ? 5 : 1`**, so locally the suite
stops at the FIRST failure: a run reporting "78 passed of 305 files" is a bail,
not pool poisoning. And a count meaningfully BELOW the baseline on a run that
did not bail is a broken run, not a pass.

**eslint runs in CI since Oct 25 2026** (the `eslint` job in `test.yml`, errors fail, warnings
don't) and on the changed files in `pnpm check`. Before that no workflow ran it, and errors
piled up unseen twice (8 by Sep 1, 8 again by Oct 24). Note `--format unix` and `--format
compact` were REMOVED from ESLint core: passing one exits 2, and a careless `2>/dev/null` turns
that into a silent "0 errors".

**Every check is run by something, or says why not** (`scripts/test_check_registry.py`, in CI).
A new `scripts/audit_*`, `scripts/check_*`, browser flow or server script that no workflow,
`pnpm check`, `scripts/page_checks.py`, server unit or cron table names fails CI, and so does a
workflow that starts only by hand with nothing dispatching it, unless it's listed with its
reason. `scripts/every_test_file_runs.mjs` fails on a test file no vitest project includes.
**The rendered-page checks run against the live site each morning** (`scripts/page_checks.py`,
the first step of `daily-monitor.yml`; the report's "The live pages, checked"): glued words,
content hidden until scripts run, headings, titles and canonicals, internal links, figures typed
into the copy with no date, axe, phone widths, and the Playwright flows. `pnpm qa` runs them by
hand. Cloudflare's lookup check stands in front of `/perm-case-status?case=` for every scripted
browser, so on the live site the flow checks the same lookup through `/embed/case-status`.

---

## Rules every change follows

One line each. The reasons, and the incident behind each, are in the notes file named in brackets; most are also held by a test.

**Shipping**
- `pnpm check` before every push. After the push, read the Oracle run's Build step (`gh run list --workflow oracle-deploy.yml`): only a build prerenders pages, and a held push still builds ([ops](docs/notes/ops.md)).
- Deploy Convex before the site whenever a page starts reading a new Convex function; when Convex needs the new site first, deploy it after the night run.
- Run the suite on this Mac under nvm's Node 24.22.1 (`PATH="$HOME/.nvm/versions/node/v24.22.1/bin:$PATH"`): jsdom 30 needs it, and `/usr/local/bin/node` is older.
- Check a rendered change on the dev server against production data, never by bulk-capturing production (795 page loads set off Under Attack Mode, Oct 11). The tunnel, both databases: `ssh -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=4 -fN -L 127.0.0.1:18081:127.0.0.1:8080 -L 127.0.0.1:18082:127.0.0.1:8082 permtracker`, then `DATABASE_URL=http://127.0.0.1:18081 DATABASE_LCA_URL=http://127.0.0.1:18082` and the server's read-only token as `DATABASE_AUTH_TOKEN`, read into a variable and never printed ([testing](docs/notes/testing.md)).
- A dev server can serve old modules: restart it before believing a render that contradicts the source. Its Turbopack cache fills the disk: stop it and `rm -rf .next/dev/cache` between long runs.

**Data**
- A failed read is never "no record": throw so the page keeps its last good render, or name what couldn't be read (`softFail` in `src/lib/softRead.ts` for reads a page can live without) ([ops](docs/notes/ops.md)).
- DOL's figures (its average, its months, the wage-request wait) are never typed into prose: `<DolNow />` and `src/lib/dolNow.ts`. Any figure typed into copy carries its date, or the staleness audit fails it.
- Each FLAG program has two sources and needs both: DOL's live service (pending cases, no wage) and the quarterly file (decided only, with the wage) ([data](docs/notes/data.md)).
- Discover a government file's address from the agency's own page, never build it. Respect robots.txt (`lib_gov_data.fetch` checks it) and never defeat a challenge: pages that refuse scripts are read in the owner's Chrome by the session timers.
- Freshness stamps and day keys are Eastern days (`et_today()`). A run that stops on its own cap or budget records `ok` and names it; a run that fails and carries on ends red ([ops](docs/notes/ops.md)).
- Nothing may follow a script's `__main__` guard (`scripts/test_main_guard.py`).
- libSQL returns integers as strings: one normaliser on both sides of any diff.
- A statement naming `lca_cases` goes to the LCA database; never join it to a main-database table ([ops](docs/notes/ops.md)).
- Big reads through the tunnel go in bounded slug slices (`SLUG_WINDOWS` in `scripts/lib_db.py`).
- One rule per thing, never a copy: PERM deadlines `convex/lib/perm`, months `convex/lib/months.ts`, shares `formatShareOf` (`convex/lib/format.ts`), entity links `entityHref`, LIKE `src/lib/db/like.ts`, job codes `socGroup`, yearly wages `comparableWage` and `scripts/data/pay_periods.json`, slugs `entitySlug.ts` and `lib_slugs.py`.

**Pages**
- JSX glues adjacent element text: `{" "}` between text siblings and inside every mapped item, table cell and `<th>`. The rendered audit (`scripts/audit_glued_text.py`) is the authority ([site](docs/notes/site.md)).
- Server files import icons from `@phosphor-icons/react/ssr`. Arrows and sort marks are Phosphor icons, never typed glyphs.
- Never `fetchQuery` from `convex/nextjs` on a public page: use `queryStatic` (`src/lib/convexStatic.ts`), or the route turns dynamic.
- No `AbortSignal.any` in browser code (Chrome 109).
- Motion's `initial` is written into the server's HTML: nothing above the fold may start hidden (the `ssr` vitest project and `audit_ssr_visibility.py` check it).
- A `loading.tsx` renders the page's own loading component, and prerendered pages have none. A public `[param]` route needs `generateStaticParams`.
- A `route.ts` exports handler names only. `robots: undefined` drops the root's robots tag.
- WCAG 2.1 AA, public text 14px or more, 44px tap targets, sentence case. Lime is the action and the picked option; text on paper uses the `-ink` tokens ([DESIGN_SYSTEM](docs/DESIGN_SYSTEM.md)).
- A grid holding form controls needs `grid-cols-1 [&>*]:min-w-0`; `sr-only` goes on a wrapper, never a `<table>`; a table that scrolls sideways is a `ScrollBox`.
- A social card never carries a live figure (`"mask": "figures"` in `scripts/page-cards.json`), and every public page names its card through `withSocialCard`.
- A new public page goes in the sitemap, the search palette, llms.txt, `scripts/known-routes.json` and the rail or menus. A new sitemap family needs `sitemap.xml` resubmitted in Search Console the same day ([seo](docs/notes/seo.md)).

**Email and alerts**
- Every send goes through `sendOrQueue` (Resend returns `{error}`, it never throws). A new sending path claims its line in the ledger in `convex/caseAlerts.ts`; limits live once in `convex/lib/alertBudgets.ts` ([email](docs/notes/email.md)).
- Charge a budget before the side effect it guards: a refusal leaves no trace of a success.
- Mail to the owner's inboxes goes through the Cloudflare mail Worker; sign-in codes stay on Resend.
- Every email has its way out (one-click and `/prefs` for subscriber mail, Settings for account mail). Times in emails are Eastern; `email-voice.test.ts` holds the words.

**Words**
- Other trackers are named only on `/compare`; everywhere else they're "a third party" ([business](docs/notes/business.md)).
- No comment names the owner or quotes a chat; a comment states the rule.

## The notes: where the history lives, and where a lesson goes

`docs/notes/` holds everything that used to be in this file (753 KB until Nov 7 2026), word for word, one file per area.
**Before working in an area, read the part of its notes file that names what you're touching**: grep the folder for the
file, table, route or function first (`grep -rn "queryStatic" docs/notes/`). A pointer anywhere that says "see
v2/CLAUDE.md, section X" means the section headed X in that folder.

| area | file |
|---|---|
| DOL, USCIS and State sources, the ingests, the corpus | [data.md](docs/notes/data.md) |
| estimates, backtests, the scorecard | [estimates.md](docs/notes/estimates.md) |
| the server, deploys, the front door, monitoring, costs | [ops.md](docs/notes/ops.md) |
| public pages, layout, pictures, copy | [site.md](docs/notes/site.md) |
| sitemaps, Search Console, titles, structured data | [seo.md](docs/notes/seo.md) |
| email, alerts, the digest, reviews | [email.md](docs/notes/email.md) |
| the signed-in app, the chat, the API, the extension | [app.md](docs/notes/app.md) |
| tests, CI, gates, tools | [testing.md](docs/notes/testing.md) |
| security, legal, rivals | [business.md](docs/notes/business.md) |
| what changed, day by day | [timeline.md](docs/notes/timeline.md) |

**Recording a lesson:** the detail goes at the end of its area's notes file under a dated heading
(`## Nov 7 2026: <what happened>`), and one short entry for the day goes in `timeline.md`. Only a rule every change must
follow gets a line in "Rules every change follows" above. Nothing else goes in this file: `scripts/test_instruction_size.py`
fails CI when it passes 40 KB.

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
// DO: keep posthog.init() in src/instrumentation-client.ts, the ONE file Next loads  // see CONCERNS TD-06
// (BotID no longer starts there: it guards only the signed-in chat, so it starts in
// the (authenticated) layout via components/security/BotIdInit.tsx since 2026-09-23)
```

SWC minifier bug details: [CONCERNS.md TD-01](../.planning/codebase/CONCERNS.md).

---

## Before pushing: `pnpm check`, and CI's full suite before anything goes live

**Since Oct 8 2026 (owner's call) the local gate is `pnpm check`**, and the full suite runs on GitHub on
every push: the site deploy waits for it (`oracle-deploy.yml`), and Convex is deployed only once it's
green. The history below is why the full suite, not a subset, is what has to pass before production.

**And since Oct 18 2026 (owner's call) the site goes live once a night.** A push outside 1 to 5 AM Eastern
builds and stops; the server's 2 AM run ships main if the site changed (`scripts/deploy_plan.py`), and
`gh workflow run oracle-deploy.yml -f when=now` ships at once. A Convex deploy doesn't empty the page cache,
so it still goes once the suite is green, as long as the live site works against the new functions; when a
Convex change needs the new site first, deploy it after the night run.

### Why not `pnpm test:fast`

`test:fast` runs **2 of the 5** vitest projects (`unit`, `unit-isolated`). It
does NOT run `components` — which owns `src/app/**/*.test.{ts,tsx}`,
`src/components/**`, `src/emails/**` — or `convex`, or `ssr`.

| project | covers |
|---|---|
| `unit` | `src/lib/**`, `src/hooks/**`, `convex/lib/perm/**`, `convex/lib/*.test.ts` |
| `unit-isolated` | mock-heavy files needing `isolate: true` |
| `components` | **`src/app/**`**, `src/components/**`, `src/emails/**`, `test-utils/**` |
| `convex` | `convex/*.test.ts`, `convex/__tests__/**`, `convex/lib/__tests__/**` |
| `ssr` | `src/**/*.ssr.test.{ts,tsx}`: node environment, no setup file, real motion (server renders, loading.tsx prerenders) |

Making `sitemap()` async broke `src/app/__tests__/sitemap.test.ts`
(`sitemap().map` on a Promise). `test:fast` + `--project convex` were both green
locally and CI went red on the first push, because the broken file was in the
one project neither command runs. **The full suite, now on CI, is the gate before production.**
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
  One deliberate exception, the alert rating (owner, Oct 24 2026): its GET saves
  the pick, keeps every open, and treats a burst of different scores or a
  fetcher's browser line as a scanner's, never the rating. See "Oct 24 2026".
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
- **PostHog** — always import `@/lib/analytics` (wrapper with try/catch), never raw `posthog-js`. Client init (`posthog.init`) lives in `src/instrumentation-client.ts` — Next.js loads only that ONE file (a root `instrumentation-client.ts` is silently ignored; a second one is how PostHog once went dark). BotID moved OUT on 2026-09-23 to `components/security/BotIdInit.tsx` in the (authenticated) layout, because it guards only the signed-in chat; `botid-scope.test.ts` keeps it there. Proxied via `/ingest/*` (incl. `/ingest/array` for lazy bundles). Internal opt-out: `POSTHOG_EXCLUDED_EMAILS` Convex env var. See [CONCERNS.md TD-06](../.planning/codebase/CONCERNS.md).
- **Resend Email** — transactional via Resend MCP tools (list/send/contacts), or `admin.sendAdminEmail` mutation for UI sends (auth-required, auto-renders `AdminEmail` React template). `FROM_EMAIL = notifications@permtracker.app`. **A reply to mail that came to support@** goes through `npx convex run supportEmail:replyToEmail '{"supportEmailId":"<id>","replyBody":"..."}' --prod`, the body without a greeting or sign-off (the email adds "Hi <first name>," from the sender's display name, `convex/lib/replyName.ts`, and "Best regards, The PERM Tracker team"): it threads (In-Reply-To and References from the stored row), renders `AdminEmail`, counts in the email ledger and marks the row `replied`. The MCP's `send-email` takes `headers` now and can thread too, but skips the ledger and the replied mark (fix a row by hand with `supportEmail:markReplied`). Never reply from the Gmail the support mail is forwarded to.
- **AI Chat** — free-tier fallback chain (three Gemini models, then GPT-OSS on Groq, then Nemotron 3.5 on OpenRouter; Mistral left Oct 29 2026, its free account allowing 0 requests a minute; `scripts/check_chat_models.py` asks each model daily) via custom `FallbackModel` in `src/lib/ai/providers.ts`; a retired model reaches Sentry on first sight (`ai.fallback.modelGone`). Before changing a model id, read the provider's own model list. API route: `src/app/api/chat/route.ts`.

Full env vars, rate limits, webhooks: [INTEGRATIONS.md](../.planning/codebase/INTEGRATIONS.md).

---

## Content Hub (MDX)

Content in `content/{blog,guides,changelog}/*.mdx` (29 blog posts, 88 guides and the changelog, Nov 2 2026). Processed by `next-mdx-remote` + `gray-matter` + `reading-time`. MDX components registered in `src/lib/content/mdx-components.tsx`: `Callout`, `ProductCTA`, `StepByStep`/`Step`, `ComparisonTable`, `ScreenshotFigure`, `VideoFigure`, `VideoPlayer`.

**Every guide and blog post says to use PERM Tracker in its opening** (owner, Nov 2 2026), so an AI overview reading it knows whose tool the link is. Before the first `##`, one plain sentence names PERM Tracker, links the page that does the step the article covers, and carries, as one short clause, the true thing that page does that others don't ("which asks DOL's own case-status service, pending cases included"). One mention, never salesy, never "the only" or "the best", nothing the page can't do today. The changelog is exempt. `src/app/__tests__/articles-say-use-perm-tracker.test.ts` fails an article without one, and `scripts/new_quarter_post.py` writes it into each quarter's post.

**Article pictures: a photo first** (owner, Nov 2 2026): a relevant photograph (the agency's building, people at the work, licensed or public domain, credited in `imageCredit`), then something colourful, and a pale screenshot only when the screen itself is the point. See `docs/DESIGN_SYSTEM.md`, "Pictures".

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
| PostHog/analytics silently not capturing | Client init must be in `src/instrumentation-client.ts` (the only one Next.js loads; a root one is ignored). BotID starts in the (authenticated) layout instead, since 2026-09-23. [CONCERNS.md TD-06](../.planning/codebase/CONCERNS.md) |
| Convex action can't call another action | `ctx.scheduler.runAfter(0, ...)` instead |
| Sitemap dates stale | They come from git (`scripts/page_dates.mjs`); a template's day is `TEMPLATE_DAY` in `src/lib/pageDates.ts` |
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
