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
 * AND A TIMEOUT. A `fetch` against a stalled connection or a slow database
 * query neither resolves nor rejects, so without a deadline `data` stays
 * `undefined` forever and the caller shows "Checking..." with no end.
 * A timer aborts the request and marks it timed out, so the deadline sets
 * `failed` (as a `TimeoutError`) without a supersede or unmount ever reading
 * as a failure.
 *
 * AND THE REASON. `failed` alone lets every caller print one generic line,
 * "reloading usually clears it", including for the front door's own 429 -
 * where a reload is one more request against the same limit.
 * `failure` carries the server's own sentence and the wait, and `retry` asks
 * again without a reload.
 *
 * AND `previous`: the last answer that came back, for any url. `data` still
 * goes undefined the moment the url changes, so a table built on it alone
 * collapses to a one-line "Loading…" on every filter or page change and
 * grows back when the answer lands. A caller that renders `data ?? previous`
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
    // One controller aborts on WHICHEVER comes first: a newer url superseding
    // this one, the component unmounting, or the deadline. The flag, not the
    // abort reason, tells a timeout (a real failure to report) from a
    // supersede (ignore), because older browsers reject an aborted fetch with
    // a plain AbortError whatever reason was given. No AbortSignal.any or
    // AbortSignal.timeout: Chrome 109, the last release for Windows 7 and 8.1,
    // has neither, and the search pages crashed there (Oct 3 2026).
    let timedOut = false;
    const deadline = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    setState((s) => ({ data: undefined, failed: false, failure: null, previous: s.previous }));
    fetch(url, { signal: controller.signal })
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
        const reason = timedOut ? new DOMException("The request timed out.", "TimeoutError") : error;
        if (!timedOut && error instanceof DOMException && error.name === "AbortError") return;
        if (latest.current === id) {
          setState((s) => ({
            data: undefined,
            failed: true,
            failure: failureFromError(reason, timeoutMs),
            previous: s.previous,
          }));
        }
      })
      .finally(() => clearTimeout(deadline));
    return () => {
      clearTimeout(deadline);
      controller.abort();
    };
  }, [url, timeoutMs, attempt]);

  return { ...state, retry };
}
