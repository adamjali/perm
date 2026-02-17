import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

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

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
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
