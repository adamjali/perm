# Phase 27: Knowledge Layer - Research

**Researched:** 2026-01-04
**Domain:** RAG + Web Search + Anti-Hallucination for PERM Chatbot
**Confidence:** HIGH

<research_summary>
## Summary

Researched the ecosystem for building a knowledge-enhanced chatbot that can answer PERM questions with citations, access user case data, and search the web for regulations. The standard approach uses **Convex RAG component** for vector search with **Gemini embeddings** (free tier), combined with **multi-provider web search** (Tavily + Brave + Jina) and **tiered case data access**.

Key finding: Convex has an official RAG component (`@convex-dev/rag`) that handles chunking, embedding storage, and semantic search out of the box. This eliminates the need for external vector databases. For web search, Tavily (1,000 free/month) is purpose-built for AI chatbots with citation-ready results.

The v1 codebase has proven patterns for case data access (`case_data` tool with composable filters) and anti-hallucination (structured prompts with tool routing). These patterns should be adapted for v2.

**Primary recommendation:** Use Convex RAG component with Gemini embeddings for PERM knowledge, Tavily as primary web search with Brave/Jina fallbacks, and a 3-tier case data access pattern (summary → smart → full). All free-tier only.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @convex-dev/rag | 0.1.x | RAG with vector search | Official Convex component, handles chunking/embeddings |
| @ai-sdk/google | latest | Gemini embeddings | Free tier: 1500 RPD, `gemini-embedding-001` |
| ai | 5.x | embed/embedMany functions | AI SDK embedding utilities |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tavily | latest | AI-optimized web search | Primary web search (1000 free/month) |
| @anthropic-ai/sdk | latest | Brave Search (if needed) | Fallback search (2000 free/month) |
| jina-ai | - | Web scraping to markdown | URL content extraction (10M tokens free) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Convex RAG | Pinecone/Weaviate | External DB adds complexity, Convex RAG is integrated |
| Gemini embeddings | OpenAI text-embedding-3-small | OpenAI costs money, Gemini free tier is generous |
| Tavily | Brave Search API | Tavily has better AI-optimized results with citations |
| @convex-dev/agent | Custom implementation | Agent component is overkill for Phase 27 (no tools yet) |

**Installation:**
```bash
# Convex RAG component
npx convex component add @convex-dev/rag

# AI SDK embeddings
pnpm add @ai-sdk/google

# Web search
pnpm add tavily
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
v2/
├── convex/
│   ├── lib/
│   │   └── rag/
│   │       ├── index.ts           # RAG component initialization
│   │       ├── ingest.ts          # Document ingestion (perm_flow.md, etc.)
│   │       └── search.ts          # Semantic search queries
│   ├── knowledge.ts               # Knowledge retrieval mutations/queries
│   └── webSearch.ts               # Web search actions
├── src/
│   ├── lib/
│   │   └── ai/
│   │       ├── system-prompt.ts   # Enhanced with RAG context injection
│   │       ├── knowledge.ts       # Knowledge layer utilities
│   │       └── web-search.ts      # Web search client
│   └── app/
│       └── api/
│           └── chat/
│               └── route.ts       # Enhanced with knowledge retrieval
```

### Pattern 1: Convex RAG Initialization
**What:** Set up RAG component with Gemini embeddings
**When to use:** One-time setup in convex/lib/rag/index.ts
**Example:**
```typescript
// convex/lib/rag/index.ts
import { RAG } from "@convex-dev/rag";
import { components } from "../_generated/api";
import { google } from "@ai-sdk/google";

// Gemini embedding model (free tier: 1500 RPD)
// Dimension: 768 for gemini-embedding-001
export const rag = new RAG(components.rag, {
  textEmbeddingModel: google.embedding("gemini-embedding-001"),
  embeddingDimension: 768,
});
```

### Pattern 2: Document Ingestion with Chunking
**What:** Ingest PERM knowledge documents with proper chunking
**When to use:** Initial setup and when documents change
**Example:**
```typescript
// convex/lib/rag/ingest.ts
import { internalAction } from "../_generated/server";
import { rag } from "./index";

export const ingestPERMKnowledge = internalAction({
  args: {},
  handler: async (ctx) => {
    // Chunk perm_flow.md by sections (~300-500 tokens each)
    const sections = [
      {
        title: "PWD Stage",
        content: "PWD (Prevailing Wage Determination): 6-8 months processing...",
        metadata: { source: "perm_flow.md", section: "pwd" }
      },
      // ... more sections
    ];

    for (const section of sections) {
      await rag.add(ctx, {
        namespace: "perm_knowledge",
        title: section.title,
        text: section.content,
        metadata: section.metadata,
      });
    }
  },
});
```

### Pattern 3: RAG Search with Context Injection
**What:** Search knowledge base and inject into prompt
**When to use:** Every chat request that might need PERM knowledge
**Example:**
```typescript
// convex/knowledge.ts
import { action } from "./_generated/server";
import { v } from "convex/values";
import { rag } from "./lib/rag";

export const searchKnowledge = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    const { results, text, entries } = await rag.search(ctx, {
      namespace: "perm_knowledge",
      query,
      limit: 5,
      chunkContext: { before: 1, after: 1 }, // Include surrounding chunks
      vectorScoreThreshold: 0.5,
    });

    return {
      context: text,
      sources: entries.map(e => ({
        title: e.title,
        source: e.metadata?.source,
      })),
    };
  },
});
```

### Pattern 4: Web Search with Multi-Provider Fallback
**What:** Search the web with citation-ready results
**When to use:** When user asks about regulations, current DOL guidance, etc.
**Example:**
```typescript
// convex/webSearch.ts
import { action } from "./_generated/server";
import { v } from "convex/values";

export const searchWeb = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    // Tier 1: Tavily (AI-optimized, 1000 free/month)
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          include_answer: true,
          max_results: 5,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return {
          source: "tavily",
          answer: data.answer,
          results: data.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.content,
          })),
        };
      }
    } catch (e) {
      console.error("Tavily failed:", e);
    }

    // Tier 2: Brave Search (2000 free/month)
    try {
      const response = await fetch(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
        {
          headers: {
            "X-Subscription-Token": process.env.BRAVE_API_KEY!,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return {
          source: "brave",
          results: data.web?.results?.map((r: any) => ({
            title: r.title,
            url: r.url,
            content: r.description,
          })) || [],
        };
      }
    } catch (e) {
      console.error("Brave failed:", e);
    }

    // Tier 3: Return no results (LLM will use knowledge base only)
    return { source: "none", results: [] };
  },
});
```

### Pattern 5: 3-Tier Case Data Access
**What:** Tiered access to case data based on query complexity
**When to use:** All case-related questions
**Example:**
```typescript
// convex/chatCaseData.ts
import { query, action } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserId } from "./lib/auth";

// Tier 1: Summary - for simple questions ("how many cases?")
export const getCaseSummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserId(ctx);
    const cases = await ctx.db
      .query("cases")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return {
      totalCount: cases.length,
      byStatus: groupBy(cases, "caseStatus"),
      byProgress: groupBy(cases, "progressStatus"),
    };
  },
});

// Tier 2: Smart - for filtered/deadline questions
export const getCasesSmart = query({
  args: {
    statusFilter: v.optional(v.string()),
    searchText: v.optional(v.string()),
    includeDeadlines: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);
    let cases = await ctx.db
      .query("cases")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Apply filters
    if (args.statusFilter) {
      cases = cases.filter(c => c.caseStatus === args.statusFilter);
    }
    if (args.searchText) {
      const search = args.searchText.toLowerCase();
      cases = cases.filter(c =>
        c.employerName?.toLowerCase().includes(search) ||
        c.positionTitle?.toLowerCase().includes(search)
      );
    }

    // Return summary with optional deadlines
    return {
      cases: cases.map(c => ({
        id: c._id,
        employerName: c.employerName,
        positionTitle: c.positionTitle,
        caseStatus: c.caseStatus,
        progressStatus: c.progressStatus,
        nextDeadline: args.includeDeadlines ? getNextDeadline(c) : undefined,
      })),
      totalCount: cases.length,
    };
  },
});

// Tier 3: Full - for complex reasoning ("analyze my portfolio")
export const getCasesFull = query({
  args: { caseId: v.optional(v.id("cases")) },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    if (args.caseId) {
      const case_ = await ctx.db.get(args.caseId);
      if (!case_ || case_.userId !== userId) return null;
      return case_;
    }

    return await ctx.db
      .query("cases")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();
  },
});
```

### Pattern 6: Enhanced System Prompt with RAG Context
**What:** Inject retrieved knowledge into system prompt
**When to use:** Every chat API request
**Example:**
```typescript
// src/lib/ai/system-prompt.ts
export function buildSystemPrompt(options: {
  ragContext?: string;
  ragSources?: { title: string; source: string }[];
  webResults?: { title: string; url: string; content: string }[];
  caseContext?: string;
}): string {
  const parts = [
    PERM_DOMAIN_KNOWLEDGE, // Base PERM knowledge
    WEBSITE_STRUCTURE,     // How to use the app
  ];

  // Inject RAG context if available
  if (options.ragContext) {
    parts.push(`
## RELEVANT PERM KNOWLEDGE (from knowledge base)

${options.ragContext}

Sources: ${options.ragSources?.map(s => s.source).join(", ") || "perm_flow.md"}
`);
  }

  // Inject web search results if available
  if (options.webResults?.length) {
    parts.push(`
## WEB SEARCH RESULTS (cite these with URLs)

${options.webResults.map(r => `[${r.title}](${r.url}): ${r.content}`).join("\n\n")}
`);
  }

  // Inject case context if available
  if (options.caseContext) {
    parts.push(`
## USER'S CASE DATA

${options.caseContext}
`);
  }

  parts.push(RESPONSE_GUIDELINES);
  parts.push(CITATION_REQUIREMENTS);

  return parts.join("\n\n---\n\n");
}

const CITATION_REQUIREMENTS = `
## CITATION REQUIREMENTS

CRITICAL: Every factual claim MUST cite its source:
- PERM regulations: Cite "20 CFR 656.XX" or "perm_flow.md"
- User's cases: Cite the case by employer name
- Web results: Cite with [Source Title](URL)
- If unsure: Say "I don't have confirmed information about..."

NEVER make claims without sources. If you can't cite it, don't say it.
`;
```

### Anti-Patterns to Avoid
- **Embedding all case data:** Only embed static knowledge (perm_flow.md), query case data dynamically
- **Single web search provider:** Always have fallbacks - free tiers have low limits
- **Injecting too much context:** Keep under 4K tokens total context to leave room for response
- **Skipping citation:** Every claim needs a source - this is the core anti-hallucination mechanism
- **Caching embeddings client-side:** Let Convex RAG handle caching server-side
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vector storage | Custom table + math | Convex RAG component | Handles chunking, versioning, similarity search |
| Text chunking | Split by character count | RAG component text splitter | Respects sentence boundaries, configurable overlap |
| Embedding generation | Direct API calls | AI SDK `embed`/`embedMany` | Handles batching, retries, provider abstraction |
| Web search | Scraping + parsing | Tavily API | AI-optimized, citation-ready, abstracts complexity |
| Citation tracking | Manual string matching | Structured context injection | RAG component tracks sources automatically |
| Similarity search | Custom cosine similarity | Convex vector index | Optimized, indexed, scales automatically |

**Key insight:** The Convex RAG component and Tavily API are purpose-built for AI chatbot knowledge retrieval. Fighting these leads to edge cases in chunking, embedding versioning, and citation tracking.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Embedding User Case Data
**What goes wrong:** Slow, expensive, stale embeddings
**Why it happens:** Treating dynamic case data like static knowledge
**How to avoid:** Embed only static knowledge (perm_flow.md, app docs). Query case data dynamically via Convex queries.
**Warning signs:** Embeddings out of sync with actual case data, high embedding costs

### Pitfall 2: Too Much Context Injection
**What goes wrong:** Response quality degrades, token limits exceeded
**Why it happens:** Injecting full RAG results + full case data + web results
**How to avoid:** Limit to ~3K tokens total context. Prioritize: case context > RAG > web search.
**Warning signs:** Truncated responses, model ignoring parts of context

### Pitfall 3: No Citation Enforcement
**What goes wrong:** Chatbot hallucinates PERM rules
**Why it happens:** Model makes plausible-sounding claims without source
**How to avoid:** System prompt MUST require citations. Post-process responses to verify sources exist.
**Warning signs:** Claims without "[Source]" or regulation citations

### Pitfall 4: Single Web Search Provider
**What goes wrong:** Chat fails when Tavily hits rate limit
**Why it happens:** Tavily free tier is 1000/month (~33/day)
**How to avoid:** Implement fallback chain: Tavily → Brave → Jina → knowledge-only
**Warning signs:** 429 errors, "couldn't search web" messages

### Pitfall 5: Searching Web for Every Question
**What goes wrong:** Burns through free tier quota
**Why it happens:** Not detecting when local knowledge is sufficient
**How to avoid:** Implement search intent detection. Only search web for: current regulations, specific DOL guidance, questions with temporal signals.
**Warning signs:** Quota exhausted mid-month, slow responses

### Pitfall 6: Embedding Without Metadata
**What goes wrong:** Can't cite sources properly
**Why it happens:** Just embedding text without tracking where it came from
**How to avoid:** Always include `metadata: { source, section, cfr_reference }` when adding to RAG
**Warning signs:** Generic citations like "according to PERM rules"
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Complete RAG Setup with Convex
```typescript
// convex/convex.config.ts
import { defineApp } from "convex/server";
import rag from "@convex-dev/rag/convex.config";

const app = defineApp();
app.use(rag);
export default app;
```

### Embedding PERM Knowledge on Demand
```typescript
// convex/lib/rag/ingest.ts
// Source: @convex-dev/rag README
import { internalAction } from "../_generated/server";
import { rag } from "./index";

const PERM_SECTIONS = [
  {
    title: "PWD Stage Overview",
    content: `PWD (Prevailing Wage Determination) is the first step in the PERM process.
Processing time: 6-8 months. The PWD is valid for 1 year from determination date.
Special rule: Filings between April 2 - June 30 have only 90 days validity.
Regulation: 20 CFR 656.40`,
    metadata: { source: "perm_flow.md", section: "pwd", cfr: "20 CFR 656.40" }
  },
  {
    title: "Recruitment Requirements",
    content: `Recruitment requires: 2 Sunday newspaper ads (7+ days apart),
30-day job order with SWA, Notice of Filing posted 10 business days.
Must wait 30 days after recruitment ends before filing ETA 9089.
Regulation: 20 CFR 656.17`,
    metadata: { source: "perm_flow.md", section: "recruitment", cfr: "20 CFR 656.17" }
  },
  // ... more sections (~10-15 total)
];

export const ingestPERMKnowledge = internalAction({
  args: {},
  handler: async (ctx) => {
    for (const section of PERM_SECTIONS) {
      await rag.add(ctx, {
        namespace: "perm_knowledge",
        title: section.title,
        text: section.content,
        metadata: section.metadata,
      });
    }
    console.log(`Ingested ${PERM_SECTIONS.length} PERM knowledge sections`);
  },
});
```

### Search Intent Detection
```typescript
// src/lib/ai/intent.ts
// Pattern from v1 prompts.py adapted for v2

export type SearchIntent = "web_search" | "case_data" | "knowledge_only" | "how_to";

const WEB_SEARCH_SIGNALS = [
  "current", "latest", "2025", "2026", "today",
  "DOL", "USCIS", "regulation", "CFR", "law",
  "changed", "update", "new rule"
];

const CASE_DATA_SIGNALS = [
  "my case", "my deadline", "how many", "which case",
  "show me", "list", "find", "search"
];

const HOW_TO_SIGNALS = [
  "how do i", "how can i", "how to", "what is the process"
];

export function detectSearchIntent(query: string): SearchIntent {
  const q = query.toLowerCase();

  // How-to questions don't need data lookup
  if (HOW_TO_SIGNALS.some(s => q.includes(s))) {
    return "how_to";
  }

  // Case data questions
  if (CASE_DATA_SIGNALS.some(s => q.includes(s))) {
    return "case_data";
  }

  // Web search for current/regulatory questions
  if (WEB_SEARCH_SIGNALS.some(s => q.includes(s))) {
    return "web_search";
  }

  // Default to knowledge-only (RAG search)
  return "knowledge_only";
}
```

### Chat API Route with Knowledge Layer
```typescript
// src/app/api/chat/route.ts
import { streamText, convertToModelMessages } from "ai";
import { fetchQuery, fetchAction } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { chatModel } from "@/lib/ai/providers";
import { buildSystemPrompt } from "@/lib/ai/system-prompt";
import { detectSearchIntent } from "@/lib/ai/intent";

export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, conversationId } = await req.json();

  // Get user's latest message
  const userMessage = messages[messages.length - 1];
  const query = userMessage.content;

  // Detect intent
  const intent = detectSearchIntent(query);

  // Gather context based on intent
  let ragContext, ragSources, webResults, caseContext;

  // Always search knowledge base for PERM questions
  if (intent !== "how_to") {
    const knowledge = await fetchAction(api.knowledge.searchKnowledge, { query });
    ragContext = knowledge.context;
    ragSources = knowledge.sources;
  }

  // Search web for regulatory/current questions
  if (intent === "web_search") {
    const web = await fetchAction(api.webSearch.searchWeb, { query });
    webResults = web.results;
  }

  // Get case context for case-related questions
  if (intent === "case_data") {
    const cases = await fetchQuery(api.chatCaseData.getCasesSmart, {
      includeDeadlines: query.includes("deadline"),
    });
    caseContext = JSON.stringify(cases, null, 2);
  }

  // Build enhanced system prompt
  const systemPrompt = buildSystemPrompt({
    ragContext,
    ragSources,
    webResults,
    caseContext,
  });

  // Stream response
  const result = streamText({
    model: chatModel,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    maxTokens: 2000,
  });

  return result.toUIMessageStreamResponse();
}
```

### Web Search with Rate Limit Tracking
```typescript
// convex/webSearch.ts
import { action, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// Track API usage for rate limiting
export const trackApiUsage = internalMutation({
  args: { provider: v.string() },
  handler: async (ctx, { provider }) => {
    const today = new Date().toISOString().split("T")[0];
    const existing = await ctx.db
      .query("apiUsage")
      .withIndex("by_provider_date", (q) =>
        q.eq("provider", provider).eq("date", today)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { count: existing.count + 1 });
    } else {
      await ctx.db.insert("apiUsage", { provider, date: today, count: 1 });
    }
  },
});

export const searchWeb = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    // Check Tavily quota (1000/month ≈ 33/day)
    const tavilyUsage = await ctx.runQuery(api.webSearch.getUsage, {
      provider: "tavily",
    });

    if (tavilyUsage < 30) {
      try {
        const result = await tavilySearch(query);
        await ctx.runMutation(internal.webSearch.trackApiUsage, {
          provider: "tavily",
        });
        return result;
      } catch (e) {
        console.error("Tavily failed:", e);
      }
    }

    // Fallback to Brave (2000/month ≈ 66/day)
    const braveUsage = await ctx.runQuery(api.webSearch.getUsage, {
      provider: "brave",
    });

    if (braveUsage < 60) {
      try {
        const result = await braveSearch(query);
        await ctx.runMutation(internal.webSearch.trackApiUsage, {
          provider: "brave",
        });
        return result;
      } catch (e) {
        console.error("Brave failed:", e);
      }
    }

    // Return empty (will use knowledge base only)
    return { source: "none", results: [] };
  },
});
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| External vector DBs (Pinecone) | Convex RAG component | 2025 | Integrated solution, no external service |
| OpenAI embeddings only | Multi-provider (Gemini free) | 2025 | Free tier embeddings available |
| Single search API | Multi-provider fallback | 2025 | Reliability with free tiers |
| Manual chunking | RAG component text splitter | 2025 | Better chunk boundaries |
| Prompt-only anti-hallucination | RAG + structured citations | 2025 | Verifiable sources |

**New tools/patterns to consider:**
- **Convex RAG component:** Official component for vector search with automatic versioning
- **Gemini embedding-001:** Free tier (1500 RPD), 768 dimensions, good quality
- **Tavily QnA endpoint:** Direct answer generation for simple questions
- **Self-RAG pattern:** Model decides when to retrieve (reduces unnecessary searches)

**Deprecated/outdated:**
- **Manual cosine similarity:** Use Convex vector indexes
- **Single embedding model:** Always have fallback (Gemini → Cohere → local)
- **Scraping for web search:** Use Tavily/Brave APIs for structured results
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Optimal Chunk Size for Legal Content**
   - What we know: 300-500 tokens is standard, legal content may need larger
   - What's unclear: Best size for PERM regulations with cross-references
   - Recommendation: Start with 400 tokens, test and adjust based on retrieval quality

2. **Web Search Quota Allocation**
   - What we know: Tavily 1000/mo, Brave 2000/mo free
   - What's unclear: Actual usage patterns for PERM chatbot
   - Recommendation: Implement tracking, optimize based on real usage data

3. **Citation Verification**
   - What we know: System prompt requires citations
   - What's unclear: How to automatically verify citations in response
   - Recommendation: Post-processing to check for citation markers, flag uncited claims
</open_questions>

<free_tier_reference>
## Free Tier Reference (January 2026)

### Embedding Models
| Provider | Model | Free Tier | Dimensions |
|----------|-------|-----------|------------|
| Google | gemini-embedding-001 | 1500 RPD | 768 |
| Cohere | embed-english-v3.0 | 100 RPM trial | 1024 |
| OpenAI | text-embedding-3-small | $0 (need to pay) | 1536 |

**Recommendation:** Use Gemini (free, good quality)

### Web Search APIs
| Provider | Free Tier | Best For |
|----------|-----------|----------|
| Tavily | 1000/month | AI-optimized results, QnA |
| Brave | 2000/month | Broader coverage, MCP integration |
| Jina Reader | 10M tokens | URL → markdown conversion |
| DuckDuckGo | Rate limited | Emergency fallback only |

**Recommendation:** Tavily primary, Brave fallback, Jina for specific URLs

### Estimated Monthly Capacity
- Embeddings: 1500/day × 30 = 45,000 embeddings (more than enough)
- Web search: 1000 + 2000 = 3000 searches/month
- With caching and intent detection: Should cover typical usage
</free_tier_reference>

<v1_patterns_to_keep>
## V1 Patterns to Keep

Proven patterns from v1 chatbot to adapt for v2:

### 1. Composable Case Data Tool
The `case_data` tool pattern with all-optional parameters works well:
```python
# v1 pattern - adapt to Convex
{
  "status_filter": "optional",
  "search_text": "optional",
  "include_deadlines": "optional",
  "get_full_data": "optional"
}
```

### 2. Tool Routing in System Prompt
Clear distinction between:
- "How do I..." → Educational response, no tool
- "Show me..." → Data query with tool
- "What is..." → Knowledge lookup

### 3. Response Guidelines
From v1 prompts.py:
- Match response length to question complexity
- Never invent case data
- Wait for tool results before answering
- Provide natural language summaries

### 4. Anti-Hallucination Guards
From v1:
- "NEVER: Invent case data or counts"
- "ALWAYS: Wait for tool results"
- "Parse JSON and summarize, don't apologize"
</v1_patterns_to_keep>

<sources>
## Sources

### Primary (HIGH confidence)
- [/get-convex/rag](https://github.com/get-convex/rag) - Context7: RAG component setup, search, ingestion
- [/get-convex/agent](https://github.com/get-convex/agent) - Context7: Agent patterns for RAG
- [/vercel/ai](https://github.com/vercel/ai) - Context7: embed, embedMany, RAG patterns
- [Google AI Embedding Models](https://ai.google.dev/gemini-api/docs/embeddings) - Gemini embedding specs

### Secondary (MEDIUM confidence)
- [Tavily API Docs](https://docs.tavily.com) - Web search integration
- [Brave Search API](https://brave.com/search/api/) - Fallback search
- v1 codebase: `backend/app/services/prompts.py` - Proven prompt patterns
- v1 codebase: `backend/app/services/tools/implementations/case_data.py` - Case access patterns

### Tertiary (LOW confidence - verify current values)
- Free tier limits may change - verify before implementation
- Embedding dimension requirements - verify with provider docs
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Convex RAG + Gemini embeddings
- Ecosystem: Tavily, Brave, Jina for web search
- Patterns: RAG, anti-hallucination, case data access
- Pitfalls: Context limits, citation tracking, rate limits

**Confidence breakdown:**
- RAG architecture: HIGH - from official Convex docs
- Embedding models: HIGH - from Google AI docs
- Web search: HIGH - from provider docs
- Anti-hallucination: HIGH - from academic papers + v1 experience
- Code examples: HIGH - adapted from Context7/official sources

**Research date:** 2026-01-04
**Valid until:** 2026-02-04 (30 days - verify free tier limits)
</metadata>

---

*Phase: 27-knowledge-layer*
*Research completed: 2026-01-04*
*Ready for planning: yes*
