"use client";

import { BrowserPushAlert } from "./BrowserPushAlert";

/** A browser notification when DOL's status for a case changes (convex/casePushAlerts.ts). */
export function CasePushAlert({ caseNumber, className }: { caseNumber: string; className?: string }) {
  return (
    <BrowserPushAlert
      subscribePath="/case-alert/push"
      stopPath="/case-alert/push/stop"
      fields={{ caseNumber }}
      summary="Or a browser notification"
      explanation="No email and no account. The browser gives this site an address for itself, not for you, and one notification goes out minutes after the status changes. Turn it off here or in the browser's settings."
      onMessage="This browser will be notified when DOL's status changes."
      className={className}
    />
  );
}
