# External Integrations

**Analysis Date:** 2026-01-16

## APIs & External Services

**AI/LLM Providers (Chat):**
- Google Gemini - Primary model
  - SDK: `@ai-sdk/google`
  - Auth: `GOOGLE_GENERATIVE_AI_API_KEY`
  - Models: gemini-2.5-flash, gemini-3-flash-preview

- OpenRouter - Multi-model fallback
  - SDK: `@openrouter/ai-sdk-provider`
  - Auth: `OPENROUTER_API_KEY`
  - Models: Devstral 2, Llama 3.3 70B

- Groq - Fast inference fallback
  - SDK: `@ai-sdk/openai` (OpenAI-compatible)
  - Auth: `GROQ_API_KEY`
  - Models: llama-3.3-70b-versatile

- Cerebras - Emergency ultra-fast fallback
  - SDK: `@ai-sdk/openai` (OpenAI-compatible)
  - Auth: `CEREBRAS_API_KEY`
  - Models: llama-3.3-70b, llama3.1-8b

- Mistral - Tool calling fallback
  - SDK: `@ai-sdk/openai` (OpenAI-compatible)
  - Auth: `MISTRAL_API_KEY`
  - Models: mistral-small-latest

**Web Search (Chat):**
- Tavily - Primary web search
  - Auth: `TAVILY_API_KEY`
  - Usage: 1000 free searches/month

- Brave - Fallback web search
  - Auth: `BRAVE_API_KEY`
  - Usage: 2000 free searches/month

## Data Storage

**Databases:**
- Convex
  - Connection: `NEXT_PUBLIC_CONVEX_URL`
  - Client: Convex SDK (`convex` package)
  - Schema: `v2/convex/schema.ts`
  - Tables: users, userProfiles, cases, notifications, conversations, conversationMessages, auditLogs, rateLimits, apiUsage, toolCache

**File Storage:**
- Convex File Storage (document attachments)
  - Files stored via Convex storage API
  - Metadata in `documents` array on cases

**Caching:**
- Convex `toolCache` table - Chat tool result caching
- Service Worker (Serwist) - Client-side image/font caching

## Authentication & Identity

**Auth Provider:**
- Convex Auth + Google OAuth
  - Implementation: `@convex-dev/auth`
  - Config: `v2/convex/auth.config.ts`, `v2/convex/auth.ts`
  - Environment: `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`

**OAuth Flows:**
- Google Sign-In (user authentication)
- Google Calendar OAuth (separate consent, calendar scopes)
  - Config: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`
  - Scopes: `https://www.googleapis.com/auth/calendar.events`
  - Token encryption: `CALENDAR_TOKEN_ENCRYPTION_KEY`

## Monitoring & Observability

**Error Tracking:**
- Sentry
  - Package: `@sentry/nextjs`
  - Config: `v2/sentry.client.config.ts`, `v2/sentry.server.config.ts`, `v2/sentry.edge.config.ts`
  - Environment: `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
  - Features: Error tracking, session replay, performance monitoring
  - Sample rates: 10% traces (production), 10% session replay, 100% error replay

**Logs:**
- Custom logging via `v2/convex/lib/logging.ts`
- Console-based logging with structured log levels
- Categories: email, calendar, push, general

**Performance:**
- Vercel Speed Insights
  - Package: `@vercel/speed-insights`
  - Auto-integrated with Vercel deployment

## CI/CD & Deployment

**Hosting:**
- Vercel - Frontend
  - Auto-deploy from `main` branch
  - Production URL: https://permtracker.app

- Convex Cloud - Backend
  - Auto-sync from `main` branch
  - Dashboard: https://dashboard.convex.dev

**CI Pipeline:**
- GitHub Actions (inferred from presence of test:ci script)
- Runs: vitest run --coverage --reporter=json --reporter=github-actions

## Email Integration

**Resend:**
- Package: `resend`
- Auth: `AUTH_RESEND_KEY` / `RESEND_API_KEY`
- From: `notifications@permtracker.app`
- Templates: `v2/src/emails/`
  - `DeadlineReminder.tsx` - Deadline approaching/overdue
  - `StatusChange.tsx` - Case status updates
  - `RfiAlert.tsx` - RFI received/due
  - `RfeAlert.tsx` - RFE received/due
  - `AutoClosure.tsx` - Case auto-closed
  - `WeeklyDigest.tsx` - Weekly summary
  - `AccountDeletionConfirm.tsx` - Account deletion scheduled

## Push Notifications

**Web Push (VAPID):**
- Package: `web-push`
- Public key: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Private key: `VAPID_PRIVATE_KEY` (server-only)
- Subject: `mailto:support@permtracker.app`
- Implementation: `v2/convex/pushNotifications.ts`, `v2/convex/pushSubscriptions.ts`

## Google Calendar

**Calendar API:**
- Package: `google-auth-library`
- Endpoint: `https://www.googleapis.com/calendar/v3`
- Auth: OAuth 2.0 with refresh tokens
- Implementation: `v2/convex/googleCalendarActions.ts`
- Features:
  - Event CRUD operations
  - Token refresh handling
  - Bulk sync operations
  - Event type mapping (PWD expiration, ETA 9089 deadlines, etc.)

## Knowledge Base (RAG)

**Convex RAG:**
- Package: `@convex-dev/rag`
- Config: `v2/convex/convex.config.ts`
- Purpose: PERM regulation knowledge search for chatbot
- Source: `perm_flow.md` embedded as vector database

## Scheduled Jobs (Crons)

**Convex Cron Jobs:**
| Job | Schedule | Handler |
|-----|----------|---------|
| `deadline-reminders` | Daily 9 AM EST | `scheduledJobs.checkDeadlineReminders` |
| `notification-cleanup` | Hourly :30 | `scheduledJobs.cleanupOldNotifications` |
| `weekly-digest` | Monday 9 AM EST | `scheduledJobs.sendWeeklyDigest` |
| `account-deletion-cleanup` | Hourly :45 | `scheduledJobs.processExpiredDeletions` |
| `rate-limit-cleanup` | Hourly :15 | `scheduledJobs.cleanupRateLimits` |

## PWA / Service Worker

**Serwist:**
- Package: `@serwist/next`, `serwist`
- Config: `v2/src/app/sw.ts`
- Caching Strategy:
  - NetworkOnly: HTML, JS, CSS (no caching to prevent stale deployments)
  - CacheFirst: Images (30 days), Fonts (1 year)

## Environment Configuration

**Required env vars:**
```bash
# Authentication
AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET

# Convex
CONVEX_DEPLOYMENT
NEXT_PUBLIC_CONVEX_URL

# Email
AUTH_RESEND_KEY

# Push Notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY

# AI (minimum one required for chat)
GOOGLE_GENERATIVE_AI_API_KEY

# Calendar (optional, for sync feature)
GOOGLE_CALENDAR_CLIENT_ID
GOOGLE_CALENDAR_CLIENT_SECRET
CALENDAR_TOKEN_ENCRYPTION_KEY
```

**Secrets location:**
- Development: `v2/.env.local` (gitignored)
- Production: Convex Dashboard environment variables + Vercel environment variables

## Webhooks & Callbacks

**Incoming:**
- `v2/src/app/api/google/callback/route.ts` - Google OAuth callback (calendar auth)

**Outgoing:**
- Email via Resend API
- Push via Web Push API
- Calendar events via Google Calendar API
- Web search via Tavily/Brave APIs

## API Rate Limits

**Internal Rate Limiting:**
- `rateLimits` table - Tracks auth endpoint attempts
- `apiUsage` table - Tracks daily web search API calls
- Cleanup: Hourly cron removes entries >24 hours old

**External Provider Limits:**
- Gemini: 15 RPM (flash-lite), 10 RPM (flash)
- Tavily: 1000/month (free tier)
- Brave: 2000/month (free tier)
- Resend: 100/day, 3000/month (free tier)

---

*Integration audit: 2026-01-16*
