import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { refuseAuthPost } from "@/lib/auth/authGate";
import { afterAuthPath } from "@/lib/carriedCase";

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
// A token refresh is a POST here too (auth:signIn with a refreshToken); the
// sign-in limits skip it, so they never throttle normal page use.
const isConvexAuthApiRoute = createRouteMatcher(["/api/auth", "/api/auth/"]);

/**
 * Next 16 renamed this file convention from `middleware.ts` to `proxy.ts` and
 * the export from `default` to a named `proxy`. Convex Auth still documents
 * only the default export, so both are exported from one handler: the default
 * keeps Convex Auth's documented shape, and the named export is what Next 16
 * looks for.
 *
 * Without the named export the build emits `middleware.js` down the legacy
 * path while `Collecting build traces` looks for `proxy.js.nft.json`, and a
 * clean build fails with ENOENT after compiling successfully.
 */
const auth = convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    const needsAuth = isProtectedRoute(request);
    const isAuth = isAuthRoute(request);

    // Skip auth check for routes that don't need it
    if (!needsAuth && !isAuth) {
      return;
    }

    const isAuthenticated = await convexAuth.isAuthenticated();

    // Redirect authenticated users away from login/signup pages. One who chose
    // "Save as a case" under the deadline calculator goes straight to the
    // new-case form with those dates (src/lib/carriedCase.ts).
    if (isAuth && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, afterAuthPath("login", request.nextUrl.search));
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

/**
 * Sign-in limits first: Convex Auth's middleware answers /api/auth itself
 * before it calls the handler above, so a check placed inside that handler
 * never ran for a sign-in (src/lib/auth/authGate.ts).
 */
async function handler(request: NextRequest, event: NextFetchEvent) {
  if (request.method === "POST" && isConvexAuthApiRoute(request)) {
    const refused = await refuseAuthPost(request);
    if (refused) return refused;
  }
  return auth(request, event);
}

export default handler;
export const proxy = handler;

export const config = {
  // ONLY WHERE THIS FILE HAS WORK TO DO. Matching every non-file path would
  // run the login check on every public page and every cached hit before the
  // page cache could answer, which is most requests, on pages with no login
  // at all. Public pages are static or ISR and need nothing from here.
  //
  // What still must run through it: the authenticated app (redirect to
  // /login), /login and /signup (redirect to /dashboard), the Convex Auth
  // endpoint and its IP rate limit, the chat and Google-calendar routes, and
  // any path carrying ?code= - that is where Convex Auth's OAuth exchange
  // lands after Google sign-in, and it is matched by query, not by path.
  matcher: [
    "/dashboard/:path*",
    "/cases/:path*",
    "/calendar/:path*",
    "/timeline/:path*",
    "/settings/:path*",
    "/notifications/:path*",
    "/admin/:path*",
    "/login",
    "/signup",
    "/api/auth/:path*",
    "/api/chat/:path*",
    "/api/google/:path*",
    // Settings > API keys reads its usage here with the signed-in session.
    "/api/developer/:path*",
    { source: "/:path*", has: [{ type: "query", key: "code" }] },
  ],
};
