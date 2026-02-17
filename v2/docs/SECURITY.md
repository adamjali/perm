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

- **Implementation**: `convex/lib/rateLimit.ts` (sliding window, `rateLimits` table)
- **Auth pre-flight**: `convex/authRateLimit.ts` — frontend calls before `signIn()`
- **Limits**: LOGIN 10/15min, OTP_VERIFY 5/15min, PASSWORD_RESET 3/hr, EMAIL_SEND 5/10min
- **Cleanup**: Hourly cron removes records older than 24 hours

## Security Headers

Applied to all routes via `next.config.ts`:
- `Strict-Transport-Security`: HSTS with preload
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Permissions-Policy`: camera=(), microphone=(), geolocation=()
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
