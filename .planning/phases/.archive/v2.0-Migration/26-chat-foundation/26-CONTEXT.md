# Phase 26: Chat Foundation - Context

**Gathered:** 2026-01-03
**Status:** Ready for research/planning

<vision>
## How This Should Work

A floating chatbot widget lives in the bottom-right corner of the app, accessible **only to authenticated users** from any authenticated page. When clicked, it expands upward into a beautiful, animated chat panel.

**IMPORTANT: Authenticated-only (differs from v1)** — The chatbot is NOT available on public pages (home, demo, login, signup). Only logged-in users see the widget. This simplifies the implementation and ensures all conversations are tied to a user account.

The experience should feel **instant & fluid** AND **intelligent & reliable** — no compromise. Responses start streaming immediately with smooth token-by-token display. If one LLM provider fails, it seamlessly falls back to the next without the user noticing.

The chat interface focuses on the current conversation. History exists but stays tucked away — not a persistent sidebar, but easily accessible when needed. The UI matches the app's neobrutalist design with Forest Green accents, hard shadows, 2px borders, and snappy animations.

This is the **foundation phase** — pure chat infrastructure. No PERM knowledge, no actions, no tool calling yet. Just rock-solid streaming chat with multi-provider reliability and a stunning UI.

</vision>

<essential>
## What Must Be Nailed

1. **Streaming Quality** — Smooth, fast, never janky. Real token-by-token streaming, not fake chunking. The typing cursor animation should feel alive.

2. **Multi-Provider Reliability** — Never fails. Intelligent fallback chain (Gemini → OpenRouter → Groq → Cerebras → Mistral). ~15,000 free requests/day capacity. User never sees provider errors.

3. **Beautiful UI** — Stunning floating widget with neobrutalist design. Hard shadows, Forest Green accents, snappy animations (Motion/GSAP). Must use frontend-design skill. Award-winning, breathtaking aesthetic.

4. **Conversation Persistence** — Messages stored in Convex (schema already exists). Conversations persist across sessions. Real-time sync.

</essential>

<boundaries>
## What's Out of Scope

- **Public/unauthenticated chatbot** — Chatbot is authenticated-only (differs from v1)
- **PERM Knowledge & Web Search** — That's Phase 27 (Knowledge Layer)
- **Tools & Actions** — That's Phase 28 (Action Layer). No case CRUD, no navigation, no form filling yet.
- **Permission System** — That's Phase 28. No confirmation flows yet.
- **Multi-step Workflows** — That's Phase 29 (Advanced Automation)
- **Bulk Operations** — That's Phase 29

Phase 26 is **pure chat foundation** — streaming, persistence, UI. The LLM just has a basic system prompt; intelligence comes in later phases.

**Key difference from v1:** No public chatbot. Widget only renders within `(authenticated)` layout.

</boundaries>

<specifics>
## Specific Ideas

### UI Structure
- **Bottom-right floating bubble** (classic position, like Intercom/Drift)
- **Expands upward** into chat panel on click
- **Panel size**: ~400x600px (similar to v1)
- **Z-index**: High (9000+) to float above everything
- **Animation**: Slide up with spring physics, not jarring

### Chat Panel Layout
- Header with close button, maybe dark mode toggle
- Scrollable message area (flex-end for bottom alignment)
- Input area at bottom with send button
- Typing indicator when LLM is responding (animated dots or cursor)

### Message Bubbles
- **User messages**: Right-aligned, Forest Green background, white text
- **Assistant messages**: Left-aligned, white background, black text, 2px border
- **Timestamps**: JetBrains Mono, small, subtle
- **Hard shadows** on message cards

### History Access
- Small icon/button to access conversation list
- Slide-out panel or modal (not persistent sidebar)
- Can switch between conversations, archive old ones

### Animations (Motion/GSAP)
- Message fade-in with spring physics
- Typing cursor blink animation
- Widget open/close with bounce easing
- Staggered message reveals on conversation load

</specifics>

<technical_foundations>
## Technical Foundations (From Exploration)

### V1 Reference (Inspiration Only — Rebuild Fresh)
V1 had a working multi-provider setup:
- **Provider Chain**: Gemini (15 RPM) → OpenRouter (31 free models, 1,550 req/day) → Groq (14,400 req/day) → Cerebras (30 RPM) → Mistral
- **Total capacity**: ~15,000+ requests/day FREE
- **Streaming**: SSE with event types (start, text, tool_start, tool_complete, done)
- **UI**: Floating widget, in-chat confirmation cards, conversation sidebar

**What worked well**: Multi-provider failover, aggressive timeouts, conversation persistence, in-chat confirmation UX

**What didn't work**: Fake streaming (chunked pre-generated response), massive prompts (5K tokens), no circuit breaker, fragile prompt engineering

### V2 Architecture (Build On This)
- **Schema Ready**: `conversations` and `conversationMessages` tables exist with proper indexes
- **Convex Patterns**: query/mutation/action patterns established
- **Auth**: `getCurrentUserId()` helpers, user isolation
- **Components**: shadcn/ui + neobrutalist design system
- **Animations**: Motion library, animation constants in `src/lib/animations.ts`

### Design System Requirements
- **Style**: Soft Neobrutalism
- **Accent**: Forest Green (#228B22)
- **Borders**: 2px solid black, 0px radius
- **Shadows**: Hard shadows (no blur) — `shadow-hard-sm`, `shadow-hard`, `shadow-hard-lg`
- **Typography**: Space Grotesk (headings), Inter (body), JetBrains Mono (technical)
- **Transitions**: 150ms snappy (cards), spring physics (Motion)

</technical_foundations>

<orchestrator_context>
## Orchestrator Instructions

**CRITICAL: This section MUST be included in all PLAN.md files and passed to all subagents.**

### Workflow Pattern
1. **Explore first** — Use Explore agents to understand current implementation before making changes
2. **Implement** — Use Task agents with proper context
3. **Verify** — Review and test
4. **Follow up** — Fix issues, iterate

### Code Quality Requirements
- **DRY & KISS** — No duplicate or clashing implementations
- **Minimal & Simple** — Use existing patterns, built-in, and standard solutions
- **Integrated** — Work within v2 architecture, not around it
- **Scalable & Maintainable** — Abstract-able, organized, readable
- **Global Fixes** — Fixes should be global, not repeated

### Mandatory References (All Agents MUST Read)
1. **PERM Source of Truth**: `./perm_flow.md`
2. **Design Skill**: Use `frontend-design` skill plugin for ALL UI work
3. **Design Docs**: `.planning/phases/17-design-system/design*.html` (design1-5)
4. **Design System**: `v2/docs/DESIGN_SYSTEM.md`
5. **Animation Patterns**: `v2/docs/ANIMATION_STORYBOARD.md`
6. **Planning Directory**: `.planning/` for context and decisions

### Agent Prompts Must Include
Every Task agent prompt MUST explicitly include:
```
CRITICAL INSTRUCTIONS:
1. Read and follow perm_flow.md for PERM business logic
2. Use frontend-design skill plugin for ALL UI work
3. Reference design docs (design1-5.html) and DESIGN_SYSTEM.md
4. Keep code DRY, KISS, minimal, integrated with existing patterns
5. No duplicate or clashing implementations
6. Explore thoroughly before implementing
7. Use central validation module (convex/lib/perm/) — never recreate logic
```

### V1 Feature Parity
- All v1 chatbot features must exist in v2
- But rebuilt properly, not ported
- V1 is reference/inspiration only

### Tracking
- Create and maintain JSON tracking file for issues/progress
- Update throughout implementation
- Clean up thoroughly after completion

</orchestrator_context>

<notes>
## Additional Context

### User Requirements (from chatbot.md)
The full chatbot vision (Phases 26-29) includes:
1. Answer PERM questions (complex, edge cases, follow-ups)
2. Answer app/website questions (how-tos)
3. Query user data (cases, deadlines, complex filters)
4. Take any user action (CRUD, bulk, settings, sync)

But for Phase 26, we're building the **foundation only**.

### Non-Functional Requirements
- **Fully Free** — Use free-tier LLM providers only
- **Best Quality** — Prioritize smartest models in fallback chain
- **Real-time** — Live, synced, Convex subscriptions
- **Performance** — Optimized, fast responses
- **Edge Cases** — Foolproof handling
- **Error Handling** — Graceful failures, rate limits, retries

### LLM Provider Priority (Free Only)
```
Tier 1 (Smartest — Try First):
├── Gemini 2.5 Flash (1M context, 15 RPM free)
├── OpenRouter: Qwen 235B (largest free model)
└── OpenRouter: Llama 3.3 70B

Tier 2 (Good Quality):
├── Groq: Llama 3.3 70B (14,400 req/day, fastest)
├── OpenRouter: Mistral Small 24B
└── OpenRouter: Various free models

Tier 3 (Fallback):
├── Cerebras: Llama 3.3 70B (30 RPM)
└── Mistral: mistral-small-latest
```

### Convex Schema (Already Exists)
```typescript
conversations: {
  userId, title, isArchived, metadata, createdAt, updatedAt
}
conversationMessages: {
  conversationId, role, content, toolCalls, metadata, createdAt
}
```
Indexes: `by_user_id`, `by_user_and_archived`, `by_conversation_id`, `by_created_at`

</notes>

---

*Phase: 26-chat-foundation*
*Context gathered: 2026-01-03*
