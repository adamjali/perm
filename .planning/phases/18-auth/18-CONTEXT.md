# Phase 18: Auth (Clerk-Ready) - Context

**Gathered:** 2025-12-22
**Status:** Ready for research

<vision>
## How This Should Work

Auth should work like v1 — straightforward, no friction. Users land on a login page with two options:

1. **Email/password** — Create an account or log in with email and password
2. **Google OAuth** — "Sign in with Google" as an alternative

Click, you're in, straight to dashboard. No fancy onboarding flows, no extra screens. The login page should feel clean and branded (PERM Tracker), but the goal is getting users into the app fast.

Importantly: reuse existing Google Cloud OAuth credentials from v1 so there's no need to reconfigure Google Console APIs.

</vision>

<essential>
## What Must Be Nailed

- **Full email/password flow** — Signup, email verification, login, and password reset. Complete auth, not a stub.
- **Google OAuth as alternative** — "Sign in with Google" button that works alongside email/password
- **Minimal friction** — Fast login, straight to dashboard. No extra steps.
- **Reuse existing OAuth credentials** — Don't require Google Cloud Console changes

</essential>

<boundaries>
## What's Out of Scope

- **No profile/settings UI** — That's Phase 25
- **No team/org features** — Single-user accounts only, no shared access
- **No 2FA/MFA** — Standard password security, no authenticator apps
- **No magic links** — Email verification yes, but not passwordless login
- **Clerk integration** — Architecture ready for Clerk swap, but not implementing Clerk now

</boundaries>

<specifics>
## Specific Ideas

- Match v1 login experience as closely as possible
- Email/password fields + "Sign in with Google" button
- Standard "Forgot password?" link with reset flow
- Email verification before account is active

</specifics>

<notes>
## Additional Context

From assumptions discussion: Agreed on separate `userProfiles` table (1:1 with auth user) rather than storing app data in Convex Auth's users table. This keeps auth isolated for potential Clerk swap and gives Phase 25 settings a clean home.

Research phase should investigate:
- Convex Auth patterns for email/password + OAuth
- Session management approach
- How to reuse existing Google OAuth credentials

</notes>

---

*Phase: 18-auth*
*Context gathered: 2025-12-22*
