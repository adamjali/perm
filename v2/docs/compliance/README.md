# Compliance Documentation

SOC 2 Trust Service Criteria evidence + supporting security/operational architecture for PERM Tracker.

| Doc | Covers |
|-----|--------|
| [SOC2_CONTROLS.md](SOC2_CONTROLS.md) | Maps every Trust Service Criterion (CC6/CC7, A1, PI1, C1, P1–P8) to the implementing control + source file |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Defense-in-depth layering, attack-surface map, security headers, key rotation (renamed from `SECURITY.md` to disambiguate from the root vuln-disclosure policy) |
| [ACCESS_CONTROL.md](ACCESS_CONTROL.md) | CC6 logical access model: `getCurrentUserId`/`verifyOwnership`/`requireAdmin`, row-level `by_user_id` isolation, session management |
| [DATA_RETENTION.md](DATA_RETENTION.md) | C1/P-series retention schedules, cleanup crons, account-deletion grace period, DSAR export |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | A1 incident runbook: Sentry + `recordError` + admin alerts, health check, recovery |
| [DNS_CHANGES.md](DNS_CHANGES.md) | One-time DNS hardening steps (SPF hardfail, DMARC, CAA) applied for the SOC 2 push |

> Source of truth is always the code these docs cite (`convex/lib/*`, `next.config.ts`, `convex/crons.ts`, …). These docs are the audit-facing narrative.

## Known drift (last audited 2026-06-08 — verify against source before an audit)

- **`DATA_RETENTION.md` cron table** lists 6 jobs; `convex/crons.ts` currently registers 8 (missing at least `abuse-blocklist-cleanup` at hourly :40). Reconcile against `convex/crons.ts` — that file is authoritative.
- **`DNS_CHANGES.md` SPF record** documents `include:amazonses.com`. Email now sends via **Resend** (which runs on Amazon SES infrastructure, so the include may still be correct) — confirm the live SPF against the Resend dashboard → Domains before relying on it.
