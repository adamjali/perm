# SOC 2 Controls Mapping

> Maps Trust Service Criteria to implemented controls in PERM Tracker

## Security (CC6, CC7)

| Criteria | Control | Implementation |
|----------|---------|----------------|
| CC6.1 | Logical access controls | `getCurrentUserId()` in every function, row-level `by_user_id` indexes |
| CC6.1 | Admin access restriction | `requireAdmin()` guard, email-based admin check |
| CC6.2 | Authentication mechanisms | Convex Auth (password + Google OAuth), rate-limited auth endpoints |
| CC6.3 | Session management | 15-min inactivity timeout, multi-tab sync, session invalidation on sign-out |
| CC6.6 | Encryption in transit | TLS/HTTPS everywhere, HSTS header with preload |
| CC6.7 | Encryption at rest | AES-256 (Convex platform), AES-256-GCM (FEIN, OAuth tokens) |
| CC6.8 | Input validation | `validateStringLength` / `validateInputLengths` on all mutations |
| CC7.1 | Security headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy |
| CC7.2 | Rate limiting | Sliding window rate limits on auth (LOGIN, OTP, PASSWORD_RESET, EMAIL_SEND) |
| CC7.2 | Audit logging | `auditLogs` table with `logCreate`/`logUpdate`/`logDelete` on all data mutations |

## Availability (A1)

| Criteria | Control | Implementation |
|----------|---------|----------------|
| A1.1 | Health monitoring | `GET /api/health` endpoint for uptime monitoring |
| A1.1 | Error monitoring | Sentry (client+server), systemErrors table, admin email alerts |
| A1.2 | Incident response | Documented in `docs/INCIDENT_RESPONSE.md` |
| A1.2 | Automated recovery | Convex auto-scaling, Vercel edge deployment, scheduled job retries |

## Processing Integrity (PI1)

| Criteria | Control | Implementation |
|----------|---------|----------------|
| PI1.1 | Data validation | Input length limits, Convex schema validation (`v.string()`, `v.number()`, etc.) |
| PI1.2 | Business rule enforcement | Central PERM logic in `convex/lib/perm/`, validated via 3600+ tests |
| PI1.3 | Audit trail | `auditLogs` table captures old/new values for all data changes |
| PI1.4 | Error handling | `recordError()` unified handler (DB + email + Sentry) |

## Confidentiality (C1)

| Criteria | Control | Implementation |
|----------|---------|----------------|
| C1.1 | Data classification | FEIN classified as sensitive, encrypted at application layer |
| C1.2 | Data retention | AI conversations: 90 days, notifications: 90 days, rate limits: 24 hours |
| C1.2 | Automated cleanup | 6 cron jobs for data lifecycle management |
| C1.3 | Data disposal | Account deletion with 30-day grace period, then full purge |

## Privacy (P1-P8)

| Criteria | Control | Implementation |
|----------|---------|----------------|
| P1.1 | Privacy notice | `/privacy` page with comprehensive data practices disclosure |
| P2.1 | Consent | Terms checkbox with AI + analytics clause, version-bumped for re-consent |
| P3.1 | Data collection | Documented in Privacy Policy sections 2-9 |
| P4.1 | Data access (DSAR) | "Export All My Data" button in Settings, JSON download |
| P5.1 | Data use limitation | User data used only for service operation, AI data not used for training |
| P6.1 | Data retention | Automated TTL for conversations (90d), notifications (90d), rate limits (24h) |
| P6.2 | Data disposal | Account deletion purges all user data after 30-day grace |
| P7.1 | Data quality | Input validation, schema enforcement, PERM business rule validation |
| P8.1 | Complaints/inquiries | `support@permtracker.app` contact, 30-45 day response commitment |

## Key Files

| Document | Path |
|----------|------|
| Security Architecture | `docs/SECURITY.md` |
| Data Retention | `docs/DATA_RETENTION.md` |
| Incident Response | `docs/INCIDENT_RESPONSE.md` |
| Access Control | `docs/ACCESS_CONTROL.md` |
| Privacy Policy | `src/app/(public)/privacy/page.tsx` |
| Terms of Service | `src/app/(public)/terms/page.tsx` |
| Rate Limiting | `convex/lib/rateLimit.ts` |
| Audit Logging | `convex/lib/audit.ts` |
| Encryption | `convex/lib/crypto.ts` |
| Input Validation | `convex/lib/validation.ts` |
| Cron Jobs | `convex/crons.ts` |
| Auth Rate Limit | `convex/authRateLimit.ts` |
| Data Export | `convex/dataExport.ts` |
