# Security & Auth — Silent Failures / Inadequate Error Handling Audit

**Scope:** Files in `_files-security.txt`, changes since `19001ba`.
**Date:** 2026-05-24
**Method:** Read current files + `git diff 19001ba..HEAD`, verified BotID/Turnstile/Convex runtime semantics against installed package source.

Legend: **CRITICAL** = silent failure / unjustified security fail-open / hidden broad catch. **IMPORTANT** = poor surfacing, fail-open with thin observability, or user-stranding UX. **SUGGESTION** = polish.

---

## CRITICAL

### C1. OTP / password-reset email send failures are swallowed — user is stranded with no code and no error
**Files:** `convex/ResendOTP.ts:32-39`, `convex/ResendPasswordReset.ts:31-37`

```ts
const { error } = await resend.emails.send({ ... });
if (error) {
  // Log but don't throw — the verification token is already stored in the DB.
  console.error(`[ResendOTP] Failed to send verification email to ${email}:`, error.message);
}
```

**Issue:** When Resend rejects the send (domain/key/quota/recipient issue), the function logs to `console.error` and returns normally. The auth flow then advances the client to the "enter your 12-char code" screen — but no email was ever delivered. The user waits for a code that will never arrive, with zero on-screen indication anything failed.

- **No Sentry / `recordError`.** `console.error` in a Convex action is not captured by the project's `recordError()` pipeline (DB + admin email + Sentry). A sustained Resend outage during signup is therefore invisible in the error dashboard — exactly the "debug it 6 months from now" nightmare. CLAUDE.md mandates backend errors go through `recordError()` from `convex/lib/errorRecording`.
- **Justification is partially valid but incomplete.** The comment is right that *throwing* surfaces an opaque Convex "Server Error" and is worse. But the correct fix is not "swallow silently" — it is "swallow the throw, **capture to Sentry/recordError**, and ideally signal a soft warning to the client" (e.g., a flag the client can use to show "Having trouble sending? Retry"). Right now it does neither.
- **Pre-existing, but reinforced in-window.** The `if (error)` swallow predates `19001ba`. The in-window change (`feat(email): hardcoded email blocklist`, commit `66a9a22`) *added* a second silent early-`return` (`isEmailBlocked` → `console.warn` → return) that explicitly cites "matches the existing error-swallowing pattern" — propagating the anti-pattern. For blocklisted recipients silence is intentional (correct), but the generic send-failure swallow needs observability.

**Hidden errors this masks:** Resend API key invalid/rotated, sender domain unverified, Resend 5xx/quota, malformed recipient, `render()` throwing on a bad template prop (this one isn't even in the `if (error)` branch — a `render()` throw would propagate as opaque Server Error).

**User impact:** Cannot complete signup or password reset; sees a code-entry form forever; "resend by retrying" only works if the failure was transient. Support gets "I never got my code" tickets with no server-side breadcrumb to correlate.

**Recommendation:** Keep the no-throw behavior, but route the failure through `recordError(ctx, "action", "ResendOTP.send", error, { emailHash })` (hash, don't log raw email) so it lands in Sentry + admin email. Consider returning a soft-fail signal the client can surface as "We had trouble sending your code — tap retry."

---

## IMPORTANT

### I2. Login Turnstile verification fails OPEN on service error — bot-mimic/replay protection silently disabled
**File:** `src/app/(auth)/login/LoginPageClient.tsx:152-169`

```ts
if (turnstileToken) {
  try {
    const verifyResult = await verifyTurnstile({ token: turnstileToken });
    if (!verifyResult.success) { /* reject */ }
  } catch (verifyError) {
    captureTurnstileServiceError(verifyError, "login");
    // Fail open — login shouldn't be blocked by a Cloudflare outage.
    console.warn("[Login] Turnstile verify threw; proceeding without check");
  }
}
```

**Issue (security implication, INTENTIONAL fail-open):** On a *thrown* verify error the login proceeds without server-side Turnstile validation. This is a deliberate availability-over-strictness tradeoff and it **is** instrumented (`captureTurnstileServiceError` → Sentry). That is the right call for login (interaction-only widget, password still required, per-email + per-IP rate limits remain). Flagging because:
- The fail-open only triggers when the action *throws* (network/5xx). A token that exists but Cloudflare *rejects* (`success:false`) still hard-blocks — good.
- Note the asymmetry vs signup/reset (I3): those fail **closed** on the same throw. The divergence is defensible (login has a second factor — the password) but should be a documented, deliberate policy, not an accident. It currently reads as deliberate.

**Recommendation:** No code change required; keep. Optionally add a `trackTurnstileFail("login","service_error")` on this throw path too (it's only tracked on the `onError` widget callback, not on the verify-throw) so the fail-open rate is measurable in PostHog, not just Sentry.

### I3. `verifyTurnstileToken` action fail-open in dev is fine; but the prod-missing-key path returns a generic error that callers translate into a hard block — verify intended
**File:** `convex/turnstile.ts:36-44`, callers `SignupPageClient.tsx:177-193`, `ResetPasswordPageClient.tsx:129-145`

The action correctly **fails closed in production** when `TURNSTILE_SECRET_KEY` is missing (`console.error` + `success:false`). Good — and signup/reset callers treat `success:false` as a hard stop with a user toast. Two notes:
- The prod-missing-key branch uses `console.error`, not `recordError`/Sentry. A misconfigured prod deploy (key dropped) would silently block **all** signups/resets with only a Convex log line — no alert. Given this is a total-conversion-killing misconfig, it deserves `captureError`/`recordError`, not `console.error`.
- The siteverify HTTP-error and throw branches (`turnstile.ts:62-65, 83-86`) also only `console.warn`/`console.error`. A sustained Cloudflare outage → every signup blocked with no Sentry signal. Recommend capturing the throw/HTTP-error branches.

### I4. `checkEmailSuspension` failure on login is swallowed with `console.warn` only — no Sentry
**File:** `src/app/(auth)/login/LoginPageClient.tsx:142-146`

```ts
} catch (suspensionError) {
  // Fail open — availability trumps strict enforcement here
  console.warn("[Login] suspension check failed:", suspensionError);
}
```

**Issue:** Fail-open is justified (rate limit still guards brute force), but unlike the rate-limit and Turnstile fail-opens elsewhere in this same file, this one has **no `captureError` and no breadcrumb** — only `console.warn`. If the suspension query starts throwing (schema drift, `getUserSuspension` bug), auto-suspension enforcement is silently bypassed at the login gate and nobody is paged. Auto-suspend is a security control; its enforcement gate failing open should be observable.

**Recommendation:** Add `captureError(suspensionError, { operation: "checkEmailSuspension" })` (or at least an `addBreadcrumb`) alongside the `console.warn`, matching the pattern the file already uses for `enforceRateLimit`.

### I5. Chat-route per-IP rate-limit fail-open uses `console.warn` only — no Sentry/breadcrumb (inconsistent with proxy.ts)
**File:** `src/app/api/chat/route.ts:117-121`

```ts
} catch (ipError) {
  // Fail open on rate-limit service error
  console.warn(`[Chat API] [${sessionId}] IP rate-limit check failed, allowing:`, ipError);
}
```

**Issue:** `proxy.ts:76-87` does the equivalent fail-open but emits a Sentry breadcrumb so sustained fail-open is visible. The chat route — which guards the most expensive resource (AI provider quotas) — fails open with `console.warn` only. If `checkIpRateLimit` starts erroring, the AI-cost rate limiter is silently disabled with no observability, defeating its purpose during exactly the incident it exists for.

**Recommendation:** Mirror `proxy.ts`: emit `addBreadcrumb({ category: "chat.rate_limit", level: "warning", ... })` (not full `captureError` — would be noisy in a Convex outage, same rationale already documented in proxy.ts).

### I6. `recordStrike` / `recordAuthFailure` run un-wrapped inside the enforcing mutation — a throw there breaks the legit rate-limit response
**Files:** `convex/authRateLimit.ts:73-78` (recordAuthFailure), `:142-147` (recordStrike)

```ts
if (!result.allowed) {
  await ctx.runMutation(internal.abuseBlocklist.recordStrike, { ip, reason });
}
```

**Issue (not a silent failure — the opposite):** These side-effect mutations are awaited but not try-wrapped, and run in the same transaction as the rate-limit check. If `recordStrike`/`recordAuthFailure` throws (e.g., `sendAdminNotificationEmail` scheduling fails, or a write conflict), the *entire* `checkIpRateLimit`/`checkAuthRateLimit` mutation rolls back and throws to the caller. The caller (proxy.ts / chat route / form `enforceRateLimit`) then hits its own catch and **fails open** — so a bug in the abuse-bookkeeping path silently converts a *rejection* into an *allow*. That's an indirect fail-open hiding behind the strike recorder.

**Hidden errors masked:** scheduler failure in `recordAuthFailure` (`sendAdminNotificationEmail`), OCC write conflict on `rateLimits`/`abuseBlocklist` under load (the exact high-traffic abuse scenario), `getUserByEmail`/profile lookup throw.

**Recommendation:** Wrap the strike/failure recording in try/catch with `recordError`, so a bookkeeping failure is logged but does NOT roll back (and thereby invert) the rate-limit verdict. The verdict (`result.allowed`) is the security-load-bearing value and must be returned even if the audit write fails.

---

## SUGGESTIONS

### S7. Fire-and-forget mutations log to console only, never Sentry
**Files:** `LoginPageClient.tsx:180-184, 239`, `SignupPageClient.tsx:211, 274`
`clearRateLimitMut(...).catch(console.warn)` and `recordMyLogin().catch(console.warn)`. Benign (login already succeeded), but a persistently failing `recordMyLogin` (login-tracking telemetry) would be invisible. Consider `captureError` at low sample rate or a breadcrumb.

### S8. BotID init try-wrap claim is CORRECT — verified, no action
**File:** `src/instrumentation-client.ts:118-140`. Verified against `botid@1.5.11` server source: in production `checkBotId()` calls Vercel's API and returns `isBot:true` when the client collected no signals (init failed) → server route returns 403. The "rejecting is the correct behavior on init failure" comment is accurate. If OIDC token is missing in prod, `checkBotId()` *throws* → lands in chat route's outer catch (`route.ts:412`) → 500 + `captureError` = fails **closed**, observable. Both BotID failure modes are safe. No issue.

### S9. PostHog `before_send` exception-dropping is a deliberate allowlist, not silent swallowing
**File:** `src/instrumentation-client.ts:36-90`. Returning `null` drops known browser-extension/stale-deploy/chunk-load noise from PostHog exception capture. This is intentional noise reduction with explicit, narrow string matches — acceptable. Watch that the `Load failed|Failed to fetch` exact-match drop (line 71) doesn't mask genuine app fetch failures; it's anchored (`^...$`) so it only drops bare messages, which is reasonably safe.

### S10. PostHog/localStorage empty catches are benign
**Files:** `instrumentation-client.ts:92-99` (PostHog init), `SecurityIncidentBanner.tsx:43, 77` (localStorage). Empty/`console.warn` catches around storage-blocked / privacy-mode browsers. UI-only, fail-safe defaults, no security or data impact. Acceptable.

### S11. `checkEmailSuspension` is an intentional account-existence oracle (documented)
**File:** `convex/abuseDetection.ts:109-141`. The query's own comment acknowledges it leaks whether an email has a profile and bounds the risk. Documented tradeoff, not an accidental leak. Note for completeness only.

---

## Verified-OK (no finding)

- **`proxy.ts:76-87`** per-IP fail-open: intentional, instrumented with Sentry breadcrumb, documented rationale. Correct.
- **`rateLimit.ts:91-92`** `resetInMs` uses `attempts[0]` — verified the `by_key_and_timestamp` index returns ascending, so `attempts[0]` IS the oldest in-window attempt. Math is correct.
- **`checkIpRateLimit` unknown-IP fail-open** (`authRateLimit.ts:112-119`): returns `{allowed:true, remaining:0}`; the `remaining:0` signal is deliberately chosen so callers don't cache bogus headroom. Documented, sound.
- **`abuseBlocklist` / `adminSecurity` admin mutations**: all gated by `requireAdmin(ctx)`; `throw new Error` on not-found is correct propagation (surfaces to admin UI). No swallowing.
- **`signUp` / verification / reset catch ladders** (Signup/Reset clients): structured message-matching with a final `captureError` + generic toast for unrecognized errors — the unknown branch is captured, not swallowed. Good.
- **Reset-email step** (`ResetPasswordPageClient.tsx:169-176`): the catch-all that shows the neutral success message is an intentional email-existence anti-enumeration measure (and skips Sentry only for the *expected* InvalidAccountId case). Correct security posture.
