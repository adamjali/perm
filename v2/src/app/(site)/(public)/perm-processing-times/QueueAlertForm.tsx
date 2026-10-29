"use client";

/**
 * Queue-reached alert signup.
 *
 * Every PERM applicant arrives at this page with the same question, "has DOL
 * got to my month yet", and DOL's own page cannot answer it because it
 * publishes only today's frontier and keeps no history. We keep the history,
 * so this turns the page from something you re-check into something that
 * tells you once and then stops.
 *
 * Two required fields, one optional. The month is required because it is the
 * only thing that decides when to write; the role is optional because it is
 * the only segmentation that would change what gets built next.
 */

import { useId, useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";

import { MONTH_NAMES } from "@convex/lib/months";
import { Button } from "@/components/ui/button";
import { SelectInput } from "@/components/forms/SelectInput";
import { Label } from "@/components/ui/label";
import { serverReply } from "@/components/alerts/alerts.messages";
import { FORMS_TEXT } from "@/components/alerts/forms.messages";
import type { Lang } from "@/lib/i18n/lang";
import { monthLabel } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";
import { isQueued } from "@/lib/alertReply";
import { AlertDone, AlertNote, EmailField, OptInBox } from "@/components/alerts/AlertParts";
import { formText } from "@/lib/forms/formText";
import { trackAlertSignup } from "@/lib/alertSignupEvent";
import { useAlertFormTelemetry } from "@/lib/funnelEvents";
import { convexSiteUrl } from "@/lib/convexSite";

/**
 * Filing months a live PERM case could plausibly carry: `newest` back to 2020.
 *
 * `newest` is passed in rather than read from `new Date()` here. The parent
 * page sets `revalidate = 21600`, so its HTML is served from cache for six hours;
 * a component that computed "this month" itself would, for up to an hour after
 * a month boundary, render a client list one option longer than the cached
 * server list and hydrate with a mismatched <select>.
 */
function filingMonthOptions(
  newest: string,
  frontier?: string,
  lang: Lang = "en",
): { value: string; label: string }[] {
  const m = /^(\d{4})-(\d{2})$/.exec(newest);
  const newestYear = m ? Number(m[1]) : 2020;
  const newestMonth = m ? Number(m[2]) - 1 : 11;

  // "YYYY-MM" sorts lexicographically, so a string compare is the month
  // compare. Absent a frontier (no readable snapshot) nothing is annotated,
  // which keeps this form working on a day DOL's page cannot be parsed.
  const reached = (value: string) => frontier !== undefined && value <= frontier;

  const options: { value: string; label: string }[] = [];
  for (let year = newestYear; year >= 2020; year--) {
    const startMonth = year === newestYear ? newestMonth : 11;
    for (let mo = startMonth; mo >= 0; mo--) {
      const value = `${year}-${String(mo + 1).padStart(2, "0")}`;
      const name = lang === "en" ? `${MONTH_NAMES[mo]} ${year}` : (monthLabel(value, lang) ?? value);
      options.push({ value, label: reached(value) ? FORMS_TEXT[lang].queue.reached(name) : name });
    }
  }
  return options;
}

export function QueueAlertForm({
  source,
  newestMonth,
  frontierMonth,
  queue = "perm",
  allowPwdChoice = false,
  defaultMonth,
  bare = false,
  lang = "en",
}: {
  /**
   * Inside a section that already names the alert: no card and no heading of
   * its own. Standing alone (the default), it's a card with its heading.
   */
  bare?: boolean;
  source: string;
  /** The filing month to start on, "YYYY-MM": a month's own page passes itself. */
  defaultMonth?: string;
  /** Newest selectable filing month, "YYYY-MM". Supplied by the server render. */
  newestMonth: string;
  /**
   * DOL's current analyst-review frontier, "YYYY-MM", when one is readable.
   *
   * Every month at or before it has already been reached, so an alert on one
   * fires the moment it is confirmed. Saying so in the option label is the
   * difference between a form whose easy default is a month DOL passed two
   * years ago and one that tells you what you are asking for. Optional because
   * this form sits outside the snapshot gate on purpose.
   */
  frontierMonth?: string;
  /**
   * Which DOL queue the alert watches. The PWD calculator passes a PWD
   * variant and sets `allowPwdChoice`; everywhere else is the PERM analyst
   * queue.
   */
  queue?: "perm" | "pwd-oews" | "pwd-nonoews";
  /**
   * Render an OEWS / non-OEWS selector. Only the PWD page wants it - the two
   * prevailing-wage queues move independently and a subscriber knows which
   * wage source their request used.
   */
  allowPwdChoice?: boolean;
  /** The page's language: the form's own words and the server's fixed replies follow it. */
  lang?: Lang;
}) {
  const t = FORMS_TEXT[lang];
  const { observe, onFocusCapture } = useAlertFormTelemetry("queue", source);
  const emailId = useId();
  const monthId = useId();
  const roleId = useId();
  const newsId = useId();
  const queueId = useId();

  const [email, setEmail] = useState("");
  const [filingMonth, setFilingMonth] = useState(defaultMonth ?? "");
  const [role, setRole] = useState("");
  const [news, setNews] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(queue);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [queued, setQueued] = useState(false);

  const options = filingMonthOptions(newestMonth, frontierMonth, lang);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    // The box itself, not only React's copy: an autofilled address can skip the
    // event React listens for (formText).
    const address = formText(event.currentTarget, "email", email).trim();
    setEmail(address);

    setStatus("sending");
    setMessage("");

    try {
      const endpoint = convexSiteUrl("/queue-alert/subscribe");
      if (!endpoint) throw new Error("Convex URL isn’t configured");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: address,
          filingMonth,
          role: role || undefined,
          source,
          queue: selectedQueue,
          news: news || undefined,
          lang: lang === "en" ? undefined : lang,
        }),
      });
      const result = (await response.json()) as { ok: boolean; message: string; queued?: boolean };
      setQueued(isQueued(result));
      setStatus(result.ok ? "done" : "error");
      setMessage(serverReply(lang, result.message));
      trackAlertSignup("queue", result.ok ? "accepted" : "refused", { source, queue: selectedQueue });
    } catch {
      trackAlertSignup("queue", "error", { source });
      setStatus("error");
      setMessage(lang === "en" ? "Something went wrong on our side. Try again in a moment." : t.failed);
    }
  }

  const frame = bare ? "" : "object p-5 sm:p-6";
  const what = selectedQueue === "perm" ? t.queue.whatPerm : t.queue.whatPwd;

  if (status === "done") {
    return (
      <div className={frame}>
        <p className="font-heading text-lg font-bold">{t.replyHeading(queued)}</p>{" "}
        <AlertDone message={message} queued={queued} className="mt-2" lang={lang} />
      </div>
    );
  }

  return (
    <form ref={observe} onFocusCapture={onFocusCapture} onSubmit={handleSubmit} className={cn(frame, "print:hidden")}>
      {bare ? null : (
        <h2 className="font-heading text-xl font-bold">{t.queue.heading}</h2>
      )}{" "}
      {/* The queue is named from the prop: on the prevailing wage pages
          "analyst review" is the wrong queue, the PERM stage. */}
      <p className={cn("max-w-2xl text-base leading-relaxed text-soft", !bare && "mt-2")}>{what}</p>{" "}

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <div>
          <Label htmlFor={emailId}>{t.email}</Label>{" "}
          <EmailField id={emailId} value={email} onChange={setEmail} invalid={status === "error"} className="mt-2" />
        </div>{" "}
        <div>
          <Label htmlFor={monthId}>{t.queue.month(selectedQueue === "perm")}</Label>{" "}
          <SelectInput
            id={monthId}
            required
            value={filingMonth}
            onChange={(e) => setFilingMonth(e.target.value)}
            placeholder={t.queue.pick}
            options={options}
            className="mt-2 h-12"
          />
        </div>
      </div>{" "}

      {allowPwdChoice ? (
        <div className="mt-4 sm:max-w-sm">
          <Label htmlFor={queueId}>{t.queue.whichQueue}</Label>{" "}
          <SelectInput
            id={queueId}
            value={selectedQueue}
            onChange={(e) => setSelectedQueue(e.target.value as "pwd-oews" | "pwd-nonoews")}
            options={[
              { value: "pwd-oews", label: t.queue.oews },
              { value: "pwd-nonoews", label: t.queue.nonOews },
            ]}
            className="mt-2"
          />
        </div>
      ) : null}{" "}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={status === "sending"} data-ph-capture-attribute-cta="queue-alert">
          {t.queue.button}
        </Button>{" "}
        {status === "error" && message ? (
          <p className="text-sm font-semibold text-data-warn-ink" role="alert">
            {message}
          </p>
        ) : (
          <AlertNote lang={lang} />
        )}
      </div>{" "}

      {/* The role is the only segmentation that would change what gets built
          next, so it's asked, but folded: it decides nothing about the email. */}
      <details className="group mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-soft hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <CaretRightIcon className="size-3.5 shrink-0 transition-transform group-open:rotate-90" weight="bold" aria-hidden="true" />{" "}
          {t.queue.more}
        </summary>{" "}
        <div className="space-y-4 pb-1 pl-5">
          <div className="sm:max-w-sm">
            <Label htmlFor={roleId}>
              {t.queue.youAre} <span className="font-normal text-muted-foreground">{t.queue.optional}</span>
            </Label>{" "}
            <SelectInput
              id={roleId}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              options={[
                { value: "", label: t.queue.roles.none },
                { value: "attorney", label: t.queue.roles.attorney },
                { value: "applicant", label: t.queue.roles.applicant },
                { value: "employer", label: t.queue.roles.employer },
              ]}
              className="mt-2"
            />
          </div>{" "}
          <OptInBox id={newsId} kind="news" checked={news} onChange={setNews} lang={lang} />{" "}
          <p className="text-sm text-muted-foreground">{t.queue.oneMonth}</p>
        </div>
      </details>
    </form>
  );
}
