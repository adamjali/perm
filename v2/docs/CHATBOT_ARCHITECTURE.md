# PERM Tracker Chatbot Architecture

## Table of Contents
1. [Overview](#overview)
2. [High-Level Architecture](#high-level-architecture)
3. [RAG Pipeline](#rag-pipeline)
4. [Tool System](#tool-system)
5. [Message Processing & Streaming](#message-processing--streaming)
6. [UI Components](#ui-components)
7. [Backend (Convex)](#backend-convex)
8. [Context Injection](#context-injection)
9. [File Reference](#file-reference)

---

## Overview

The PERM Tracker chatbot is a production-grade AI assistant built with:
- **Frontend:** Next.js 16 + React 19 + TypeScript
- **AI SDK:** Vercel AI SDK v5 with streaming support
- **Backend:** Convex serverless functions
- **RAG:** `@convex-dev/rag` with Google Gemini embeddings
- **Multi-Provider Fallback:** 8 models across 5 providers (Gemini, OpenRouter, Groq, Cerebras, Mistral)

### Key Capabilities
- **Domain Knowledge:** PERM immigration regulations (20 CFR Part 656)
- **Case Management:** Query, create, update, archive, delete cases
- **Deadline Tracking:** PWD expiration, recruitment windows, filing deadlines
- **Calendar Sync:** Google Calendar integration for deadlines
- **Knowledge Search:** RAG-based semantic search over PERM regulations
- **Web Search:** Real-time DOL/USCIS processing times and updates

---

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend (Next.js)"]
        UI[Chat Widget]
        Hook[useChatWithPersistence]
        TO[useToolOrchestrator]
        PC[PageContextProvider]
    end

    subgraph API["API Routes"]
        ChatRoute["/api/chat"]
        ToolRoute["/api/chat/execute-tool"]
    end

    subgraph AI["AI Layer"]
        SDK[Vercel AI SDK]
        FB[ai-fallback]
        SP[System Prompt]
        Tools[Tool Definitions]
    end

    subgraph Providers["AI Providers"]
        G[Gemini 2.5/3 Flash]
        OR[OpenRouter]
        GQ[Groq]
        CB[Cerebras]
        MI[Mistral]
    end

    subgraph Backend["Convex Backend"]
        Conv[Conversations]
        Msg[Messages]
        Cases[Case Data]
        RAG[RAG Component]
        WS[Web Search]
        Cache[Tool Cache]
    end

    UI --> Hook
    Hook --> ChatRoute
    Hook --> TO
    TO --> ToolRoute
    PC --> Hook

    ChatRoute --> SDK
    SDK --> FB
    FB --> G & OR & GQ & CB & MI
    SDK --> Tools
    SP --> SDK

    ToolRoute --> Cases
    Tools --> RAG & Cases & WS

    ChatRoute --> Conv & Msg
    RAG --> Cache
    WS --> Cache
```

### Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| **ChatWidget** | Floating chat UI with message list, input, history |
| **useChatWithPersistence** | Streaming + Convex persistence + optimistic updates |
| **useToolOrchestrator** | Tool execution, confirmations, navigation |
| **PageContextProvider** | Makes AI aware of current page, selected cases |
| **/api/chat** | Main streaming endpoint with multi-provider fallback |
| **/api/chat/execute-tool** | Executes tools after user confirmation |
| **Convex Backend** | Data persistence, queries, RAG, web search |

---

## RAG Pipeline

The RAG (Retrieval-Augmented Generation) pipeline provides the chatbot with up-to-date PERM domain knowledge.

### RAG Architecture

```mermaid
flowchart LR
    subgraph Ingestion["Knowledge Ingestion"]
        PK[PERM Knowledge Sections]
        AG[App Guide Sections]
        ING[Ingest Functions]
    end

    subgraph Storage["Vector Storage"]
        EMB["Gemini Embedding<br/>(gemini-embedding-001)"]
        VS["Convex Vector Store<br/>(3072 dimensions)"]
        NS["Namespace: perm_knowledge"]
    end

    subgraph Retrieval["Retrieval"]
        Q[User Query]
        SS["Semantic Search<br/>(threshold: 0.3)"]
        TOP["Top 5 Results<br/>+ Chunk Context"]
    end

    subgraph Output["Context Assembly"]
        CTX[Retrieved Context]
        SRC[Source Citations]
        LLM[LLM Input]
    end

    PK --> ING
    AG --> ING
    ING --> EMB
    EMB --> VS
    VS --> NS

    Q --> EMB
    EMB --> SS
    SS --> VS
    VS --> TOP

    TOP --> CTX
    TOP --> SRC
    CTX --> LLM
    SRC --> LLM
```

### Knowledge Base Structure

**21+ PERM Knowledge Sections:**

| Section | Content | CFR Reference |
|---------|---------|---------------|
| PWD Application & Expiration | 90-day rule, June 30 rule | 20 CFR 656.40 |
| Recruitment Stage | 180-day window, required methods | 20 CFR 656.17 |
| Notice of Filing | 10 business day posting | 20 CFR 656.10 |
| Job Order | 30-day SWA posting | 20 CFR 656.17 |
| Sunday Ads | 7-day separation rule | 20 CFR 656.17 |
| Professional Occupation | 3 additional methods | 20 CFR 656.17 |
| 30-180 Filing Window | ETA 9089 timing rules | 20 CFR 656.17 |
| I-140 Deadline | 180-day certification window | 20 CFR 656.30 |
| RFI/RFE Response | Strict 30-day deadline | 20 CFR 656.20 |

### RAG Search Flow

```mermaid
sequenceDiagram
    participant U as User
    participant AI as AI Assistant
    participant T as searchKnowledge Tool
    participant RAG as RAG Component
    participant EMB as Gemini Embeddings
    participant VS as Vector Store

    U->>AI: "What's the PWD expiration rule?"
    AI->>T: Execute searchKnowledge
    T->>EMB: Embed query
    EMB-->>T: Query vector (3072 dims)
    T->>RAG: search(query, namespace, threshold)
    RAG->>VS: Vector similarity search
    VS-->>RAG: Top 5 matches + scores
    RAG-->>T: Context text + sources
    T-->>AI: {context, sources[]}
    AI->>U: "PWD expires after 90 days... (20 CFR 656.40)"
```

### Configuration

```typescript
// convex/lib/rag/index.ts
export const rag = new RAG(components.rag, {
  textEmbeddingModel: google.embedding("gemini-embedding-001"),
  embeddingDimension: 3072,
});

// Search parameters
const result = await rag.search(ctx, {
  namespace: "perm_knowledge",
  query: userQuestion,
  limit: 5,
  chunkContext: { before: 1, after: 1 },
  vectorScoreThreshold: 0.3,  // Low for broad recall
});
```

---

## Tool System

The chatbot has 28 tools across 8 categories, each with defined permissions.

### Tool Categories

```mermaid
mindmap
  root((Chat Tools))
    Query Tools
      queryCases
      searchKnowledge
      searchWeb
    Navigation
      navigate
      viewCase
      scrollTo
      refreshPage
    Case CRUD
      createCase
      updateCase
      archiveCase
      reopenCase
      deleteCase
    Calendar
      syncToCalendar
      unsyncFromCalendar
    Notifications
      markNotificationRead
      markAllNotificationsRead
      deleteNotification
      clearAllNotifications
    Bulk Operations
      bulkUpdateStatus
      bulkArchiveCases
      bulkDeleteCases
      bulkCalendarSync
    Settings
      updateSettings
      getSettings
    Templates
      listJobDescriptionTemplates
      createJobDescriptionTemplate
      updateJobDescriptionTemplate
      deleteJobDescriptionTemplate
```

### Permission System

| Permission Level | Behavior in CONFIRM Mode | Behavior in AUTO Mode | Tools |
|-----------------|--------------------------|----------------------|-------|
| **autonomous** | Execute immediately | Execute immediately | Query, Navigation, getSettings |
| **confirm** | Wait for user approval | Execute immediately | Case CRUD, Calendar, Notifications, Settings |
| **destructive** | Always wait for approval | Always wait for approval | deleteCase, bulk operations |

### Tool Execution Flow

```mermaid
sequenceDiagram
    participant U as User
    participant AI as AI Assistant
    participant PM as Permission Manager
    participant UI as Confirmation Card
    participant EX as Tool Executor
    participant DB as Convex Database

    U->>AI: "Archive case ABC123"
    AI->>PM: Check permission(archiveCase)
    PM-->>AI: requiresConfirmation: true
    AI-->>UI: Show confirmation card

    alt User Approves
        U->>UI: Click Approve
        UI->>EX: POST /api/chat/execute-tool
        EX->>DB: api.cases.remove(caseId)
        DB-->>EX: Success
        EX-->>UI: {success: true, message: "Archived"}
        UI-->>U: Show success result
    else User Denies
        U->>UI: Click Deny
        UI-->>AI: Tool denied
        AI-->>U: "Action cancelled"
    end
```

### Tool Definition Structure

```typescript
// src/lib/ai/tools.ts
export const queryCases = tool({
  description: `Query the user's PERM cases with flexible filters...`,
  parameters: z.object({
    caseStatus: z.enum(["pwd", "recruitment", "eta9089", "i140", "closed"]).optional(),
    progressStatus: z.enum(["working", "waiting_intake", ...]).optional(),
    hasRfi: z.boolean().optional(),
    hasRfe: z.boolean().optional(),
    hasOverdueDeadline: z.boolean().optional(),
    deadlineWithinDays: z.number().optional(),
    searchText: z.string().optional(),
    // ... more filters
  }),
  execute: async (params) => {
    // Execute with caching
    return executeWithCache("query_cases", params, () =>
      fetchQuery(api.chatCaseData.queryCases, params)
    );
  }
});
```

---

## Message Processing & Streaming

### Streaming Architecture

```mermaid
flowchart TB
    subgraph Input["User Input"]
        MSG[User Message]
        CTX[Page Context]
    end

    subgraph Processing["Server Processing"]
        AUTH[Convex Auth]
        CONV[Load Conversation]
        SUM["Check Summarization<br/>(> 12 messages?)"]
        SYS[Build System Prompt]
        TOOLS[Create Tools]
    end

    subgraph Streaming["AI Streaming"]
        SDK["streamText()"]
        MODEL[Model Fallback Chain]
        CHUNKS[Stream Chunks]
        TC[Tool Calls]
    end

    subgraph Persistence["Persistence"]
        OPT[Optimistic UI]
        SAVE[Save to Convex]
        CACHE[Cache Tool Results]
    end

    MSG --> AUTH
    CTX --> AUTH
    AUTH --> CONV
    CONV --> SUM
    SUM --> SYS
    SYS --> TOOLS
    TOOLS --> SDK
    SDK --> MODEL
    MODEL --> CHUNKS
    MODEL --> TC
    CHUNKS --> OPT
    TC --> CACHE
    OPT --> SAVE
```

### Model Fallback Chain

```mermaid
flowchart LR
    subgraph Tier1["Tier 1 - Primary"]
        G25[Gemini 2.5 Flash]
        G3[Gemini 3 Flash Preview]
    end

    subgraph Tier2["Tier 2 - Strong Tool Calling"]
        DEV[Devstral 2<br/>72.2%]
        LL[Llama 3.3 70B<br/>77.3%]
        MIS[Mistral Small<br/>~70%]
        GRQ[Groq Llama<br/>77.3%]
    end

    subgraph Tier3["Tier 3 - Emergency"]
        CB1[Cerebras Llama 70B<br/>2000+ tok/s]
        CB2[Cerebras Llama 8B<br/>Emergency]
    end

    G25 -->|fail| G3
    G3 -->|fail| DEV
    DEV -->|fail| LL
    LL -->|fail| MIS
    MIS -->|fail| GRQ
    GRQ -->|fail| CB1
    CB1 -->|fail| CB2
```

### Message State Machine

```mermaid
stateDiagram-v2
    [*] --> Ready
    Ready --> Submitted: User sends message
    Submitted --> Streaming: First chunk received
    Streaming --> Streaming: More chunks
    Streaming --> ToolExecuting: Tool call detected
    ToolExecuting --> Streaming: Tool result
    Streaming --> Persisting: Stream complete
    Persisting --> Ready: Saved to Convex

    Submitted --> Error: API failure
    Streaming --> Error: Mid-stream error
    Error --> Ready: User retries
```

### Optimistic Updates

```typescript
// useChatWithPersistence.ts
const handleSend = async (message: string) => {
  // 1. Optimistic: Show immediately
  flushSync(() => setOptimisticMessage({ role: 'user', content: message }));

  // 2. Create conversation if needed
  const convId = conversationId ?? await createConversation();

  // 3. Fire-and-forget: Save to Convex (don't wait)
  createUserMessage({ conversationId: convId, content: message });

  // 4. Stream response from AI
  await sendMessage(message);

  // 5. Clear optimistic when persisted message appears
  // (handled by useEffect watching persisted messages)
};
```

---

## UI Components

### Component Hierarchy

```mermaid
flowchart TB
    subgraph Connected["ChatWidgetConnected (State)"]
        PC[usePageContext]
        CHAT[useChatWithPersistence]
        ORCH[useToolOrchestrator]
    end

    subgraph Widget["ChatWidget (Container)"]
        BUBBLE[Floating Bubble]
        PANEL[ChatPanel]
    end

    subgraph Panel["ChatPanel (Layout)"]
        HEADER[Header + ActionMode]
        MESSAGES[Message List]
        INPUT[ChatInput]
        HISTORY[ChatHistory Modal]
    end

    subgraph Message["Message Components"]
        CM[ChatMessage]
        MD[ChatMarkdown]
        TW[Typewriter Effect]
        TCL[ToolCallList]
        TCC[ToolCallCard]
        ICC[InChatConfirmationCard]
    end

    Connected --> Widget
    Widget --> BUBBLE
    Widget --> PANEL
    PANEL --> HEADER & MESSAGES & INPUT & HISTORY
    MESSAGES --> CM
    CM --> MD & TW & TCL
    TCL --> TCC
    TCC --> ICC
```

### Key UI Features

1. **Typewriter Effect:** 3 characters revealed every 15ms
2. **Auto-scroll:** Tracks user scroll position, pauses if user scrolls up
3. **Voice Input:** Web Speech API with transcript insertion
4. **Tool Confirmations:** Inline approval/denial cards
5. **Action Mode Toggle:** OFF / CONFIRM / AUTO segmented control
6. **Chat History:** Slide-out panel for conversation switching

### Message Rendering

```mermaid
flowchart LR
    subgraph Source["Message Sources"]
        S1[Persisted Messages]
        S2[Optimistic User Msg]
        S3[Streaming Assistant]
    end

    subgraph Merge["Display Merge"]
        M[displayMessages]
    end

    subgraph Render["Rendering"]
        R1[ChatMessage]
        R2[ChatMarkdown]
        R3[Typewriter]
        R4[ToolCallList]
    end

    S1 --> M
    S2 --> M
    S3 --> M
    M --> R1
    R1 --> R2 --> R3
    R1 --> R4
```

---

## Backend (Convex)

### Database Schema

```mermaid
erDiagram
    users ||--o{ conversations : owns
    conversations ||--o{ conversationMessages : contains
    conversations ||--o{ toolCache : caches
    users ||--o{ cases : owns

    conversations {
        id string PK
        userId id FK
        title string
        isArchived boolean
        metadata object
        summary object
        createdAt number
        updatedAt number
    }

    conversationMessages {
        id string PK
        conversationId id FK
        role enum
        content string
        toolCalls array
        metadata object
        createdAt number
    }

    toolCache {
        id string PK
        conversationId id FK
        toolName string
        queryHash string
        queryParams string
        result string
        expiresAt number
    }

    apiUsage {
        id string PK
        provider string
        date string
        callCount number
    }
```

### Convex Functions

| Module | Function | Type | Purpose |
|--------|----------|------|---------|
| `conversations` | `create` | mutation | Create new conversation |
| | `get` | query | Get conversation by ID |
| | `list` | query | List user's conversations |
| | `deleteConversation` | mutation | Delete conversation + messages |
| `conversationMessages` | `createUserMessage` | mutation | Save user message |
| | `createAssistantMessage` | mutation | Save assistant response + tools |
| | `list` | query | Get messages in conversation |
| | `updateToolCallResult` | mutation | Persist tool execution result |
| `chatCaseData` | `queryCases` | query | Flexible case queries |
| | `getCaseSummary` | query | Aggregate case statistics |
| `knowledge` | `searchKnowledge` | action | RAG semantic search |
| `webSearch` | `searchWeb` | action | Multi-provider web search |
| `toolCache` | `get` / `set` | query/mutation | Cache tool results |

### Web Search Fallback

```mermaid
flowchart LR
    subgraph Primary["Primary: Tavily"]
        T1[Check daily limit]
        T2[Call Tavily API]
        T3[Return answer + results]
    end

    subgraph Fallback["Fallback: Brave"]
        B1[Check daily limit]
        B2[Call Brave API]
        B3[Return results]
    end

    subgraph RateLimit["Rate Limiting"]
        RL[apiUsage table]
        L1["Tavily: 30/day"]
        L2["Brave: 60/day"]
    end

    T1 --> RL
    B1 --> RL
    T1 -->|under limit| T2
    T2 --> T3
    T1 -->|over limit| B1
    T2 -->|error| B1
    B1 -->|under limit| B2
    B2 --> B3
```

---

## Context Injection

### Multi-Layer Context

```mermaid
flowchart TB
    subgraph Static["Static Knowledge"]
        PERM[PERM Domain<br/>Statuses, Deadlines, Rules]
        APP[App Features<br/>Dashboard, Cases, Calendar]
        TOOLS[Tool Guidelines<br/>When to use each tool]
        RESP[Response Rules<br/>Formatting, Citations]
    end

    subgraph Dynamic["Runtime Context"]
        DATE[Current Date/Time]
        PAGE[Page Context<br/>Path, Type, IDs]
        MODE[Action Mode<br/>OFF/CONFIRM/AUTO]
        STATS[Case Summary<br/>Total, Overdue, RFI]
    end

    subgraph Conversation["Conversation Context"]
        SUM[Summary<br/>Compressed History]
        RECENT[Recent Messages<br/>Last 6 verbatim]
    end

    subgraph Tools["Tool Results"]
        CASES[Case Query Results]
        KNOW[Knowledge Search]
        WEB[Web Search Results]
    end

    Static --> SystemPrompt
    Dynamic --> SystemPrompt
    Conversation --> Messages
    Tools --> Messages
    SystemPrompt --> LLM
    Messages --> LLM
```

### Page Context Types

```typescript
interface PageContext {
  // Always present
  path: string;
  pageType: 'dashboard' | 'cases_list' | 'case_detail' | 'calendar' | 'notifications' | 'settings';
  timestamp: number;

  // Case detail page
  currentCaseId?: string;
  currentCaseData?: CaseSummary;

  // Cases list page
  filters?: { status?, progressStatus?, search? };
  pagination?: { totalCount };
  visibleCaseIds?: string[];   // Cases on screen
  selectedCaseIds?: string[];  // Checked cases

  // Calendar page
  calendarFilters?: { view, dateRange };
  visibleEventCount?: number;

  // Notifications page
  notificationTab?: 'all' | 'unread';
  unreadCount?: number;
}
```

### Conversation Summarization

```mermaid
sequenceDiagram
    participant CHAT as Chat Route
    participant CHECK as Summarization Check
    participant LLM as Gemini Flash Lite
    participant DB as Convex DB

    Note over CHAT: After response completes
    CHAT->>CHECK: Message count > 12?

    alt Needs Summarization
        CHECK->>DB: Fetch messages 1 to N-6
        DB-->>CHECK: Old messages
        CHECK->>LLM: Summarize these messages
        LLM-->>CHECK: 2-4 paragraph summary
        CHECK->>DB: Save summary to conversation
        Note over DB: summary.content<br/>summary.tokenCount<br/>summary.messageCountAtSummary
    end

    Note over CHAT: Next request uses:<br/>summary + recent 6 messages
```

---

## File Reference

### Core Files

| Category | File | Purpose |
|----------|------|---------|
| **API Routes** | `src/app/api/chat/route.ts` | Main streaming endpoint |
| | `src/app/api/chat/execute-tool/route.ts` | Tool execution |
| **AI Layer** | `src/lib/ai/providers.ts` | Multi-provider config |
| | `src/lib/ai/tools.ts` | 28 tool definitions |
| | `src/lib/ai/system-prompt.ts` | System prompt builder |
| | `src/lib/ai/summarize.ts` | Conversation compression |
| | `src/lib/ai/cache.ts` | Tool result caching |
| | `src/lib/ai/tool-permissions.ts` | Permission system |
| **Hooks** | `src/hooks/useChatWithPersistence.ts` | Chat state + streaming |
| | `src/hooks/useToolOrchestrator.ts` | Tool execution flow |
| | `src/hooks/useToolConfirmations.ts` | Confirmation state |
| | `src/lib/ai/page-context.tsx` | Page awareness |
| **UI Components** | `src/components/chat/ChatWidgetConnected.tsx` | Connected wrapper |
| | `src/components/chat/ChatWidget.tsx` | Container |
| | `src/components/chat/ChatPanel.tsx` | Main layout |
| | `src/components/chat/ChatMessage.tsx` | Message rendering |
| | `src/components/chat/ChatInput.tsx` | Input + voice |
| | `src/components/chat/ToolCallCard.tsx` | Tool display |
| | `src/components/chat/ChatMarkdown.tsx` | Markdown rendering |
| **Convex Backend** | `convex/conversations.ts` | Conversation CRUD |
| | `convex/conversationMessages.ts` | Message CRUD |
| | `convex/chatCaseData.ts` | Case queries for AI |
| | `convex/knowledge.ts` | RAG search |
| | `convex/webSearch.ts` | Web search |
| | `convex/toolCache.ts` | Caching |
| | `convex/lib/rag/index.ts` | RAG instance |
| | `convex/lib/rag/permKnowledge.ts` | PERM knowledge |
| | `convex/lib/rag/appGuideKnowledge.ts` | App guide |
| | `convex/lib/rag/ingest.ts` | Ingestion functions |

### Statistics

| Metric | Value |
|--------|-------|
| AI Providers | 5 (Google, OpenRouter, Groq, Cerebras, Mistral) |
| AI Models | 8 in fallback chain |
| Tools | 28 across 8 categories |
| Knowledge Sections | 21+ PERM regulatory sections |
| Embedding Dimensions | 3072 (Gemini) |
| Vector Threshold | 0.3 (tuned for recall) |
| Summarization Trigger | 12 messages |
| Recent Messages Kept | 6 verbatim |
| Web Search Providers | 2 (Tavily + Brave) |
| Total Test Coverage | 3600+ tests |

---

## Quick Start

```bash
# 1. Start Convex dev server
npx convex dev

# 2. Start Next.js dev server
pnpm dev

# 3. Ingest knowledge base (one-time)
# In Convex dashboard, run:
# - knowledge.ingestPERMKnowledge()
# - knowledge.ingestAppGuideKnowledge()
```

## Environment Variables

```bash
# AI Providers
GOOGLE_GENERATIVE_AI_API_KEY=   # Gemini (primary)
OPENROUTER_API_KEY=              # OpenRouter (fallback)
GROQ_API_KEY=                    # Groq (fallback)
CEREBRAS_API_KEY=                # Cerebras (fallback)
MISTRAL_API_KEY=                 # Mistral (fallback)

# Web Search
TAVILY_API_KEY=                  # Primary web search
BRAVE_API_KEY=                   # Fallback web search
```

---

*Last Updated: January 2026*
