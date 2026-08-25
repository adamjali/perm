"use client";

import { useEffect, useRef, useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference, FunctionReturnType } from "convex/server";

/**
 * `useQuery` for a page that has no ConvexProvider, and must not have one.
 *
 * `src/app/providers.tsx` mounts Convex only in the auth and authenticated
 * layouts, with the comment "Public pages skip this entirely, avoiding Convex
 * WebSocket + auth overhead." That is a deliberate decision about what a
 * visitor to a public page downloads, and a client component that calls
 * `useQuery` under it does not degrade: it throws
 * "Could not find Convex client!" and takes the page down. /perm-cases
 * shipped exactly that.
 *
 * The queries behind it are already public `query` functions, callable by
 * anyone with the deployment URL, so reaching them over HTTP adds no exposure
 * and no socket. It costs the live subscription, which is the right trade
 * here: the disclosure files change once a quarter.
 *
 * The contract deliberately matches `useQuery`, so a component can move
 * between them without changing a line of its rendering:
 *   - `undefined` while in flight (and callers render a loading state)
 *   - `"skip"` as args means do not fetch at all
 *   - the newest request wins; a slow earlier one cannot overwrite it
 */
export function useConvexHttpQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args: Q["_args"] | "skip",
): FunctionReturnType<Q> | undefined {
  const [data, setData] = useState<FunctionReturnType<Q> | undefined>(undefined);
  // A monotonic id rather than a cleanup flag: with several requests in
  // flight, only the LATEST may write. A per-effect boolean lets an earlier
  // slow response win whenever it lands after a later fast one.
  const latest = useRef(0);
  const key = args === "skip" ? "skip" : JSON.stringify(args);

  useEffect(() => {
    if (args === "skip") {
      setData(undefined);
      return;
    }
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) return;
    const id = ++latest.current;
    setData(undefined);
    new ConvexHttpClient(url)
      .query(query, args)
      .then((result) => {
        if (latest.current === id) setData(result as FunctionReturnType<Q>);
      })
      .catch(() => {
        // Leave it undefined so the caller keeps rendering its loading or
        // empty state rather than a half-populated table.
        if (latest.current === id) setData(undefined);
      });
    // `key` is the serialised args; `query` is a stable module-level ref.
  }, [key, query, args]);

  return data;
}
