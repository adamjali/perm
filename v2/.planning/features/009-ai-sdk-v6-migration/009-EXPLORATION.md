# Feature 009: AI SDK v6 Migration - Exploration

**Date:** 2026-02-14
**Focus:** Migrate Next.js chatbot from AI SDK v5 to v6
**Confidence:** HIGH

---

## Current State

### Package Versions (package.json)

| Package | Current Version | Target Version |
|---------|----------------|----------------|
| `ai` | ^5.0.133 | ^6.0.0 |
| `@ai-sdk/react` | ^2.0.119 | ^3.0.0 |
| `@ai-sdk/openai` | ^2.0.89 | ^3.0.0 |
| `@ai-sdk/google` | ^2.0.53 | ^3.0.0 |
| `@openrouter/ai-sdk-provider` | ^1.5.4 | ^2.0.0+ |
| `ai-fallback` | 1.0.8 | 2.0.0 |

### Current Implementation Files

| File | Key AI SDK Usage |
|------|------------------|
| `src/app/api/chat/route.ts` | `streamText`, `convertToModelMessages`, `CoreMessage`, tools |
| `src/hooks/useChatWithPersistence.ts` | `useChat` from `@ai-sdk/react`, `DefaultChatTransport` |
| `src/lib/ai/providers.ts` | Provider initialization with `ai-fallback` |
| `src/lib/ai/summarize.ts` | `generateText`, message conversion |

**Current imports in route.ts:**
```typescript
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  stepCountIs,
  type Tool,
  type CoreMessage, // ❌ REMOVED in v6
} from 'ai';
```

**Current imports in useChatWithPersistence.ts:**
```typescript
import { useChat as useAIChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
```

---

## Critical Breaking Changes

### 1. CoreMessage Type Removed (HIGH IMPACT)

**What changed:**
- `CoreMessage` type completely removed
- `convertToCoreMessages()` function removed
- Replace with `ModelMessage` type
- Replace with `convertToModelMessages()` (which is NOW ASYNC)

**Current code in route.ts:**
```typescript
import { type CoreMessage } from 'ai'; // ❌ This import will fail

let currentMessages: CoreMessage[] = []; // ❌ Type no longer exists
```

**Migration:**
```typescript
import { type ModelMessage } from 'ai'; // ✅ New type

let currentMessages: ModelMessage[] = []; // ✅ Updated type
```

**Files affected:**
- `src/app/api/chat/route.ts` (uses `CoreMessage` type)
- Any other files importing `CoreMessage`

---

### 2. convertToModelMessages is Now Async (HIGH IMPACT)

**What changed:**
- `convertToModelMessages()` returns `Promise<ModelMessage[]>` (was synchronous)
- Must add `await` to all calls
- Codemod available: `npx @ai-sdk/codemod v6` with `add-await-converttomodelmessages`

**Current code in route.ts:**
```typescript
// Line 287-289 (approx)
const modelMessages = convertToModelMessages(uiMessages); // ❌ Missing await
```

**Migration:**
```typescript
const modelMessages = await convertToModelMessages(uiMessages); // ✅ Add await
```

**Why it changed:**
Supports async `Tool.toModelOutput()` - tools can now perform async operations when converting outputs.

**Files affected:**
- `src/app/api/chat/route.ts` (multiple calls)
- `src/lib/ai/summarize.ts` (likely uses this)

---

### 3. Tool.toModelOutput Parameter Change (MEDIUM IMPACT)

**What changed:**
- Old: `toModelOutput(output)` - receives output directly
- New: `toModelOutput({ output })` - receives parameter object
- Codemod available: `wrap-tomodeloutput-parameter`

**If you have custom tools with toModelOutput:**
```typescript
// OLD (v5)
tool: {
  toModelOutput: (output) => `Result: ${output}`
}

// NEW (v6)
tool: {
  toModelOutput: ({ output }) => `Result: ${output}`
}
```

**Files affected:**
- Check `src/app/api/chat/route.ts` tool definitions for `toModelOutput` usage

---

### 4. Strict Mode Now Defaults to True (MEDIUM IMPACT)

**What changed:**
- `strictJsonSchema` now defaults to `true` for:
  - JSON outputs (`generateObject`, `streamObject`)
  - Tool calls
- Stricter JSON schema validation by default
- Can disable with `strictJsonSchema: false`

**Per-tool strict control (NEW in v6):**
```typescript
// OLD (v5): Global strictJsonSchema setting
const openai = createOpenAI({ strictJsonSchema: false });

// NEW (v6): Per-tool strict control
const tools = {
  myTool: {
    // ...
    strict: true, // Enable strict mode for THIS tool only
  }
}
```

**Files affected:**
- `src/lib/ai/providers.ts` (provider initialization)
- `src/app/api/chat/route.ts` (tool definitions)

---

### 5. generateObject & streamObject Deprecated (LOW IMPACT - Future)

**What changed:**
- `generateObject` / `streamObject` deprecated (still work, will be removed later)
- Use `generateText` / `streamText` with `output` setting instead

**Not currently used in codebase** (confirmed via file review).

---

### 6. Token Usage Property Changes (LOW IMPACT)

**What changed:**
- `cachedInputTokens` → `inputTokenDetails.cacheReadTokens`
- `reasoningTokens` → `outputTokenDetails.reasoningTokens`

**If tracking token usage:**
```typescript
// OLD (v5)
const cached = usage.cachedInputTokens;
const reasoning = usage.reasoningTokens;

// NEW (v6)
const cached = usage.inputTokenDetails?.cacheReadTokens;
const reasoning = usage.outputTokenDetails?.reasoningTokens;
```

**Files affected:**
- Check if `src/app/api/chat/route.ts` logs token usage

---

### 7. Finish Reason "unknown" → "other" (LOW IMPACT)

**What changed:**
- Finish reason `"unknown"` is now returned as `"other"`

**If checking finish reasons:**
```typescript
// OLD (v5)
if (finishReason === 'unknown') { ... }

// NEW (v6)
if (finishReason === 'other') { ... }
```

---

## Provider-Specific Changes

### @ai-sdk/openai v3

**Breaking changes:**
- `strictJsonSchema` defaults to `true` (was `false`)
- Responses API called by default (not chat API)
  - `openai('gpt-4')` → uses responses API
  - `openai.chat('gpt-4')` → uses chat API (old behavior)

**Current code in providers.ts:**
```typescript
import { openai } from '@ai-sdk/openai';
import { createOpenAI } from '@ai-sdk/openai';
```

**Migration:**
- Review if responses API vs chat API matters for your use case
- Likely no change needed (responses API is newer/better)
- If strict mode causes issues, disable per-tool with `strict: false`

---

### @ai-sdk/google v3

**Breaking changes:**
- Provider metadata key: `google` → `vertex` (for Google Vertex only)
- Regular Google Generative AI (Gemini) unchanged

**Current code:**
```typescript
import { google } from '@ai-sdk/google';
```

**Migration:**
- No changes needed (only Vertex affected)
- Continue using `google('gemini-2.5-flash')` as-is

**New features available:**
- Auto caching with 75% token discount (Gemini 2.5)
- `thinkingConfig` for reasoning control (Gemini 2.5/3)
- Grounding tools (Search, Maps, RAG)

---

### @openrouter/ai-sdk-provider v2

**Breaking changes:**
- v2 is for AI SDK v6 (current: v1.5.4 for AI SDK v5)
- No detailed migration guide available
- Likely follows AI SDK v6 patterns (strict mode, etc.)

**Current code in providers.ts:**
```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
```

**Migration:**
```bash
pnpm add @openrouter/ai-sdk-provider@latest
```

**Verify:**
- Check provider options syntax
- Test model compatibility
- Review error handling (may have improved)

**Sources:**
- [GitHub](https://github.com/OpenRouterTeam/ai-sdk-provider)
- [npm](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)

---

### ai-fallback v2

**Breaking changes:**
- v2 for AI SDK v6 (current: v1.0.8)
- API unchanged (uses standard AI SDK interfaces)

**Current code in providers.ts:**
```typescript
import { createFallback } from 'ai-fallback';
```

**Migration:**
```bash
pnpm add ai-fallback@2
```

**No code changes expected** - fallback wraps AI SDK models, inherits v6 behavior automatically.

**Sources:**
- [GitHub](https://github.com/remorses/ai-fallback)

---

## @ai-sdk/react v3 Changes

### DefaultChatTransport (MEDIUM IMPACT)

**What changed:**
- Transport architecture unchanged (introduced in v5)
- API remains stable
- **Known issues persist:**
  - Dynamic `api` prop changes don't reconfigure transport
  - Dynamic `body` state may not update correctly
  - Changing transport reference doesn't trigger hook update

**Current code in useChatWithPersistence.ts:**
```typescript
transport: new DefaultChatTransport({ api: '/api/chat' })
```

**Migration:**
- No changes needed (static configuration)
- Avoid dynamic `api`/`body` updates (current code doesn't use these)

**Workarounds if needed:**
- Use `prepareSendMessagesRequest` for dynamic state
- Pass state via `body` in `sendMessage()` options (current approach)

**Sources:**
- [AI SDK UI Transport Docs](https://ai-sdk.dev/docs/ai-sdk-ui/transport)
- [GitHub Issue #7070](https://github.com/vercel/ai/issues/7070)
- [GitHub Issue #7109](https://github.com/vercel/ai/issues/7109)
- [GitHub Issue #8956](https://github.com/vercel/ai/issues/8956)

---

### useChat Hook (LOW IMPACT)

**What changed:**
- No breaking changes documented for v3
- Transport architecture stable since v5

**Current usage:**
```typescript
const {
  messages: streamingMessages,
  setMessages: setAIMessages,
  sendMessage,
  status: aiStatus,
  error,
  stop,
} = useAIChat({
  transport: new DefaultChatTransport({ api: '/api/chat' }),
  onFinish: async ({ message }) => { ... },
  onError: (err) => { ... },
});
```

**Migration:**
- No changes needed
- `onFinish` and `onError` callbacks unchanged

---

## Automated Migration Tools

### Codemod

```bash
npx @ai-sdk/codemod v6
```

**What it fixes:**
- Renames `CoreMessage` → `ModelMessage`
- Renames `convertToCoreMessages` → `convertToModelMessages`
- Adds `await` to `convertToModelMessages()` calls
- Wraps `toModelOutput` parameters
- Updates provider metadata keys (Azure, Vertex)
- Renames deprecated types/functions

**Limitations:**
- May not catch all cases
- Manual review required
- Test thoroughly after running

**Files to check manually after codemod:**
- `src/app/api/chat/route.ts` (primary migration file)
- `src/hooks/useChatWithPersistence.ts` (minor changes)
- `src/lib/ai/summarize.ts` (likely uses convertToModelMessages)
- `src/lib/ai/providers.ts` (provider config)

---

## Migration Checklist

### Phase 1: Preparation

- [ ] Backup current working state (git commit)
- [ ] Review all files using AI SDK APIs
- [ ] Identify custom tools with `toModelOutput`
- [ ] Check for `CoreMessage` type usage
- [ ] Check for `convertToModelMessages` calls
- [ ] Review token usage tracking (if any)

### Phase 2: Package Updates

- [ ] Update `ai` to ^6.0.0
- [ ] Update `@ai-sdk/react` to ^3.0.0
- [ ] Update `@ai-sdk/openai` to ^3.0.0
- [ ] Update `@ai-sdk/google` to ^3.0.0
- [ ] Update `@openrouter/ai-sdk-provider` to ^2.0.0+
- [ ] Update `ai-fallback` to 2.0.0
- [ ] Run `pnpm install`

### Phase 3: Automated Migration

- [ ] Run `npx @ai-sdk/codemod v6`
- [ ] Review changes (don't auto-accept all)
- [ ] Commit codemod changes separately

### Phase 4: Manual Fixes

**route.ts:**
- [ ] Replace `CoreMessage` with `ModelMessage`
- [ ] Add `await` to `convertToModelMessages()` calls
- [ ] Update `toModelOutput` parameters (if used)
- [ ] Check finish reason checks (`"unknown"` → `"other"`)
- [ ] Review strict mode impact on tools

**useChatWithPersistence.ts:**
- [ ] Verify `useChat` hook still works
- [ ] Test `DefaultChatTransport` behavior
- [ ] No breaking changes expected (confirm)

**providers.ts:**
- [ ] Update `ai-fallback` import to v2
- [ ] Review `strictJsonSchema` defaults
- [ ] Test provider fallback still works
- [ ] Verify OpenRouter compatibility

**summarize.ts:**
- [ ] Add `await` to `convertToModelMessages()` if used
- [ ] Update `CoreMessage` → `ModelMessage` if used

### Phase 5: Testing

- [ ] Test chat send/receive
- [ ] Test streaming display
- [ ] Test tool calls (all tools: query, search, navigate, etc.)
- [ ] Test tool confirmations (action mode)
- [ ] Test conversation persistence
- [ ] Test provider fallback (simulate quota error)
- [ ] Test message summarization
- [ ] Test error handling
- [ ] Test token usage tracking (if implemented)
- [ ] Visual regression test (message display)

### Phase 6: Validation

- [ ] Run `pnpm typecheck` (no errors)
- [ ] Run `pnpm test` (all tests pass)
- [ ] Run `pnpm test:e2e` (chat flow works)
- [ ] Manual test in browser (full chat flow)
- [ ] Check Sentry for errors (if deployed to preview)

### Phase 7: Documentation

- [ ] Update `v2/CLAUDE.md` with v6 notes (if needed)
- [ ] Update `.planning/VERSION-DECISIONS.md` (AI SDK v6)
- [ ] Document any non-standard workarounds
- [ ] Note any skipped features (e.g., output setting)

---

## Risk Assessment

### HIGH RISK

| Change | Risk | Mitigation |
|--------|------|------------|
| `convertToModelMessages` async | Breaking function signature | Codemod + manual review, comprehensive testing |
| `CoreMessage` removed | Type errors, build failures | Codemod + find/replace, TypeScript catches |
| Strict mode defaults | Tool calls may fail | Test all tools, disable per-tool if needed |

### MEDIUM RISK

| Change | Risk | Mitigation |
|--------|------|------------|
| `toModelOutput` parameter change | Tool output conversion breaks | Codemod + review custom tools |
| OpenRouter v2 API changes | Provider initialization fails | Test fallback, review docs |
| Token usage property changes | Logging breaks | Search for `cachedInputTokens`, update |

### LOW RISK

| Change | Risk | Mitigation |
|--------|------|------------|
| Finish reason renaming | Rarely used | Search for `"unknown"`, update |
| `useChat` hook unchanged | Minimal compatibility issues | Test streaming, confirm behavior |
| `ai-fallback` v2 | Wrapper follows AI SDK | Test fallback behavior |

---

## Rollback Plan

If migration fails or causes critical issues:

1. **Immediate rollback:**
   ```bash
   git reset --hard HEAD~1  # If committed
   git checkout .           # If not committed
   pnpm install             # Restore v5 packages
   ```

2. **Incremental rollback:**
   - Revert package.json to v5 versions
   - Run `pnpm install`
   - Keep code changes for future attempt
   - Document blockers

3. **Staged migration:**
   - Update packages in feature branch
   - Test in isolation
   - Merge only when 100% validated

---

## Open Questions

1. **Does the codebase use token usage tracking?**
   - Search for `cachedInputTokens` / `reasoningTokens`
   - Update to new property paths if found

2. **Are there custom tools with `toModelOutput`?**
   - Review tool definitions in route.ts
   - Update parameter destructuring

3. **Does OpenRouter v2 require config changes?**
   - No detailed migration docs available
   - Must test provider initialization
   - Check model compatibility

4. **Should we adopt new v6 features?**
   - Agent abstraction (not using agents)
   - Google caching (free token savings)
   - Per-tool strict mode (better control)

---

## Sources

### Official Documentation
- [AI SDK v6 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0)
- [AI SDK v6 Announcement](https://vercel.com/blog/ai-sdk-6)
- [AI SDK UI Transport Docs](https://ai-sdk.dev/docs/ai-sdk-ui/transport)
- [AI SDK UI useChat Reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat)
- [OpenAI Provider Docs](https://ai-sdk.dev/providers/ai-sdk-providers/openai)
- [Google Provider Docs](https://ai-sdk.dev/providers/ai-sdk-providers/google-generative-ai)

### Package Repositories
- [ai-fallback GitHub](https://github.com/remorses/ai-fallback)
- [OpenRouter AI SDK Provider GitHub](https://github.com/OpenRouterTeam/ai-sdk-provider)
- [OpenRouter AI SDK Provider npm](https://www.npmjs.com/package/@openrouter/ai-sdk-provider)

### Community Issues
- [useChat dynamic api prop issue #7070](https://github.com/vercel/ai/issues/7070)
- [DefaultChatTransport body update issue #7109](https://github.com/vercel/ai/issues/7109)
- [useChat transport change issue #8956](https://github.com/vercel/ai/issues/8956)
- [convertToModelMessages no tool invocation #9968](https://github.com/vercel/ai/issues/9968)
- [Upgrade to AI SDK 6 discussion #1366](https://github.com/vercel/ai-chatbot/issues/1366)

---

## Next Steps

1. **Create migration plan** (PLAN.md files)
2. **Estimate effort** (4-6 hours: update, test, validate)
3. **Schedule execution** (low-traffic window if production)
4. **Prepare rollback** (backup, git tags)
5. **Execute migration** (follow checklist)
6. **Monitor production** (Sentry, error logs)

---

## Summary

**Migration complexity:** MEDIUM

**Estimated effort:** 4-6 hours (includes testing)

**Critical changes:**
1. Add `await` to `convertToModelMessages()` calls
2. Replace `CoreMessage` → `ModelMessage`
3. Update provider packages (6 packages)
4. Test all tools and streaming

**Codemod coverage:** ~70% (handles type renames, await injection)

**Manual work:** ~30% (verification, provider testing, tool testing)

**Risk level:** MEDIUM (breaking changes, but well-documented)

**Rollback:** EASY (git revert, package restore)

**Recommendation:** Proceed with migration using staged approach:
1. Feature branch with v6 packages
2. Run codemod + manual fixes
3. Comprehensive testing
4. Deploy to preview environment
5. Monitor for issues
6. Merge to main when validated

---

**Researched by:** Claude Opus 4.6
**Valid until:** 2026-03-14 (30 days for stable framework)
