"use client";

import { useEffect, useState } from "react";
import { CaretRightIcon, WarningIcon } from "@phosphor-icons/react";

import { isPushSupported, subscribeToPush } from "@/lib/pushSubscription";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { convexSiteUrl } from "@/lib/convexSite";

/**
 * A browser notification with no account and no email: a DOL case's status (CasePushAlert) or a new visa
 * bulletin for one line (BulletinPushAlert). The subscription object the browser hands back is the only thing
 * stored; it identifies a browser, not a person, and it can be revoked here or in the browser's own settings
 * at any time. One component, so the two can't drift.
 *
 * Rendered only where it can work: the push API exists, and the VAPID public key was built in. iOS needs the
 * site installed to the home screen first, and the message says so rather than failing quietly.
 */

const STORAGE_KEY = "pt-push-endpoint";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "on"; message: string }
  | { kind: "off"; message: string }
  | { kind: "refused"; message: string };

export interface BrowserPushAlertProps {
  /** The Convex routes, e.g. "/case-alert/push" and "/case-alert/push/stop". */
  subscribePath: `/${string}`;
  stopPath: `/${string}`;
  /** What the subscribe POST carries beside the subscription. */
  fields: Record<string, string>;
  /** The folded line, and the explanation it opens to. */
  summary: string;
  explanation: string;
  /** Said once it's on, when the server gives no message. */
  onMessage: string;
  className?: string;
}

export function BrowserPushAlert({ subscribePath, stopPath, fields, summary, explanation, onMessage, className }: BrowserPushAlertProps) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [stored, setStored] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });
  // An iPhone or iPad delivers a site's notifications only once the site is on the home screen (iOS 16.4 on),
  // and in Safari the push API isn't there until then, so this box would hide itself. It says how instead.
  const [needsHomeScreen, setNeedsHomeScreen] = useState(false);

  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const installed = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
    setNeedsHomeScreen(ios && !installed);
    setSupported((isPushSupported() || (ios && !installed)) && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY));
    try {
      setStored(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      setStored(null);
    }
  }, []);

  const subscribeUrl = convexSiteUrl(subscribePath);
  const stopUrl = convexSiteUrl(stopPath);
  if (!subscribeUrl || !stopUrl || supported === false) return null;

  async function turnOn() {
    if (state.kind === "working") return;
    setState({ kind: "working" });
    try {
      // A browser whose service worker never activates would otherwise leave
      // the button on "asking" forever; fifteen seconds is generous for a
      // permission prompt plus a subscribe call.
      const subscription = await Promise.race([
        subscribeToPush(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), 15_000)),
      ]);
      const res = await fetch(subscribeUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fields, subscription }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (res.ok) {
        try {
          const ep = (JSON.parse(subscription) as { endpoint?: string }).endpoint ?? null;
          if (ep) window.localStorage.setItem(STORAGE_KEY, ep);
          setStored(ep);
        } catch {
          // Storage unavailable: the subscription still works, only the "stop" shortcut is lost.
        }
        setState({ kind: "on", message: body?.message ?? onMessage });
      } else {
        setState({ kind: "refused", message: body?.message ?? "That didn't go through. Try again in a moment." });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setState({
        kind: "refused",
        message: /denied/i.test(m)
          ? "Notifications are blocked for this site in the browser's settings."
          : /not supported/i.test(m)
            ? "This browser cannot receive notifications. On an iPhone, add the site to the home screen first."
            : /timed out/i.test(m)
              ? "The browser didn't answer. Reload the page and try once more."
              : "That didn't go through. Try again in a moment.",
      });
    }
  }

  async function turnOff() {
    if (state.kind === "working" || !stored) return;
    setState({ kind: "working" });
    try {
      const res = await fetch(stopUrl!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: stored }),
      });
      if (res.ok) {
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch {
          // Nothing to do: the server side is what matters.
        }
        setStored(null);
        setState({ kind: "off", message: "This browser will not be notified any more." });
      } else {
        setState({ kind: "refused", message: "That didn't go through. Try again in a moment." });
      }
    } catch {
      setState({ kind: "refused", message: "That didn't go through, which usually means the connection dropped." });
    }
  }

  // Folded under the email box: one line until asked for, then the
  // explanation and the button open in place.
  return (
    <details className={cn("group print:hidden", className)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <CaretRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" weight="bold" aria-hidden="true" />{" "}
        {summary}
      </summary>{" "}
      <div className="pb-1 pl-5">
        <p className="max-w-2xl text-sm leading-relaxed text-soft">{explanation}</p>{" "}
        {needsHomeScreen ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed">
            On an iPhone or iPad, add PERM Tracker to your home screen first: tap Share, then Add to Home Screen.
            Open it from there, come back to this page and turn notifications on.
          </p>
        ) : null}{" "}
        {state.kind === "on" || state.kind === "off" ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-soft">
            {state.message}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={turnOn} loading={state.kind === "working"}>
              Notify this browser
            </Button>{" "}
            {stored ? (
              <Button type="button" variant="link" onClick={turnOff} disabled={state.kind === "working"}>
                Stop notifying this browser
              </Button>
            ) : null}{" "}
            {state.kind === "refused" ? (
              <p role="alert" className="flex items-start gap-2 text-sm">
                <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0 text-data-warn-ink" aria-hidden="true" />{" "}
                {state.message}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </details>
  );
}
