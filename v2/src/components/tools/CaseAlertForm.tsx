"use client";

import { useId, useState } from "react";
import { BellIcon, CheckCircleIcon } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { programNoun, type FlagProgram } from "@/lib/flagCaseNumber";

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
};

/**
 * Convex HTTP actions are served from the `.convex.site` twin of the
 * `.convex.cloud` deployment URL. Derived the same way the queue-alert form
 * derives it, rather than introducing a second env var for the same address.
 */
function subscribeEndpoint(): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}/case-alert/subscribe`;
}

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; message: string }
  | { kind: "refused"; message: string };

export function CaseAlertForm({
  caseNumber,
  program = "perm",
  className,
}: {
  caseNumber: string;
  program?: FlagProgram;
  className?: string;
}) {
  const noun = programNoun(program);
  const inputId = useId();
  const noteId = useId();
  const newsId = useId();
  const [email, setEmail] = useState("");
  const [news, setNews] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });

  const endpoint = subscribeEndpoint();
  if (!endpoint) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const res = await fetch(endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          caseNumber,
          source: SOURCE[program],
          news: news || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      // The server's own words, whatever the code. A generic fallback only
      // for the case where there is no body to read at all.
      const message =
        body?.message ??
        "That did not go through. Try again in a moment, or check the case on DOL's own status page.";
      setState({ kind: res.ok ? "done" : "refused", message });
    } catch {
      setState({
        kind: "refused",
        message:
          "That did not go through, which usually means the connection dropped. Try again in a moment.",
      });
    }
  }

  if (state.kind === "done") {
    return (
      <div
        className={cn(
          "border-2 border-border bg-card p-5 shadow-hard sm:p-6",
          className,
        )}
      >
        <p className="flex items-start gap-2 text-base leading-relaxed text-foreground/80">
          <CheckCircleIcon
            className="mt-1 h-5 w-5 shrink-0 text-data-good-ink"
            weight="fill"
            aria-hidden="true"
          />{" "}
          <span>
            <b className="font-bold text-foreground">{state.message}</b>{" "}
            Check your inbox to confirm. Nothing is sent until you do.
          </span>
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className={cn(
        "border-2 border-border bg-card p-5 shadow-hard sm:p-6",
        className,
      )}
    >
      <p className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        <BellIcon className="h-4 w-4" weight="fill" aria-hidden="true" />{" "}
        Watch this case
      </p>{" "}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/80">
        Get an email when DOL&apos;s status for this {noun} changes. We&apos;ll
        stop once it&apos;s decided.
      </p>
      <div className="mt-4 flex flex-wrap items-stretch gap-3">
        <label htmlFor={inputId} className="sr-only">
          Your email address
        </label>
        <input
          id={inputId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-describedby={noteId}
          className="min-h-[48px] w-full min-w-0 flex-1 basis-64 border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        />
        <button
          type="submit"
          disabled={state.kind === "sending"}
          className="min-h-[48px] shrink-0 border-2 border-border bg-foreground px-5 font-mono text-sm font-bold uppercase tracking-[0.1em] text-background shadow-hard transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          {state.kind === "sending" ? "Sending" : "Email me changes"}
        </button>
      </div>
      <div className="mt-3 flex items-start gap-2.5">
        <input
          id={newsId}
          type="checkbox"
          checked={news}
          onChange={(e) => setNews(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none border-2 border-border bg-background checked:bg-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />{" "}
        <label
          htmlFor={newsId}
          className="cursor-pointer text-sm leading-relaxed text-muted-foreground"
        >
          Also send occasional product news. The same confirmation covers it,
          and it&apos;s off by default.
        </label>
      </div>{" "}
      <p id={noteId} className="mt-2 text-sm text-muted-foreground">
        {state.kind === "refused" ? (
          <span className="font-bold text-data-warn-ink">{state.message}</span>
        ) : (
          <>
            Double opt-in, so nothing arrives until you confirm. One address can
            watch 25 cases, and we send one confirmation every 10 minutes - if
            nothing lands, wait that long before trying again.
          </>
        )}
      </p>
    </form>
  );
}
