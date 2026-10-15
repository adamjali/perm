"use client";

import { useSyncExternalStore } from "react";

import { Switch } from "@/components/ui/switch";
import { analytics, isAnalyticsOff, isGpcEnabled } from "@/lib/analytics";

/**
 * Usage analytics on or off, for anyone, from the footer of every page.
 *
 * It sets the same browser flag the signed-in switch in Settings sets
 * (`analytics.optOut()`), so off means this browser sends our analytics
 * service nothing at all. A browser sending Global Privacy Control already
 * sends nothing, and the switch says so instead of pretending to work.
 */
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
/** The server can't know, so it draws the switch on (the default). */
const offOnServer = () => false;

export function AnalyticsSwitch() {
  const off = useSyncExternalStore(subscribe, isAnalyticsOff, offOnServer);
  const gpc = useSyncExternalStore(subscribe, isGpcEnabled, offOnServer);

  const set = (on: boolean) => {
    if (on) analytics.optIn();
    else analytics.optOut();
    listeners.forEach((fn) => fn());
  };

  return (
    <div className="flex min-h-11 items-center gap-3 text-sm">
      <Switch
        id="footer-analytics"
        checked={!off && !gpc}
        onCheckedChange={set}
        disabled={gpc}
        aria-describedby="footer-analytics-note"
      />{" "}
      <label htmlFor="footer-analytics" className="text-soft">
        Usage analytics
      </label>{" "}
      <span id="footer-analytics-note" className="sr-only">
        {gpc
          ? "Your browser sends Global Privacy Control, so it already sends no analytics."
          : "Off means this browser sends our analytics service nothing."}
      </span>
    </div>
  );
}
