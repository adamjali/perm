/**
 * Next.js Instrumentation Hook
 *
 * Initializes Sentry based on the runtime environment.
 * This file is automatically loaded by Next.js during startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
 */

export async function register() {
  // Only initialize if DSN is configured
  const hasSentryDsn =
    process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!hasSentryDsn) {
    console.log(
      "[Instrumentation] Sentry DSN not configured, skipping initialization"
    );
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Server-side Node.js runtime
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    // Edge runtime (middleware, edge routes)
    await import("../sentry.edge.config");
  }
}

// Export the Sentry error handler for the onRequestError hook
export const onRequestError = async (
  error: Error,
  request: { method: string; path: string; headers: Record<string, string> },
  context: { routerKind: string; routePath: string; routeType: string }
) => {
  try {
    // Import Sentry dynamically to avoid loading during build
    const Sentry = await import("@sentry/nextjs");

    Sentry.captureException(error, {
      tags: {
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
      },
      extra: {
        method: request.method,
        path: request.path,
      },
    });
  } catch (importError) {
    // Fallback to console if Sentry fails to load
    console.error("[Instrumentation] Failed to report error to Sentry:", importError);
    console.error("[Instrumentation] Original error:", error);
  }
};
