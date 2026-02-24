# PostHog Integration Setup Report

**Project:** PERM Tracker v2
**Integration Date:** 2026-02-24
**PostHog Host:** https://us.i.posthog.com
**Dashboard:** [Analytics basics](https://us.posthog.com/project/322551/dashboard/1304678)

---

## Integration Overview

PostHog analytics was integrated into the Next.js 16.1 App Router application using the recommended `instrumentation-client.ts` approach (Next.js 15.3+ native hook). Both client-side (`posthog-js`) and server-side (`posthog-node`) tracking are active.

### Architecture

| Layer | Method | File |
|-------|--------|------|
| Client init | `instrumentation-client.ts` (Next.js hook) | `instrumentation-client.ts` |
| Client capture | `posthog.capture()` in event handlers | Various component files |
| Server capture | `getPostHogClient()` singleton (fire-and-forget) | `src/lib/posthog-server.ts` |
| Proxy | `/ingest/*` rewrites in `next.config.ts` | `next.config.ts` |
| User identity | `posthog.identify()` on login | `src/components/auth/LoginTracker.tsx` |

### Reverse Proxy

All PostHog traffic is routed through the app domain via `next.config.ts` rewrites to avoid ad-blocker interference:
- `/ingest/static/*` → `https://us-assets.i.posthog.com/static/*`
- `/ingest/*` → `https://us.i.posthog.com/*`

### Environment Variables

| Variable | Location |
|----------|----------|
| `NEXT_PUBLIC_POSTHOG_KEY` | `.env.local` |
| `NEXT_PUBLIC_POSTHOG_HOST` | `.env.local` (set to `/ingest` for proxy) |

---

## Files Modified / Created

| File | Change |
|------|--------|
| `instrumentation-client.ts` | **Created** — PostHog client init with `/ingest` proxy, `capture_pageview: false` (Next.js App Router handles routing) |
| `src/lib/posthog-server.ts` | **Created** — Server-side `PostHog` Node singleton (`getPostHogClient()`) |
| `next.config.ts` | **Modified** — Added `/ingest/*` rewrites, `skipTrailingSlashRedirect: true`, CSP `connect-src` for PostHog |
| `.env.local` | **Modified** — Added `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` |
| `src/components/auth/LoginTracker.tsx` | **Modified** — `posthog.identify()` + `user_logged_in` event |
| `src/app/(auth)/signup/SignupPageClient.tsx` | **Modified** — `user_signed_up` event |
| `src/hooks/useFormSubmission.ts` | **Modified** — `case_form_validation_failed` + `case_updated` events |
| `src/app/(authenticated)/cases/new/AddCasePageClient.tsx` | **Modified** — `case_created` + `case_duplicate_detected` + `case_created_despite_duplicate` events |
| `src/app/(authenticated)/cases/CasesPageClient.tsx` | **Modified** — `cases_exported`, `case_deleted`, `case_archived`, `cases_imported` events |
| `src/app/api/chat/route.ts` | **Modified** — Server-side `chat_message_sent` + `chat_provider_fallback` events |
| `src/components/settings/CalendarSyncSection.tsx` | **Modified** — `calendar_sync_enabled` + `calendar_sync_disabled` events |
| `src/components/settings/ProfileSection.tsx` | **Modified** — `profile_updated` event |
| `src/components/settings/NotificationPreferencesSection.tsx` | **Modified** — `notification_preferences_updated` event |
| `src/components/settings/DeadlineEnforcementToggle.tsx` | **Modified** — `deadline_enforcement_toggled` event |

---

## Events Tracked

### Authentication & Onboarding

| Event | Trigger | Properties | File |
|-------|---------|------------|------|
| `user_signed_up` | Successful signup form submission | — | `SignupPageClient.tsx` |
| `user_logged_in` | On auth + profile load (all flows) | `auth_method: "oauth_or_password"` | `LoginTracker.tsx` |

### Case Management (Core Workflow)

| Event | Trigger | Properties | File |
|-------|---------|------------|------|
| `case_created` | New case saved successfully | `case_id`, `is_duplicate_override` | `AddCasePageClient.tsx` |
| `case_updated` | Existing case form saved | `case_id` | `useFormSubmission.ts` |
| `case_deleted` | Single or bulk delete confirmed | `case_id` / `count`, `bulk` | `CasesPageClient.tsx` |
| `case_archived` | Single or bulk archive confirmed | `case_id` / `count`, `bulk` | `CasesPageClient.tsx` |
| `case_form_validation_failed` | Client-side validation error on save | `error_count`, `error_fields[]` | `useFormSubmission.ts` |
| `case_duplicate_detected` | Duplicate check finds existing case | `existing_case_id` | `AddCasePageClient.tsx` |
| `case_created_despite_duplicate` | User overrides duplicate warning | `existing_case_id` | `AddCasePageClient.tsx` |
| `cases_exported` | CSV or JSON export triggered | `format`, `count` | `CasesPageClient.tsx` |
| `cases_imported` | Import modal completes | `imported_count`, `replaced_count`, `skipped_count` | `CasesPageClient.tsx` |

### AI Chat

| Event | Trigger | Properties | File |
|-------|---------|------------|------|
| `chat_message_sent` | Chat API route receives a request | `session_id`, `has_conversation_id` | `api/chat/route.ts` (server) |
| `chat_provider_fallback` | Primary AI provider fails, fallback used | `session_id`, `model_used`, `attempts` | `api/chat/route.ts` (server) |

### Settings & Feature Adoption

| Event | Trigger | Properties | File |
|-------|---------|------------|------|
| `calendar_sync_enabled` | Google Calendar OAuth success callback | — | `CalendarSyncSection.tsx` |
| `calendar_sync_disabled` | User disconnects Google Calendar | — | `CalendarSyncSection.tsx` |
| `profile_updated` | Profile form saved successfully | — | `ProfileSection.tsx` |
| `notification_preferences_updated` | Any notification toggle changed | `field`, `value` | `NotificationPreferencesSection.tsx` |
| `deadline_enforcement_toggled` | Deadline enforcement toggle changed | `enabled` | `DeadlineEnforcementToggle.tsx` |

**Total events: 17**

---

## PostHog Dashboard

**[Analytics basics](https://us.posthog.com/project/322551/dashboard/1304678)** — pinned dashboard with 5 insights:

| # | Insight | Type | URL |
|---|---------|------|-----|
| 1 | Signups & Logins (Daily) | Trend (line) | [View](https://us.posthog.com/project/322551/insights/KMlmxelQ) |
| 2 | Case Creation to First Action Funnel | Funnel | [View](https://us.posthog.com/project/322551/insights/PJaAA4oI) |
| 3 | Case Activity (Created, Updated, Deleted) | Trend (line) | [View](https://us.posthog.com/project/322551/insights/Gzl0wz9v) |
| 4 | Calendar Sync Adoption | Trend (bar) | [View](https://us.posthog.com/project/322551/insights/EWnWkjLN) |
| 5 | AI Chat Usage | Trend (line) | [View](https://us.posthog.com/project/322551/insights/3Da1Uofc) |

---

## Notes

- **TypeScript fix:** `LoginTracker.tsx` originally referenced `profile.email`, which doesn't exist on `userProfiles`. Removed — only `profile.fullName` is sent to `posthog.identify()`.
- **Calendar sync capture location:** `calendar_sync_enabled` is captured in the `useEffect` watching `?connected=true` URL param (post-OAuth redirect), not in `handleConnect` — because `handleConnect` only redirects and cannot await the result.
- **Server-side events are fire-and-forget:** `chat_message_sent` and `chat_provider_fallback` are wrapped in non-throwing `try/catch` so analytics never block the streaming response.
- **ESLint environment issue:** The project's ESLint 9.39.2 has a pre-existing `ajv` config error (`Cannot set properties of undefined (setting 'defaultMeta')`). This is unrelated to the PostHog integration — TypeScript (`pnpm typecheck`) passes cleanly with zero errors.
