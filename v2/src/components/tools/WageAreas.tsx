"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AreaOption } from "@/lib/wageLevels";

/**
 * DOL's wage areas for one state and series, read through /api/wage-areas, for
 * the wage-level tool and the lottery calculator.
 *
 * A failed read is said, never shown as an empty list: on Oct 29 2026 (7:34 to
 * 7:49 PM EDT) DOL's area list answered 503 while FLAG was down, and both tools
 * read the failure as "DOL lists no areas". `failure` carries the route's own
 * reason, and `retry` asks again. `onLoaded` hears each list as it arrives (an
 * empty one on a failure), so a tool can pick its first area.
 */
export function useWageAreas(stateName: string, seriesYear: number, onLoaded?: (list: AreaOption[]) => void) {
  const [areas, setAreas] = useState<AreaOption[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // The newest callback, without asking DOL again when a caller's callback changes.
  const loaded = useRef(onLoaded);
  useEffect(() => {
    loaded.current = onLoaded;
  });

  useEffect(() => {
    if (!stateName) {
      setAreas(null);
      setFailure(null);
      loaded.current?.([]);
      return;
    }
    let live = true;
    setAreas(null);
    setFailure(null);
    fetch(`/api/wage-areas?state=${encodeURIComponent(stateName.toUpperCase())}&year=${seriesYear}`)
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as { areas?: AreaOption[]; message?: string } | null;
        if (!live) return;
        if (!r.ok || !body || !Array.isArray(body.areas)) {
          setFailure(body?.message || `The area list didn't load (HTTP ${r.status}).`);
          setAreas([]);
          loaded.current?.([]);
          return;
        }
        setAreas(body.areas);
        loaded.current?.(body.areas);
      })
      .catch(() => {
        if (!live) return;
        setFailure("The area list didn't load: the connection dropped.");
        setAreas([]);
        loaded.current?.([]);
      });
    return () => {
      live = false;
    };
  }, [stateName, seriesYear, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { areas, failure, retry };
}

/**
 * What to put in the area picker for the state of the read: one line, never "DOL lists no areas" for a list that
 * didn't load.
 */
export function areaPlaceholder(stateName: string, areas: AreaOption[] | null, failure: string | null): string | null {
  if (!stateName) return "Choose a state first";
  if (areas === null) return "Loading DOL's areas";
  if (failure) return "DOL's areas didn't load";
  return areas.length === 0 ? "DOL lists no areas" : null;
}

/** Why the area list didn't load, said under the picker, with a way to ask again. */
export function AreaLoadFailure({ failure, retry }: { failure: string | null; retry: () => void }) {
  if (!failure) return null;
  return (
    <p role="status" className="mt-2 text-sm">
      {failure}{" "}
      <button type="button" onClick={retry} className="link inline-flex min-h-11 items-center font-bold">
        Try again
      </button>
    </p>
  );
}
