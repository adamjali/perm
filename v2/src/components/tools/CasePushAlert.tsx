"use client";

import { useEffect, useState } from "react";
import { BellIcon, WarningIcon } from "@phosphor-icons/react";

import { isPushSupported, subscribeToPush } from "@/lib/pushSubscription";
import { cn } from "@/lib/utils";

/**
 * A browser notification when DOL's status changes, with no account and no
 * email. The subscription object the browser hands back is the only thing
 * stored; it identifies a browser, not a person, and it can be revoked here
 * or in the browser's own settings at any time.
 *
 * Rendered only where it can work: the push API exists, and the VAPID public
 * key was built in. iOS needs the site installed to the home screen first,
 * and the message says so rather than failing quietly.
 */

const STORAGE_KEY = "pt-push-endpoint";

/** Convex HTTP actions live on the `.convex.site` twin of the cloud URL. */
function endpoint(path: string): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}${path}`;
}

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "on"; message: string }
  | { kind: "off"; message: string }
  | { kind: "refused"; message: string };

export function CasePushAlert({ caseNumber, className }: { caseNumber: string; className?: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [stored, setStored] = useState<string | null>(null);
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    setSupported(isPushSupported() && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY));
    try {
      setStored(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      setStored(null);
    }
  }, []);

  const subscribeUrl = endpoint("/case-alert/push");
  const stopUrl = endpoint("/case-alert/push/stop");
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
        body: JSON.stringify({ caseNumber, subscription }),
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
        setState({ kind: "on", message: body?.message ?? "This browser will be notified when DOL's status changes." });
      } else {
        setState({ kind: "refused", message: body?.message ?? "That did not go through. Try again in a moment." });
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
              ? "The browser did not answer. Reload the page and try once more."
              : "That did not go through. Try again in a moment.",
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
        setState({ kind: "refused", message: "That did not go through. Try again in a moment." });
      }
    } catch {
      setState({ kind: "refused", message: "That did not go through, which usually means the connection dropped." });
    }
  }

  return (
    <div className={cn("border-2 border-border bg-card p-5 shadow-hard sm:p-6", className)}>
      <h3 className="flex items-center gap-2 font-heading text-base font-black">
        <BellIcon size={18} weight="bold" aria-hidden="true" /> Or a notification in this browser
      </h3>{" "}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/70">
        No email and no account: the browser hands this site a delivery address that identifies the browser, not
        you, and the daily sweep sends one notification when DOL&apos;s status for this case changes. Turn it off
        here or in the browser&apos;s settings.
      </p>{" "}
      {state.kind === "on" || state.kind === "off" ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground/80">{state.message}</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={turnOn}
            disabled={state.kind === "working"}
            className="min-h-11 border-2 border-border bg-background px-5 font-bold shadow-hard transition-transform hover:-translate-y-[1px] disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {state.kind === "working" ? "Asking the browser" : "Notify this browser"}
          </button>{" "}
          {stored ? (
            <button
              type="button"
              onClick={turnOff}
              disabled={state.kind === "working"}
              className="min-h-11 px-3 text-sm font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary disabled:opacity-60"
            >
              Stop notifying this browser
            </button>
          ) : null}{" "}
          {state.kind === "refused" ? (
            <p className="flex items-start gap-2 text-sm">
              <WarningIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" /> {state.message}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
