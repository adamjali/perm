# Simplification Analysis — changes since `19001ba`

Scope: highest-churn changed source. Analysis only — no edits applied. All
suggestions PRESERVE functionality and respect project conventions (`||` not
`??`, central perm lib, `@/lib/toast`, named exports, import order). Line
numbers reference current HEAD.

Churn (insertions, scoped files):
signup 473 · summarize 359 · reset-password 359 · providers 227 · login 253 ·
SecurityDashboard 581 (new) · RecruitmentResultsCard 461 (new) · compaction 348
(new) · ChatCompactionDivider 255 (new) · abuseBlocklist 230 (new) · authRateLimit 101 · next-up −199.

---

## 1. FactsSchema triplication (HIGH — corroborated)

The PERM facts shape + its parsing/normalization logic is defined THREE times,
each subtly different:

- `v2/src/lib/ai/compaction.ts:64-82` — `CompactionFactsSchema` (zod, canonical,
  with legacy `cases: string[]` transform). Plus the `CompactionFacts` interface
  at `compaction.ts:41-47` and `parseFacts` at `compaction.ts:329-348`.
- `v2/src/lib/ai/summarize.ts:67-84` — `FactsSchema`. **Byte-for-byte identical**
  to `CompactionFactsSchema` (same union, same transform, same optionals). It
  even casts `object as CompactionFacts` at `summarize.ts:178`, proving it
  intends to produce the exact same type.
- `v2/src/components/chat/ChatCompactionDivider.tsx:31-37` — a third `Facts`
  TYPE (looser: `cases?: Array<string | {...}>`), plus its own `parseFacts`
  (`:60-70`) and `formatCase` (`:72-75`) — both already implemented in
  compaction.ts (`parseFacts` and the inline case-formatter in `renderFacts`
  at `compaction.ts:175`).

Approach: export `CompactionFactsSchema` from `compaction.ts`. Have
`summarize.ts` import it for the `generateObject` schema (delete its local
`FactsSchema`, drop the `as CompactionFacts` cast since zod output already
matches). For `ChatCompactionDivider.tsx`, import `CompactionFacts` + `parseFacts`
from compaction.ts and export a small `formatCase(c)` helper from there too
(extract the `c.status ? ... : c.id` expression currently inlined in
`renderFacts`). The divider's `parseFacts` accepts an already-parsed object as
well as a string — preserve that by widening the shared `parseFacts` to accept
`string | CompactionFacts | null | undefined`, or keep a 3-line object-passthrough
wrapper in the component. Net: one schema, one type, one parser.

---

## 2. Auth-client error-string classification duplicated across 3 clients (HIGH)

Every catch block in all three auth clients re-tests the same substring sets:

- network: `network` / `offline` / `failed to fetch` / `load failed`
- rate-limit: `toomanyfailedattempts` / `rate limit` / `too many`
- invalid-code: `invalid` / `incorrect` / `could not verify`

`login` already factored two of these into module-local `isNetworkError`
(`LoginPageClient.tsx:32`) and `isRateLimitError` (`:36`), but `signup` and
`reset-password` still inline the raw chains repeatedly:

- `SignupPageClient.tsx` — network chain inlined 3×, rate-limit chain 2×
  (handleCredentialsSubmit, handleVerificationSubmit, handleGoogleSignIn).
- `ResetPasswordPageClient.tsx` — network chain 3×, rate-limit chain 2×,
  invalid-code chain 1× (handleEmailSubmit, handleResetSubmit).
- `login` duplicates the invalid-code chain at `LoginPageClient.tsx:251`.

Approach: add `isNetworkError`, `isRateLimitError`, `isInvalidCodeError`,
`isExpiredError` to a new `v2/src/lib/auth/auth-errors.ts` (next to the existing
`auth-telemetry.ts` / `signup-validation.ts`). Each takes the lowercased message
and returns boolean. Replace all inline `lower.includes(...)` chains with these.
Use `||` inside (SWC rule — these are short chains so safe either way, but keep
`||`). This removes ~40 lines and makes the matching rules single-sourced.
Optionally a `classifyAuthError(message): "network"|"rate_limit"|"invalid_code"|
"expired"|"unknown"` returning a union, consumed via `switch` (avoids nested
ternary, matches CLAUDE.md anti-nested-ternary rule).

---

## 3. Per-field blur handler in signup is a manual dispatch table (MEDIUM)

`SignupPageClient.tsx` `handleBlur` (the `if (field === "email") ... else if
... else` block) re-derives each field's validator + touched-setter inline. The
four `validate*Value` calls and `setXTouched` calls follow an identical shape.

Approach: drive it from a small config map keyed by field name —
`{ email: { setTouched: setEmailTouched, validate: () => validateEmailValue(email, true), reportKey: "email" }, ... }`.
`handleBlur(field)` does `cfg.setTouched(true); const v = cfg.validate(); if (v.state === "invalid") reportIfNewInvalid(cfg.reportKey, v.reason)`.
Collapses ~20 lines to ~6 and removes the `confirm` vs `confirm_password`
reportKey mismatch risk (currently the string differs between the `else` branch
and the password-cascade onChange). Keep behavior identical.

---

## 4. Two near-identical `submitLabel` + `firstMissing` gating patterns (MEDIUM)

`signup`, `login`, and `reset-password` each compute a `firstMissing`
useMemo (which gate failed) and a `submitLabel`/`*StepLabel` useMemo that
`switch`es on it to produce the button copy. The structure is identical; only
the field set and copy strings differ. Reset-password has TWO copies
(`emailFirstMissing`/`emailStepLabel` and `resetFirstMissing`/`resetStepLabel`).

Approach: a small generic helper, e.g.
`buildSubmitState(steps: Array<{ key: K; missing: boolean; label: string }>, loadingLabel: string, doneLabel: string)`
returning `{ firstMissing, label }`. Caller passes an ordered list of gates; the
helper returns the first unmet key and its label (or done label). This is a
judgment call — the per-form arrays are short and explicit, and over-abstracting
button copy can hurt readability. Recommend ONLY if a 4th flow appears;
otherwise leave as-is. Documented as a watch-item, not an action.

---

## 5. Hand-rolled branded `Id` type in SecurityDashboardClient (LOW)

`SecurityDashboardClient.tsx:37` declares `type Id<T extends string> = string &
{ __tableName: T }` locally and casts `userId as Id<"users">` at `:428`. The real
`Id` is available from `convex/_generated/dataModel` (used elsewhere in the repo,
e.g. RecruitmentResultsCard imports from `case-detail-types`). The local fake
type risks drifting from the generated brand.

Approach: `import type { Id } from "../../../../../convex/_generated/dataModel"`
(matching the existing relative-`api` import on `:28`) and delete the local decl.
MEMORY note: don't remove `Id` where used in interfaces — here it IS still used
(the `:428` cast), so keep the import.

---

## 6. SummaryCards accent class logic — nested conditional inside cn() (LOW)

`SecurityDashboardClient.tsx:152-162` computes border/bg classes with
`c.accent === "destructive" && (cond ? "a" : "b")` and a parallel amber branch
inside one `cn()` call. Readable but mixes the "which accent" and "is threshold
exceeded" decisions.

Approach: lift to a helper `cardAccentClass(accent, value)` using a `switch
(accent)` with an explicit threshold per case (destructive: `>0`, amber: `>10`),
returning the class string. Removes the inline ternaries from JSX and names the
thresholds. Pure refactor, no behavior change.

---

## 7. Events-tab actor cell uses nested ternary (LOW — convention)

`SecurityDashboardClient.tsx:247`:
`{e.kind === "strike" ? e.ip : e.kind === "rate_limit" ? e.actor : "—"}` is a
nested ternary — CLAUDE.md explicitly discourages these.

Approach: extract a tiny `actorFor(e)` function with an early-return / `switch`
on `e.kind`. One-liner becomes `{actorFor(e)}`.

---

## 8. estimateInputTokens is now a pure passthrough (LOW)

`providers.ts` `estimateInputTokens(options)` simply
`return estimateTokensOf(options)`. After the compaction.ts extraction this
wrapper adds only a doc comment.

Approach: either inline `estimateTokensOf(options)` at the single call site in
`doStreamWithFallback`/the skip-check loop, or keep the wrapper purely for the
doc comment (defensible). Trivial; flag only.

---

## 9. summarize.ts: repeated finishSummarizing lock-release calls (LOW)

`summarize.ts` calls `fetchMutation(api.conversationSummary.finishSummarizing, {
conversationId }, { token })` in four places (no-messages branch, prose-failed
branch, catch branch, and implicitly on success via saveSummary). The three
explicit release calls are identical.

Approach: a local `releaseLock()` closure (captures `conversationId`, `token`)
inside `summarizeConversation`, used in the early-return branches and the catch.
Keep the catch's try/swallow wrapper around it (stale lock auto-clears at 60s).
Minor; reduces three identical 5-line calls to `await releaseLock()`.

---

## 10. abuseBlocklist: upsert-block pattern duplicated (LOW)

`abuseBlocklist.ts` `recordStrike` (`:96-126`) and `adminBlockIp` (`:135-170`)
both do "query by_ip → if existing patch(expiresAt/reason) else insert(full
row)". The field sets differ (strike sets `strikes`, manual sets
`manualOverride: true`) so they're not identical, but the
query/branch/patch/insert skeleton repeats.

Approach: a private `upsertBlock(ctx, { ip, expiresAt, reason, strikes?,
manualOverride })` helper that does the query + patch-or-insert, with callers
supplying the differing fields. Judgment call — the two differ enough that a
helper with many optional params may not be clearer. Recommend leaving unless a
third writer appears; documented as watch-item.

---

## Confirmed NON-issues / intentional patterns (do not touch)

- `compaction.ts` `renderFacts` config-array (`sections.map`) — already the DRY
  form; good.
- `compaction.ts` `compactAt` level config record (`{2,3,4}`) — clean, keep.
- providers.ts `lastUsedModel`/`lastAttemptCount` getter+private-field change —
  intentional encapsulation, fine.
- providers.ts `wrapMistralModel` middleware — necessary (Sentry 7411490896),
  well-documented, keep.
- `validateConfirmPassword` eslint-disable for timing-attack — intentional and
  commented.
- Auth clients moved from FormData-read to controlled state — intentional for
  Turnstile/validation gating, not churn-for-churn.
- `next-up-section.components.tsx` — net deletion (NextActionCard extracted
  elsewhere); nothing to simplify in remaining StageProgress/Deadline code.
- RecruitmentResultsCard `STATUS_CONFIG` record + per-status mapping — clean
  table-driven pattern, keep.
- The copy/check `AnimatePresence` swap in RecruitmentResultsCard (`:278-300`)
  is two near-identical motion.span blocks; could be one parameterized block,
  but the icon + color differ and it's a well-worn shadcn idiom. Optional, LOW.

---

## Priority order

1. FactsSchema/parseFacts/Facts type triplication (#1) — true DRY win, 3 files.
2. Auth error-string classification helpers (#2) — ~40 lines, 3 files, single source.
3. signup handleBlur dispatch table (#3) — local, fixes reportKey drift risk.
4. SecurityDashboard: real `Id` import (#5), nested-ternary actor cell (#7),
   accent helper (#6) — quick convention fixes.
5. summarize releaseLock closure (#9), estimateInputTokens inline (#8) — minor.
6. Watch-items only: submitLabel generic (#4), abuseBlocklist upsert helper (#10).
