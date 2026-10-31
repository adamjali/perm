/**
 * What an error screen reports to /api/client-error, checked. The screens that
 * catch a crash reload or redirect within a second (owner, Oct 31 2026: "it
 * disappears super quick so i cant [screenshot]"), and PostHog is off for staff
 * and Sentry isn't loaded on the sign-in pages, so they also tell our own server.
 *
 * Only these fields, each capped, and the path without its query string, so a
 * case number or a token in an address never reaches the log.
 */

export const OUTCOMES = ["shown", "reload", "redirect-login", "reload-stale"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface ClientErrorReport {
  boundary: string;
  outcome: Outcome;
  name: string;
  message: string;
  digest: string | null;
  path: string;
  stack: string | null;
}

/** The most bytes a report may carry. */
export const MAX_BODY = 4096;

const cut = (v: unknown, max: number): string | null =>
  typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, max) : null;

/** The report, or null when it isn't one. */
export function parseClientError(body: unknown): ClientErrorReport | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const boundary = cut(b.boundary, 40);
  if (!boundary || !/^[A-Za-z]+$/.test(boundary)) return null;
  const outcome = OUTCOMES.find((o) => o === b.outcome);
  if (!outcome) return null;
  const path = cut(b.path, 200);
  if (!path || !path.startsWith("/")) return null;
  return {
    boundary,
    outcome,
    name: cut(b.name, 60) ?? "Error",
    message: cut(b.message, 300) ?? "",
    digest: cut(b.digest, 40),
    path: path.split(/[?#]/)[0] ?? path,
    stack: typeof b.stack === "string" ? b.stack.slice(0, 1500) : null,
  };
}
