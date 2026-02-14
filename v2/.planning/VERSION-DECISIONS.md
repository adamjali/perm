# Version Decisions

Packages intentionally NOT on latest, with reasons.

## AI SDK Stack — Pinned to v5 Ecosystem

**Date:** 2026-02-14

| Package | Current | Latest | Why Not Latest |
|---------|---------|--------|----------------|
| `ai` | 5.0.133 | 6.x | `@openrouter/ai-sdk-provider@1.5.4` only supports `ai@^5.0.0` |
| `@ai-sdk/openai` | 2.0.89 | 3.x | v3 requires `ai@^6.0.0` |
| `@ai-sdk/react` | 2.0.119 | 3.x | v3 requires `ai@^6.0.0` |
| `@openrouter/ai-sdk-provider` | 1.5.4 | 2.x | v2 requires `ai@^6.0.0` |

**Constraint chain:** OpenRouter v1.5.4 (`ai@^5`) blocks the entire AI SDK from upgrading to v6. Upgrading requires migrating all four packages simultaneously plus verifying OpenRouter v2 stability and any breaking API changes in `ai@6`, `@ai-sdk/openai@3`, and `@ai-sdk/react@3`.

**When to revisit:** When `@openrouter/ai-sdk-provider` v2.x is stable and the `ai@6` migration guide is available. Check quarterly.

**Related:** Dependabot PRs #19 and #20 were closed for this reason.
