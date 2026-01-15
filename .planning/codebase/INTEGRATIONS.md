# External Integrations

**Analysis Date:** 2026-01-03

## APIs & External Services

**Google Calendar Integration:**
- Google Calendar API v3 - Sync PERM deadline dates to user's calendar
  - SDK/Client: Native fetch + google-auth-library
  - Auth: OAuth 2.0 (separate from app auth)
  - Scopes: `https://www.googleapis.com/auth/calendar.events`
  - Implementation: `convex/googleAuth.ts`, `convex/googleCalendarActions.ts`
  - Features: All-day events, create/update/delete, token refresh

**Email Service (Resend):**
- Resend - Transactional emails (deadline reminders, status changes, digests)
  - SDK/Client: resend v6.6.0
  - Auth: API key in RESEND_API_KEY env var (Convex)
  - From: noreply@permtracker.app
  - Templates: React Email components in src/emails/
  - Rate limits: 100/day (free), 3000/month (production)

**Push Notifications:**
- Web Push API - Browser notifications for deadlines and updates
  - Protocol: VAPID (Voluntary Application Server Identification)
  - Library: web-push v3.6.7
  - Auth: VAPID public/private key pair
  - Implementation: `convex/pushNotifications.ts`, `public/sw-push.js`

**Error Tracking (Sentry):**
- Sentry - Error and performance monitoring
  - DSN: NEXT_PUBLIC_SENTRY_DSN env var
  - Auth Token: SENTRY_AUTH_TOKEN (source map upload)
  - Features: Client/server errors, 10% session replay, performance traces
  - Config: sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts

## Data Storage

**Databases:**
- Convex Cloud - Primary real-time database
  - Connection: NEXT_PUBLIC_CONVEX_URL (public endpoint)
  - Client: Convex React hooks (useQuery, useMutation)
  - Schema: convex/schema.ts (single source of truth)
  - Features: Transactional mutations, real-time subscriptions, file storage

**File Storage:**
- Convex File Storage - Available but not currently used for user uploads

**Caching:**
- None explicitly configured (Convex handles internally)

## Authentication & Identity

**Auth Provider:**
- @convex-dev/auth 0.0.90 - Convex native authentication
  - Implementation: Email/password primary, OAuth extensible
  - Token storage: httpOnly cookies via middleware
  - Session management: JWT tokens managed by Convex
  - Config: convex/auth.config.ts

**OAuth Integrations:**
- Google OAuth (Calendar) - Separate from app auth
  - Credentials: GOOGLE_CALENDAR_CLIENT_ID, GOOGLE_CALENDAR_CLIENT_SECRET
  - Scopes: calendar.events
  - Routes: /api/google/connect, /api/google/callback, /api/google/disconnect

## Monitoring & Observability

**Error Tracking:**
- Sentry - Client and server-side errors
  - DSN: NEXT_PUBLIC_SENTRY_DSN
  - Session Replay: 10% sample rate, 100% on errors
  - Release tracking: Git commit SHA

**Analytics:**
- Not detected (only Sentry for errors)

**Logs:**
- Console logging to stdout
- Vercel logs for production (7-day retention on Pro)

## CI/CD & Deployment

**Hosting:**
- Vercel - Next.js frontend hosting
  - Deployment: Automatic on main branch push
  - Environment vars: Configured in Vercel dashboard

- Convex Cloud - Backend/database hosting
  - Deployment: `npx convex deploy`
  - Environment vars: Convex dashboard

**CI Pipeline:**
- GitHub Actions (assumed)
  - Tests and type checking before deploy

## Environment Configuration

**Development:**
- Required env vars: CONVEX_DEPLOYMENT, NEXT_PUBLIC_CONVEX_URL, JWT_PRIVATE_KEY, AUTH_GOOGLE_*, GOOGLE_CALENDAR_*, RESEND_API_KEY, VAPID_*
- Secrets location: .env.local (gitignored)
- Mock services: Convex dev server, test email/push disabled

**Staging:**
- Not explicitly configured (uses Convex dev deployment)

**Production:**
- Secrets management: Vercel + Convex dashboard environment variables
- Database: Convex production deployment

## Webhooks & Callbacks

**Incoming:**
- Not detected (no external webhook handlers)

**Outgoing:**
- None currently configured

## Scheduled/Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| deadline-reminders | Daily 9 AM EST | Send deadline reminder emails |
| notification-cleanup | Hourly at :30 | Delete read notifications > 90 days |
| weekly-digest | Monday 9 AM EST | Send weekly summary emails |
| deadline-enforcement | Daily 2 AM EST | Auto-close cases with violations |

**Implementation:** `convex/crons.ts` → `convex/scheduledJobs.ts`

## OAuth Flows

**Google Calendar OAuth:**
```
User clicks "Connect Calendar"
  ↓ GET /api/google/connect
Generate state, store in cookie (CSRF protection)
  ↓ Redirect to Google OAuth
User grants permissions
  ↓ GET /api/google/callback?code=...&state=...
Verify state, exchange code for tokens
Encrypt tokens (AES-256-GCM), store in userProfiles
  ↓ Redirect to /settings?tab=calendar-sync&success
```

## Credential Management

| Credential | Storage | Security |
|-----------|---------|----------|
| Google OAuth Tokens | Encrypted in Convex DB | AES-256-GCM |
| VAPID Private Key | Convex environment | Server-only |
| Resend API Key | Convex environment | Server-only |
| JWT Secret | Convex environment | Server-only |
| Sentry DSN | Public env var | Public (DSN only) |

---

*Integration audit: 2026-01-03*
*Update when adding/removing external services*
