import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Public routes (no auth required)
const isPublicRoute = createRouteMatcher([
  "/",
  "/login",
  "/signup",
  "/reset-password",
  "/demo",
  // Legal/info pages (footer links)
  "/contact",
  "/privacy",
  "/terms",
  // Static assets that need to be public
  "/icon",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
  // Google Calendar OAuth callback - must be public because Google redirect loses session cookies
  "/api/google/callback",
]);

// Auth routes (should redirect to dashboard if already logged in)
const isAuthRoute = createRouteMatcher(["/login", "/signup"]);

export default convexAuthNextjsMiddleware(
  async (request, { convexAuth }) => {
    // OPTIMIZATION: Skip auth check entirely for truly public routes (not auth routes)
    // Auth routes need the check to redirect authenticated users to dashboard
    if (isPublicRoute(request) && !isAuthRoute(request)) {
      return; // No auth check needed, instant response
    }

    // Only check auth for routes that need it (auth routes + protected routes)
    const isAuthenticated = await convexAuth.isAuthenticated();

    // Redirect authenticated users away from login/signup pages
    if (isAuthRoute(request) && isAuthenticated) {
      return nextjsMiddlewareRedirect(request, "/dashboard");
    }

    // Redirect unauthenticated users to login (for protected routes)
    if (!isPublicRoute(request) && !isAuthenticated) {
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
