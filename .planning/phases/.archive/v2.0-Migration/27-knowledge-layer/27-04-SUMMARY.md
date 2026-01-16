# Phase 27-04 Summary: Chat API Integration with Tools

**Executed:** 2026-01-08
**Duration:** ~45 minutes
**Status:** Complete

## What Was Built

### 1. Enhanced System Prompt (~1,833 tokens)

**File:** `v2/src/lib/ai/system-prompt.ts`

Modular system prompt with sections:
- **PERM_DOMAIN_KNOWLEDGE**: Case statuses (5 stages), progress statuses (6 values), key deadlines, regulations (20 CFR 656)
- **APP_FEATURES**: Dashboard, Cases List, Case View/Edit, Calendar, Notifications, Settings
- **TOOL_USAGE_GUIDELINES**: Decision tree for tool selection, tool chaining examples
- **RESPONSE_GUIDELINES**: Professional tone, formatting rules, edge case handling
- **CITATION_REQUIREMENTS**: Anti-hallucination rules, citation formats (CFR, URLs, case references)

Key functions:
- `buildSystemPrompt()`: Joins all sections
- `buildSystemPromptWithContext()`: Optional runtime context injection
- `getSystemPrompt()`: Backward-compatible export

### 2. Chat API Tool Integration

**File:** `v2/src/app/api/chat/route.ts`

Native AI SDK tool calling with:
- Three tools: `queryCases`, `searchKnowledge`, `searchWeb`
- Each tool has execute function calling Convex
- Multi-step support: `stopWhen: stepCountIs(5)`
- Comprehensive logging with session IDs
- Error handling returns data objects (LLM recovery)

Tool execution pattern:
```typescript
queryCases: {
  description: QUERY_CASES_DESCRIPTION,
  inputSchema: QueryCasesInputSchema,
  execute: async (params) => {
    return await fetchQuery(api.chatCaseData.queryCases, params, { token });
  },
},
```

### 3. Message Persistence for Tool Calls

**File:** `v2/src/hooks/useChatWithPersistence.ts`

Enhanced `onFinish` callback:
- Extracts tool calls from AI SDK message parts
- Maps to Convex schema format (JSON-serialized arguments/results)
- Tracks status: pending → success/error
- Real-time tool call extraction for UI display during streaming

Schema format persisted:
```typescript
{
  tool: string,
  arguments: string,  // JSON
  result?: string,    // JSON
  status: 'pending' | 'success' | 'error',
  executedAt?: number
}
```

## Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Plain objects for tools (not `tool()` helper) | AI SDK v5 `Tool` type requires `inputSchema` + `execute` as object properties |
| Convex auth token per-request | Passed to tool execute functions for authenticated queries/actions |
| Session IDs for request tracing | `chat_${timestamp}_${random}` format enables debugging |
| Tool call logging with truncation | Prevents log explosion while maintaining visibility |

## Files Modified

| File | Changes |
|------|---------|
| `v2/src/lib/ai/system-prompt.ts` | Complete rewrite with modular sections |
| `v2/src/app/api/chat/route.ts` | Added tool definitions, logging utilities, execute functions |
| `v2/src/hooks/useChatWithPersistence.ts` | Tool call extraction, persistence, real-time display |

## Verification

Human-verified chatbot tool calling:
- [x] PERM knowledge questions use `searchKnowledge`, cite sources
- [x] Case data questions use `queryCases`
- [x] Web search questions use `searchWeb`, cite URLs
- [x] Complex questions chain multiple tools
- [x] Citations accurate (CFR, URLs, case names)
- [x] No hallucination observed
- [x] Tool calls persist in conversation history

## Quality Notes

- TypeScript strict mode: All types explicit
- Anti-hallucination: System prompt includes specific rules
- Logging: Session-scoped, truncated for readability
- Error recovery: Tools return error objects, not exceptions

## Dependencies on Previous Plans

- 27-01: RAG infrastructure (searchKnowledge calls `api.knowledge.searchKnowledge`)
- 27-02: Web search (searchWeb calls `api.webSearch.searchWeb`)
- 27-03: Tool definitions (schemas imported, flexible queryCases)

## Next Steps

Phase 27 complete. Ready for:
- Phase 28 (Action Layer): Case CRUD actions, navigation, confirmation flows
- Or Phase 28+ depending on roadmap

## Metrics

- System prompt: ~1,833 tokens
- Tools: 3 (queryCases, searchKnowledge, searchWeb)
- Max tool steps: 5
- All tests passing
