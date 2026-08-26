"use client";

import { useEffect, useRef, useState } from "react";

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
 * WITH ONE ADDITION, AND IT IS THE POINT. `useConvexHttpQuery` swallowed a
 * failed fetch and left `data` undefined, so an outage rendered as a loading
 * state that never resolved - the same class of bug as a `.catch(() => [])`
 * that renders an empty table, and just as invisible to a status check.
 * `failed` says so, and the caller is expected to render it.
 */
export interface PublicQueryResult<T> {
  /** `undefined` while in flight, and after a failure. */
  data: T | undefined;
  /** True when the most recent request for this url did not return data. */
  failed: boolean;
}

export function usePublicQuery<T>(url: string | "skip"): PublicQueryResult<T> {
  const [state, setState] = useState<PublicQueryResult<T>>({
    data: undefined,
    failed: false,
  });
  // A monotonic id rather than a cleanup flag: with several requests in
  // flight, only the LATEST may write. A per-effect boolean lets an earlier
  // slow response win whenever it lands after a later fast one.
  const latest = useRef(0);

  useEffect(() => {
    if (url === "skip") {
      setState({ data: undefined, failed: false });
      return;
    }
    const id = ++latest.current;
    const controller = new AbortController();
    setState({ data: undefined, failed: false });
    fetch(url, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .then((data) => {
        if (latest.current === id) setState({ data, failed: false });
      })
      .catch((error: unknown) => {
        // An abort is this effect being superseded or unmounted, not a
        // failure: reporting it would flash an error banner on every keystroke.
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (latest.current === id) setState({ data: undefined, failed: true });
      });
    return () => controller.abort();
  }, [url]);

  return state;
}
