# Email + Convex Backend Code Review — since 19001ba

**Reviewer:** email-convex-code-reviewer (Opus 4.7)
**Scope:** `_files-email.txt` + `_files-convex.txt` non-test files. Diff base `19001ba`, HEAD `13b0d7d`.
**Method:** read current files + `git diff 19001ba..HEAD`; cross-checked callers, schema indexes, auth lib, CLAUDE.md (root + v2) + CONVENTIONS/CONCERNS.

---

## CRITICAL

### C1. IDOR — `getMarketingSubscriptionStatus` / `updateMarketingSubscription` trust client-supplied `email`
**File:** `v2/convex/marketingEmail.ts:109-164` (callers: `src/components/settings/NotificationPreferencesSection.tsx:243,251`)
**Confidence: 92**

Both are public `action`s. They check `ctx.auth.getUserIdentity()` (i.e. *any* authenticated user) but accept an arbitrary `email` arg and operate on it directly against the Resend Contacts API — they never verify the email belongs to the caller.

- `updateMarketingSubscription({ email: "victim@firm.com", subscribed: false })` lets any logged-in user **unsubscribe (or resubscribe) any contact in the Resend audience** by email. This is a write-side IDOR with CAN-SPAM / deliverability impact.
- `getMarketingSubscriptionStatus({ email: "victim@firm.com" })` discloses whether an arbitrary email is a contact and its subscription state (enumeration / info leak).

The frontend happens to pass the user's own `userEmail`, but the server is the trust boundary and performs no ownership check. Per project memory, `identity.email` is empty for password auth — but the fix is still server-side: resolve the caller's own email from their user record, ignore/validate the client arg.

**Fix:** In both handlers, `const userId = await getCurrentUserId(ctx); const me = await ctx.runQuery(... or ctx.db.get(userId))`; compare `normalizeEmail(args.email) === normalizeEmail(me.email)` and throw on mismatch (or drop the `email` arg entirely and derive it server-side). Note these run in a `"use node"` action, so the user lookup must go through an `internalQuery` (e.g. add one to `marketingEmailHelpers.ts`) rather than `ctx.db` directly.

---

## IMPORTANT

### I1. Webhook can silently lose CAN-SPAM unsubscribe events; `occurredAt` NaN path
**File:** `v2/convex/http.ts:85-110`
**Confidence: 80**

Two related robustness gaps in the verified-webhook path:
- If `body.created_at` is an unparseable string, `new Date(body.created_at).getTime()` is `NaN`. `marketingEvents.occurredAt` is `v.number()`, which **rejects NaN**, so `recordContactEvent` throws. http.ts catches it, returns 200, and Resend never retries — the event is dropped. Guard: `const t = Date.parse(body.created_at); occurredAt: Number.isFinite(t) ? t : Date.now()`.
- The catch-and-return-200 on `recordContactEvent` failure is documented as a deliberate trade-off, but for `contact.deleted`/unsubscribe specifically the comment itself flags a legal risk. Consider returning a non-2xx for transient (vs. validation) write failures so Resend retries on the dedup-safe path, since `recordContactEvent` is idempotent on `svixId`.

(Not raised as critical: svix `wh.verify` enforces the 5-min timestamp tolerance and signature internally — replay protection + idempotency via `by_svix_id` are correct.)

---

## SUGGESTIONS

- **S1 — `marketingEmail.ts:130`** `getMarketingSubscriptionStatus` returns `data.unsubscribed === false`; a contact missing the field would read as `false` (treated "not subscribed"). Minor; Resend always returns it.
- **S2 — `incidentCleanup.ts:107-111`** `cancelJobsByIds` casts through `as unknown as never` / hand-rolled `ctx.db.system.get` typing to work around system-table Id typing. Functionally re-validates name + pending state against the allow-list before cancel (good), but the cast is a maintainability smell — one-off incident tool, acceptable.
- **S3 — `http.ts:118`** Non-contact, non-`email.received` events return `{ignored:true}` 200 — fine, but note Resend `email.*` delivery events (bounced/complained) silently ignored; if you later want bounce suppression, that's the hook.
- **S4 — `nameValidation.ts:43` / `incidentCleanup.ts:29`** Two separate URL/attacker regexes plus the client mirror (`src/lib/nameValidation.ts`) must stay in lockstep by hand. Comment says so, but it's drift-prone. Low priority.

---

## STRENGTHS

- **Auth attack-surface reduction is correct and verified:** `apiUsage.getUsage`/`getDailyLimits` and `knowledge.getIngestionStatus` flipped `query`→`internalQuery` with **zero broken callers** (webSearch uses `getUsageInternal`/`DAILY_LIMITS`; `getIngestionStatus` unused). `knowledge.searchKnowledge` + `cases.create/update`, `jobDescriptionTemplates.create`, `userCaseOrder.saveCaseOrder`, `notifications.markAllAsRead` all gained per-user `rateLimiter.limit(..., {throws:true})` keyed on the authenticated user — good compromised-JWT mitigation.
- **`systemErrors.record` OCC fix is correct:** `by_resolved` index is `["resolved","createdAt"]`, so the compound range `eq(false).gte(createdAt)` + `.take(6)` is index-backed and bounds reads to 6 docs. The `<= 5` notify gate still behaves correctly (6th row present ⇒ skip).
- **Webhook security is sound:** svix signature verified before any processing; idempotency via `by_svix_id`; size caps on all user-supplied fields + `rawPayload.slice(0,10_000)`; backfill uses stable `backfill_<id>` svixId for true no-op reruns.
- **Blocklist is defense-in-depth & centralized:** enforced in `sendEmailWithRetry` (to/cc/bcc), both direct `ResendOTP`/`ResendPasswordReset` paths, and both sync/backfill marketing paths. Case-insensitive + trimmed. Hardcoded-for-review rationale is sound.
- **Pagination correct everywhere:** `listAllUsers` (`.paginate`), `listAllResendContacts` (cursor loop), `incidentCleanup` list/purge all batch with `.take`/`.paginate` + bounded iteration caps — no unbounded `.collect()` introduced. `purgeAttackerUsersBatch` re-validates `isAttackerName` per-row before delete (can't delete clean accounts by ID).
- **ISO-date protocol & central-perm-lib respected:** perm calculator diffs (`recruitment.ts`, `rfi.ts`, `constants.ts`) are comment-only (removed stale doc refs) — no logic touched. `marketingEvents` uses epoch-ms `occurredAt`, consistent with other event tables.
- **`suspension.ts` helper** cleanly collapses the 3-field triplet into one typed view and is actually consumed (`abuseDetection.ts`, `adminSecurity.ts`) — no dead code.
