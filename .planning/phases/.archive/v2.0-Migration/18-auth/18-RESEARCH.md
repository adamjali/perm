# Phase 18: Auth (Clerk-Ready) - Research

**Researched:** 2025-12-22
**Domain:** Convex Auth for Next.js 16+ with email/password + Google OAuth
**Confidence:** HIGH

<research_summary>
## Summary

Researched the Convex Auth ecosystem for implementing email/password authentication with Google OAuth in a Next.js 16 App Router application. The standard approach uses `@convex-dev/auth` with the built-in Password provider for email/password and `@auth/core/providers/google` for OAuth.

Key finding: Convex Auth provides a complete authentication solution that stores sessions in Convex tables (`authSessions`, `authAccounts`). For Clerk migration readiness, the architecture should use a **separate `userProfiles` table** that references the auth user ID, keeping auth data isolated from app-specific user preferences.

**Primary recommendation:** Use Convex Auth with Password provider (+ Resend for email verification) and Google OAuth provider. Create a separate `userProfiles` table for app-specific data (settings, preferences) with a 1:1 reference to the `users` table. This architecture allows seamless Clerk swap by only changing the auth layer while preserving all user profile data.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for Convex Auth with Next.js:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @convex-dev/auth | latest | Authentication framework | Official Convex Auth library |
| @auth/core | latest | OAuth provider definitions | Auth.js core, used by Convex Auth for OAuth |
| resend | 4.x | Email delivery (OTP/verification) | Popular transactional email API |
| @oslojs/crypto | latest | Secure token generation | Cryptographically secure OTP generation |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 3.x | Input validation | Validate email format, password requirements |
| bcryptjs | (bundled) | Password hashing | Handled internally by Password provider |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Convex Auth | Better Auth | Better Auth is more feature-rich but adds complexity; Convex Auth is simpler and official |
| Convex Auth | Auth.js (NextAuth) | Auth.js requires adapter setup; Convex Auth is native integration |
| Convex Auth | Clerk | Clerk is production-grade but external service; start with Convex Auth, migrate later if needed |
| Resend | Nodemailer | Nodemailer requires SMTP config; Resend is simpler for transactional emails |

**Installation:**
```bash
pnpm add @convex-dev/auth @auth/core resend @oslojs/crypto zod
```

**Environment Variables (Convex):**
```bash
# Set via: npx convex env set <VAR> <VALUE>
AUTH_GOOGLE_ID=<google-client-id>  # Reuse from v1: GOOGLE_CLIENT_ID
AUTH_GOOGLE_SECRET=<google-secret>  # Reuse from v1: GOOGLE_CLIENT_SECRET
AUTH_RESEND_KEY=<resend-api-key>    # Reuse from v1: RESEND_API_KEY
```

**Note on v1 credential reuse:** The existing Google OAuth credentials from v1 can be reused. You'll need to:
1. Add a new Authorized redirect URI in Google Cloud Console: `https://<your-convex-deployment>.convex.site/api/auth/callback/google`
2. Copy the existing GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET values to the new AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET environment variables in Convex
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
convex/
├── auth.ts              # Convex Auth configuration
├── http.ts              # HTTP routes for OAuth callbacks
├── schema.ts            # Database schema with authTables
├── users.ts             # User-related queries/mutations
├── userProfiles.ts      # App-specific profile data
├── ResendOTP.ts         # OTP email provider for verification
└── ResendPasswordReset.ts # Password reset email provider
src/
├── app/
│   ├── layout.tsx       # ConvexAuthNextjsServerProvider wrapper
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── reset-password/page.tsx
│   └── (protected)/     # Authenticated routes
├── components/
│   └── providers/
│       └── ConvexClientProvider.tsx
└── middleware.ts        # Route protection
```

### Pattern 1: Convex Auth Setup with Multiple Providers
**What:** Configure Convex Auth with Password + Google OAuth providers
**When to use:** Any app needing email/password and social login
**Example:**
```typescript
// convex/auth.ts
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendPasswordReset } from "./ResendPasswordReset";
import { DataModel } from "./_generated/dataModel";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Google,
    Password<DataModel>({
      verify: ResendOTP,      // Email verification OTP
      reset: ResendPasswordReset,  // Password reset OTP
      profile(params) {
        return {
          email: params.email as string,
          name: params.name as string | undefined,
        };
      },
      validatePasswordRequirements(password: string) {
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters");
        }
      },
    }),
  ],
});
```

### Pattern 2: Separate User Profiles Table (Clerk-Ready Architecture)
**What:** Keep auth data in `users` table, app data in separate `userProfiles` table
**When to use:** When you need migration flexibility to Clerk or other auth providers
**Example:**
```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,  // Includes users, authSessions, authAccounts, etc.

  // Extend users table minimally (auth-related only)
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
  }).index("email", ["email"]),

  // Separate table for app-specific user data
  userProfiles: defineTable({
    userId: v.id("users"),  // Reference to auth user
    // App-specific settings (from v1 perm_users)
    calendarSyncEnabled: v.boolean(),
    notificationPreferences: v.optional(v.object({
      emailNotifications: v.boolean(),
      deadlineReminders: v.boolean(),
    })),
    // ... other app settings
  }).index("userId", ["userId"]),
});
```

**Why separate tables?**
1. **Clerk migration:** When swapping to Clerk, only the `users` table changes; `userProfiles` remains untouched
2. **Clean separation:** Auth concerns vs app concerns
3. **Type safety:** Different validation rules for auth vs app data

### Pattern 3: Next.js Middleware for Route Protection
**What:** Protect routes using Convex Auth middleware
**When to use:** All authenticated apps with Next.js
**Example:**
```typescript
// middleware.ts
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/login", "/signup", "/reset-password"]);
const isAuthRoute = createRouteMatcher(["/login", "/signup"]);

export default convexAuthNextjsMiddleware(async (request, { convexAuth }) => {
  const isAuthenticated = await convexAuth.isAuthenticated();

  // Redirect authenticated users away from auth pages
  if (isAuthRoute(request) && isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/dashboard");
  }

  // Redirect unauthenticated users to login
  if (!isPublicRoute(request) && !isAuthenticated) {
    return nextjsMiddlewareRedirect(request, "/login");
  }
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

### Pattern 4: Server-Side Auth Checks
**What:** Verify authentication in Convex queries/mutations
**When to use:** All protected database operations
**Example:**
```typescript
// convex/users.ts
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    return await ctx.db.get(userId);
  },
});

export const currentUserProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .unique();
    return profile;
  },
});
```

### Anti-Patterns to Avoid
- **Storing app data in the `users` table:** Makes Clerk migration harder; use separate `userProfiles`
- **Using Clerk's `useAuth()` directly:** Use `useConvexAuth()` hook for proper token synchronization
- **Not validating sessions in mutations:** Always use `getAuthUserId()` to verify authentication
- **Hardcoding callback URLs:** Use environment variables for OAuth redirect URIs
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom bcrypt implementation | Password provider's built-in crypto | Secure by default, handles salt/rounds |
| JWT validation | Custom JWT parsing | Convex Auth middleware | Handles token refresh, expiry, signatures |
| OAuth flow | Custom OAuth redirect handling | @auth/core providers | Handles state, PKCE, token exchange |
| Session management | Custom session table | authSessions table | Handles expiry, refresh token reuse detection |
| Email verification | Custom verification logic | Password provider verify option | Handles OTP generation, expiry, rate limiting |
| Route protection | Custom auth checks in pages | convexAuthNextjsMiddleware | Runs before page load, handles redirects |
| User ID retrieval | Parsing ctx.auth manually | getAuthUserId() | Handles null checks, type safety |

**Key insight:** Convex Auth handles the hard security parts — token generation, password hashing, session invalidation, refresh token reuse detection. Custom implementations risk security vulnerabilities. The only custom code needed is:
1. Email templates (for branding)
2. User profile data (app-specific)
3. Password validation rules (business logic)
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Missing OAuth Callback URL Configuration
**What goes wrong:** Google OAuth login fails with redirect_uri_mismatch error
**Why it happens:** Forgot to add Convex HTTP Actions URL to Google Cloud Console
**How to avoid:**
1. Get your Convex deployment URL: `npx convex dashboard` → Settings → URL
2. Add to Google Console: `https://<deployment>.convex.site/api/auth/callback/google`
**Warning signs:** OAuth works locally but fails in production, or vice versa

### Pitfall 2: Environment Variable Naming Confusion
**What goes wrong:** OAuth provider can't find credentials
**Why it happens:** Using wrong env var names (e.g., GOOGLE_CLIENT_ID instead of AUTH_GOOGLE_ID)
**How to avoid:** Convex Auth expects `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`, not v1's `GOOGLE_CLIENT_ID`
**Warning signs:** "OAuth provider not configured" errors despite having credentials

### Pitfall 3: Mixing useAuth() and useConvexAuth()
**What goes wrong:** Race conditions between auth state and Convex connection
**Why it happens:** Using Clerk/Auth.js's `useAuth()` instead of Convex's `useConvexAuth()`
**How to avoid:** Always use `useConvexAuth()` from `convex/react` for auth state checks
**Warning signs:** "Not authenticated" errors despite being logged in, inconsistent auth state

### Pitfall 4: Not Handling Email Verification State
**What goes wrong:** Users can access app without verified email
**Why it happens:** Forgot to check `emailVerificationTime` field
**How to avoid:** Check for `emailVerificationTime !== undefined` before granting full access
**Warning signs:** Users complain about not receiving verification emails (because flow was skipped)

### Pitfall 5: Session Storage Misconfiguration
**What goes wrong:** Auth state lost on page refresh, or cross-tab auth issues
**Why it happens:** Default localStorage may conflict with sessionStorage requirements
**How to avoid:** Use `storage` prop on ConvexAuthProvider if you need per-tab sessions
**Warning signs:** Logging in on one tab affects all tabs unexpectedly (or doesn't when it should)

### Pitfall 6: Forgetting HTTP Routes for OAuth
**What goes wrong:** OAuth callbacks return 404
**Why it happens:** Didn't call `auth.addHttpRoutes(http)` in `convex/http.ts`
**How to avoid:** Always add HTTP routes for OAuth:
```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";
const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```
**Warning signs:** OAuth redirect works but callback fails
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### Resend OTP Provider for Email Verification
```typescript
// convex/ResendOTP.ts
// Source: Convex Auth docs - Password configuration
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "@oslojs/crypto/random";

export const ResendOTP = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  async generateVerificationToken() {
    return generateRandomString(8, alphabet("0-9"));
  },
  async sendVerificationRequest({ identifier: email, token }) {
    const resend = new ResendAPI(process.env.AUTH_RESEND_KEY!);
    await resend.emails.send({
      from: "PERM Tracker <noreply@permtracker.app>",
      to: [email],
      subject: "Verify your email",
      html: `<p>Your verification code is: <strong>${token}</strong></p>
             <p>This code expires in 10 minutes.</p>`,
    });
  },
});
```

### Client Provider Setup for Next.js App Router
```typescript
// src/components/providers/ConvexClientProvider.tsx
// Source: Convex Auth docs - Next.js setup
"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
```

### Server Provider in Root Layout
```typescript
// src/app/layout.tsx
// Source: Convex Auth docs - Next.js setup
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { ConvexClientProvider } from "@/components/providers/ConvexClientProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
}
```

### Sign In/Sign Up Form Component
```typescript
// Source: Convex Auth docs - Password authentication
"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [step, setStep] = useState<"credentials" | "verification">("credentials");
  const [email, setEmail] = useState("");

  if (step === "verification") {
    return (
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        void signIn("password", formData);
      }}>
        <input name="email" type="hidden" value={email} />
        <input name="code" placeholder="Verification code" />
        <input name="flow" type="hidden" value="email-verification" />
        <button type="submit">Verify</button>
      </form>
    );
  }

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      setEmail(formData.get("email") as string);
      void signIn("password", formData).then(() => {
        if (flow === "signUp") setStep("verification");
      });
    }}>
      <input name="email" type="email" placeholder="Email" required />
      <input name="password" type="password" placeholder="Password" required />
      <input name="flow" type="hidden" value={flow} />
      <button type="submit">{flow === "signIn" ? "Sign In" : "Sign Up"}</button>
      <button type="button" onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}>
        {flow === "signIn" ? "Need an account?" : "Have an account?"}
      </button>
    </form>
  );
}
```

### Google OAuth Button
```typescript
// Source: Convex Auth docs - OAuth
"use client";

import { useAuthActions } from "@convex-dev/auth/react";

export function GoogleSignIn() {
  const { signIn } = useAuthActions();

  return (
    <button onClick={() => void signIn("google")}>
      Sign in with Google
    </button>
  );
}
```

### Auth State Component
```typescript
// Source: Convex React docs - Authentication
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div>Loading...</div>
      </AuthLoading>
      <Unauthenticated>
        <SignInForm />
      </Unauthenticated>
      <Authenticated>
        {children}
      </Authenticated>
    </>
  );
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2025)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom JWT validation | Convex Auth built-in | 2024 | No manual JWT handling needed |
| Auth.js adapter | @convex-dev/auth native | 2024 | Simpler setup, better TypeScript |
| localStorage only | Server cookies + localStorage | 2024 | SSR support in Next.js App Router |
| Manual session tables | authTables schema spread | 2024 | Standardized session management |

**New tools/patterns to consider:**
- **Better Auth integration:** Alternative to Convex Auth with more features (2FA, magic links); consider if those features become requirements
- **Convex Auth SSA (Server-Side Auth):** Experimental feature for pure server-side auth in Next.js; watch for stable release

**Deprecated/outdated:**
- **Manual JWT providers:** Use Convex Auth's built-in providers instead of custom JWT handling
- **ConvexProviderWithClerk pattern:** Only needed if using Clerk; Convex Auth has its own provider
</sota_updates>

<clerk_migration_readiness>
## Clerk Migration Readiness

Architecture decisions that enable future Clerk migration:

### What to Do Now

1. **Separate `userProfiles` table:** Store app-specific data (settings, preferences) in a table that references `users.id` rather than in the `users` table itself

2. **Use Convex user IDs as foreign keys:** Reference `users._id` (Convex ID) in other tables, not email or external IDs

3. **Don't rely on auth-specific fields:** Keep business logic independent of `authSessions` or `authAccounts` tables

4. **Document email as stable identifier:** If you need to match users across migration, email is the most reliable field

### Migration Strategy (When Ready)

1. **Trickle migration:** Keep both systems running, migrate users on next login
2. **User ID mapping:** Store Clerk's user ID as `external_id` in `userProfiles`, map to existing Convex user ID
3. **Profile preservation:** All data in `userProfiles` survives migration unchanged

### Code Changes Required for Clerk

| Component | Convex Auth | Clerk | Change Scope |
|-----------|-------------|-------|--------------|
| Provider | ConvexAuthNextjsProvider | ConvexProviderWithClerk | 1 file |
| Middleware | convexAuthNextjsMiddleware | clerkMiddleware | 1 file |
| Hook | useConvexAuth | useConvexAuth | No change |
| Backend | getAuthUserId | ctx.auth.getUserIdentity | All mutations/queries |
| Schema | authTables spread | Remove auth tables | 1 file |
| User profiles | userProfiles table | userProfiles table | No change |

**Estimated effort:** 1-2 days for full migration if architecture is followed correctly.
</clerk_migration_readiness>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Email verification UX**
   - What we know: Convex Auth supports OTP-based email verification via the `verify` option
   - What's unclear: Whether to require verification before first login or allow "soft" access with verification prompt
   - Recommendation: Start with soft verification (like v1), add hard requirement later if needed

2. **Session cookie duration**
   - What we know: Default is session cookie (cleared on browser close); can set maxAge
   - What's unclear: Whether users expect persistent login (7-day token) or per-session
   - Recommendation: Use 7-day maxAge in middleware config, matching v1 behavior

3. **Rate limiting for password attempts**
   - What we know: Convex Auth has refresh token reuse detection
   - What's unclear: Whether additional rate limiting is needed for brute force protection
   - Recommendation: Convex backend naturally rate-limits via serverless invocation limits; monitor and add if needed
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- /get-convex/convex-auth (Context7) - setup, passwords, oauth, authz, advanced
- Convex Auth docs (labs.convex.dev/auth) - all configuration pages
- Convex Developer Hub (docs.convex.dev/auth) - authentication guide

### Secondary (MEDIUM confidence)
- [Convex Auth Next.js setup](https://labs.convex.dev/auth) - verified against Context7
- [Convex Auth passwords](https://labs.convex.dev/auth/config/passwords) - verified code examples
- [Convex Auth Google OAuth](https://labs.convex.dev/auth/config/oauth/google) - verified setup steps

### Tertiary (LOW confidence - needs validation)
- GitHub issue discussions on session management - general patterns, may have edge cases
- Community Discord recommendations on Clerk migration - anecdotal, not official

### Web Search Verification
- [Convex Auth security](https://labs.convex.dev/auth/security) - token storage, XSS prevention
- [Authentication debugging](https://docs.convex.dev/auth/debug) - JWT verification steps
- [Clerk migration docs](https://clerk.com/docs/deployments/migrate-overview) - migration strategies
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Convex Auth + @convex-dev/auth
- Ecosystem: @auth/core providers, Resend, @oslojs/crypto
- Patterns: Password auth, OAuth, email verification, route protection
- Pitfalls: OAuth config, session storage, hook usage, email verification

**Confidence breakdown:**
- Standard stack: HIGH - verified with Context7, official docs
- Architecture: HIGH - patterns from official examples and documentation
- Pitfalls: HIGH - documented in official debugging guide
- Code examples: HIGH - from Context7/official sources
- Clerk migration: MEDIUM - based on community patterns, not official guide

**Research date:** 2025-12-22
**Valid until:** 2026-01-22 (30 days - Convex Auth ecosystem stable)
</metadata>

---

*Phase: 18-auth*
*Research completed: 2025-12-22*
*Ready for planning: yes*
