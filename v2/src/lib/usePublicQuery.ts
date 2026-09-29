"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { failureFromError, failureFromResponse, FetchFailureError, type FetchFailure } from "@/lib/fetchFailure";

/**
 * `useQuery` for a public page, over a JSON route.
 *
 * `src/app/providers.tsx` mounts Convex only in the auth and authenticated
 * layouts, with the comment "Public pages skip this entirely, avoiding Convex
 * WebSocket + auth overhead." That is a deliberate decision about what a
 * visitor to a public page downloads, and it is still true now the data lives
 * in Turso: `src/lib/turso/client.ts` is `server-only`, so a client component
 * cannot read it at all and has to go through a route.
 *
 * The contract deliberately matches `useQuery`, so a component can move
 * between them without changing how it renders:
 *   - `data` is `undefined` while in flight
 *   - `"skip"` as the url means do not fetch at all
 *   - the newest request wins; a slow earlier one cannot overwrite it
 *
 * WITH TWO ADDITIONS, AND THEY ARE THE POINT. The earlier Convex-based hook
 * this replaced swallowed a failed fetch and left `data` undefined, so an
 * outage rendered as a loading state that never resolved - the same class of
 * bug as a `.catch(() => [])` that renders an empty table, and just as
 * invisible to a status check. `failed` says so, and the caller renders it.
 *
 * AND A TIMEOUT. A `fetch` against a stalled connection or a slow Turso query
 * neither resolves nor rejects, so without a deadline `data` stays `undefined`
 * forever and the caller shows "Checking..." with no end - the reported bug.
 * `AbortSignal.timeout` fires a `TimeoutError` (distinct from the `AbortError`
 * a supersede/unmount raises), so the deadline can set `failed` without the
 * supersede path ever reading as a failure.
 *
 * AND THE REASON (Sep 29 2026). `failed` alone let every caller print one
 * generic line, "reloading usually clears it", including for the front door's
 * own 429 - where a reload is one more request against the same limit.
 * `failure` carries the server's own sentence and the wait, and `retry` asks
 * again without a reload.
 */

/** Deadline for one request. Hot-path Turso reads are &lt;550ms; live case
 *  discovery is ~3.5s. 15s catches a true hang without tripping on a slow-but-
 *  working request. Injectable so a test can drive it with real timers. */
const DEFAULT_TIMEOUT_MS = 15_000;

export interface PublicQueryResult<T> {
  /** `undefined` while in flight, and after a failure. */
  data: T | undefined;
  /** True when the most recent request for this url did not return data. */
  failed: boolean;
  /** Why it failed, as a sentence to show. Null unless `failed`. */
  failure: FetchFailure | null;
  /** Ask again for the same url. */
  retry: () => void;
}

type State<T> = Pick<PublicQueryResult<T>, "data" | "failed" | "failure">;

export function usePublicQuery<T>(
  url: string | "skip",
  options?: { timeoutMs?: number },
): PublicQueryResult<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const [state, setState] = useState<State<T>>({
    data: undefined,
    failed: false,
    failure: null,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // A monotonic id rather than a cleanup flag: with several requests in
  // flight, only the LATEST may write. A per-effect boolean lets an earlier
  // slow response win whenever it lands after a later fast one.
  const latest = useRef(0);

  useEffect(() => {
    if (url === "skip") {
      setState({ data: undefined, failed: false, failure: null });
      return;
    }
    const id = ++latest.current;
    const controller = new AbortController();
    // The request aborts on WHICHEVER fires first: our controller (a newer
    // url superseded this one, or the component unmounted) or the deadline.
    // The two abort with different reasons, which is how the catch tells a
    // supersede (ignore) from a timeout (a real failure to report).
    const signal = AbortSignal.any([
      controller.signal,
      AbortSignal.timeout(timeoutMs),
    ]);
    setState({ data: undefined, failed: false, failure: null });
    fetch(url, { signal })
      .then(async (r) => {
        if (!r.ok) throw new FetchFailureError(await failureFromResponse(r));
        return r.json() as Promise<T>;
      })
      .then((data) => {
        if (latest.current === id) setState({ data, failed: false, failure: null });
      })
      .catch((error: unknown) => {
        // A supersede/unmount abort is not a failure: reporting it would flash
        // an error on every keystroke. A TimeoutError IS a failure - the
        // request never came back. Everything else (HTTP status, JSON, network)
        // is a failure too.
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (latest.current === id) {
          setState({ data: undefined, failed: true, failure: failureFromError(error, timeoutMs) });
        }
      });
    return () => controller.abort();
  }, [url, timeoutMs, attempt]);

  return { ...state, retry };
}
