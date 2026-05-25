# Research Notes — PR Review Implementation Questions

**Date:** 2026-05-24
**Stack:** Next.js 16.2 / Convex 1.35 / Vercel AI SDK v6.0.191 / @convex-dev/auth / svix
**Method:** WebSearch + WebFetch against primary docs and source code. (context7 MCP was declared in the session but its tools were not reachable via ToolSearch, so all findings below are from official docs / GitHub source — primary sources, higher confidence than context7 summaries.)

---

## Q1. Correct client-IP extraction on Vercel

### Ground truth (from Vercel docs, last updated 2025-12-13)

On Vercel, **the platform overwrites `x-forwarded-for` and does not forward external/upstream IPs by default**. The exact wording:

> "If you are trying to use Vercel behind a proxy, we currently overwrite the `X-Forwarded-For` header and **do not forward external IPs**. This restriction is in place to prevent IP spoofing."

This is the crux: on Vercel, `x-forwarded-for` is **not** the classic untrusted client-controlled chain. Vercel's edge sets it to the real public client IP it observed at its own edge. The values are equivalent across:
- `x-forwarded-for` — public IP of the client (Vercel-set)
- `x-vercel-forwarded-for` — "identical to `x-forwarded-for`" (Vercel's own copy; survives even if a proxy on top of Vercel overwrites `x-forwarded-for`)
- `x-real-ip` — "identical to the `x-forwarded-for` header"

### Why the leftmost `x-forwarded-for` hop is spoofable *in general* (and the Vercel nuance)

In a generic Node/Express setup, `x-forwarded-for` is a client-appendable, comma-separated list `client, proxy1, proxy2`. An attacker can send `X-Forwarded-For: 1.2.3.4` and your app, naively taking the **leftmost** value, trusts attacker-controlled input → rate-limit bypass. The trusted hop is the **rightmost** value *added by infrastructure you control*, not the leftmost.

**On Vercel specifically**, because Vercel overwrites the header at its edge, the value you read is Vercel-attested (the IP Vercel saw). The leftmost-spoofing problem only re-emerges if:
1. You put **another proxy/CDN in front of Vercel** (e.g., Cloudflare → Vercel). Then the front proxy can set `x-forwarded-for` before Vercel, and the only Vercel-attested value is `x-vercel-forwarded-for`. For a custom `X-Forwarded-For`, Vercel requires the **Trusted Proxy** (Enterprise) feature.
2. You parse `x-forwarded-for` yourself and naively `.split(",")[0]` — fine on bare Vercel, but brittle and unsafe the moment a fronting proxy is added.

### Recommended trusted method: `@vercel/functions` `ipAddress(request)`

The official helper. Exact API (Vercel docs, last updated 2026-01-23):

```ts
import { ipAddress } from '@vercel/functions';
// signature: ipAddress(request: Request): string | undefined
const ip = ipAddress(request);
```

> "Returns the IP address of the request from the headers."

It reads Vercel's attested headers internally (the same value as `x-forwarded-for` / `x-real-ip` on Vercel) and returns `string | undefined`. This is the recommended, version-stable way — it insulates you from header-name churn. Already a transitive dep on Vercel projects.

### Recommended ONE shared `getClientIp()` util

Works in both route handlers and proxy/middleware because both receive a `Request` (Web `Request` / `NextRequest`). `ipAddress()` accepts any `Request`.

```ts
// src/lib/getClientIp.ts
import { ipAddress } from '@vercel/functions';

/**
 * Trusted client IP on Vercel. Reads Vercel-attested IP headers via the
 * official @vercel/functions helper (equivalent to x-forwarded-for /
 * x-real-ip on Vercel, which Vercel overwrites at its edge to prevent
 * spoofing). Returns undefined when no IP is available (local dev, etc.).
 *
 * NOTE: If a proxy/CDN is ever placed IN FRONT of Vercel (e.g. Cloudflare),
 * x-forwarded-for becomes attacker-influenceable and only
 * x-vercel-forwarded-for stays Vercel-attested. In that case enable Vercel's
 * Trusted Proxy (Enterprise) feature rather than parsing XFF manually.
 */
export function getClientIp(request: Request): string | undefined {
  // Primary: official helper, Vercel-attested.
  const fromHelper = ipAddress(request);
  if (fromHelper) return fromHelper;

  // Fallback for local dev / non-Vercel runtimes only.
  // On Vercel these headers ARE the trusted values; off-Vercel they are NOT
  // trustworthy, but local dev has no real client IP to protect anyway.
  const vercelXff = request.headers.get('x-vercel-forwarded-for');
  if (vercelXff) return vercelXff.split(',')[0]?.trim() || undefined;

  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || undefined;

  return request.headers.get('x-real-ip') ?? undefined;
}
```

Identical call site in a route handler **and** in `proxy.ts`/middleware:
```ts
const ip = getClientIp(request); // request: Request | NextRequest
```

Notes for the implementer:
- Next.js 16 removed `request.ip` and `request.geo` long ago — `@vercel/functions` `ipAddress()`/`geolocation()` are the supported replacements.
- Do **not** trust leftmost `x-forwarded-for` if you ever front Vercel with another CDN. For rate-limiting keys on bare Vercel, `ipAddress(request)` is correct and sufficient.
- Per the project's SWC-minifier anti-pattern (CLAUDE.md), avoid `??`-heavy chains; the fallback above uses a small number and could be rewritten with `||` if it grows.

**Confidence: HIGH** for bare-Vercel. **MEDIUM** caveat: if a fronting proxy exists, only `x-vercel-forwarded-for` + Trusted Proxy is safe.

Sources:
- https://vercel.com/docs/headers/request-headers
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package
- https://vercel.com/docs/security/reverse-proxy
- https://httptoolkit.com/blog/what-is-x-forwarded-for/

---

## Q2. `import { after } from 'next/server'` (Next.js 16)

### Ground truth (Next.js docs, version 16.2.6, last updated 2026-05-19)

`after` schedules a callback to run **after the response (or prerender) is finished**. Stable since v15.1.0 (was `unstable_after` in 15.0-rc).

```ts
import { after } from 'next/server';
```

### Where it can be called
Server Components (incl. `generateMetadata`), **Server Functions / Server Actions**, **Route Handlers**, and **Proxy** (Next.js 16's middleware file is `proxy.ts`). Per `@vercel/functions` docs, also usable in Middleware.

### Exact usage in a Route Handler (the fire-and-forget summarization case)

```ts
import { after } from 'next/server';

export async function POST(request: Request) {
  // ... produce + return the user-facing response first ...
  const response = Response.json({ status: 'success' });

  after(async () => {
    // runs AFTER the response is sent; does not block it
    await summarizeConversation(/* ... */);
  });

  return response;
}
```

### Does it respect `maxDuration`? — YES

> "`after` will run for the platform's default or configured max duration of your route. If your platform supports it, you can configure the timeout limit using the `maxDuration` route segment config."

Mechanism on Vercel: `after` is implemented on top of `waitUntil(promise)`, which extends the serverless invocation lifetime until the promise settles. **Promises passed to `waitUntil` share the same timeout as the function** — if the function times out, the promise is cancelled. So `after` work counts against `maxDuration`; set `export const maxDuration = N` on the route if the background work is non-trivial.

### How it differs from a detached/floating promise
- A bare `doWork()` (no await, no `after`) is **not guaranteed to run** on serverless — the runtime can freeze/kill the instance the moment the response is flushed. `after`/`waitUntil` explicitly extends the invocation so the work actually completes.
- `after` runs **even if the response did not complete successfully** — including when an error is thrown, or `notFound()`/`redirect()` is called.
- `after` integrates with the Next.js request lifecycle (you can use `cookies()`/`headers()` inside it in Route Handlers & Server Functions; see below).

### Request-API caveat (important)
- **Route Handlers + Server Functions:** you CAN call `cookies()` and `headers()` *inside* the `after` callback.
- **Server Components (pages/layouts/`generateMetadata`):** you CANNOT call `cookies()`/`headers()` inside `after` — it throws at runtime. Read the values *before* `after` and close over them.

Other good-to-knows: `after` is **not** a request-time/dynamic API (calling it does not force a route dynamic); can be nested; use React `cache` to dedupe calls inside it. On Vercel/Node server/Docker it's supported; **not** supported on static export.

**For the fire-and-forget summarization use case: `after` in the route handler is the correct, reliable primitive** — superior to a detached promise, and bounded by `maxDuration` (bump it if summarization is slow).

**Confidence: HIGH.**

Sources:
- https://nextjs.org/docs/app/api-reference/functions/after
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package (waitUntil / after guidance)

---

## Q3. Vercel AI SDK v6 — `onFinish`/error semantics (don't persist corrupted turns)

Two distinct callbacks, two layers. Field names below are exact per AI SDK v6 docs.

### Server: `createUIMessageStream({ onFinish, onError })`

`onFinish({ messages, isContinuation, isAborted, responseMessage, finishReason })`:
- `messages: UIMessage[]` — full message array after completion
- `isContinuation: boolean`
- **`isAborted: boolean`** — stream was aborted (client `stop()` / server abort signal)
- `responseMessage: UIMessage` — the final assistant message
- `finishReason: FinishReason | undefined` — `"stop" | "length" | ...`

**Server-side persistence guard:** persist in `createUIMessageStream`'s `onFinish` (or `toUIMessageStreamResponse`'s `onFinish`) and gate on `!isAborted` and a non-error `finishReason`:
```ts
onFinish: ({ responseMessage, isAborted, finishReason }) => {
  if (isAborted) return;                 // do NOT persist aborted turn
  if (finishReason === 'error') return;  // do NOT persist errored turn
  await saveAssistantMessage(responseMessage);
}
```

`onError: (error: unknown) => string`:
- Its **return value is the error string surfaced to the client** as an error part on the stream (this is the correct way to send an error to the client **instead of** injecting it as assistant `text`). Default behavior masks errors as `"An error occurred"` for safety; override `onError` to return a sanitized message.
- KNOWN GOTCHA: there are open reports that `createUIMessageStream`'s `onError` return value is sometimes ignored, and `onFinish`/`onError` not firing in certain server stream compositions (GitHub issues #8393, #8713). Verify against your exact 6.0.191 behavior in a test.
- Throwing inside `onData` triggers `onError` and prevents the message being appended.

### Client: `useChat({ onFinish, onError })`

`onFinish({ message, messages, isAbort, isDisconnect, isError, finishReason })`:
- `message: UIMessage` — the completed assistant message
- `messages: UIMessage[]` — full history
- **`isAbort: boolean`** — user called `stop()`
- **`isDisconnect: boolean`** — network/connection lost
- **`isError: boolean`** — an error occurred during streaming
- `finishReason?: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other'`

**Client-side persistence guard (mirror of server):**
```ts
onFinish: ({ message, isAbort, isDisconnect, isError }) => {
  if (isAbort || isDisconnect || isError) return; // skip corrupted turn
  persist(message);
}
```

`onError: (error: Error) => void` — surface stream errors to UI here (toast/banner). This is the right channel for client error display — do NOT render the error as assistant message text.

### Correct way to surface a stream error WITHOUT injecting it as assistant text
1. **Server:** return a sanitized string from `createUIMessageStream`'s `onError` → emitted as a structured **error part**, not text.
2. **Client:** read it via `useChat`'s `onError` (and/or the `error` value from the hook) and render it as UI chrome (banner/toast), separate from message content.
3. Use the `isAbort`/`isDisconnect`/`isError` (client) and `isAborted`/`finishReason==='error'` (server) flags to skip persistence so a partial/garbage assistant message is never written.

### Known issues to watch (v6, as of early-2026)
- `onFinish`/`onError` not firing with some `createUIMessageStream` server compositions (#8713).
- Server-side abort signal from client `stop()` only detected after stream completion in some setups (#9707) — abort detection is post-hoc, so rely on `isAborted` in `onFinish`.
- `onFinish` only returning `message` (not `messages`/flags) in some versions (#9307) — verify shape on 6.0.191.
- `createUIMessageStream` `onFinish` fails for tool-approval flows when `originalMessages` is omitted (#12622) — pass `originalMessages` if using tool approval.
- Don't combine `resume: true` with abort — they conflict.

**Confidence: HIGH** on field names/semantics; **MEDIUM** on edge-case firing reliability (several open bugs) — recommend a small integration test asserting the flags fire on 6.0.191.

Sources:
- https://ai-sdk.dev/docs/reference/ai-sdk-ui/create-ui-message-stream
- https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
- https://ai-sdk.dev/docs/advanced/stopping-streams
- https://github.com/vercel/ai/issues/8393, /8713, /9307, /9707, /12622

---

## Q4. @convex-dev/auth email handling (Password + Google)

### Ground truth from source (`get-convex/convex-auth` `src/providers/Password.ts`, main)

**No normalization. Email is stored verbatim, and email IS the account id.** Confirmed from source:

```ts
function defaultProfile(params) {
  return { email: params.email as string };   // verbatim, no toLowerCase
}
// ...
account: { id: email, secret }                // account id === the email string
const provider = config.id ?? "password";
```

So:
- The Password provider does **not** lowercase/trim email anywhere by default.
- The **account `id` is the raw email** → `"Adam@x.com"` and `"adam@x.com"` are two distinct accounts/credentials.
- `profile()` is called for every flow ("signUp", "signIn", "reset", "reset-verification", "email-verification") and its returned `email` is what gets written to the user document.

### Where email is written in THIS repo (confirmed by reading `convex/auth.ts`)
- `profile()` returns `params.email as string` verbatim (line 71) — no normalization.
- `createOrUpdateUser` does the email-based account-linking lookup with an **exact, case-sensitive** index match (line 130): `q.eq("email", email)`.
- New users are inserted with `email: args.profile.email` verbatim (line 158).

### CRITICAL implication (this is a real bug surface for the PR)
Because the lookup is exact-case and email is stored verbatim:
- Sign up with `Adam@Gmail.com` (Password) then Google OAuth returns `adam@gmail.com` → the `withIndex("email", q.eq("email", "adam@gmail.com"))` lookup **misses** the existing `Adam@Gmail.com` user → **a duplicate account is created**, defeating the entire purpose of the linking callback.
- This is exactly the "two separate accounts" problem the callback's own doc comment says it's preventing — but it only works when casing matches.

### Safe way to normalize on write (without breaking provider linking)

Normalize in BOTH places so the stored value and the lookup agree, and so the Password account `id` is also normalized:

1. **Password `profile()`** — lowercase + trim there so the account `id` (= email) and the stored email are normalized at the source:
```ts
profile(params) {
  const email = (params.email as string).trim().toLowerCase();
  const validatedName = validateUserName(params.name as string | undefined);
  return { email, name: validatedName || undefined };
}
```
2. **`createOrUpdateUser`** — normalize the incoming `args.profile.email` before the index lookup AND before insert, so Google (which may return any casing) matches the normalized stored value:
```ts
const email = args.profile.email?.trim().toLowerCase();
// ...withIndex("email", q => q.eq("email", email))...
// ...insert(... email ...) using the normalized value
```

Why this is safe for linking: Convex Auth links by the **email match inside your `createOrUpdateUser`** (this repo's design) and, for the Password provider, by the account `id`. Normalizing both the stored `users.email` and the lookup key keeps them consistent. Google OAuth's profile email flows through the same normalize step before lookup, so cross-provider linking now works regardless of casing. Account `id` for Password becomes the normalized email, so password sign-in must also normalize on the way in — which `profile()` handles because it runs on every flow including "signIn".

CAVEAT to verify: confirm `profile()` runs and its normalized `email` is used to derive the credential lookup on **sign-in** too (source shows `account.id = email` and `profile` runs for "signIn"); a quick test (sign up mixed-case, sign in lower-case) validates this on your installed version.

### Backfilling existing mixed-case emails
1. **Audit first:** query the `users` table, group by `toLowerCase(email)`, find collisions (genuine dupes already created by the casing bug). Do NOT blindly lowercase — that can create unique-index/linking conflicts if two rows collapse to the same key.
2. **Merge dupes manually/scripted:** for each lowercased-collision group, pick a canonical user, repoint child records (userProfiles, cases, push subscriptions, etc.), soft-delete the loser, then lowercase the survivor's email.
3. **Lowercase the rest:** for non-colliding rows, a one-shot internal mutation that patches `email: email.toLowerCase().trim()`.
4. **Password accounts:** the auth `authAccounts` table stores the credential with `providerAccountId = email` (the account id). Lowercasing only `users.email` will NOT fix the password credential id — existing password users may need to reset/re-link, OR you backfill `authAccounts.providerAccountId` too. **Verify the exact table/field name in your installed `@convex-dev/auth` schema before backfilling** — this is the riskiest part.
5. Run the audit in dev (`giddy-peccary-484`) first; this is irreversible in prod.

**Confidence: HIGH** that no default normalization exists and that the current repo lookup is case-sensitive (read both source and repo). **MEDIUM** on the exact `authAccounts` credential-id backfill mechanics — verify against installed package schema before touching prod.

Sources:
- https://github.com/get-convex/convex-auth/blob/main/src/providers/Password.ts
- https://labs.convex.dev/auth/config/passwords
- https://labs.convex.dev/auth/advanced (createOrUpdateUser signature + linking)
- This repo: `v2/convex/auth.ts` (lines 54-74, 102-163)

---

## Q5. svix webhook retry semantics

### Ground truth (Svix docs)

**Retry trigger by status code (exact):**
> "The way to indicate that a webhook has been processed is by returning a `2xx` (status code `200-299`) response... within a reasonable time-frame (15s with Svix). **Any other status code, including `3xx` redirects are treated as failures.**"

So **5xx, 4xx, 3xx, timeouts, connection refusals → all trigger retry.** Only 2xx = success/no retry. Svix does **not** itself distinguish "malformed 4xx don't-retry" from "transient 5xx do-retry" — to Svix, any non-2xx is a failure and will be retried on the schedule.

**Retry schedule (exponential backoff):** Immediately, 5s, 5min, 30min, 2h, 5h, 10h, +10h. After exhaustion the message is marked "Failed."

**Same id across retries — YES (this is the key answer):**
> The `svix-id` / `webhook-id` header "is unique per message but **reused across retries of the same message**." Consumers "use this identifier to ensure that they only process each event once."

So returning 5xx → redelivery arrives with the **same `svix-id`** → an idempotency dedup key on `svix-id` makes retries safe. Confirmed.

**Signature headers (for the verified webhook):** `svix-id`, `svix-timestamp`, `svix-signature` (the `Webhook(secret).verify(rawBody, headers)` call). The dedup key is `svix-id`.

### Best practice for the receiver (recommended)
1. Verify signature first; if signature invalid → return **4xx** (e.g. 401/400). (Svix will still retry, but the request is rejected as unauthenticated — acceptable.)
2. **Dedup on `svix-id`** before doing work: store processed ids (e.g. a Convex table row keyed by `svix-id`, or Redis with ~24h TTL — Svix recommends 24h). If seen → return **200** immediately (ack the duplicate, no reprocessing).
3. Respond **200 fast**, then do heavy work in the background (`after()` / scheduler) to avoid the 15s timeout triggering spurious retries.
4. Status-code policy on the receiver side (your contract, even though Svix retries any non-2xx):
   - **2xx** — processed (or duplicate, or intentionally ignored event type you don't handle) → no retry needed.
   - **5xx** — transient failure (DB down, downstream timeout) → signal "retry me."
   - **4xx** — malformed/unverifiable payload. Note: Svix WILL retry these too, but retrying won't help a permanently malformed body. Best practice: log/alert, and prefer returning **200** for permanently-undeliverable payloads you've decided to drop (so Svix stops retrying), reserving **5xx** strictly for genuinely transient errors. Returning 4xx for malformed is semantically correct but causes Svix to burn the full retry schedule before giving up.

The practical rule: **return 200 for "handled or permanently un-handleable," return 5xx only for transient/retryable failures.** Because Svix treats all non-2xx identically (retry), the only way to *stop* retries on a poison message is a 2xx.

**Confidence: HIGH.**

Sources:
- https://docs.svix.com/retries
- https://docs.svix.com/idempotency
- https://www.svix.com/resources/webhook-best-practices/retries/
- https://www.svix.com/resources/webhook-university/reliability/idempotency-and-deduplication/

---

## Uncertainties / things to verify before shipping
1. **AI SDK v6.0.191 callback firing** — several open GitHub issues report `onFinish`/`onError` not firing or returning partial shapes with `createUIMessageStream`. Add an integration test on the pinned version.
2. **Convex Auth `authAccounts` credential-id backfill** — confirm exact table/field for the password credential id in the installed package before any prod email backfill; lowercasing `users.email` alone won't migrate password sign-in.
3. **Vercel fronting proxy** — the `getClientIp()` recommendation assumes bare Vercel (no CDN in front). If Cloudflare/etc is ever added, switch to `x-vercel-forwarded-for` + Trusted Proxy.
4. context7 MCP tools were unavailable this session; all findings are from official docs + source (primary), which is stronger, but the user specifically asked for context7 — flag that it could not be invoked.
