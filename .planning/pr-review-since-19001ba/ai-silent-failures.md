# AI & Chat — Silent Failure / Error-Handling Audit

**Scope:** AI/chat changes since `19001ba` (multi-provider fallback + streaming + compaction).
**Files:** `providers.ts`, `summarize.ts`, `compaction.ts`, `api/chat/route.ts`, `conversationSummary.ts`, `conversations.ts`, plus client `useChatWithPersistence.ts` / `ChatPanel.tsx` for stream-error surfacing.
**Method:** `git diff 19001ba..HEAD` + current source read. AI SDK v6 stream/error semantics verified via context7 (`/vercel/ai`). No code changed.

Legend: **R** = introduced/changed by this PR (regression risk), **P** = pre-existing but live in the audited path.

---

## CRITICAL

### C1. Client `onFinish` persists partial/errored/aborted assistant messages as if complete (P — live, high data-integrity risk)
`v2/src/hooks/useChatWithPersistence.ts:138`
```ts
onFinish: async ({ message }) => { ... await createAssistantMessage({ content, ... }) }
```
AI SDK v6 fires `onFinish` on **abort, disconnect, and error** too (callback exposes `isAbort`, `isDisconnect`, `isError` — confirmed via context7 `/vercel/ai` `04-ai-sdk-ui/02-chatbot`). This handler destructures only `{ message }` and **unconditionally persists** to Convex. Consequences:
- A mid-stream provider failure persists a truncated assistant turn as a normal message.
- The server `onError` (route.ts:376) returns the literal string `"AI service temporarily unavailable. Please try again in a moment."` into the stream; that text becomes a `text` part and is then **persisted as the assistant's answer**, polluting conversation history and feeding it back into future compaction/summarization context.
- A user-pressed Stop persists a partial message silently.

This is a silent data-corruption failure: the conversation record diverges from what actually happened, and there is no log/flag distinguishing a real answer from an error placeholder.
**Fix:** guard persistence on the v6 flags — `onFinish: async ({ message, isError, isAbort, isDisconnect }) => { if (isError || isAbort || isDisconnect) return; ... }` (or persist with an explicit `incomplete`/`error` status field rather than as a clean assistant message).

---

## IMPORTANT

### I2. Server `onError` returns a user-facing string that becomes durable message content (R — changed in this PR's stream path)
`v2/src/app/api/chat/route.ts:372-377`
```ts
writer.merge(result.toUIMessageStream({
  onError: (error) => { captureError(...); return 'AI service temporarily unavailable. Please try again in a moment.'; }
}));
```
Returning a string from `toUIMessageStream.onError` injects it into the stream as assistant text (AI SDK v6 maps the return value to an error/text part). Combined with C1, this hard-codes an error sentence into the persisted transcript. It is also indistinguishable on the client from a legitimate short model reply, so the user may not realize the request failed. **Fix:** coordinate with C1 (don't persist on `isError`), and/or surface errors via a distinct stream error part the client renders as the red error banner (ChatPanel.tsx:309) rather than as message text.

### I3. Mid-stream provider failure escapes the fallback chain entirely (R — documented trade-off, but no recovery + weak surfacing)
`v2/src/lib/ai/providers.ts:228-347` (FallbackModel) and route.ts:299-360.
`FallbackModel.tryModels` only catches errors thrown by `doStream()` at **connection time**. Once a provider's stream resolves, any error during token consumption (provider drops connection, 5xx mid-stream, quota exhausted partway) is **outside** the loop — no fallback to the next of the 5 models. The only handling is `streamText.onError` (route.ts:307) → `console.error` + `captureError` + the C1/I2 string. So "Gemini died at token 50" degrades to a truncated/placeholder answer with the *next 4 models never tried*, even though the whole point of the chain is resilience. The header comment calls this acceptable ("most errors happen at connection time"), which is a reasonable intentional-degradation stance — but it is under-surfaced: the user just sees a generic banner, and there is no telemetry distinguishing connection-time failures (recoverable) from mid-stream failures (the actual gap). **Fix (or at minimum):** emit a distinct breadcrumb/Sentry tag for mid-stream `onError` so the rate of unrecoverable mid-stream failures is measurable; consider documenting it as a known limitation in the user-facing error.

### I4. `compactToFit` returns null → "use L4 anyway" sends a knowingly-oversized payload (R — accidental-swallow of an over-budget condition)
`v2/src/app/api/chat/route.ts:222-227`
```ts
} else { // even L4 didn't fit
  console.warn(`No compaction level fits ${TARGET_TOKENS}; using L4 anyway`);
  convertedMessages = fullMessages.slice(-4);
}
```
Two issues: (a) `compactToFit` already failed at L4 with the **envelope (summary+facts) included**; the fallback uses `fullMessages.slice(-4)` which **drops the summary/facts envelope entirely** — silent loss of the compacted context the whole pipeline built, not an equivalent "L4 payload." (b) It then relies on FallbackModel skipping over-budget models, but only Groq declares `maxInputTokens` (10k); Gemini/Mistral/GLM have no cap, so the oversized payload is sent and may 400/exceed quota — handled only as a generic failure. The `console.warn` is the sole signal; no `captureError`. **Fix:** `captureError` on the no-fit branch (this means a single turn exceeds 10k even at L4 — a real product signal), and reuse the L4-compacted result (`compactAt(4, input)`) instead of `slice(-4)` so the envelope is preserved.

### I5. IP rate-limit fail-open collapses all unidentifiable callers into one shared bucket (R — intentional fail-open, but masks a bypass)
`v2/src/app/api/chat/route.ts:99-121`
`clientIp` falls back to the literal `"unknown"` when no `x-forwarded-for`/`x-real-ip` header is present, and the rate-limit check `catch` **fails open** (allows the request, `console.warn` only). Net: any caller able to suppress those headers shares a single `"unknown"` quota bucket, and any rate-limiter outage disables the per-IP AI-quota protection silently. The fail-open is explicitly justified in-comment (availability > blocking), which is defensible — but the `"unknown"` bucket sharing is not called out and the catch has no `captureError`, so a persistent limiter outage is invisible in Sentry. **Fix:** `captureError` (sampled) in the rate-limit catch so sustained fail-open is observable; consider rejecting or separately bucketing `"unknown"` IPs.

---

## SUGGESTIONS

### S6. `getContextMessages.recentMessages` is now dead output (R — confused contract, latent foot-gun)
`v2/convex/conversationSummary.ts:160-219`. The route was refactored (route.ts:208) to compact `convertToModelMessages(messages)` from the **request body** and no longer reads `contextData.recentMessages` (grep confirms zero non-test consumers). The query still computes/returns it. Beyond dead code: this is a quiet **behavior change** — when a summary exists the server now sends `summary + entire client-supplied history (compacted)` rather than `summary + server's recent window`, trusting the client's message list. Worth a comment documenting the new contract, and either dropping `recentMessages` or noting why it's retained.

### S7. Entity extraction & prose summary are single-model with no chain (R — intentional degradation, correctly non-fatal)
`v2/src/lib/ai/summarize.ts:144-213`. `extractEntities` (Cerebras only) returns `undefined` on failure; `generateProseSummary` is Mistral→Groq (2-deep) then `null`. Both log + `captureError`, and `summarizeConversation` releases the lock and skips saving on double-failure (summarize.ts:289-300). This is correct non-blocking design — flagging only to confirm it's *intentional*: a persistent Cerebras outage silently means facts stop accumulating (prose still works), and a Mistral+Groq outage means the summary simply never advances. No user-facing impact, but a sustained extractor outage is only visible as a Sentry trickle, never an alert. Acceptable; consider a metric if fact-loss matters.

### S8. `summarizeConversation` lock-release-on-error best-effort swallow is justified (P — verified OK)
`v2/src/lib/ai/summarize.ts:333-341`. The empty-ish `catch {}` around `finishSummarizing` is acceptable: the comment correctly notes the 60s TTL auto-clears a stale lock (`SUMMARIZATION_LOCK_TTL_MS`, conversationSummary.ts:56), and the outer error was already `captureError`'d at line 328. Not a defect. (Also verified: the Convex `patch({ summary: {...} })` "clear `summarizingAt` by omission" pattern is **correct** — `db.patch` replaces the whole nested `summary` object, so omitting the key clears it. The reassuring comments at conversationSummary.ts:348 / :428 are accurate.)

### S9. `triggerSummarizationCheck` fire-and-forget is correctly contained (R — verified OK)
`v2/src/app/api/chat/route.ts:56-76, 380-388`. The IIFE has try/catch + `captureError`, and the inner `summarizeConversation(...).catch(...)` prevents an unhandled rejection. Good — no unawaited-promise leak. Note it runs in `createUIMessageStream.onFinish`, which (like client onFinish) also fires on abort/error in v6; here that's harmless (worst case: an extra summarization check after a failed turn), so no action needed beyond awareness.

### S10. PostHog capture try/catch + `?.` chains are appropriate, not error-hiding (R — verified OK)
route.ts:282-290, 349-357 wrap analytics in try/catch with `console.warn`; `getPostHogClient()?.capture` optional-chains a non-critical dependency. Analytics is correctly treated as best-effort. No change needed.

---

## Net assessment
- **One CRITICAL (C1)**: errored/aborted/partial assistant turns are persisted as clean messages — silent data corruption that also poisons downstream summarization context. Pre-existing but live and squarely in this PR's path.
- **I2–I5** are real surfacing/data-fidelity gaps introduced or reshaped by this PR's streaming + compaction rewrite; I4 silently drops the compacted envelope and lacks `captureError`.
- The fallback-chain *connection-time* error handling, missing-API-key surfacing (`getApiKey` → `captureError` at module load, providers.ts:60-73), and all-providers-failed paths (providers.ts:328-337, route.ts:392-411) are **well done** — clear logs, Sentry capture, and a genuine 503 to the client when the whole chain is exhausted. The gap is specifically **mid-stream** failures and **client-side persistence of non-success finishes**.
