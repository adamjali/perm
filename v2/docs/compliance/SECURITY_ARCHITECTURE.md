# Security Architecture

> PERM Tracker security controls for SOC 2 Trust Service Criteria (CC6, CC7)

## Authentication

- **Convex Auth** with email/password and Google OAuth
- Passwords hashed by auth provider (never stored in plaintext)
- Session tokens managed by Convex Auth (HttpOnly cookies)
- 15-minute inactivity timeout with 2-minute warning (OWASP-aligned)
- Multi-tab sync via BroadcastChannel + localStorage

### MFA Status

MFA is not currently implemented. Compensating controls:
- Inactivity timeout (15 min)
- Rate limiting on auth endpoints (10 login attempts / 15 min)
- Login tracking with `recordMyLogin` mutation (client-side, covers all auth flows)
- Session invalidation on sign-out
- Google OAuth provides its own MFA options

## Authorization

- **Row-level security**: Every Convex function verifies `userId` via `getCurrentUserId(ctx)` before data access
- **Admin guard**: `requireAdmin()` in `convex/lib/admin.ts` checks email against `ADMIN_EMAIL` env var
- **Firm access**: `verifyFirmAccess()` and `verifyOwnership()` helpers prevent cross-user data access
- All public mutations/queries authenticate via `getAuthUserId` from `@convex-dev/auth`
- Internal functions (`internalMutation`, `internalAction`) are not exposed to clients

## Encryption

### In Transit
- All traffic over TLS/HTTPS (enforced by Vercel + Convex)
- HSTS header: `max-age=63072000; includeSubDomains; preload`

### At Rest
- Convex platform: AES-256 encryption for all stored data
- **Employer FEIN**: AES-256-GCM encrypted at application layer (`convex/lib/crypto.ts`)
- **Google Calendar OAuth tokens**: AES-256-GCM encrypted before storage
- Encryption key: `OAUTH_ENCRYPTION_KEY` env var (64 hex chars = 32 bytes)
- Legacy plaintext values handled gracefully via `isEncryptedToken()` detection

### Key Rotation

To rotate `OAUTH_ENCRYPTION_KEY`:
1. Set new key in env vars (Convex + Vercel)
2. Run migration to re-encrypt existing tokens and FEINs with new key
3. Old key needed temporarily for decryption during migration
4. Verify all records re-encrypted via dashboard spot check

## Rate Limiting

Three layers:

1. **Per-IP** (`convex/authRateLimit.ts:checkIpRateLimit` + `src/proxy.ts`)
   - `ip_auth`: 500/hr on `/api/auth` paths (sized for ~100-person NAT)
   - `ip_chat`: 120/min on `/api/chat`
2. **Per-email** (`convex/authRateLimit.ts:checkAuthRateLimit`)
   - LOGIN: 20 / 15 min · OTP_VERIFY / SIGNUP: 10 / 15 min · PASSWORD_RESET: 5 / hr
3. **Per-user** (Convex `@convex-dev/rate-limiter`, `convex/rateLimitConfig.ts`)
   - `cases:create/update` 60/min · `conversations:create` 20/min · `notifications:markAllAsRead` 20/min · `userCaseOrder:saveCaseOrder` 60/min · `jobDescriptionTemplates:create` 20/min · `knowledge:searchKnowledge` 20/min · `pushSubscriptions:*` 10/min

Abuse escalation:

- **IP blocklist** (`convex/abuseBlocklist.ts`): 3 rate-limit strikes in 15 min → 24h block, enforced pre-route in middleware at zero Convex cost.
- **Account auto-suspension** (`convex/abuseDetection.ts`): 10 per-email auth failures in 30 min → `userProfiles.suspendedAt` set for 24h, admin emailed, friendly "account locked" toast shown on next login attempt.
- **Admin overrides** (`/admin/security`): manual suspend/unsuspend/block/unblock.

Cleanup: hourly cron removes expired rateLimits + abuseBlocklist records.

## Security Headers

Applied to all routes via `next.config.ts`:
- `Strict-Transport-Security`: HSTS with preload
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Permissions-Policy`: camera=(), microphone=(self), geolocation=()
- `Content-Security-Policy`: restrictive policy with allowlisted domains

## Session Management

- Sessions managed by Convex Auth
- Inactivity timeout: 15 minutes (configurable)
- Warning modal at 13 minutes (2 minutes before timeout)
- Sign-out is best-effort with 8-second timeout — always redirects to `/login`
- Multi-tab synchronization prevents one tab from staying active after another times out

## Input Validation

- `convex/lib/validation.ts`: `validateStringLength` / `validateInputLengths`
- Applied to all user-facing mutations (cases, profiles, conversations, templates)
- Limits: SHORT=500, MEDIUM=10,000, LONG=50,000 characters

## Bot Protection

- **Cloudflare Turnstile** (interaction-only widget) on `/signup`, `/login`, `/reset-password` — invisible to low-risk users, challenges appear only when Cloudflare's ML flags the attempt. Token verified server-side via `turnstile.verifyTurnstileToken`.
- **Vercel BotID Basic** (Kasada ML) on `/api/chat` — invisible bot detection baked into the platform.
- Name validation server-side for sign-up (`convex/lib/nameValidation.ts`) to filter obvious spam.

## Attack Surface Map

| # | Surface | Entry Point | Auth | Rate Limits | Bot Protection |
|---|---------|-------------|------|-------------|----------------|
| 1 | Sign-up | `/api/auth` (flow=signUp) | No | per-IP + per-email | Turnstile |
| 2 | Sign-in | `/api/auth` (flow=signIn) | No | per-IP + per-email + suspension gate | Turnstile |
| 3 | Google OAuth | `/api/auth/callback/google` | No | per-IP | Google |
| 4 | Password reset | `/api/auth` (flow=reset) | No | per-IP + per-email | Turnstile |
| 5 | OTP verify | `/api/auth` (flow=email-verification) | No | per-IP + per-email | Turnstile |
| 6 | AI chat | `/api/chat` POST | **Yes** | per-IP (120/min) + per-user | BotID |
| 7 | Tool execution | `/api/chat/execute-tool` | **Yes** | per-user on target mutation | BotID |
| 8 | Convex functions | WebSocket `*.convex.cloud` | Most **yes** | per-user | N/A |
| 9 | Image upload | `convex/documents.ts:generateUploadUrl` | **Yes** | per-user | N/A |
| 10 | Public content (`/`, `/blog`, `/guides`, `/tutorials`, `/changelog`, `/resources`) | SSG | No | None | None |
| 11 | Sitemap / RSS | `/sitemap.xml`, `/rss.xml`, `/feed.xml` | No | None | None |
| 12 | Demo page | `/demo` | No | None | None (localStorage only) |
| 13 | Contact | `/contact` (mailto:) | N/A | N/A | N/A |
| 14 | Admin dashboard | `/admin`, `/admin/security` | **Yes + admin** | per-user | N/A |

### Defense-in-depth layering (request flow)

```
Vercel edge → Next middleware (IP rate + blocklist) → Form pre-flight (email rate + suspension + Turnstile) → Convex Auth → Function (auth gate + per-user rate) → business logic
```

## Response Playbook

- **Credential stuffing flood**: `/admin/security` Events tab → confirm auto-suspensions working; add offending IPs to blocklist if narrow; escalate if botnet.
- **Sign-up spam**: verify BotID healthy, Turnstile loading; `adminSuspendUser` on offenders; `npx convex run marketingEmail:syncContacts '{}' --prod` to clean contacts.
- **Compromised account**: `adminSuspendUser` + force sign-out + send reset email + review `auditLogs`.
- **False-positive lockout**: `/admin/security` → Flagged Users → unsuspend; optionally unblock IP.

## Known gaps (Phase 2+)

- No MFA (planned with Clerk migration)
- No dedicated WAF (Vercel Hobby — rely on edge + middleware + per-layer limits)
- Appeal flow is email-based (self-service signed-token `/appeal/[token]` planned)
- No password-history enforcement (Clerk will provide)
- No device fingerprinting beyond Turnstile + BotID
