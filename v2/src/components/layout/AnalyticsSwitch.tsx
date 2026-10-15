"use client";

import { useSyncExternalStore } from "react";

import { Switch } from "@/components/ui/switch";
import { analytics, isAccountAnalyticsOff, isAnalyticsOff, isGpcEnabled } from "@/lib/analytics";

/**
 * Usage analytics on or off, for anyone, from the footer of every page.
 *
 * Off means this browser sends our analytics service nothing at all, signed in
 * or not. It's the visitor's own flag (`analytics.visitorOptOut()`), kept apart
 * from the account's, so signing in never turns it back on. When the account
 * signed in here has analytics off, or the browser sends Global Privacy
 * Control, the switch shows off and says why instead of pretending to work.
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
  const byAccount = useSyncExternalStore(subscribe, isAccountAnalyticsOff, offOnServer);
  const locked = gpc || byAccount;

  const set = (on: boolean) => {
    if (on) analytics.visitorOptIn();
    else analytics.visitorOptOut();
    listeners.forEach((fn) => fn());
  };

  return (
    <div className="flex min-h-11 items-center gap-3 text-sm">
      <Switch
        id="footer-analytics"
        checked={!off && !gpc}
        onCheckedChange={set}
        disabled={locked}
        aria-describedby="footer-analytics-note"
      />{" "}
      <label htmlFor="footer-analytics" className="text-soft">
        Usage analytics
      </label>{" "}
      <span id="footer-analytics-note" className="sr-only">
        {gpc
          ? "Your browser sends Global Privacy Control, so it already sends no analytics."
          : byAccount
            ? "Off for your account. Turn it back on in Settings, under Support."
            : "Off means this browser sends our analytics service nothing."}
      </span>
    </div>
  );
}
