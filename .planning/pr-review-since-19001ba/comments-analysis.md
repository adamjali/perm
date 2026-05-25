# Comment Accuracy & Maintainability Analysis — since `19001ba`

Scope: non-test source in the PR-review file lists, prioritizing comment-heavy /
complex-logic files. Every flagged comment was cross-checked against the actual
code (and, where relevant, against callers and schema). Commit `9d4f981`
("docs(comments): rewrite inaccurate / drop redundant comments") was verified —
its cleanup is overwhelmingly accurate; the few issues below are mostly in
*newly added* files, not regressions introduced by that cleanup.

**No changes were made.** Advisory only.

---

## Summary

The new security/AI/email code is unusually well-commented: fail-open/closed
decisions, idempotency, token math, the instrumentation-client single-file rule,
and the Mistral tool-call-ID sanitizer are all documented accurately and at the
right altitude (the "why", not the "what"). Most invariants a future maintainer
needs are captured.

A handful of real inaccuracies exist, almost all in two newly-added files
(`marketingWebhook.ts`, `conversationSummary.ts` leftover) plus a couple of
slightly-imprecise "single source of truth" / "import from here" claims. None
are dangerous, but two will actively mislead a maintainer about call graph and
dead code.

---

## Critical Issues

### 1. `marketingWebhook.ts` header — "Called only from `convex/http.ts`" is false
- **Location:** `/Users/dev/cc/perm-tracker/v2/convex/marketingWebhook.ts:8`
- **Issue:** The module docstring states `recordContactEvent` is "Called only
  from `convex/http.ts` after svix signature verification." It is **also** called
  from `convex/marketingEmail.ts:358` (`backfillMarketingEvents`), which bypasses
  svix entirely and uses synthetic `backfill_<contactId>` IDs. A maintainer
  trusting this comment could wrongly assume every row has a real svix signature
  behind it, or could refactor the http path and miss the backfill caller.
- **Suggestion:** "Called from `convex/http.ts` (live svix-verified webhook) and
  from `marketingEmail.ts` backfill (synthetic `backfill_<id>` svixId, no svix
  verification)."

### 2. `marketingWebhook.ts` header — event list omits `contact.backfill`
- **Location:** `/Users/dev/cc/perm-tracker/v2/convex/marketingWebhook.ts:4` (and `:10` idempotency note)
- **Issue:** Header says it records "subscribe/unsubscribe/delete events," but the
  validator (`marketingWebhook.ts:31`) and the schema (`schema.ts:979`) both
  accept a 4th type, `contact.backfill`, which is actively written by the
  backfill action. The "Idempotent: deduped on `svixId` (from the `svix-id`
  request header)" note is only true for the webhook path — the backfill path's
  svixId is synthetic, not a header value.
- **Suggestion:** List all four event types and note that `contact.backfill` rows
  carry a synthetic `backfill_<contactId>` svixId (not a header), which is what
  makes re-running the backfill a no-op.

---

## Improvement Opportunities

### 3. `conversationSummary.ts` — `SUMMARIZATION_PROMPT` is now dead but documented as live
- **Location:** `/Users/dev/cc/perm-tracker/v2/convex/conversationSummary.ts:58-62`
- **Current state:** The exported `SUMMARIZATION_PROMPT` still carries a docstring
  ("System prompt for the summarization LLM"). After this PR, `summarize.ts` no
  longer imports it — it defines its own `PROSE_SUMMARIZATION_PROMPT` (and
  `ENTITY_EXTRACTION_PROMPT`). The only remaining references to
  `SUMMARIZATION_PROMPT` are its own definition (no runtime consumers in
  non-test source). The docstring implies it's wired into a live pipeline; it is
  not. This is comment-supported dead code that will rot further.
- **Suggestion:** Either delete the constant, or change the docstring to flag it
  as unused/legacy and point to `src/lib/ai/summarize.ts` for the live prompts.

### 4. `compaction.ts` — "providers.ts and summarize.ts import from here" (the constant)
- **Location:** `/Users/dev/cc/perm-tracker/v2/src/lib/ai/compaction.ts:24-28`
- **Current state:** The `CHARS_PER_TOKEN` doc says "Single source of truth —
  providers.ts and summarize.ts import from here." Neither file imports the
  `CHARS_PER_TOKEN` constant itself: `providers.ts` imports `estimateTokensOf`,
  `summarize.ts` imports `estimateStringTokens`. The *intent* (one place owns the
  token-math ratio) is correct, but the literal claim about who imports the
  constant is wrong and could send a maintainer hunting for a non-existent
  `import { CHARS_PER_TOKEN }`.
- **Suggestion:** "Single source of truth for token math — providers.ts and
  summarize.ts consume it via the estimator helpers (`estimateTokensOf`,
  `estimateStringTokens`), not by importing the constant directly."

### 5. `proxy.ts` — internal comments still say "middleware" after the Next 16 rename
- **Location:** `/Users/dev/cc/perm-tracker/v2/src/proxy.ts:36,40` ("INSIDE this middleware", "the rate limit here")
- **Current state:** File was renamed `middleware.ts` → `proxy.ts` (Next.js 16),
  but several comments still call it "this middleware." It's wrapped by
  `convexAuthNextjsMiddleware`, so "middleware" is conceptually defensible, and
  the Sentry breadcrumb category `middleware.rate_limit` (matched in
  `sentry.ts:45`) is consistent with that wording. Low risk, but a maintainer
  grepping for a `middleware.ts` file will not find one.
- **Suggestion:** Optionally note at the top that this is the Next 16 `proxy.ts`
  (formerly `middleware.ts`); leave the breadcrumb category as-is for continuity.

---

## Recommended Removals

None. No comment in scope is pure noise/restatement that warrants deletion on
its own (the SUMMARIZATION_PROMPT case in #3 is better fixed by deleting the
*code*, not just the comment).

---

## Positive Findings (accurate, high-value comments — keep as examples)

- `instrumentation-client.ts:1-13` — the single-file rule ("Next.js loads
  exactly ONE instrumentation-client file… a root-level one is silently
  ignored") with the concrete regression history. Verified: the root
  `v2/instrumentation-client.ts` was deleted in this PR and both PostHog + BotID
  now live in `src/instrumentation-client.ts`. Exemplary "why" comment.
- `providers.ts:30-48` — the Mistral tool-call-ID sanitizer rationale (9-char
  rule, cross-provider historical IDs, Sentry issue ref). Matches
  `toMistralToolCallId` / `wrapMistralModel` exactly.
- `turnstile.ts:6-9` — documents the synchronous `profile()` callback constraint
  that forces the pre-flight action; and fail-open(dev)/fail-closed(prod) is
  documented AND implemented correctly (`turnstile.ts` NODE_ENV branch).
- `authRateLimit.ts:30-39` + `checkIpRateLimit` fail-open note — per-IP vs
  per-email rationale and the deliberate `remaining: 0` "can't enforce"
  pass-through are accurate. `recordAuthFailure`'s "potentially auto-suspend"
  claim is backed by `abuseDetection.ts:66-77`.
- `abuseBlocklist.ts:1-11` + `recordStrike` — "reuse the rateLimits table as a
  strike log so we don't need another table" is true; `recordStrike` and
  `recordAuthFailure` both write `rateLimits` rows. `listActiveBlocks` "newest
  first" matches `.order("desc")`.
- `compaction.ts:22-26` — the intentional ~30-50% over-count bias ("better to
  skip a model that almost-fits than to send an oversized payload that 400s") is
  a genuinely useful invariant and matches the estimator + `FallbackModel` skip
  logic.
- `http.ts:84-90` — the CAN-SPAM double-failure trade-off on the contact-event
  catch is honest and accurate (returns 200, Resend won't retry, Resend is
  source of truth).
- `.env.example` Sentry block — "sentry.server/edge.config.ts read SENTRY_DSN,
  the unprefixed one" verified against both config files; `.env.sentry.example`
  referenced and exists.
- `suspension.ts:1-10` — accurately describes the three-field triplet collapse
  and the future-migration swap point.
