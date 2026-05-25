# Test Coverage Review — PERM Tracker changes since `19001ba`

**Date:** 2026-05-24
**Scope:** New/changed behavior since `19001ba`. Focus areas: AI fallback chain + compaction/summarize, security (abuse blocklist, auth rate-limit, Turnstile, email blocklist, suspension), marketing webhook, IDOR-prone marketing subscription actions.
**Method:** Cross-checked each new/changed test against actual source behavior; ran the new + adjacent suites. Made no code changes.

---

## 1. Summary / Verdict

Coverage of the **pure, deterministic** new logic is genuinely strong: `compaction.ts`, `nameValidation.ts`, `signup-validation.ts`, `emailBlocklist.ts`, `abuseBlocklist.ts`, `authRateLimit.ts`, and the `conversationSummary` Convex functions all have well-structured, behavior-oriented, parameterized tests with meaningful assertions. The `FallbackModel` sequential-failover contract and the Mistral tool-call-ID sanitizer are tested thoroughly with injected mock models.

However, the coverage has a **shape problem**: the most security- and money-sensitive *new* surfaces are either untested or tested one layer below where the risk lives. Specifically:

- **2 actively FAILING tests committed to the tree** (`rateLimit.test.ts` × stale constants; `conversationSummary.test.ts` × rate-limiter component). These would break CI / a `pnpm test:run` gate today.
- **The IDOR-prone marketing subscription actions have zero tests** — and the source confirms the IDOR (any authed user can read/unsubscribe any email).
- **The marketing webhook HTTP handler (`http.ts`) is untested** — svix verify, the `contact.backfill`/`isContactEventType` mismatch, the NaN `created_at` path, size caps, and the deliberate 200-on-failure CAN-SPAM trade-off all live there, not in the tested mutation.
- **Six newly-added security/email modules have no dedicated test file at all**: `turnstile.ts`, `abuseDetection.ts`, `suspension.ts`, `adminSecurity.ts`, `marketingEmail.ts`, `rateLimitConfig.ts`.
- **`summarize.ts` (the orchestration: all-providers-fail, lock release, fact merge wiring) is untested**, and the **chat route** (`/api/chat`, +70 lines: BotID, IP rate-limit fail-open, compaction integration) is untested.

Net: **business-logic primitives are well covered; the integration seams where the actual production incidents will originate are the weak spots.** Plus two committed failing tests must be fixed before this is mergeable.

---

## 2. CRITICAL GAPS (rated 8–10) — must address

### G1. `rateLimit.test.ts` is FAILING (stale constants) — severity 9
`convex/lib/rateLimit.ts` `RATE_LIMITS` were retuned (LOGIN 10→**20**, OTP_VERIFY 5→**10**, PASSWORD_RESET 3→**5**) but `convex/lib/__tests__/rateLimit.test.ts` still asserts the old values. Verified failing:
```
RATE_LIMITS configuration > LOGIN allows 10 attempts per 15 minutes
AssertionError: expected 20 to be 10
```
3 of 10 assertions fail. This is a regression caught by an existing test that was never updated — either update the assertions or, better, replace these constant-mirroring tests with **behavioral** tests of `checkAndRecordRateLimit` (window roll-off, `remaining` decrement, `resetInMs`, the block message) which is the logic that actually changed and is currently **untested at runtime** (the suite only reads the config object). Catches: silently shipping a too-loose login limit.

### G2. `conversationSummary.test.ts` is FAILING under the rate limiter — severity 8
The very first test fails at `conversations.create` → `rateLimiter.limit(ctx, "conversationCreate", { throws: true })` (token bucket capacity 5). Fails in isolation, not just in parallel — so it is not the known page-context/toast flake. The `convex-test` harness isn't seeding/registering the `@convex-dev/rate-limiter` component bucket as the real deployment does, so `.limit()` throws on the first call. Either the rate-limiter component must be wired into the test harness (`convex-test` modules/component registration), or the seed helper must mock/bypass it. As-is, every `conversationSummary` assertion behind `seedConversation` is at risk. Catches: nothing right now — it's red.

### G3. IDOR marketing subscription actions — UNTESTED, and the IDOR is real — severity 10
`convex/marketingEmail.ts`:
- `getMarketingSubscriptionStatus({ email })` and `updateMarketingSubscription({ email, subscribed })` only check `if (!identity)` / `if (!identity) throw`. **Neither verifies the `email` arg belongs to the caller.** Any authenticated user can read another user's subscription state or unsubscribe/re-subscribe any arbitrary email in Resend.
- There are **no tests for either action** (no `marketingEmail.test.ts` exists).

Required tests (criticality 10): (a) authed caller passing *their own* email succeeds; (b) authed caller passing *someone else's* email is rejected — this test would FAIL today and correctly surface the vuln; (c) unauthenticated caller → `getMarketingSubscriptionStatus` returns `null`, `updateMarketingSubscription` throws; (d) Resend 404 → `null` (new-user path); (e) Resend non-404 error → logged + `null` (status) / throws (update). Catches: cross-tenant subscription tampering, a CAN-SPAM/privacy issue.

> Note: these are Node `action`s hitting `fetch`; test by mocking `global.fetch` and `ctx.auth.getUserIdentity`. `convex-test` supports actions, but the `"use node"` + external fetch means a direct unit harness with a mocked fetch is the pragmatic route.

### G4. Marketing webhook HTTP handler (`convex/http.ts`) — UNTESTED — severity 9
`marketingWebhook.test.ts` is good but tests **only the `recordContactEvent` internal mutation**, passing a pre-computed `occurredAt`. All the risk-bearing logic lives in the `/resend-inbound` httpAction and is never exercised:
- **svix signature verification** — missing headers → 401; bad signature → 401; missing `RESEND_WEBHOOK_SECRET` → 500. None tested.
- **NaN `created_at`** — the http handler does `body.created_at ? new Date(body.created_at).getTime() : Date.now()`. An *invalid-but-truthy* string (e.g. `"not-a-date"`) yields `NaN`, which is truthy-guarded but still produces `NaN` and would be stored as `occurredAt`. The task flagged "NaN created_at"; the current guard does NOT defend against an unparseable non-empty string. Untested + latent bug.
- **`contact.backfill` event-type mismatch** — the mutation's `eventType` union includes `"contact.backfill"`, and `marketingEmail.ts:backfillMarketingEvents` emits it, but `http.ts:KNOWN_CONTACT_EVENTS` / `isContactEventType` only lists created/updated/deleted. Consistent by design (backfill is internal-only), but there is no test pinning this contract, so a future edit could break webhook routing silently.
- **200-on-failure trade-off** — the handler deliberately returns 200 even when `recordContactEvent` throws (documented CAN-SPAM risk). No test asserts this intentional behavior, so a future "fix" to return 500 (causing Resend retry storms) wouldn't be caught.
- **Size caps** — email sliced to 254, names/ids to 200, rawPayload to 10k. Untested.

Required: an httpAction-level test (mock svix `Webhook.verify`, `recordError`) covering the 401/500/200 branches, the NaN path, and the size caps. Criticality 9 (unsubscribe events are legally load-bearing).

### G5. `abuseDetection.ts` auto-suspend feeder — UNTESTED — severity 8
`recordAuthFailure` is the write-path that actually **suspends a user account** after 10 failures/30min, and `checkEmailSuspension` is the public read path the login form trusts. `authRateLimit.test.ts` only asserts that `auth_fail:login` *rows* get written — it never verifies that the threshold actually flips `suspendedAt`, that the admin email is scheduled, that `alreadySuspended` is honored (no double-suspend), or that the 30-min window rolls off. `checkEmailSuspension` has no test for the suspended-vs-not response shape, the auto-lift-past-`until` case (delegated to `getUserSuspension`), or the unknown-email neutral response. These are direct account-lockout mechanics. Catches: a broken threshold that never suspends (security hole) or suspends too eagerly (DoS on legit users).

---

## 3. IMPORTANT IMPROVEMENTS (rated 5–7)

### I1. `turnstile.ts` — no tests — severity 7
Branch-heavy and security-relevant: missing secret in prod → fail-closed; missing secret in dev → fall through to test key; empty/whitespace token → reject; siteverify non-2xx → reject; `data.success === false` → reject with error-codes; fetch throws → reject. All untestable today because there's no test. Mock `global.fetch` + toggle `NODE_ENV`/`TURNSTILE_SECRET_KEY`. The prod fail-closed vs dev fail-open fork is exactly the kind of env-conditional logic that breaks silently.

### I2. `suspension.ts` — no tests — severity 6
Pure, trivially testable, and the single source of truth for "is this user suspended" consumed by `abuseDetection` and `adminSecurity`. Needs: not-suspended (no `suspendedAt`) → null; suspended with future `until` → object; suspended with past `until` → null (auto-lift); `until: undefined` → `until: null` (manual unsuspend); `isUserSuspended` mirrors. ~8 lines of source, high leverage, zero tests.

### I3. `adminSecurity.ts` admin suspend/unsuspend write path — no tests — severity 6
`adminSuspendUser` / `adminUnsuspendUser` mutations write the suspension triplet and must enforce `requireAdmin`. Should test: non-admin rejected; admin can suspend (sets triplet) and unsuspend (clears it); `getSecuritySummary`/`listFlaggedUsers` shape. The admin authorization gate on a state-changing security endpoint is exactly what a test should pin.

### I4. `summarize.ts` orchestration — no tests — severity 6
The pure helpers it relies on (`mergeFacts`, `parseFacts`, `compactToFit`) are well tested, but the *orchestration* is not: all-prose-models-fail → `proseText === null` → release lock without saving; lock-not-acquired → early return; `getMessagesToSummarize` returns empty → release lock; `extractEntities` failure is non-fatal (prose-only still saves); facts merge + `messageCountAtSummary = total - RECENT_MESSAGES_TO_KEEP`. These are the "mid-stream / partial failure" paths the task called out. Mockable via `vi.mock('ai')` + `vi.mock('convex/nextjs')`.

### I5. Chat route `/api/chat` integration — no tests — severity 6
+70 lines of new logic, none covered: BotID `isBot` → 403; IP rate-limit `!allowed` → 429; IP rate-limit *service error* → **fail-open** (allow); compaction `compactToFit` returns null → emergency `slice(-4)` fallback; `summary || facts` gate now includes facts (previously summary-only). The fail-open-on-rate-limit-error branch is a deliberate availability/security trade-off worth pinning. Hard to unit test (Next route + many imports) but at minimum the IP-extraction + fail-open decision could be factored out and tested.

### I6. `rateLimitConfig.ts` per-user limiter — no behavioral test — severity 5
Newly added (`caseCreate`, `conversationCreate`, etc.). No test verifies a limit actually trips after capacity, or that `throws:true` produces a "rate limit"-matching message the client handlers expect. Tied to G2 — once the harness wires the component, add a "N+1th create within a minute throws" test for at least one bucket.

### I7. `FallbackModel` `maxInputTokens` skip path — undertested — severity 5
`providers.test.ts` covers failover and all-fail well, but never exercises the **skip-on-oversized-input** branch (`estimatedTokens > config.maxInputTokens` → push error, `continue`, breadcrumb). Given Groq's 10k cap is the whole reason compaction targets 10k, a test that a too-large payload skips Groq and lands on the next model is worth adding. Also: no test asserts `lastUsedModel`/`lastAttemptCount` after a *multi-failure* success (only the single-success `forRequest` case).

### I8. `compactToFit` real-token-budget realism — severity 5
Good coverage, but the "returns null when even L4 doesn't fit" test uses a 50-token budget (below the envelope header) — a somewhat synthetic case. A test at a *realistic* tight budget (e.g. Groq's 10k with a genuinely huge transcript) where L4 *does* fit would better pin the production target. Minor.

---

## 4. TEST QUALITY ISSUES

- **`rateLimit.test.ts` tests constants, not behavior.** Even after fixing G1's numbers, asserting `RATE_LIMITS.LOGIN.limit === 20` is a change-detector that re-breaks on every tuning. Prefer behavioral assertions on `checkAndRecordRateLimit`. (Implementation-coupled.)
- **`abuseBlocklist.test.ts` admin flow silently no-ops without `ADMIN_EMAIL`.** The "admin block creates a row + unblock removes it" test does `if (!adminEmail) return;` — it passes green while testing nothing in any env where `ADMIN_EMAIL` is unset (likely CI). This hides the admin-path coverage. Use a fixture that injects an admin profile deterministically (the `requireAdmin` path) rather than depending on a process env var.
- **`providers.test.ts` `toMistralToolCallId` empty-string test dodges the real case.** The test comments that empty input could infinite-loop (`charCodeAt` on `""` → NaN), then *deliberately tests `'a'` instead*. The actual `''` edge case — the one with the documented infinite-loop risk — is never asserted. If `toMistralToolCallId('')` is reachable, test it; if not, document why it can't be. Current test gives false confidence.
- **`marketingWebhook.test.ts` `makePayload` is unused at the field level.** Several tests build a full realistic `makePayload()` then hand-map only a few fields into the mutation args, so the realistic payload shape (snake_case, segment_ids, null handling) is constructed but never actually flows through any parser — because the parser (in `http.ts`) isn't under test (see G4). The fixture implies more coverage than exists.
- **`compaction.test.ts` length-based prose assertions are loose.** Truncation tests assert `envelopeContent.length < longProse.length` and `< 2000`/`< 1200` rather than asserting the prose was cut near the intended token cap. They'd pass even if truncation were far more (or barely) aggressive than intended. Behavior is mostly right, but the assertions don't tightly pin the cap.
- **Positive: most new tests follow AAA, use `it.each` parameterization well** (signup-validation, nameValidation), assert exact reason codes / shapes (not just "doesn't throw"), and test ownership/negative paths (conversationSummary non-owner cases, abuseBlocklist expired-row filter). This is good behavior-first testing.

---

## 5. POSITIVE OBSERVATIONS (well covered)

- **`compaction.ts`** — excellent: every level L0–L4, envelope build/skip, facts rendering per-category, prose truncation, `mergeFacts` dedupe rules (case-insensitive people/prefs, newer-wins, date shallow-merge), `parseFacts` legacy-string normalization + invalid-shape rejection, empty-array edge cases at every level.
- **`abuseBlocklist.test.ts`** — strike accumulation below threshold, auto-block on 3rd strike with 24h-window bound assertion, XFF-chain normalization, expired-row live filter, empty-IP guard.
- **`authRateLimit.test.ts`** — fail-open `remaining:0` semantics, blocklist short-circuit, expired-row ignore, XFF normalization, and the signup carve-out vs login auth-failure feeder distinction (good behavioral nuance).
- **`conversationSummary.test.ts`** (logic aside from G2) — ownership enforced on all five functions, token-trigger boundary (below floor / low tokens / over trigger), lock acquire/block/release, empty-content filtering, facts round-trip.
- **`nameValidation` / `signup-validation`** — strong parameterized coverage of the April-2026 spam-attack vectors (URLs incl. new gTLDs, emojis, control chars, repeated content) and client/server parity import.
- **`FallbackModel`** — sequential order, first-success short-circuit, all-fail comprehensive error, per-request isolation (`forRequest`), every-error-type, empty-config guard, logging.

---

## 6. Prioritized action list

| # | Item | Sev | Type |
|---|------|-----|------|
| G1 | Fix failing `rateLimit.test.ts` constants → convert to behavioral `checkAndRecordRateLimit` tests | 9 | Failing + gap |
| G2 | Fix failing `conversationSummary.test.ts` (wire rate-limiter component into harness) | 8 | Failing |
| G3 | Test marketing subscription actions; the cross-tenant test exposes a real IDOR | 10 | Gap + bug |
| G4 | Test `http.ts` resend-inbound handler (svix, NaN date, size caps, 200-on-fail) | 9 | Gap + latent bug |
| G5 | Test `abuseDetection.recordAuthFailure` suspend write + `checkEmailSuspension` | 8 | Gap |
| I1 | Test `turnstile.verifyTurnstileToken` (prod fail-closed vs dev fail-open) | 7 | Gap |
| I2–I8 | suspension / adminSecurity / summarize / chat route / per-user limiter / maxInputTokens skip / compact realism | 5–6 | Gap |

**Two committed failing tests (G1, G2) make this branch non-green today** — fix before merge regardless of the new-coverage work.
