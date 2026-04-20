import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";
import { fetchMutation } from "convex/nextjs";
import { api } from "../convex/_generated/api";

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

// @convex-dev/auth mounts its sign-in/sign-up/reset handlers under /api/auth.
// These are publicly reachable — a bot can hit them directly without ever
// loading our signup page. We enforce a per-IP rate limit here (in addition
// to the per-email rate limit that runs inside Convex Auth itself).
const isConvexAuthApiRoute = createRouteMatcher(["/api/auth", "/api/auth/(.*)"]);

// Map the auth path fragment to a rate-limit action bucket.
function rateLimitActionForAuthPath(pathname: string): "ip_signup" | "ip_login" | "ip_password_reset" | "ip_otp_verify" | null {
  // @convex-dev/auth uses a single /api/auth endpoint and distinguishes flow
  // via the `flow` form field (signUp|signIn|reset|reset-verification|email-verification).
  // At middleware level we can't easily parse the body without consuming it,
  // so we treat all /api/auth POSTs under one bucket: ip_signup (the harshest).
  // This favors safety over UX for legitimate rapid retries.
  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return "ip_signup";
  }
  return null;
}

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // Per-IP rate-limit gate on Convex Auth API routes (defense-in-depth
    // alongside the per-email limit inside Convex). Only POSTs matter —
    // the sign-in/up flow is POST-only.
    if (request.method === "POST" && isConvexAuthApiRoute(request)) {
      const action = rateLimitActionForAuthPath(request.nextUrl.pathname);
      if (action) {
        const ip =
          request.headers.get("x-forwarded-for") ??
          request.headers.get("x-real-ip") ??
          "unknown";
        try {
          const check = await fetchMutation(api.authRateLimit.checkIpRateLimit, {
            ip,
            action,
          });
          if (!check.allowed) {
            return NextResponse.json(
              { error: check.message || "Too many requests from your IP. Please wait and try again." },
              { status: 429 },
            );
          }
        } catch {
          // Fail open — availability over strictness on infrastructure glitches.
        }
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
