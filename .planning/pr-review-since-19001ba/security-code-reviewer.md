# Security & Auth PR Review — since `19001ba`

**Reviewer:** security-code-reviewer (Claude Opus 4.7)
**Date:** 2026-05-24
**Scope:** Files in `_files-security.txt` (non-test source). Diffed `19001ba..HEAD`, read current files for full context, verified `@convex-dev/auth` runtime behavior and Vercel BotID model against package source + context7 docs.

Overall: this is a strong, well-documented hardening pass — layered defenses (per-email + per-IP + per-user rate limits, Turnstile, abuse blocklist, auto-suspend, admin ops dashboard), good fail-open/observability discipline, all admin Convex functions correctly gated with `requireAdmin()`, React auto-escaping makes the attacker-controlled dashboard strings XSS-safe, and ISO-date / `@/lib/toast` / central-lib conventions are respected. The findings below are mostly correctness gaps in the *new* abuse-detection feature plus a couple of pre-existing authz weaknesses surfaced by this security-focused diff.

Confidence scoring: only issues ≥80 reported.

---

## CRITICAL (90-100)

_None._ No auth bypass, secret exposure, injection, or IDOR found. Admin surface is server-side gated; ownership checks intact; rate-limiter keys don't collide; emails verbatim-stored but no privilege escalation.

---

## IMPORTANT (80-89)

### 1. Auto-suspend silently never fires for mixed-case emails — `getUserByEmail` lowercases lookup, `users.email` is stored verbatim
**Confidence: 88**
**Files:**
- `v2/convex/lib/auth.ts:171-181` (`getUserByEmail` — lowercases the lookup key)
- `v2/convex/auth.ts:155-159` (`createOrUpdateUser` inserts `email: args.profile.email` with NO normalization)
- Consumers: `v2/convex/abuseDetection.ts:69` (`recordAuthFailure`) and `:126` (`checkEmailSuspension`)

**Rationale:** I verified against the installed package (`node_modules/@convex-dev/auth/dist/providers/Password.js` `defaultProfile` returns `email: params.email`; `server/implementation/users.js` does not lowercase). Convex Auth stores the email with the casing the user typed. `getUserByEmail` queries `withIndex("email", q => q.eq("email", normalizedLowercase))`. For a user stored as `John@Example.com`, the lowercased lookup `john@example.com` does NOT match the index entry → returns `null`.

Impact on the new feature:
- `recordAuthFailure`: `getUserByEmail` → null → returns `{ suspended: false }`. **The headline auto-suspend protection never triggers** for any account whose stored email isn't all-lowercase.
- `checkEmailSuspension` (login gate): returns `{ suspended: false }` for the same accounts (fail-open, not dangerous, but the "locked account" UX never appears).
- Bonus (pre-existing, same root cause): the account-link lookup at `auth.ts:129` compares verbatim `email`, so `John@X.com` (password) and `john@x.com` (Google) would create duplicate accounts.

**Fix:** Normalize email to `trim().toLowerCase()` at the single write point in `createOrUpdateUser` before insert (and ideally backfill existing rows), OR drop the lowercasing in `getUserByEmail` and match the stored casing. The write-side normalization is the correct fix — it also closes the duplicate-account gap. Add a test with a mixed-case email asserting suspend + suspension-gate both fire.

---

### 2. `clearAuthRateLimit` lets any authenticated user clear ANY email's brute-force counter (missing email-ownership check)
**Confidence: 82** (pre-existing — body unchanged in this diff, but in scope and directly undermines the PR's brute-force hardening)
**File:** `v2/convex/authRateLimit.ts:169-174`

**Rationale:** The handler only checks `getCurrentUserIdOrNull(ctx)` (is *someone* logged in) and then calls `clearRateLimit(ctx, args.email.toLowerCase(), args.action)` for the **caller-supplied email** — there is no check that the email belongs to the authenticated user. A logged-in attacker (or a compromised/low-value account, or a stolen JWT) can repeatedly call `clearAuthRateLimit({ email: "victim@x.com", action: "login" })` to wipe the per-email login counter, defeating the 20/15-min cap and enabling sustained password brute-forcing of another account. The per-IP cap (500/hr) still applies, but a distributed attacker bypasses that too.

**Fix:** Resolve the authenticated user's own email (`ctx.db.get(userId)`), normalize, and only clear when `args.email` matches — or drop the `email` arg entirely and always clear the authenticated user's own counter. The login flow already calls this only after a successful sign-in for the user's own email, so restricting it is non-breaking.

---

### 3. Account-lockout-as-a-weapon: auto-suspend keys purely on per-email failure volume with no IP-distinctness
**Confidence: 80**
**File:** `v2/convex/abuseDetection.ts:37-107` (documented at `:5-9` "No per-IP distinctness check")

**Rationale:** Once an attacker knows a victim's email, they can deliberately fail logins until the per-email limit trips (20/15 min) and then accumulate 10 `auth_fail` rows in 30 min, causing `recordAuthFailure` to set `suspendedAt/suspendedUntil` for 24h. The victim is then shown "account temporarily locked" and cannot log in (a targeted DoS). This is the classic trade-off of email-keyed lockout. It is partially mitigated (24h auto-lift, support appeal, the high pre-trip threshold) and partially neutralized today by finding #1, but once #1 is fixed this becomes a live abuse vector.

**Fix:** Require the failures to span ≥2 distinct IPs (or a high distinct-IP count) before auto-suspending, or downgrade auto-suspend to a soft challenge (force Turnstile/extra OTP) instead of a hard 24h lock. At minimum, never reveal the auto-generated `reason` ("auto: N auth failures in 30min") to the unauthenticated `checkEmailSuspension` caller (`abuseDetection.ts:137`) — it leaks the lockout mechanics and confirms the email exists.

---

### 4. BotID `protect: ["/api/auth/*"]` is a no-op — no server-side `checkBotId()` on the auth path
**Confidence: 80**
**Files:** `v2/src/instrumentation-client.ts:129` (protects `/api/auth/*`); enforcement only exists in `v2/src/app/api/chat/route.ts:87`. `v2/src/proxy.ts` (which owns `/api/auth` via `convexAuthNextjsMiddleware`) never calls `checkBotId()`.

**Rationale:** Verified via context7 (`/vercel-labs/botid-nextjs-starter`) and the project's own `docs/SECURITY.md` (rows 1-5 list **Turnstile**, not BotID, as the auth-endpoint defense; only `/api/chat` rows 6-7 list BotID). Vercel BotID requires a server-side `checkBotId()` to read the verdict; the client `initBotId` only collects/attaches signals. Listing `/api/auth/*` in `protect` therefore collects signals that nothing consumes — dead config that implies a protection that isn't enforced. (Not a regression in real defense: Turnstile + per-IP + per-email + name-validation do guard auth. The risk is operational — someone reading `instrumentation-client.ts` believes BotID blocks auth bots when it does not.)

**Fix:** Either (a) remove `{ path: "/api/auth/*", method: "POST" }` from `initBotId` and rely on the documented Turnstile + rate-limit stack, or (b) add a `checkBotId()` gate for `/api/auth` POSTs inside `proxy.ts` before the rate-limit check (note: `@convex-dev/auth`'s middleware proxies this route, so verify `checkBotId()` works in the middleware/edge context before relying on it). Keep `instrumentation-client.ts` and `docs/SECURITY.md` in sync with whichever is chosen.

---

## SUGGESTIONS (51-79, surfaced because the PR materially raises load / improves observability)

### S1. `rateLimits` cleanup cron can't keep up with new volume — non-indexed filter + 100/hr cap
**Confidence: 70** (pre-existing inefficiency, not in changed-files scope, but the PR adds three new high-volume row sources: `ip_auth` 500/IP/hr, `ip_strike`, `auth_fail`)
**File:** `v2/convex/scheduledJobs.ts:1056-1059` (`cleanupRateLimits`)
The cleanup does `.query("rateLimits").filter(q => q.lt(q.field("timestamp"), cutoff)).take(100)` — a **full-table filter** deleting only 100 rows/hour, despite a `by_timestamp` index existing (schema comment literally says "For cleanup queries"). Under the new IP-rate-limit volume the table will grow faster than cleanup drains it; every `checkRateLimit`/`recordStrike`/`recordAuthFailure` does `.collect()` over a window, so unbounded growth degrades rate-limit latency. **Fix:** use `.withIndex("by_timestamp", q => q.lt("timestamp", cutoff))` and raise the batch size or self-reschedule when `take()` is saturated.

### S2. `checkIpRateLimit` treats `"unknown"` IP as a shared real bucket
**Confidence: 65**
**Files:** `v2/src/proxy.ts:54-57`, `v2/src/app/api/chat/route.ts:99-102` pass `"unknown"` when no `x-forwarded-for`; `normalizeIp("unknown")` returns `"unknown"` (truthy), so `checkIpRateLimit` does NOT hit the fail-open branch (`authRateLimit.ts:113`) and instead counts all unknown-IP traffic into one `ip_auth:unknown` / `ip_chat:unknown` bucket. On Vercel this is rare (edge always sets the header), but if it ever occurs all such users share one 500/hr (or 120/min) allowance and can be collectively locked out, or an attacker can dodge per-IP limits by forcing an empty header. **Fix:** treat literal `"unknown"` as the fail-open case (skip enforcement) rather than a real key, or hard-fail the request when no trustworthy IP is present. Also note (already documented in `proxy.ts:51-53`) `x-forwarded-for` is spoofable off-Vercel.

### S3. Minor consistency: `findActiveBlock` excludes `expiresAt <= now` while `cleanupExpiredBlocks` deletes `expiresAt < now`
**Confidence: 55**
`v2/convex/abuseBlocklist.ts:51` vs `:209`. Negligible (a row expiring at the exact ms boundary). No action required; noted for completeness.

---

## Verified-good (explicitly checked, no issue)

- All `adminSecurity.ts` / `abuseBlocklist.ts` admin functions call `requireAdmin(ctx)` server-side; the client `isAdmin` gate is UX-only. No IDOR.
- `cases.update` rate-limit keyed on `caseDoc.userId` is safe — `verifyOwnership` runs first, so it always equals the caller.
- Rate-limiter keys are namespaced (`ip_auth:`, `ip_strike:`, `auth_fail:`, `<action>:<email>`) — no cross-contamination of counts.
- Dashboard renders attacker-controlled `ip`/`reason`/`email` via JSX text nodes → React-escaped, no XSS.
- `EMAIL_RE` (`signup-validation.ts:27`) is linear, no ReDoS.
- Turnstile fail-closed in prod / fail-open in dev (`turnstile.ts:37-44`); token presence checked; secret only read server-side, never returned.
- Telemetry payloads carry only structural reason codes, never email/name/password (`auth-telemetry.ts`).
- ISO-date protocol, `@/lib/toast`, central-lib imports, named exports, soft-delete filters all respected. No `??`-dense expressions introduced.
- `instrumentation-client.ts` correctly consolidates PostHog + BotID in the single `src/` file with per-initializer try/catch (the documented prior outage fix).
