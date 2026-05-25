# AI & Chat PR Review — since 19001ba

Reviewed (git diff 19001ba..HEAD): `convex/conversationSummary.ts`, `convex/conversations.ts`,
`src/app/api/chat/route.ts`, `src/lib/ai/providers.ts`, `src/lib/ai/compaction.ts`,
`src/lib/ai/summarize.ts`, `ChatCompactionDivider.tsx`, `ChatMessage.tsx`, `ChatPanel.tsx`,
`ChatWidget.tsx`, `ChatWidgetConnected.tsx`, `ToolCallCard.tsx`.

Verified against AI SDK v6.0.191 installed in repo (`pruneMessages`, `convertToModelMessages`,
`createUIMessageStream`, `toUIMessageStream` signatures confirmed from `ai/dist/index.d.ts`).

## Verdict
No CRITICAL correctness bugs. The fallback chain, compaction token math, lock protocol, and
streaming patterns are sound and well-tested (45 compaction tests, 32 provider tests). A few
IMPORTANT robustness gaps and SUGGESTIONS below.

---

## IMPORTANT (80-89)

### 1. Background summarization in serverless `onFinish` may be killed — `route.ts:380-388` (confidence 82)
`triggerSummarizationCheck()` is fire-and-forget from `createUIMessageStream`'s `onFinish`,
which runs AFTER the response body has been flushed. On Vercel serverless/fluid compute, the
function instance can be frozen/terminated once the response completes, so the async
`checkNeedsSummarization` + `summarizeConversation` chain (which makes multiple Convex round
trips + LLM calls, hundreds of ms to seconds) is not guaranteed to finish. The correct primitive
is `import { after } from 'next/server'` (or `ctx.waitUntil` via the AI SDK) to register
post-response work the platform keeps alive. Symptom: summaries intermittently never generated
under real traffic, while working locally. Note `maxDuration = 60` governs the request, not
detached post-response promises.
Fix: wrap the trigger in `after(() => triggerSummarizationCheck(...))`.

### 2. `recentMessages` from `getContextMessages` is now dead — divider/path desync risk — `conversationSummary.ts:201-209`, `route.ts:200` (confidence 80)
The route no longer consumes `contextData.recentMessages`; it compacts the FULL client-supplied
`messages` via `convertToModelMessages(messages)`. The query still computes/returns
`recentMessages` (a `.slice(-10).filter(...)` over all rows) — pure dead compute and a
maintenance trap: a future reader will assume the server controls the recent window, but it is
now the (untrusted) client array that drives context. The summary text already covers msgs
`1..N-10`; the L2-L4 tail (`pruned.slice(-keep)`) re-includes the same recent messages the
envelope summarizes, so there is summary/verbatim content overlap (token waste + mild model
confusion), not a hard bug. Recommend: drop `recentMessages` from the query return, and add a
comment that the client array is the source of truth for the verbatim tail.

---

## SUGGESTIONS (51-79)

### 3. Compaction tail-slice can orphan a tool-result part — `compaction.ts:234-244` (confidence 68)
L2-L4 prune with `toolCalls: 'before-last-message'` (keeps the last message's tool-call bodies
as structured parts), THEN `pruned.slice(-keep)`. If the boundary lands such that a `tool`
(tool-result) message is the first kept element but its matching assistant tool-call was sliced
away, strict providers (Mistral, OpenRouter) can 400 on an orphaned `tool_call_id`. In practice
the FallbackModel + over-counted token budget mask this, and Gemini tolerates it, so it rarely
surfaces — but it is unguarded. Consider trimming a leading orphan `tool` message after slicing,
or pruning `toolCalls: 'all'` for L3/L4 where verbatim tool state matters least.

### 4. FallbackModel has no mid-stream recovery — `providers.ts:344-346` (acknowledged in code) (confidence 70)
`doStream` only retries at connection time; an error after the stream resolves (e.g. provider
drops mid-generation, common on free tiers) surfaces to the user with no failover. The code
documents this trade-off honestly. Given the free-tier providers, mid-stream drops are plausible;
worth a follow-up to wrap the returned stream and restart on early-stream error.

### 5. IP rate-limit uses raw `x-forwarded-for` first value — `route.ts:99-102` (confidence 60)
`x-forwarded-for` is a comma-joined list; `normalizeIp` takes the first hop. On Vercel the
left-most value is client-controllable upstream of the platform's trusted append, so a crafted
header can rotate the rate-limit key. BotID + auth gate this, and it fails open by design, so
impact is low — but document that enforcement trusts the platform proxy, or pull the IP from a
Vercel-trusted header (`x-vercel-forwarded-for`).

### 6. `toMistralToolCallId` padding can collide — `providers.ts:101-116` (confidence 55)
For IDs <9 alphanumerics, padding derives from `id.charCodeAt`, deterministic but not
collision-proof across distinct short IDs in one turn (two different short IDs could map to the
same 9-char output, breaking call/result matching). Real-world IDs are long, so unreached; noting
for completeness.

### 7. `messageCountAtSummary = totalMessageCount - RECENT_MESSAGES_TO_KEEP` TOCTOU — `summarize.ts:307` (confidence 52)
`totalMessageCount` is read in `getMessagesToSummarize`; new messages may persist before
`saveSummary` writes the count. The 60s lock + "recent window" tolerance absorbs the lag (noted
in the route comment), so acceptable. The divider index (`ChatPanel.tsx:264-268`) keys off this
absolute count and will point at a stable seam even as messages append — correct.

---

## Strengths
- Atomic `beginSummarizing`/`finishSummarizing` lock with 60s TTL is a clean, correct
  single-document race guard; `saveSummary` clears the lock via patch omission (correct Convex
  semantics). All summary mutations re-verify ownership.
- `compactToFit` L0→L4 walk terminates (finite list, returns null on no-fit) — no infinite loop.
  Token estimator intentionally over-counts to bias toward skipping marginal models.
- `forRequest()` per-request model instance correctly isolates `lastUsedModel`/`lastAttemptCount`
  from concurrent requests (singleton would race).
- `maxRetries: 0` correctly delegates failover to FallbackModel; `onError`/`toUIMessageStream`
  `onError` both capture to Sentry with friendly user message.
- BotID-before-rate-limit-before-auth ordering is deliberate and cost-aware; IP check fails open
  with `remaining: 0` to avoid caching bogus headroom.
- Prompt-injection surface is low: `pageContext` is field-extracted (not raw-JSON injected),
  summary/facts ride in a labeled `[COMPACTED CONTEXT]` envelope flagged as non-user, and all
  tool execution is auth-scoped server-side in Convex — injected case IDs cannot cross tenants.
- `parseFacts` validates untrusted JSON via zod before merge; legacy `cases: string[]` shape
  normalized by transform. No secrets logged; missing API keys surfaced once at module load.
- AI SDK v6 stream composition (`createUIMessageStream` + `writer.merge(result.toUIMessageStream)`
  + `createUIMessageStreamResponse`) matches the documented v6 pattern.
