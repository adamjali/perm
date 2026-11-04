"use client";

import { BrowserPushAlert } from "./BrowserPushAlert";

/**
 * A browser notification when a new visa bulletin is out, saying what it did to this line
 * (convex/bulletinPushAlerts.ts). `category` and `country` are the archive's keys ("EB2", "india").
 */
export function BulletinPushAlert({ category, country, className }: { category: string; country: string; className?: string }) {
  return (
    <BrowserPushAlert
      subscribePath="/bulletin-alert/push"
      stopPath="/bulletin-alert/push/stop"
      fields={{ category, country }}
      summary="Or a browser notification each new bulletin"
      explanation="No email and no account. When the next visa bulletin is out, this browser gets one notification saying where this line's cutoff moved, or that it held. Turn it off here or in the browser's settings."
      onMessage="This browser will be notified when the next visa bulletin is out."
      className={className}
    />
  );
}
