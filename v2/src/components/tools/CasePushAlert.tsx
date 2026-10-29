"use client";

import { useEffect, useState } from "react";
import { CaretRightIcon, WarningIcon } from "@phosphor-icons/react";

import { isPushSupported, subscribeToPush } from "@/lib/pushSubscription";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { convexSiteUrl } from "@/lib/convexSite";
import type { Lang } from "@/lib/i18n/lang";
import { ALERT_TEXT, serverReply } from "@/components/alerts/alerts.messages";

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

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "on"; message: string }
  | { kind: "off"; message: string }
  | { kind: "refused"; message: string };

export function CasePushAlert({ caseNumber, className, lang = "en" }: { caseNumber: string; className?: string; lang?: Lang }) {
  const t = ALERT_TEXT[lang].push;
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

  const subscribeUrl = convexSiteUrl("/case-alert/push");
  const stopUrl = convexSiteUrl("/case-alert/push/stop");
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
        // Our own words on success: the server's are English, and say the same thing.
        setState({ kind: "on", message: lang === "en" ? (body?.message ?? t.on) : t.on });
      } else {
        setState({ kind: "refused", message: body?.message ? serverReply(lang, body.message) : t.failed });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : "";
      setState({
        kind: "refused",
        message: /denied/i.test(m)
          ? t.blocked
          : /not supported/i.test(m)
            ? t.unsupported
            : /timed out/i.test(m)
              ? t.noAnswer
              : t.failed,
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
        setState({ kind: "off", message: t.off });
      } else {
        setState({ kind: "refused", message: t.failed });
      }
    } catch {
      setState({ kind: "refused", message: t.dropped });
    }
  }

  // Folded under the email box: one line until asked for, then the
  // explanation and the button open in place.
  return (
    <details className={cn("group print:hidden", className)}>
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <CaretRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" weight="bold" aria-hidden="true" />{" "}
        {t.summary}
      </summary>{" "}
      <div className="pb-1 pl-5">
        <p className="max-w-2xl text-sm leading-relaxed text-soft">
          {t.explain}
        </p>{" "}
        {state.kind === "on" || state.kind === "off" ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-soft">
            {state.message}
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={turnOn} loading={state.kind === "working"}>
              {t.turnOn}
            </Button>{" "}
            {stored ? (
              <Button type="button" variant="link" onClick={turnOff} disabled={state.kind === "working"}>
                {t.turnOff}
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
