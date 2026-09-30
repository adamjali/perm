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
 *
 * AND `previous` (Sep 30 2026): the last answer that came back, for any url.
 * `data` still goes undefined the moment the url changes, so a table built on
 * it collapsed to a one-line "Loading…" on every filter or page change and
 * grew back when the answer landed. A caller that renders `data ?? previous`
 * keeps the old rows on screen (dimmed, marked busy) until the new ones land.
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
  /** The most recent successful answer, for this url or an earlier one. */
  previous: T | undefined;
}

type State<T> = Pick<PublicQueryResult<T>, "data" | "failed" | "failure" | "previous">;

export function usePublicQuery<T>(
  url: string | "skip",
  options?: { timeoutMs?: number },
): PublicQueryResult<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const [state, setState] = useState<State<T>>({
    data: undefined,
    failed: false,
    failure: null,
    previous: undefined,
  });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  // A monotonic id rather than a cleanup flag: with several requests in
  // flight, only the LATEST may write. A per-effect boolean lets an earlier
  // slow response win whenever it lands after a later fast one.
  const latest = useRef(0);

  useEffect(() => {
    if (url === "skip") {
      setState((s) => ({ data: undefined, failed: false, failure: null, previous: s.previous }));
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
    setState((s) => ({ data: undefined, failed: false, failure: null, previous: s.previous }));
    fetch(url, { signal })
      .then(async (r) => {
        if (!r.ok) throw new FetchFailureError(await failureFromResponse(r));
        return r.json() as Promise<T>;
      })
      .then((data) => {
        if (latest.current === id) setState({ data, failed: false, failure: null, previous: data });
      })
      .catch((error: unknown) => {
        // A supersede/unmount abort is not a failure: reporting it would flash
        // an error on every keystroke. A TimeoutError IS a failure - the
        // request never came back. Everything else (HTTP status, JSON, network)
        // is a failure too.
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (latest.current === id) {
          setState((s) => ({
            data: undefined,
            failed: true,
            failure: failureFromError(error, timeoutMs),
            previous: s.previous,
          }));
        }
      });
    return () => controller.abort();
  }, [url, timeoutMs, attempt]);

  return { ...state, retry };
}
