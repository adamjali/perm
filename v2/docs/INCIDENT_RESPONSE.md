# Incident Response Plan

> PERM Tracker incident detection, response, and recovery procedures

## Error Monitoring Stack

### 1. Sentry (Frontend + Backend Bridge)

- **Client**: `@sentry/nextjs` — browser errors, Session Replay (10% normal, 100% on error)
- **Server**: Node.js errors via `sentry.server.config.ts`
- **Edge**: Middleware errors via `sentry.edge.config.ts`
- **Convex bridge**: `convex/sentryReportAction.ts` — internal action that reports backend errors to Sentry via HTTP Store API

### 2. System Error Table (`systemErrors`)

- Backend errors recorded in Convex DB via `recordError()` in `convex/lib/errorRecording.ts`
- Captures: error message, stack trace, function name, context metadata
- Accessible via admin dashboard

### 3. Admin Email Alerts

- Critical errors trigger email to admin via `recordError()` (same function)
- Uses Resend for delivery
- Admin email configured via `ADMIN_EMAIL` env var

### 4. Health Check

- `GET /api/health` — returns `{ status: "ok", timestamp, version, environment }`
- No authentication required (suitable for uptime monitoring tools like UptimeRobot, Pingdom)
- `GET /api/sentry-check` — Sentry connectivity test (requires `x-sentry-check-secret` header)

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

1. **Automated Detection**: Sentry alerts, health check failures, system error emails
2. **Admin Review**: Check admin dashboard (`/admin`) for error patterns
3. **Investigation**: Review Sentry breadcrumbs, session replays, audit logs
4. **Mitigation**: Deploy fix or rollback via Vercel (instant) + Convex (`npx convex deploy -y`)
5. **Post-Incident**: Document in changelog, update monitoring if gaps found

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
- Vercel: Check [vercel.com/status](https://vercel.com/status)
- Redeploy if needed: `npx convex deploy -y` (backend), `vercel --prod` (frontend)

### Data Recovery
- Convex provides automatic backups
- Case data can be re-imported via CSV import
- User profiles are recreated on next login via `ensureUserProfileInternal`

### Key Rotation
- See `docs/SECURITY.md` for `OAUTH_ENCRYPTION_KEY` rotation procedure
