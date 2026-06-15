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
- ~~**`DNS_CHANGES.md` SPF record** documents `include:amazonses.com`. Email now sends via **Resend** — confirm the live SPF before relying on it.~~ **Resolved 2026-06-15:** verified — no drift. Live apex SPF is `v=spf1 include:amazonses.com -all` (confirmed via `dig +short TXT permtracker.app`), and Resend's own docs publish exactly `v=spf1 include:amazonses.com ~all` (Resend sends through Amazon SES; there is no `include:_spf.resend.com`). The `include:amazonses.com` value is correct as-is. Note: Resend's default bounce/Return-Path lives on the `send.permtracker.app` subdomain, so DMARC alignment is handled there, not on the apex.
