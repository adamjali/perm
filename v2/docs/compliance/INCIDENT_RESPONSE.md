# Incident Response Plan

> PERM Tracker incident detection, response, and recovery procedures

## Error Monitoring Stack

### 1. Sentry (Frontend + Backend Bridge)

- **Client**: `@sentry/nextjs`, loaded only in the signed-in app and the sign-in pages (`SentryClientInit` in the `(authenticated)` and `(auth)` layouts). No Session Replay (removed Aug 29 2026). Public pages' browser errors go to PostHog as `$exception`, recorded by every error screen (`src/components/error/recovery.ts`)
- **Server**: Node.js errors via `sentry.server.config.ts`
- **Edge**: Middleware errors via `sentry.edge.config.ts`
- **Convex bridge**: `convex/sentryReportAction.ts` — internal action that reports backend errors to Sentry via HTTP Store API
- **Budget**: `src/lib/sentryBudget.ts`, per process: 5 copies of one error and 60 errors an hour, 500 log lines an hour, so a storm can't spend the plan and hide the next real error

### 2. System Error Table (`systemErrors`)

- Backend errors recorded in Convex DB via `recordError()` in `convex/lib/errorRecording.ts`
- Captures: error message, stack trace, function name, context metadata
- Accessible via admin dashboard

### 3. Admin Email Alerts

- Critical errors trigger email to admin via `recordError()` (same function), through `notificationActions.sendAdminNotificationEmail`
- Uses Resend for delivery
- Sent to `SECURITY_ALERT_EMAIL` (a direct inbox, so alerts arrive when the permtracker.app domain is down), falling back to `ADMIN_EMAIL`
- `ADMIN_ERROR_EMAILS=off` mutes them on the development deployment, and each names its deployment

### 4. Health Check

- `GET /api/health` — returns `{ status: "ok", timestamp }`
- No authentication required (suitable for uptime monitoring tools like UptimeRobot, Pingdom)
- `GET /api/sentry-check` — Sentry connectivity test (requires `x-sentry-check-secret` header)

### 5. The server (Oracle Cloud)

Runbook: `scripts/oracle/README.md`. Each piece is a systemd timer:

- **`permtracker-alarm`**, every 5 minutes: emails the owner within minutes when the disk is under 25 GB free or would be full within 24 hours at the last two hours' rate, under 10 GB, memory or swap is short, a job or service is `failed`, the health sampler is silent, the page-cache cap stalls, or the nightly backup is late. It fixes the disk first and keeps its state in memory, so it works on a full disk (since Oct 10 2026). Email only, by the owner's choice
- **`permtracker-health`**, every 10 minutes: memory, CPU, disk (with hours until full), backups and services into `perm_docs['server_health']`
- **`permtracker-watchdog`**, every 2 minutes: restarts a piece that runs but stops answering, including a database that stops taking writes
- **`permtracker-defend`**, every minute: when people are being turned away, a Cloudflare challenge for the source, then Under Attack Mode, then stands down

### 6. Watched from outside

- **Convex `serverWatch`**, every 15 minutes (`convex/serverWatch.ts`, only where `SERVER_WATCH=on`): emails the admin when the server's health report is over 35 minutes old, the database doesn't answer, or the disk is 90% full. It runs off the server, so it works when the server can't report at all
- **The morning report**, 7:30 AM Eastern (`daily-monitor.yml`, `dailyReport:send`): health, every workflow run, the site, traffic, errors, email and the server, emailed to `SECURITY_ALERT_EMAIL`; a Claude routine reviews it
- **GitHub runs fail loudly**: a step that carries on after a failure records it, and the run's last step turns the run red

## Unified Error Recording

All backend errors flow through ONE function:

```typescript
// convex/lib/errorRecording.ts
await recordError(ctx, "mutation", "cases.update", error, { resourceId: caseId });
```

This schedules:
1. `systemErrors.record` — DB insert + admin email
2. `sentryReportAction.report` — Sentry HTTP API

## Severity Classification

| Level | Examples | Response Time |
|-------|----------|---------------|
| P1 Critical | Auth failures, data corruption, service outage | Immediate |
| P2 High | Failed mutations, API errors, rate limit bypass | 4 hours |
| P3 Medium | UI rendering errors, slow queries | 24 hours |
| P4 Low | Cosmetic issues, non-critical warnings | Next sprint |

## Escalation Path

1. **Automated Detection**: the server alarm, the outside watch, Sentry alerts, PostHog's new-error alert, system error emails, the morning report, a red GitHub run
2. **Admin Review**: Check admin dashboard (`/admin`) for error patterns
3. **Investigation**: Review Sentry breadcrumbs, session replays, audit logs
4. **Mitigation**: Deploy fix or roll back on the Oracle server (`permtracker-deploy`, which switches between the live and standby releases) + Convex (`npx convex deploy -y`)
5. **Post-Incident**: Record it in the incident log below and in the dated section of `v2/CLAUDE.md`; correct anything the public site said wrongly in `content/changelog/corrections.mdx`; add the monitoring that would have caught it sooner

## Data Breach Response

1. **Identify** scope of breach via audit logs (`auditLogs` table)
2. **Contain** by revoking affected sessions / rotating keys
3. **Assess** what data was exposed (FEIN encryption limits exposure of sensitive fields)
4. **Notify** affected users within 72 hours
5. **Remediate** root cause
6. **Document** incident and response actions

## Recovery Procedures

### Service Outage
- Convex: Check [status.convex.dev](https://status.convex.dev)
- Cloudflare: Check [cloudflarestatus.com](https://www.cloudflarestatus.com)
- Oracle Cloud: Check [ocistatus.oraclecloud.com](https://ocistatus.oraclecloud.com)
- Redeploy if needed: `npx convex deploy -y` (backend), a push to `main` (the Oracle deploy workflow builds and switches the release)

### Data Recovery
- Convex data: exported nightly and sealed (CMS, AES-256-GCM) on the GitHub runner, stored in Cloudflare R2; only the owner's key opens it (Convex keeps its own backups only on paid plans)
- Public-data database: dumped nightly to Cloudflare R2 (15-day expiry, 7-day lock); a monthly restore test loads the copy; Oracle keeps 3 days of disk backups
- The server's secrets: sealed nightly to R2 the same way
- Case data can be re-imported through the JSON import
- User profiles are recreated on next login via `ensureUserProfileInternal`

### Key Rotation
- See `SECURITY_ARCHITECTURE.md` for `OAUTH_ENCRYPTION_KEY` rotation procedure

## Incident log

Production incidents since the move to the Oracle server (Sep 28 2026). Detail is in `v2/CLAUDE.md` under each date. Times are Eastern.

| When | What happened | Who it touched | What changed |
|------|---------------|----------------|--------------|
| Sep 29 2026, 12:43 AM to 7:19 AM | Crawlers (YandexBot, PerplexityBot) were exempt from every limit and asked for up to 280 employer pages a minute | 1,742 employer pages answered 500; at 4:56 AM the live copy stopped answering for 6 minutes until the watchdog restarted it | Limits per crawler and for all crawlers together; at most 64 requests in the app at once |
| Oct 1 to 2 2026, 11:34 PM to 2:46 AM | Scrapers walking case numbers and pages filled every app slot, five times in three hours | People were shown the busy page | Two copies of the site, a cap on lookups together, Cloudflare browser checks for the sources, the automatic defense |
| Oct 3 2026, 12:46 to 1:24 PM | Our own history loads made the database compact its log until writes stalled | About 9 visitors in 10 got the busy page for 38 minutes | A larger database log limit, paced history loads, a watchdog that checks writes |
| Oct 8 2026, 2:19 to 2:21 PM | A second deploy of the same commit deleted the live release's folder | 31 errors on two files; no page failed; rolled back in 2 minutes | The deploy refuses a release that a running copy uses |
| Oct 10 2026, about 5:20 to 8:27 AM | The server's disk filled: Next 16.3 had moved its saved pages to a folder the page-cache cap didn't read | Pages kept serving; database writes failed, so the morning's data jobs failed (one run still showed green); nothing in the corpus was lost; the server's own logs for those hours were lost | The cap reads both folders, `permtracker-alarm`, the outside watch, runs that end red on any failure |
