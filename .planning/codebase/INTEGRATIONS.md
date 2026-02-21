# External Integrations

**Analysis Date:** 2026-02-21

## APIs & External Services

### Convex (Backend-as-a-Service)

- **Purpose:** Real-time database, serverless functions, file storage, scheduling
- **SDK:** `convex` 1.32.0
- **Connection:** WebSocket (real-time) + HTTPS (queries/mutations)
- **Auth:** JWT-based via `@convex-dev/auth`
- **Env vars:**
  - `CONVEX_DEPLOYMENT` — Deployment name (set by `npx convex dev`)
  - `NEXT_PUBLIC_CONVEX_URL` — Public Convex cloud URL
- **Files:**
  - Schema: `v2/convex/schema.ts` (16 tables)
  - Functions: `v2/convex/*.ts` (queries, mutations, actions)
  - HTTP routes: `v2/convex/http.ts`
  - Config: `v2/convex.json`
- **Production deployment:** `giant-dragon-464`
- **Dev deployment:** `giddy-peccary-484`

### AI Chat Providers (5 providers, multi-model fallback)

**Architecture:** Custom `FallbackModel` class in `v2/src/lib/ai/providers.ts` tries each model sequentially per request. All use native AI SDK packages (not generic `createOpenAI()` wrappers).

**API Route:** `POST /api/chat` — `v2/src/app/api/chat/route.ts`

| Tier | Provider | Model | SDK | Env Var | Notes |
|------|----------|-------|-----|---------|-------|
| 1 (Primary) | Google Gemini | gemini-2.5-flash | `@ai-sdk/google` 3.0.29 | `GOOGLE_GENERATIVE_AI_API_KEY` | 20 RPD free, 1M context |
| 2 | Groq | llama-3.3-70b-versatile | `@ai-sdk/groq` 3.0.24 | `GROQ_API_KEY` | 30 RPM, 14400 RPD free, 10k input limit |
| 2 | Mistral | mistral-small-latest | `@ai-sdk/mistral` 3.0.20 | `MISTRAL_API_KEY` | Generous free tier |
| 3 | OpenRouter | llama-3.3-70b-instruct:free | `@openrouter/ai-sdk-provider` 2.2.3 | `OPENROUTER_API_KEY` | Free, often rate-limited |
| 3 (Emergency) | Cerebras | llama3.1-8b | `@ai-sdk/cerebras` 2.0.34 | `CEREBRAS_API_KEY` | 6k input limit, small model |

**Summarization:** Uses Groq (not Gemini) for conversation summarization to avoid competing for same quota. Implemented in `v2/src/lib/ai/summarize.ts`.

**Tool Calling:** AI can query cases, search knowledge (RAG), search web, and execute case modifications with user confirmation. Tools defined in `v2/src/app/api/chat/create-tools.ts`.

**Streaming:** Vercel AI SDK v6 streaming with `createUIMessageStream` + `writer.merge()`. Max 60s timeout, 4000 max output tokens, 10 step limit.

### Web Search Providers (Chatbot)

**Architecture:** Multi-provider fallback with daily rate limit tracking via `apiUsage` Convex table.

**Implementation:** `v2/convex/webSearch.ts` (Convex action called by chat tools)

| Priority | Provider | Daily Limit | Env Var |
|----------|----------|-------------|---------|
| Primary | Tavily | 30/day (free tier) | `TAVILY_API_KEY` |
| Fallback | Brave Search | 60/day (free tier) | `BRAVE_API_KEY` |

**Rate tracking:** `v2/convex/apiUsage.ts` — Stores daily call counts per provider.
**Cache:** `v2/convex/toolCache.ts` — Caches tool results per conversation with TTL expiration.

### RAG (Knowledge Search)

- **Purpose:** Retrieval Augmented Generation for PERM domain knowledge
- **SDK:** `@convex-dev/rag` 0.7.1
- **Config:** `v2/convex/convex.config.ts`, `v2/convex/lib/rag/index.ts`
- **Usage:** Chatbot tool for searching PERM-specific knowledge base

## Authentication & Identity

### Convex Auth (Primary)

- **SDK:** `@convex-dev/auth` 0.0.90 + `@auth/core` 0.41.1
- **Config:** `v2/convex/auth.ts`
- **Providers:**
  1. **Google OAuth** — Via `@auth/core/providers/google`
     - Env: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  2. **Email/Password** — Via `@convex-dev/auth/providers/Password`
     - OTP verification via Resend: `v2/convex/ResendOTP.ts`
     - Password reset via Resend: `v2/convex/ResendPasswordReset.ts`
     - 12-char alphanumeric OTP (5.3 x 10^17 combinations)
     - Minimum 8 character passwords

**Account Linking:** Custom `createOrUpdateUser` callback in `v2/convex/auth.ts` links accounts by verified email (prevents duplicate accounts when user signs up with email then logs in with Google).

**Auth Helpers:**
- `v2/convex/lib/auth.ts` — `getCurrentUserId()`, `getCurrentUserIdOrNull()`, `verifyOwnership()`, `verifyFirmAccess()`
- `extractUserIdFromAction()` — Handles multi-method identity subjects

**JWT:** `JWT_PRIVATE_KEY` env var for Convex Auth token signing.

**Login Tracking:** Client-side via `LoginTracker` component (not in auth callbacks — password sign-ins bypass callbacks).

**Session Management:**
- 15-min inactivity timeout with 2-min warning (OWASP-aligned)
- Multi-tab sync via BroadcastChannel + localStorage
- Rate limiting: `v2/convex/schema.ts` `rateLimits` table

### Google OAuth (Calendar Integration — SEPARATE from Auth)

- **Purpose:** Google Calendar API access for deadline syncing
- **SDK:** `google-auth-library` 10.5.0
- **Config:** `v2/src/lib/google/oauth.ts`
- **Flow:**
  1. `GET /api/google/connect` — Redirects to Google consent screen (`v2/src/app/api/google/connect/route.ts`)
  2. `GET /api/google/callback` — Exchanges code for tokens (`v2/src/app/api/google/callback/route.ts`)
  3. `GET /api/google/disconnect` — Revokes tokens (`v2/src/app/api/google/disconnect/route.ts`)
- **Scope:** `https://www.googleapis.com/auth/calendar.events` (events only, no Gmail)
- **Env vars:**
  - `GOOGLE_CALENDAR_CLIENT_ID` (separate from auth OAuth)
  - `GOOGLE_CALENDAR_CLIENT_SECRET`
  - `CALENDAR_OAUTH_REDIRECT_URI`
  - `CALENDAR_TOKEN_ENCRYPTION_KEY` (AES-256-GCM for token storage)
- **Token storage:** Encrypted at rest in `userProfiles` table (`googleRefreshToken`, `googleAccessToken`, `googleTokenExpiry`)
- **Calendar mutations:** `v2/convex/calendar.ts` — Event creation/update/deletion via Google Calendar API

## Email Service

### Resend

- **Purpose:** Transactional email (notifications, OTP, password reset, admin alerts, weekly digest)
- **SDK:** `resend` 6.9.2
- **Config:** `v2/convex/lib/email.ts` — `getResend()`, `FROM_EMAIL`
- **Env vars:**
  - `AUTH_RESEND_KEY` — API key (used in Convex backend)
  - `RESEND_API_KEY` — API key (for Next.js if needed)
  - `RESEND_WEBHOOK_SECRET` — Webhook signature verification

**Email Templates (React Email):**

| Template | File | Purpose |
|----------|------|---------|
| `DeadlineReminder` | `v2/src/emails/DeadlineReminder.tsx` | Deadline approaching alerts |
| `StatusChange` | `v2/src/emails/StatusChange.tsx` | Case status updates |
| `RfiAlert` | `v2/src/emails/RfiAlert.tsx` | Request for Information |
| `RfeAlert` | `v2/src/emails/RfeAlert.tsx` | Request for Evidence |
| `AutoClosure` | `v2/src/emails/AutoClosure.tsx` | Auto-closure notifications |
| `WeeklyDigest` | `v2/src/emails/WeeklyDigest.tsx` | Weekly summary email |
| `VerificationCode` | `v2/src/emails/VerificationCode.tsx` | OTP verification |
| `PasswordResetCode` | `v2/src/emails/PasswordResetCode.tsx` | Password reset |
| `WelcomeEmail` | `v2/src/emails/WelcomeEmail.tsx` | New user welcome |
| `AdminEmail` | `v2/src/emails/AdminEmail.tsx` | Admin notifications |
| `AccountDeletionConfirm` | `v2/src/emails/AccountDeletionConfirm.tsx` | Deletion confirmation |
| `TestEmail` | `v2/src/emails/TestEmail.tsx` | Test/verify config |
| `RequestAlert` | `v2/src/emails/RequestAlert.tsx` | Support request alerts |

**Email Actions:** `v2/convex/notificationActions.ts` — Renders templates with `@react-email/render` and sends via Resend.

**Sender addresses:**
- `notifications@permtracker.app` — Deadline reminders, status updates
- `noreply@permtracker.app` — Auth emails (OTP, password reset)

## Push Notifications

### Web Push (VAPID)

- **Purpose:** Browser push notifications for deadline alerts
- **SDK:** `web-push` 3.6.7
- **Config:** `v2/convex/pushNotifications.ts` (Node.js action with `"use node"`)
- **Env vars:**
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — Public key (exposed to browser)
  - `VAPID_PRIVATE_KEY` — Private key (server-only)
- **Storage:** Push subscription stored as JSON string in `userProfiles.pushSubscription`

## Monitoring & Observability

### Sentry

- **Purpose:** Error tracking, performance monitoring, session replay
- **SDK:** `@sentry/nextjs` 10.39.0
- **Env vars:**
  - `NEXT_PUBLIC_SENTRY_DSN` — Client-side DSN
  - `SENTRY_DSN` — Server-side DSN
  - `SENTRY_AUTH_TOKEN` — Source map upload token
  - `SENTRY_ORG`, `SENTRY_PROJECT` — Organization/project slugs
  - `SENTRY_DEBUG` / `NEXT_PUBLIC_SENTRY_DEBUG` — Debug mode in dev

**Config files:**
- `v2/sentry.client.config.ts` — Intentionally empty (lazy init via `SentryClientInit` component)
- `v2/sentry.server.config.ts` — Server-side init (10% trace sample, console logging integration)
- `v2/sentry.edge.config.ts` — Edge runtime init
- `v2/src/instrumentation.ts` — Next.js instrumentation hook (loads Sentry configs)

**Frontend utility:** `v2/src/lib/sentry.ts` — `captureError()`, `addBreadcrumb()`, `setUser()` (179+ callers)

**Backend bridge:** Convex V8 isolates cannot use Sentry SDK directly:
- `v2/convex/lib/sentry.ts` — HTTP Store API utility (`reportError()`)
- `v2/convex/sentryReportAction.ts` — Internal action: mutations schedule this to send to Sentry
- `v2/convex/lib/errorRecording.ts` — Unified `recordError()` → DB + admin email + Sentry

**Features:** Session Replay (10% normal, 100% on error), `consoleLoggingIntegration`, structured logging, automatic Vercel monitors.

### Vercel Analytics

- **Purpose:** Web analytics and Core Web Vitals
- **SDKs:**
  - `@vercel/analytics` 1.6.1 — Page view tracking
  - `@vercel/speed-insights` 1.3.1 — Core Web Vitals
- **Integration:** `v2/src/app/layout.tsx` — `<Analytics />` + `<SpeedInsights />`

### System Error Tracking (Internal)

- **Table:** `systemErrors` in `v2/convex/schema.ts`
- **Purpose:** Backend errors stored in DB for admin visibility
- **Sources:** mutation, action, query, cron, webhook
- **Admin email:** Rate-limited error notifications to admin

## Data Storage

### Convex Database (Primary)

- **Type:** Document database with real-time sync
- **Tables (16):**
  - `users` — Core auth fields
  - `userProfiles` — App-specific user data, preferences, settings
  - `cases` — PERM case tracking (PWD, recruitment, ETA 9089, I-140)
  - `notifications` — Deadline alerts and system messages
  - `conversations` — AI chat conversations
  - `conversationMessages` — Chat message history with tool calls
  - `auditLogs` — Append-only change tracking
  - `userCaseOrder` — Custom drag-drop case ordering
  - `timelinePreferences` — Timeline display settings
  - `rateLimits` — Auth rate limiting
  - `apiUsage` — External API usage tracking
  - `toolCache` — Chat tool result caching
  - `jobDescriptionTemplates` — Reusable job description templates
  - `supportEmails` — Inbound support email storage
  - `systemErrors` — Backend error records
  - Auth tables (from `@convex-dev/auth` — `authSessions`, `authAccounts`, etc.)
- **Schema:** `v2/convex/schema.ts`
- **Indexes:** 40+ indexes across tables for query performance

### Convex File Storage

- **Purpose:** Document attachments on PERM cases
- **Schema:** `cases.documents[]` array with `url` pointing to Convex storage URLs
- **Fields:** `id`, `name`, `url`, `mimeType`, `size`, `uploadedAt`

### No External Cache

- Caching is handled via:
  - Convex `toolCache` table (TTL-based, per-conversation)
  - Service worker (Serwist) for static assets
  - `apiUsage` table for rate limit tracking

## Webhooks & Callbacks

### Incoming

**Resend Inbound Email Webhook:**
- **Endpoint:** `POST /resend-inbound` (Convex HTTP action)
- **File:** `v2/convex/http.ts`
- **Verification:** Svix signature verification (`svix` 1.85.0)
- **Env:** `RESEND_WEBHOOK_SECRET`
- **Purpose:** Receives inbound support emails sent to `support@permtracker.app`
- **Flow:** Verify signature → Parse sender → Schedule `processInboundEmail` action
- **Handler:** `v2/convex/supportEmail.ts` (fetches full content, stores, notifies admin)

**Convex Auth HTTP Routes:**
- **Endpoint:** Multiple auth routes added by `auth.addHttpRoutes(http)` in `v2/convex/http.ts`
- **Purpose:** OAuth callbacks, session management

### Outgoing

**Email Notifications:**
- Resend API calls from `v2/convex/notificationActions.ts`
- Types: deadline reminders, status changes, RFI/RFE alerts, auto-closure, weekly digest, admin alerts

**Push Notifications:**
- Web Push API calls from `v2/convex/pushNotifications.ts`
- VAPID-authenticated push to browser subscription endpoints

**Google Calendar:**
- Google Calendar API calls from `v2/convex/calendar.ts`
- Create/update/delete calendar events for case deadlines

**Sentry:**
- HTTP Store API calls from `v2/convex/lib/sentry.ts`
- Error event submission from backend (bypasses SDK limitations in V8 isolates)

**AI Providers:**
- HTTP streaming to 5 AI providers from `POST /api/chat`
- Web search to Tavily/Brave from `v2/convex/webSearch.ts`

## Scheduled Jobs (Cron)

**Config:** `v2/convex/crons.ts` (6 jobs)

| Job | Schedule | Handler | Purpose |
|-----|----------|---------|---------|
| `deadline-reminders` | Daily 9 AM EST | `scheduledJobs.checkDeadlineReminders` | Check all cases for upcoming deadlines |
| `notification-cleanup` | Hourly :30 | `scheduledJobs.cleanupOldNotifications` | Delete read notifications > 90 days |
| `weekly-digest` | Monday 9 AM EST | `scheduledJobs.sendWeeklyDigest` | Weekly summary email to opted-in users |
| `account-deletion-cleanup` | Hourly :45 | `scheduledJobs.processExpiredDeletions` | Safety net for failed deletion jobs |
| `rate-limit-cleanup` | Hourly :15 | `scheduledJobs.cleanupRateLimits` | Purge rate limit records > 24h |
| `conversation-ttl-cleanup` | Daily 3 AM UTC | `scheduledJobs.cleanupExpiredConversations` | Delete AI conversations > 90 days (SOC 2) |

## CI/CD & Deployment

### Vercel (Frontend)

- **Project:** "perm" (linked via `v2/.vercel/project.json`)
- **Domain:** `permtracker.app`
- **Trigger:** Push to `main` branch
- **Config:** Builds from `v2/` directory
- **Features:** Auto-deploy, preview deployments, edge functions

### Convex (Backend)

- **Deploy:** Manual `npx convex deploy -y` from `v2/`
- **Dev:** `npx convex dev` (auto-syncs schema and functions)
- **Production:** `giant-dragon-464`
- **Development:** `giddy-peccary-484`

### GitHub Actions

- **CodeQL:** Security scanning on push/PR to main/develop + weekly schedule
- **Claude Code:** AI-assisted PR reviews and issue responses
- **Dependabot:** Automated dependency updates

## Environment Variables Inventory

### Required (App Won't Function Without These)

| Variable | Where Set | Purpose |
|----------|-----------|---------|
| `CONVEX_DEPLOYMENT` | .env.local + Convex | Convex deployment identifier |
| `NEXT_PUBLIC_CONVEX_URL` | .env.local + Vercel | Public Convex WebSocket URL |
| `AUTH_GOOGLE_ID` | Convex env | Google OAuth client ID (sign-in) |
| `AUTH_GOOGLE_SECRET` | Convex env | Google OAuth client secret (sign-in) |
| `JWT_PRIVATE_KEY` | Convex env | JWT signing for auth tokens |
| `AUTH_RESEND_KEY` | Convex env | Resend API key (OTP, notifications) |

### Required for Features

| Variable | Where Set | Feature |
|----------|-----------|---------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Vercel | AI chat (primary model) |
| `GROQ_API_KEY` | Vercel | AI chat (fallback) |
| `MISTRAL_API_KEY` | Vercel | AI chat (fallback) |
| `CEREBRAS_API_KEY` | Vercel | AI chat (emergency) |
| `OPENROUTER_API_KEY` | Vercel | AI chat (free fallback) |
| `GOOGLE_CALENDAR_CLIENT_ID` | .env.local + Vercel | Google Calendar sync |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | .env.local + Vercel | Google Calendar sync |
| `CALENDAR_OAUTH_REDIRECT_URI` | .env.local + Vercel | Calendar OAuth callback URL |
| `CALENDAR_TOKEN_ENCRYPTION_KEY` | Convex env | OAuth token encryption |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | .env.local + Vercel + Convex | Push notifications (public) |
| `VAPID_PRIVATE_KEY` | Convex env | Push notifications (private) |
| `TAVILY_API_KEY` | Convex env | Web search (primary) |
| `BRAVE_API_KEY` | Convex env | Web search (fallback) |
| `RESEND_WEBHOOK_SECRET` | Convex env | Inbound email webhook verification |

### Optional (Observability/Dev)

| Variable | Where Set | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SENTRY_DSN` | .env.local + Vercel | Client-side error tracking |
| `SENTRY_DSN` | .env.local + Vercel + Convex | Server-side error tracking |
| `SENTRY_AUTH_TOKEN` | Vercel | Source map uploads |
| `SENTRY_ORG` | Vercel | Sentry organization slug |
| `SENTRY_PROJECT` | Vercel | Sentry project name |
| `SENTRY_DEBUG` | .env.local | Enable Sentry in development |
| `NEXT_PUBLIC_APP_URL` | .env.local + Vercel | App URL for metadata/OAuth |
| `APP_URL` | Convex env | Email link generation |
| `ANALYZE` | CLI | Enable bundle analyzer |

### Compile-Time Note

`NEXT_PUBLIC_*` variables are **compile-time constants** in Next.js. Adding them to Vercel requires a new deployment to take effect. Server-only variables (without `NEXT_PUBLIC_` prefix) are runtime.

## Integration Flow Diagrams

### AI Chat Request Flow

```
Browser (useChat) → POST /api/chat
    │
    ├── Auth check (Convex Auth token)
    ├── Get action mode preference
    ├── Build system prompt + tools
    │
    └── streamText(FallbackModel)
         ├── Gemini 2.5 Flash → success? → stream response
         ├── Groq Llama 3.3 70B → success? → stream response
         ├── Mistral Small → success? → stream response
         ├── OpenRouter Llama 3.3 → success? → stream response
         └── Cerebras Llama 3.1 → success? → stream response
                                  └── fail → 503 error

    Tool calls during stream:
    ├── query_cases → Convex fetchQuery(api.cases.*)
    ├── search_knowledge → Convex fetchQuery(rag.*)
    ├── search_web → Convex runAction(webSearch) → Tavily/Brave
    └── modify_case → Convex fetchMutation (with confirmation)
```

### Authentication Flow

```
User → Login Page
  ├── Google OAuth:
  │    └── Google consent → Convex Auth callback
  │         └── createOrUpdateUser (email linking)
  │              └── onAuthEvent → ensureUserProfile
  │
  └── Email/Password:
       ├── Sign up → Resend OTP → Verify code → createOrUpdateUser
       ├── Sign in → Convex Auth (bypasses createOrUpdateUser)
       └── Reset → Resend reset code → New password

Post-auth (ALL flows):
  └── LoginTracker (client-side) → recordMyLogin mutation
```

### Email Notification Flow

```
Cron (daily 9 AM EST)
  └── checkDeadlineReminders
       └── For each user with active cases:
            ├── Calculate upcoming deadlines
            ├── Check user reminder preferences
            ├── Create notification in DB
            ├── If email enabled → schedule sendDeadlineReminderEmail
            │    └── Render React Email → Resend API
            └── If push enabled → schedule sendPushNotification
                 └── web-push → Browser push endpoint
```

### Google Calendar Sync Flow

```
User → Settings → Connect Calendar
  └── GET /api/google/connect
       └── Redirect to Google consent
            └── GET /api/google/callback
                 ├── Exchange code for tokens
                 ├── Encrypt tokens (AES-256-GCM)
                 └── Store in userProfiles

Case update:
  └── mutation → If calendarSyncEnabled:
       └── action → Google Calendar API
            ├── Create/update events for deadlines
            └── Store event IDs in cases.calendarEventIds
```

### Inbound Support Email Flow

```
Email → support@permtracker.app → Resend
  └── Webhook → POST /resend-inbound (Convex HTTP)
       ├── Verify Svix signature
       ├── Parse sender info
       └── Schedule processInboundEmail action
            ├── Fetch full email content from Resend
            ├── Store in supportEmails table
            └── Notify admin via email
```

---

*Integration audit: 2026-02-21*
