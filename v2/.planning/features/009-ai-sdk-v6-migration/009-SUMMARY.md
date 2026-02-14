# Feature 009: AI SDK v6 Migration - Summary

**Date:** 2026-02-14
**Status:** COMPLETE

## What Was Done

Migrated all 6 AI SDK packages from v5 to v6 ecosystem:

| Package | Before | After |
|---------|--------|-------|
| `ai` | 5.0.133 | 6.0.86 |
| `@ai-sdk/google` | 2.0.53 | 3.0.29 |
| `@ai-sdk/openai` | 2.0.89 | 3.0.29 |
| `@ai-sdk/react` | 2.0.119 | 3.0.88 |
| `@openrouter/ai-sdk-provider` | 1.5.4 | 2.2.3 |
| `ai-fallback` | 1.0.8 | 2.0.0 |

## Breaking Changes Fixed

### 1. `CoreMessage` → `ModelMessage` (route.ts)
- Import renamed
- Type annotation on `ToolExecutionOptions.messages`
- Variable type on `optimizedMessages` array

### 2. `finishReason` object change (providers.ts)
- Provider-level `finishReason` changed from string to `{ unified, raw }` object
- Updated `wrapGenerate` to use `result.finishReason.unified`
- Updated `wrapStream` to extract `chunk.finishReason.unified`

### 3. Middleware `specificationVersion` (providers.ts)
- Added `specificationVersion: 'v3' as const` to both middleware objects:
  - `wrapMistralModel` (transformParams middleware)
  - `wrapWithRetryableErrors` (wrapGenerate + wrapStream middleware)

### 4. `finishReason 'unknown'` → `'other'` (route.ts + providers.ts)
- Updated 3 string comparisons across 2 files

## Files Modified

| File | Changes |
|------|---------|
| `package.json` | 6 package version bumps |
| `pnpm-lock.yaml` | Lockfile regenerated |
| `src/app/api/chat/route.ts` | CoreMessage → ModelMessage (3 spots), finishReason update (1 spot) |
| `src/lib/ai/providers.ts` | specificationVersion (2 spots), finishReason.unified (2 spots), finishReason 'other' (2 spots) |
| `.planning/VERSION-DECISIONS.md` | Updated constraint status to RESOLVED |

## Files Verified (No Changes Needed)

- `src/lib/ai/summarize.ts` — `generateText` + `google()` API unchanged
- `src/lib/ai/tools.ts` — `tool()` API unchanged
- `src/hooks/useChatWithPersistence.ts` — `useChat` + `DefaultChatTransport` unchanged
- `convex/lib/rag/index.ts` — `google.embedding()` unchanged
- `src/lib/ai/__tests__/providers.test.ts` — mocks still work

## Verification

- `tsgo --noEmit` — 0 errors
- `pnpm test:fast` — all AI SDK tests pass (1 pre-existing flaky test unrelated to migration)
- `pnpm build` — succeeds
- `npx convex deploy -y` — succeeds
- `git push` — pre-push type check passes

## Commits

- `008f78f` — chore: checkpoint before AI SDK v6 migration
- `1feab66` — feat(ai): migrate AI SDK from v5 to v6
