"use client";

import { useId, useState } from "react";

import { cn } from "@/lib/utils";
import type { FlagProgram } from "@/lib/flagCaseNumber";
import type { Lang } from "@/lib/i18n/lang";
import { ALERT_TEXT, serverReply } from "@/components/alerts/alerts.messages";
import { isQueued } from "@/lib/alertReply";
import { AlertDone, AlertNote, EmailField, OptInFold } from "@/components/alerts/AlertParts";
import { Button } from "@/components/ui/button";
import { formText } from "@/lib/forms/formText";
import { trackAlertSignup } from "@/lib/alertSignupEvent";
import { useAlertFormTelemetry } from "@/lib/funnelEvents";
import { convexSiteUrl } from "@/lib/convexSite";

/**
 * Subscribe to status changes on ONE case.
 *
 * The endpoint and its whole contract belong to the alerts work; this is the
 * form in front of it. Two rules come from that side and are not mine to
 * soften:
 *
 * THE SERVER'S `message` IS RENDERED VERBATIM, on success and on refusal
 * alike. Every reply for an address that already exists is the same neutral
 * string on purpose, because "you're already subscribed to that case" tells
 * anyone who asks whether a given person is waiting on a given case. Writing
 * our own friendlier copy per status code would rebuild that oracle.
 *
 * IT IS DOUBLE OPT-IN, so nothing is sent until the address is confirmed, and
 * the success line says so rather than implying the alert is already armed.
 *
 * IT HAS NO BOX OF ITS OWN: WatchThisNumber places it, in an answer panel or a card.
 *
 * WHERE IT IS OFFERED is decided by the caller, and only for a case that can
 * still change. Mounting it on a decided case would promise mail that can
 * never arrive.
 *
 * THE `program` PROP CHANGES WORDING AND NOTHING ELSE. The endpoint works out
 * which program a number belongs to from the number itself, and it has to,
 * because the case-status page takes all three prefixes and a form cannot be
 * trusted to say. So this prop is presentation: it names the thing the reader
 * is looking at, and tags the source so signup mix can be read per surface.
 * Passing the wrong one produces mildly wrong copy, never a wrong
 * subscription.
 */

/** Where the signup came from, for the `source` column. Wording aside, inert. */
const SOURCE: Record<FlagProgram, string> = {
  perm: "perm-case-status",
  pwd: "pwd-status",
  lca: "lca-status",
  seasonal: "seasonal-status",
};

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string; queued: boolean }
  | { kind: "refused"; message: string };

export function CaseAlertForm({
  caseNumber,
  program = "perm",
  className,
  lang = "en",
}: {
  caseNumber: string;
  program?: FlagProgram;
  className?: string;
  /** The page's language: the form's own words and the server's fixed replies follow it. */
  lang?: Lang;
}) {
  const { observe, onFocusCapture } = useAlertFormTelemetry("case", program);
  const t = ALERT_TEXT[lang];
  const inputId = useId();
  const noteId = useId();
  const newsId = useId();
  const [email, setEmail] = useState("");
  const [news, setNews] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  const endpoint = convexSiteUrl("/case-alert/subscribe");
  if (!endpoint) return null;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "sending") return;
    // The box itself, not only React's copy: an autofilled address can skip the
    // event React listens for (formText).
    const address = formText(e.currentTarget, "email", email).trim();
    setEmail(address);
    setState({ kind: "sending" });
    try {
      const res = await fetch(endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          caseNumber,
          source: SOURCE[program],
          news: news || undefined,
          newsletter: newsletter || undefined,
          lang: lang === "en" ? undefined : lang,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      // The server's own words, whatever the code. A generic fallback only
      // for the case where there is no body to read at all.
      const message = body?.message ? serverReply(lang, body.message) : t.failed;
      setState(res.ok ? { kind: "done", message, queued: isQueued(body) } : { kind: "refused", message });
      trackAlertSignup("case", res.ok ? "accepted" : "refused", { program, status: res.status });
    } catch {
      trackAlertSignup("case", "error", { program });
      setState({
        kind: "refused",
        message: t.dropped,
      });
    }
  }

  if (state.kind === "done") {
    return <AlertDone message={state.message} queued={state.queued} className={className} lang={lang} />;
  }

  return (
    <form
      ref={observe}
      onFocusCapture={onFocusCapture}
      onSubmit={submit}
      className={cn("print:hidden", className)}
    >
      <label htmlFor={inputId} className="block text-base font-semibold text-foreground">
        {t.label(program)}
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
        <Button
          type="submit"
          size="lg"
          loading={state.kind === "sending"}
          data-ph-capture-attribute-cta="case-alert"
          className="sm:w-auto"
        >
          {t.button}
        </Button>
      </div>{" "}
      {state.kind === "refused" ? (
        <p id={noteId} role="alert" className="mt-2 text-sm font-semibold text-data-warn-ink">
          {state.message}
        </p>
      ) : (
        <AlertNote id={noteId} className="mt-2" lang={lang} />
      )}{" "}
      <OptInFold
        id={newsId}
        news={news}
        newsletter={newsletter}
        onNews={setNews}
        onNewsletter={setNewsletter}
        className="mt-1"
        lang={lang}
      />
    </form>
  );
}
