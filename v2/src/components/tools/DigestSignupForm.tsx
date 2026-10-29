"use client";

import { useId, useState } from "react";

import { AlertDone, AlertNote, EmailField } from "@/components/alerts/AlertParts";
import { ALERT_TEXT, serverReply } from "@/components/alerts/alerts.messages";
import { Button } from "@/components/ui/button";
import { isQueued } from "@/lib/alertReply";
import { trackAlertSignup } from "@/lib/alertSignupEvent";
import { convexSiteUrl } from "@/lib/convexSite";
import { formText } from "@/lib/forms/formText";
import type { Lang } from "@/lib/i18n/lang";
import { cn } from "@/lib/utils";

/**
 * The weekly digest on its own, with no alert attached (convex/digestSignup.ts). Double opt-in like every alert:
 * the server's reply is the same sentence for every address and is shown as it comes (in the reader's language
 * when it's one of the fixed sentences).
 */
type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string; queued: boolean }
  | { kind: "refused"; message: string };

export function DigestSignupForm({ source = "alerts-page", lang = "en", className }: { source?: string; lang?: Lang; className?: string }) {
  const t = ALERT_TEXT[lang];
  const inputId = useId();
  const noteId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const endpoint = convexSiteUrl("/digest/subscribe");
  if (!endpoint) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending") return;
    const address = formText(e.currentTarget, "email", email).trim();
    setEmail(address);
    setState({ kind: "sending" });
    try {
      const res = await fetch(endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, source, lang: lang === "en" ? undefined : lang }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      const message = body?.message ? serverReply(lang, body.message) : t.failed;
      setState(res.ok ? { kind: "done", message, queued: isQueued(body) } : { kind: "refused", message });
      trackAlertSignup("digest", res.ok ? "accepted" : "refused", { source, status: res.status });
    } catch {
      trackAlertSignup("digest", "error", { source });
      setState({ kind: "refused", message: t.dropped });
    }
  }

  if (state.kind === "done") return <AlertDone message={state.message} queued={state.queued} className={className} lang={lang} />;

  return (
    <form onSubmit={submit} className={cn("print:hidden", className)}>
      <label htmlFor={inputId} className="block text-base font-semibold text-foreground">
        {t.digest.label}
      </label>{" "}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <EmailField
          id={inputId}
          value={email}
          onChange={setEmail}
          describedBy={noteId}
          invalid={state.kind === "refused"}
          className="sm:flex-1"
        />{" "}
        <Button type="submit" size="lg" loading={state.kind === "sending"} data-ph-capture-attribute-cta="digest-signup" className="sm:w-auto">
          {t.digest.button}
        </Button>
      </div>{" "}
      {state.kind === "refused" ? (
        <p id={noteId} role="alert" className="mt-2 text-sm font-semibold text-data-warn-ink">
          {state.message}
        </p>
      ) : (
        <AlertNote id={noteId} className="mt-2" lang={lang} />
      )}
    </form>
  );
}
