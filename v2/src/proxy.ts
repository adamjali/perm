import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../convex/_generated/api";
import { addBreadcrumb } from "@/lib/sentry";
import { getClientIp } from "@/lib/net/getClientIp";

// Protected routes (auth required) — unknown routes fall through to Next.js (404 naturally)
const isProtectedRoute = createRouteMatcher([
  "/dashboard",
  "/dashboard/(.*)",
  "/cases",
  "/cases/(.*)",
  "/calendar",
  "/calendar/(.*)",
  "/timeline",
  "/timeline/(.*)",
  "/settings",
  "/settings/(.*)",
  "/notifications",
  "/notifications/(.*)",
  "/admin",
  "/admin/(.*)",
  // Protected API routes
  "/api/chat",
  "/api/chat/(.*)",
  "/api/google/connect",
  "/api/google/disconnect",
]);

// Auth routes (should redirect to dashboard if already logged in)
const isAuthRoute = createRouteMatcher(["/login", "/signup"]);

// @convex-dev/auth mounts its handlers at the single /api/auth path (confirmed
// by reading the package source — shouldProxyAuthAction matches only exact path
// with/without trailing slash). All flows (signUp, signIn, reset, OTP verify,
// signOut) go through this one endpoint, distinguished by body.action + body.flow.
// Token refresh happens INSIDE this proxy (no additional POST), so the rate
// limit here does NOT throttle normal page navigation.
const isConvexAuthApiRoute = createRouteMatcher(["/api/auth", "/api/auth/"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // Per-IP rate-limit gate on Convex Auth API route (defense-in-depth
    // alongside the per-email limit inside Convex). Only POSTs matter —
    // the sign-in/up flow is POST-only.
    if (request.method === "POST" && isConvexAuthApiRoute(request)) {
      // getClientIp() reads the Vercel-attested IP via @vercel/functions, not
      // the spoofable leftmost x-forwarded-for hop. "unknown" only when no IP
      // is resolvable (local dev); checkIpRateLimit treats that literal as a
      // per-request fail-open so unknown-IP traffic never shares one real
      // rate-limit bucket.
      const ip = getClientIp(request) || "unknown";
      try {
        const check = await fetchMutation(api.authRateLimit.checkIpRateLimit, {
          ip,
          action: "ip_auth",
        });
        if (!check.allowed) {
          const retryMs = check.retryAfterMs ?? 0;
          const retryMin = Math.ceil(retryMs / 60000);
          const retrySec = Math.ceil(retryMs / 1000);
          return NextResponse.json(
            {
              error:
                check.message ||
                `Too many requests from your IP. Please try again in ${retryMin} minute${retryMin === 1 ? "" : "s"}.`,
            },
            { status: 429, headers: { "Retry-After": String(retrySec) } },
          );
        }
      } catch (error) {
        // Fail open — availability over strictness on infrastructure glitches.
        // Emit a Sentry breadcrumb so sustained fail-open events show up in
        // the auth error report instead of vanishing. Not captureError:
        // would be too noisy during any Convex outage.
        addBreadcrumb({
          category: "middleware.rate_limit",
          message: "ip_auth check failed — falling open",
          level: "warning",
          data: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    const needsAuth = isProtectedRoute(request);
    const isAuth = isAuthRoute(request);

    // Skip auth check for routes that don't need it
    if (!needsAuth && !isAuth) {
      return;
    }

    const isAuthenticated = await convexAuth.isAuthenticated();

    // Redirect authenticated users away from login/signup pages
    if (isAuth && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/dashboard");
    }

    // Redirect unauthenticated users to login (for protected routes only)
    if (needsAuth && !isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/login");
    }
  },
  {
    // Prevent Convex Auth from intercepting the Calendar OAuth callback
    // We have our own /api/google/callback route that handles Calendar OAuth separately
    shouldHandleCode: (request) => {
      // Don't let Convex Auth handle the code parameter for our Calendar OAuth callback
      if (request.nextUrl.pathname === "/api/google/callback") {
        return false;
      }
      // Let Convex Auth handle all other OAuth callbacks (e.g., Google Sign-In)
      return true;
    },
  }
);

export const config = {
  // Match all routes except static files and Next.js internals
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
