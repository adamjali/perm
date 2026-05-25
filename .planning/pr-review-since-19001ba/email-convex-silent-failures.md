# Silent Failures Audit — Email + Convex Backend (since 19001ba)

Scope: non-test files in `_files-email.txt` + `_files-convex.txt`. Priority files read in full + diffed against `19001ba`. Repo pattern for backend errors is `recordError()` (convex/lib/errorRecording.ts) → DB row + rate-limited admin email + Sentry. Flagging where it is missing or where errors are console-only.

Verified semantics:
- **svix** `wh.verify()` throws on bad/expired signature → caught → 401 (correct; signature failures are NOT swallowed).
- **Resend webhooks (svix-backed)** retry on any non-2xx. Returning 200 stops retries. Returning 5xx triggers redelivery with the same `svix-id`.
- **Resend SDK** `emails.send()` returns `{data}|{error}` (does not throw for API errors), can throw for network errors.

---

## CRITICAL

### C1 — Contact-webhook write failure returns 200, losing unsubscribe events (CAN-SPAM risk)
`v2/convex/http.ts:96-114`
On `contact.created/updated/deleted`, if `recordContactEvent` throws, the handler logs + `recordError()`, then **still returns 200**. Resend will not retry, so the event (including `contact.deleted`/`unsubscribed=true`) is permanently dropped from the `marketingEvents` audit trail. The inline comment acknowledges this as a known "legal risk … mitigated by Resend being the source of truth." That mitigation is real for *current subscription status* (Resend stays correct, so users won't actually be emailed against their will), so this is not an active CAN-SPAM violation — but the **audit/analytics trail silently develops holes** exactly when the DB is unhealthy.

Recommendation: return **5xx on the mutation failure** so Resend redelivers with the same `svix-id`; idempotency dedup (`by_svix_id`) makes retry safe and is the entire reason svixId is stored. The only thing that should swallow-and-200 is a *non-retryable* error (e.g., validation rejection of a malformed payload). Distinguish: 200 for "we understood and rejected the payload," 5xx for "we failed to persist." `recordError()` here is correct and present — good.

### C2 — `recordError` is awaited but its internal scheduling can still no-op silently
`v2/convex/lib/errorRecording.ts:58-84`
Both `scheduler.runAfter` calls are individually try/caught and downgraded to `console.error`. During the 2026-04-19 storm this is *intentional* (prevents recursive error cascades). But it means: if the scheduler itself is failing (the exact condition during an incident), the "guaranteed" admin email + Sentry report silently degrade to a console line that no human watches in Convex prod logs. Not a regression in this PR, but it is the backstop that C1 leans on ("we've logged it via recordError"), so the backstop is weaker than the comment implies. Worth noting; no change required if accepted as best-effort.

---

## IMPORTANT

### I1 — `email.received` inbound processing scheduled fire-and-forget, then 200
`v2/convex/http.ts:143-155` (pre-existing, in scope)
`ctx.runAction(internal.supportEmail.processInboundEmail, …)` is awaited only for *scheduling*; the action runs async. If that action later throws (Resend fetch of full body fails, store fails), the failure surfaces only inside `processInboundEmail`'s own handler. Confirm `supportEmail.processInboundEmail` calls `recordError` on its own failures — if it doesn't, an inbound support email can vanish with no admin signal and Resend already got its 200. (Outside the literal diff but the surrounding handler was rewritten in this PR.)

### I2 — Outer webhook catch returns 200 on ALL processing errors
`v2/convex/http.ts:156-170`
The top-level catch (`recordError` + return 200) covers `JSON.parse(rawBody)` failures and any unexpected throw. Returning 200 on a parse failure of a *signature-verified* body means a genuinely malformed Resend payload is silently accepted and never retried. `recordError` is present (good), but consider 400 for parse failures so the bad delivery is visible as a Resend-side delivery failure too. Low practical impact (svix already verified origin), but it's a broad catch that 200s real internal faults.

### I3 — `syncContacts` per-contact failures are console-only, not recorded
`v2/convex/marketingEmail.ts:227-251, 315-318`
`runWrite()` swallows every create/update/delete failure to `console.warn` and increments a `failed` counter returned in the summary string. No `recordError`. This is an `internalAction` run manually via CLI (`npx convex run … --prod`) and is **not** wired into `crons.ts`, so an operator watching the CLI output sees `N failed`. Acceptable as best-effort for a manual reconciliation tool — but if it is ever added to a cron, the `failed` count becomes invisible (no admin alert, no Sentry). Flagging now: either add `recordError` when `failed > 0`, or add a guard comment that this must stay manual-only. Same applies to `listAllResendContacts` throwing mid-pagination — it aborts the whole sync (correct, fail-loud) but only the CLI sees the throw.

### I4 — `getMarketingSubscriptionStatus` degrades a revoked API key to `null` ("not subscribed")
`v2/convex/marketingEmail.ts:122-137`
Non-404 Resend errors and thrown exceptions are `console.warn` + `return null`. The UI then renders the toggle as "not subscribed" indistinguishably from a genuinely-unsubscribed user. The docstring explicitly accepts this ("UI degrades to null rather than throwing"). The real defect: a revoked/expired `AUTH_RESEND_KEY` (the `getApiKey()` throw is caught here too) would make **every** user appear unsubscribed forever with zero admin signal — only console.warn lines no one reads. Recommend `recordError(ctx, "action", "marketingEmail.getStatus", …)` for the non-404 branch so an auth-key outage is surfaced, while still returning null to the UI.

---

## SUGGESTIONS

### S1 — ResendOTP / ResendPasswordReset blocklist skip is silent-by-design
`v2/convex/ResendOTP.ts:15-19`, `v2/convex/ResendPasswordReset.ts:15-18`
Returning early on a blocklisted recipient means the auth flow reports success while no OTP/reset is ever sent — the user sees "check your email" forever. This is intentional (comment: "matches the existing error-swallowing pattern") and the blocklist is a deliberate safety switch for one hardcoded address, so impact is contained. `console.warn` only; no `recordError`. Fine as-is given the single curated entry, but if the blocklist grows, a blocked legit user becomes an invisible support black hole.

### S2 — `email.ts` blocklist abort returns an `EmailBlocked` error object, relies on callers to log
`v2/convex/lib/email.ts:70-79`
Good pattern (returns structured error rather than throwing/swallowing). Just verify all 10 callers actually inspect `result.error` and `recordError` it — a caller that ignores the return value turns this into a silent drop. Not checked in this scope.

### S3 — `turnstile.ts` fail-open in non-production is correct; production path is fail-closed + logged
`v2/convex/turnstile.ts:36-86`
Well handled — missing key in prod → `console.error` + `{success:false}`; network/HTTP errors → logged + fail-closed. No `recordError`, but this returns an actionable error to the client and is an auth-adjacent pre-flight; console.error in prod is the only gap (a missing TURNSTILE key in prod deserves an admin alert, not just a log line).

### S4 — `systemErrors.record` rate-limit `.take(6)` change is a correctness improvement
`v2/convex/systemErrors.ts:44-57`
The diff replaces an unbounded `.collect()` with a bounded compound-index range + `.take(6)`. This is strictly better (prevents OCC storms). No silent-failure concern. Note: if `sendAdminNotificationEmail` scheduling itself fails it's unguarded here — but it's a `scheduler.runAfter` inside an internalMutation; a scheduler failure would roll back the row insert too, which is acceptable.

### S5 — `incidentCleanup.ts` best-effort batch loops are well-bounded, no silent data loss
`v2/convex/incidentCleanup.ts`
`maxIterations`/`maxTotal`/`maxUserBatches` caps + `stoppedReason` strings make partial completion *visible* in the return value. Skips are collected with reasons. `purgeAttackerUsersBatch` re-validates `isAttackerName` per row before delete (defense in depth — prevents ID smuggling). No swallowed errors; this is a manual incident tool. Good.

---

## Verdict
- **C1** is the one genuine actionable defect introduced by this PR: webhook 200-on-write-failure drops audit events that idempotent retry could have recovered. Switch the *internal-failure* branch (not the malformed-payload branch) to 5xx.
- Everything else is intentional best-effort with documented trade-offs; the main residual risk is **console-only logging where `recordError` would surface outages** (I3 if cron-wired, I4 revoked key, S3 missing prod key).
- Signature/parse verification itself is correctly fail-closed (401). `recordError` is present in the http.ts handler — the issue is the response code, not missing logging.
