/**
 * Sentry Error Reporting for Convex Backend
 *
 * Uses Sentry's HTTP store API since Convex runs in V8 isolates
 * without Node.js APIs. Only usable from actions (which have fetch).
 *
 * @example
 * ```ts
 * import { reportError } from './lib/sentry';
 *
 * try {
 *   await someOperation();
 * } catch (error) {
 *   await reportError(error, { module: 'email', operation: 'sendDeadlineReminder' });
 *   throw error;
 * }
 * ```
 */

import { createLogger } from "./logging";

const log = createLogger("Sentry");

interface SentryContext {
  module?: string;
  operation?: string;
  userId?: string;
  resourceId?: string;
  extra?: Record<string, unknown>;
}

interface ParsedDSN {
  publicKey: string;
  host: string;
  projectId: string;
}

function parseDSN(dsn: string): ParsedDSN | null {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const host = url.hostname;
    const projectId = url.pathname.replace("/", "");
    if (!publicKey || !host || !projectId) return null;
    return { publicKey, host, projectId };
  } catch {
    return null;
  }
}

/**
 * Report an error to Sentry from a Convex action.
 * Silently fails if DSN is not configured — never throws.
 */
export async function reportError(
  error: unknown,
  context?: SentryContext
): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const parsed = parseDSN(dsn);
  if (!parsed) {
    log.warn("Invalid SENTRY_DSN format");
    return;
  }

  const errorObj =
    error instanceof Error ? error : new Error(String(error));

  const event = {
    event_id: crypto.randomUUID().replace(/-/g, ""),
    timestamp: new Date().toISOString(),
    platform: "node",
    level: "error",
    server_name: "convex-backend",
    environment: process.env.NODE_ENV ?? "production",
    tags: {
      runtime: "convex",
      ...(context?.module && { module: context.module }),
      ...(context?.operation && { operation: context.operation }),
    },
    user: context?.userId ? { id: context.userId } : undefined,
    extra: {
      ...(context?.resourceId && { resourceId: context.resourceId }),
      ...context?.extra,
    },
    exception: {
      values: [
        {
          type: errorObj.name,
          value: errorObj.message,
          stacktrace: errorObj.stack
            ? {
                frames: parseStackFrames(errorObj.stack),
              }
            : undefined,
        },
      ],
    },
  };

  const storeUrl = `https://${parsed.host}/api/${parsed.projectId}/store/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  try {
    const response = await fetch(storeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      log.warn("Failed to report to Sentry", {
        status: response.status.toString(),
      });
    }
  } catch (fetchError) {
    log.warn("Sentry report failed", {
      error: fetchError instanceof Error ? fetchError.message : "Unknown",
    });
  }
}

/**
 * Parse stack trace string into Sentry frame objects.
 */
function parseStackFrames(
  stack: string
): Array<{ filename: string; function: string; lineno?: number; colno?: number }> {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1] ?? "<unknown>",
          filename: match[2] ?? "<unknown>",
          lineno: parseInt(match[3] ?? "0", 10),
          colno: parseInt(match[4] ?? "0", 10),
        };
      }
      const simpleMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
      if (simpleMatch) {
        return {
          function: "<anonymous>",
          filename: simpleMatch[1] ?? "<unknown>",
          lineno: parseInt(simpleMatch[2] ?? "0", 10),
          colno: parseInt(simpleMatch[3] ?? "0", 10),
        };
      }
      return { function: line.trim(), filename: "<unknown>" };
    })
    .reverse(); // Sentry expects innermost frame last
}
