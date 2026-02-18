"use client";

/**
 * Global Error Boundary
 *
 * Catches unhandled errors in the root layout and all pages.
 * This is the last line of defense — it even catches errors
 * that the per-route error.tsx boundaries miss.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */

import { useEffect } from "react";
import { isAuthError, isStaleDeploymentError } from "@/components/error/auth-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isExpiredSession = isAuthError(error.message);
  const isStaleDeployment = isStaleDeploymentError(error);

  useEffect(() => {
    // Stale deployment: silently reload to pick up new Server Action hashes
    if (isStaleDeployment) {
      window.location.reload();
      return;
    }

    if (isExpiredSession) {
      window.location.href = "/login?expired=1";
      return;
    }

    // Dynamic import — Sentry may not be initialized on public pages
    import("@sentry/nextjs")
      .then((Sentry) => {
        Sentry.captureException(error, {
          tags: {
            component: "GlobalError",
            ...(error.digest && { digest: error.digest }),
          },
        });
      })
      .catch((err) => {
        console.error("[GlobalError] Could not report to Sentry:", err);
      });
  }, [error, isExpiredSession, isStaleDeployment]);

  // Stale deployment: show brief message while reloading
  if (isStaleDeployment) {
    return (
      <html lang="en">
        <body
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            background: "#fafafa",
            margin: 0,
          }}
        >
          <p style={{ color: "#666", fontSize: 14 }}>
            Updating to latest version&hellip;
          </p>
        </body>
      </html>
    );
  }

  // Auth errors: show brief message while redirecting to login
  if (isExpiredSession) {
    return (
      <html lang="en">
        <body
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            background: "#fafafa",
            margin: 0,
          }}
        >
          <p style={{ color: "#666", fontSize: 14 }}>
            Session expired. Redirecting to login&hellip;
          </p>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "system-ui, sans-serif",
          background: "#fafafa",
          margin: 0,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: 24 }}>
            An unexpected error occurred. Our team has been notified.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 24px",
              background: "#000",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
