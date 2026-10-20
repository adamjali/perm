"use client";

import { useMemo, useSyncExternalStore } from "react";

import { CARRIED_EVENT, decodeCarried, encodeCarried, readCarried, type CarriedDates } from "@/lib/carriedCase";

function subscribe(onChange: () => void) {
  window.addEventListener(CARRIED_EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(CARRIED_EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/** The encoded form is the snapshot: a string compares equal between reads, an object wouldn't. */
function snapshot(): string {
  const d = readCarried();
  return d ? encodeCarried(d) : "";
}

/**
 * The deadline calculator's dates this visitor brought into the app, or null
 * (src/lib/carriedCase.ts). Null on the server and in the first client render,
 * so a page hydrates the same either way and picks the dates up straight after.
 */
export function useCarriedDates(): { dates: CarriedDates | null; key: string } {
  const key = useSyncExternalStore(subscribe, snapshot, () => "");
  const dates = useMemo(() => decodeCarried(key), [key]);
  return { dates, key };
}
