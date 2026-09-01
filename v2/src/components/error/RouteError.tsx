"use client";

/**
 * RouteError Component
 *
 * Error boundary UI for Next.js App Router error.tsx files.
 * Wrapper around ErrorDisplay with Sentry integration.
 *
 * Auth errors (session expiry) redirect gracefully to /login
 * instead of showing a scary error page.
 */

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { ArrowCounterClockwiseIcon as RefreshCcw, HouseIcon as Home } from "@phosphor-icons/react";
import { isAuthError, isStaleDeploymentError, isLikelySessionTimeout } from "./auth-error";
import { ErrorDisplay } from "./ErrorDisplay";

export interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  homeHref?: string;
}

export function RouteError({
  error,
  reset,
  title = "Something went wrong",
  homeHref = "/dashboard",
}: RouteErrorProps) {
  const isExpiredSession = isAuthError(error.message) || isLikelySessionTimeout();
  const isStaleDeployment = isStaleDeploymentError(error);

  useEffect(() => {
    // Stale deployment — silently reload to pick up new Server Action hashes
    if (isStaleDeployment) {
      window.location.reload();
      return;
    }

    if (isExpiredSession) {
      // Session expired — redirect gracefully, don’t report to Sentry
      window.location.href = "/login?expired=1";
      return;
    }

    console.error("[RouteError]", error);

    Sentry.captureException(error, {
      tags: {
        component: "RouteError",
        route:
          typeof window !== "undefined" ? window.location.pathname : "unknown",
        ...(error.digest && { digest: error.digest }),
      },
      extra: {
        url: typeof window !== "undefined" ? window.location.href : undefined,
        referrer:
          typeof document !== "undefined" ? document.referrer : undefined,
      },
    });
  }, [error, isExpiredSession, isStaleDeployment]);

  // Stale deployment: show brief message while reloading
  if (isStaleDeployment) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">
          Updating to latest version&hellip;
        </p>
      </div>
    );
  }

  // Auth errors: show brief message while redirecting to login
  if (isExpiredSession) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <p className="text-sm text-muted-foreground">
          Session expired. Redirecting to login&hellip;
        </p>
      </div>
    );
  }

  const isDev = process.env.NODE_ENV === "development";

  return (
    <ErrorDisplay
      title={title}
      message={
        isDev ? error.message : "An unexpected error occurred. Please try again."
      }
      details={isDev && error.digest ? `Digest: ${error.digest}` : undefined}
      actions={[
        {
          label: "Try Again",
          icon: RefreshCcw,
          onClick: reset,
        },
        {
          label: "Go to Dashboard",
          icon: Home,
          onClick: () => (window.location.href = homeHref),
          variant: "outline",
        },
      ]}
    />
  );
}
