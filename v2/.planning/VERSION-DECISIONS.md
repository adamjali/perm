# Version Decisions

Packages intentionally NOT on latest, with reasons.

## AI SDK Stack — Upgraded to v6 (Feb 2026)

**Date:** 2026-02-14
**Status:** RESOLVED

Previously pinned to v5 because `@openrouter/ai-sdk-provider@1.5.4` only supported `ai@^5`.
OpenRouter v2.2.3+ now supports `ai@^6`. All packages upgraded to latest:

| Package | Version |
|---------|---------|
| `ai` | 6.0.86 |
| `@ai-sdk/google` | 3.0.29 |
| `@ai-sdk/openai` | 3.0.29 |
| `@ai-sdk/react` | 3.0.88 |
| `@openrouter/ai-sdk-provider` | 2.2.3 |
| `ai-fallback` | 2.0.0 |

**Migration notes:**
- `CoreMessage` → `ModelMessage` (type rename)
- `finishReason` at provider level is now `{ unified, raw }` object (high-level `FinishReason` unchanged)
- Middleware requires `specificationVersion: 'v3'`
- `convertToModelMessages` is async (was already `await`ed in our code)
- Strict mode defaults to true for tool schemas (compatible with our Zod schemas)

**Related:** Dependabot PRs #19, #20, and #23 superseded by this migration.
