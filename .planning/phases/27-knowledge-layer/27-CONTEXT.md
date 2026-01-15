# Phase 27: Knowledge Layer - Context

**Gathered:** 2026-01-04
**Status:** Ready for planning

<vision>
## How This Should Work

The chatbot acts as a **personal PERM consultant** - not just a search engine or generic AI, but someone who knows your specific cases and can give tailored advice based on your situation.

When you ask a question, it feels like talking to an expert who:
- Knows the PERM regulations inside and out
- Has your entire case portfolio at their fingertips
- Can search the web for the latest DOL guidance when needed
- Remembers what you discussed earlier in the conversation

Professional quality like Claude/ChatGPT - thorough, well-structured answers that cite their sources. When it says "According to 20 CFR 656.40(c)..." you can trust it actually checked.

Conversational flow is natural - ask follow-ups, get context-aware responses. "What about the other case?" just works because it remembers you were discussing cases.

</vision>

<essential>
## What Must Be Nailed

All three are **equally critical** - can't compromise on any:

- **Always cite sources** - Every PERM answer shows where the info came from (CFR, DOL, perm_flow.md, etc.). No unsourced claims.

- **Knows MY cases** - Answers in context of specific situations. "Your PWD expires in 30 days" not "PWDs typically expire..."

- **Never hallucinates** - Only says things it can back up. Admits uncertainty. If it doesn't know, it says so rather than making something up.

</essential>

<boundaries>
## What's Out of Scope

- **Taking actions** (create/edit/delete cases, modify settings) - That's Phase 28
- **Bulk operations** - Phase 29
- **Permission system for actions** - Phase 28

**In scope:**
- Answering questions (PERM, app how-tos, case data)
- Web search for regulations
- Full read access to all user data
- Conversational follow-ups within same conversation

</boundaries>

<specifics>
## Specific Ideas

- **Quality bar:** Like Claude/ChatGPT - professional, thorough, properly cited
- **All free:** Must use free providers only (Convex vectors, Gemini embeddings, multi-provider web search)
- **Multi-provider fallbacks:** More free options = more capacity (from v1 exploration: Brave + Google + Tavily + DDG + Jina for web search)
- **v1 patterns to keep:** Anti-hallucination prompts, fuzzy status matching, search intent detection, tiered case data access
- **v2 only:** No v1 feature docs, only v2 app knowledge

</specifics>

<notes>
## Additional Context

From chatbot.md requirements:
- Fully free
- Chatbot only when logged in (no public)
- Industry standard practices (DRY, KISS, no workarounds)
- Optimized for performance and speed
- Real-time, fully synced
- Proper error handling for failures, rate limits, loops

From v1 exploration:
- Web search has 4-provider fallback chain already built (spare parts)
- LLM providers via OpenRouter give ~1,550 free req/day across 31 models
- System prompts with anti-hallucination guards are proven effective
- 3-tier case data access (simple → smart → full) is solid pattern

Embedding approach: RAG with Convex vector search + Gemini embeddings (chunk perm_flow.md and docs by section, ~300-500 tokens per chunk)

</notes>

---

*Phase: 27-knowledge-layer*
*Context gathered: 2026-01-04*
