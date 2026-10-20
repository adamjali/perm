"use client";

import { useSyncExternalStore } from "react";

import { WarningIcon } from "@phosphor-icons/react";

import { storageBlocked } from "@/lib/storageGuard";

const noop = () => () => {};

/**
 * Says why signing in can't work in a browser that blocks this site's cookies
 * and data (src/lib/storageGuard.ts). Nothing on the server or in a browser
 * that allows them, so the page hydrates the same either way.
 */
export function StorageBlockedNotice() {
  const show = useSyncExternalStore(noop, () => storageBlocked(), () => false);
  if (!show) return null;
  return (
    <div
      role="status"
      className="flex items-start gap-2 border-2 border-data-warn/50 bg-data-warn/15 px-3 py-2.5 text-sm text-data-warn-ink"
    >
      <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        This browser is blocking cookies and site data for permtracker.app, and signing in needs them. Allow them for
        this site in your browser&rsquo;s settings, then reload this page.
      </span>
    </div>
  );
}
