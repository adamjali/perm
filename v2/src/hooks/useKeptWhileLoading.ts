"use client";

import { useState } from "react";

/**
 * A Convex query's last answer, kept while the next one loads.
 *
 * `useQuery` answers `undefined` whenever its arguments change, so a page that shows its skeleton on
 * `undefined` dropped back to a whole loading screen when someone ticked "show closed" on the calendar or
 * picked another range on the timeline (owner, Nov 2 2026: nothing loading may look like a page starting
 * over). This keeps the previous answer on screen and says it's refreshing, so the page can dim it.
 *
 * `null` (signed out, no access) is an answer and is kept like any other. The first load is still
 * `undefined`, so a page's own loading state shows then.
 */
export function useKeptWhileLoading<T>(value: T | undefined): { value: T | undefined; refreshing: boolean } {
  const [kept, setKept] = useState<T | undefined>(value);
  // Set during render, React's pattern for state derived from a changing input: useQuery returns the same
  // object until a new answer arrives, so this settles after one extra render.
  if (value !== undefined && value !== kept) setKept(value);
  return { value: value === undefined ? kept : value, refreshing: value === undefined && kept !== undefined };
}
