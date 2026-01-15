"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useEffect } from "react";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/contexts/AuthContext";
import { NavLinkProvider } from "@/components/ui/nav-link";
import { PageContextProvider } from "@/lib/ai/page-context";

// Validate required environment variable with explicit error message
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL environment variable is not set. " +
    "Please add it to your .env.local file or deployment environment."
  );
}
const convex = new ConvexReactClient(convexUrl);

/**
 * Suppresses the Convex Auth beforeunload popup during internal navigation.
 * The library adds a beforeunload listener to prevent navigation during token refresh,
 * but this can interfere with normal SPA navigation on public pages.
 *
 * Strategy: Track if navigation is internal (via Next.js router) vs external (browser).
 * When internal navigation triggers beforeunload, suppress the popup.
 */
function BeforeUnloadSuppressor({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Track whether current navigation is internal (via SPA router)
    let isInternalNavigation = false;

    // Intercept link clicks and router events to detect internal navigation
    const markInternalNavigation = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const link = target.closest("a");
      if (link && link.href) {
        try {
          const url = new URL(link.href, window.location.origin);
          // Same-origin links are internal navigation
          if (url.origin === window.location.origin) {
            isInternalNavigation = true;
            // Reset after a short delay (navigation should complete or be cancelled)
            setTimeout(() => {
              isInternalNavigation = false;
            }, 100);
          }
        } catch (e) {
          // Invalid URL (e.g., javascript:void(0)) - treat as external navigation
          if (process.env.NODE_ENV === "development") {
            console.debug("[BeforeUnloadSuppressor] Invalid URL:", link.href, e);
          }
        }
      }
    };

    const suppressHandler = (e: BeforeUnloadEvent) => {
      // Suppress beforeunload popup for internal SPA navigation
      if (isInternalNavigation) {
        // Prevent the default dialog by not setting returnValue
        e.preventDefault();
        // Reset the flag
        isInternalNavigation = false;
        return undefined;
      }
    };

    // Track link clicks to detect internal navigation
    document.addEventListener("click", markInternalNavigation, { capture: true });
    // Add beforeunload handler with capture to run before Convex Auth's handler
    window.addEventListener("beforeunload", suppressHandler, { capture: true });

    return () => {
      document.removeEventListener("click", markInternalNavigation, { capture: true });
      window.removeEventListener("beforeunload", suppressHandler, { capture: true });
    };
  }, []);

  return <>{children}</>;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <BeforeUnloadSuppressor>
        <AuthProvider>
          <ThemeProvider>
            <NavLinkProvider>
              <PageContextProvider>
                {children}
              </PageContextProvider>
            </NavLinkProvider>
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </BeforeUnloadSuppressor>
    </ConvexAuthNextjsProvider>
  );
}
