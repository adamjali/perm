/**
 * Why a public request failed, in words a reader can act on.
 *
 * Every public search and list used to turn a failed request into one line -
 * "The search didn't load. Reloading usually clears it." - whatever the
 * cause. For the commonest cause under load that advice is wrong: the front
 * door answers 429 with its own JSON ("Too many requests from this address.
 * Try again in a few seconds.") and a Retry-After, and a reload is one more
 * request against the same limit. Sep 29 2026, from the silent-limit audit:
 * the reason existed on the wire and no page ever showed it.
 *
 * So the reason is read here, once, for every caller: the server's own
 * message when it sent one, the wait from Retry-After, and a plain sentence
 * for the cases a server cannot describe (a timeout, a dropped connection).
 */

export type FetchFailureKind = "rate-limited" | "busy" | "timeout" | "network" | "server";

export interface FetchFailure {
  kind: FetchFailureKind;
  /** HTTP status, or null when no response came back. */
  status: number | null;
  /** What to show. Always a full sentence that says what to do. */
  message: string;
  /** Seconds to wait before trying again, when the server said. */
  retryAfterSec: number | null;
}

/** Thrown by fetch helpers so a catch can show the reason, not a generic line. */
export class FetchFailureError extends Error {
  readonly failure: FetchFailure;
  constructor(failure: FetchFailure) {
    super(failure.message);
    this.name = "FetchFailureError";
    this.failure = failure;
  }
}

/** A string is worth showing only if it reads as a sentence, not a code. */
function sentence(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length >= 12 && s.includes(" ") ? s : null;
}

function seconds(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 3600) : null;
}

function wait(sec: number | null, fallback: number): string {
  const s = sec ?? fallback;
  return s >= 120 ? `${Math.round(s / 60)} minutes` : `${s} seconds`;
}

/** The failure a non-OK response describes. Reads the body without consuming the caller's. */
export async function failureFromResponse(res: Response): Promise<FetchFailure> {
  let body: Record<string, unknown> | null = null;
  try {
    const parsed: unknown = await res.clone().json();
    if (parsed && typeof parsed === "object") body = parsed as Record<string, unknown>;
  } catch {
    // An HTML error page or an empty body: the status still says enough.
  }
  const said = sentence(body?.message) ?? sentence(body?.error);
  const retryAfterSec = seconds(res.headers.get("retry-after")) ?? seconds(body?.retryAfter);
  if (res.status === 429) {
    return {
      kind: "rate-limited",
      status: 429,
      retryAfterSec,
      message:
        said ??
        `Too many requests from your connection in a short time. Wait ${wait(retryAfterSec, 30)} and try again.`,
    };
  }
  if (res.status === 503) {
    return {
      kind: "busy",
      status: 503,
      retryAfterSec,
      message: said ?? `The site is busy right now. Try again in ${wait(retryAfterSec, 15)}.`,
    };
  }
  return {
    kind: "server",
    status: res.status,
    retryAfterSec,
    message:
      said ??
      `The site answered with an error (HTTP ${res.status}). Try again, and if it keeps happening the problem is on our side.`,
  };
}

/** The failure a thrown error describes (timeout, dropped connection, or an already-described one). */
export function failureFromError(error: unknown, timeoutMs?: number): FetchFailure {
  if (error instanceof FetchFailureError) return error.failure;
  if (error instanceof DOMException && error.name === "TimeoutError") {
    const secs = timeoutMs ? Math.round(timeoutMs / 1000) : null;
    return {
      kind: "timeout",
      status: null,
      retryAfterSec: null,
      message: `The answer took longer than ${secs ? `${secs} seconds` : "expected"}, so it was stopped. Try again.`,
    };
  }
  return {
    kind: "network",
    status: null,
    retryAfterSec: null,
    message: "The request didn't reach the site. Check your connection and try again.",
  };
}
