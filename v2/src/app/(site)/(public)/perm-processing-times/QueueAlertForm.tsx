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
import { BellIcon, CheckCircleIcon as CheckCircle2 } from "@phosphor-icons/react";

import { MONTH_NAMES } from "@/lib/dolFormat";
import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";

/**
 * Convex HTTP actions are served from the `.convex.site` twin of the
 * `.convex.cloud` deployment URL. Posting to an endpoint keeps this page free
 * of the Convex React client: the public layout mounts no ConvexProvider, so
 * marketing pages never open a websocket or ship that bundle.
 */
function subscribeEndpoint(): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}/queue-alert/subscribe`;
}

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
      options.push({
        value,
        label: reached(value)
          ? `${MONTH_NAMES[mo]} ${year} (already reached)`
          : `${MONTH_NAMES[mo]} ${year}`,
      });
    }
  }
  return options;
}

/** Native select styled to match the Input component (no Select primitive exists here). */
const selectClasses = cn(
  "border-input h-11 w-full min-w-0 border-2 bg-background px-3 py-1 text-base",
  "shadow-hard-sm transition-all duration-150 outline-none md:text-sm",
  "hover:shadow-hard hover:-translate-y-[1px] active:translate-y-0 active:shadow-hard-sm",
  "focus:shadow-hard focus:ring-2 focus:ring-ring focus-visible:border-ring focus:-translate-y-[1px]",
  "disabled:shadow-none disabled:pointer-events-none disabled:opacity-50",
);

export function QueueAlertForm({
  source,
  newestMonth,
  frontierMonth,
  queue = "perm",
  allowPwdChoice = false,
}: {
  source: string;
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
}) {
  const emailId = useId();
  const monthId = useId();
  const roleId = useId();
  const newsId = useId();
  const queueId = useId();

  const [email, setEmail] = useState("");
  const [filingMonth, setFilingMonth] = useState("");
  const [role, setRole] = useState("");
  const [news, setNews] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(queue);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const options = filingMonthOptions(newestMonth, frontierMonth);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setMessage("");

    try {
      const endpoint = subscribeEndpoint();
      if (!endpoint) throw new Error("Convex URL isn’t configured");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          filingMonth,
          role: role || undefined,
          source,
          queue: selectedQueue,
          news: news || undefined,
        }),
      });
      const result = (await response.json()) as { ok: boolean; message: string };
      setStatus(result.ok ? "done" : "error");
      setMessage(result.message);
    } catch {
      setStatus("error");
      setMessage("Something went wrong on our side. Try again in a moment.");
    }
  }

  if (status === "done") {
    return (
      <div
        className="border-2 border-border bg-card p-6 shadow-hard sm:p-8"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="font-heading text-lg font-black">Check your inbox</p>{" "}
            <p className="mt-1 text-sm leading-relaxed text-foreground/70">{message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-2 border-border bg-card p-6 shadow-hard sm:p-8"
    >
      <div className="flex items-center gap-2">
        <BellIcon className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Get notified when DOL reaches your month
        </h2>
      </div>{" "}
      {/* The queue is named from the prop, not hardcoded. This form also sits
          on the prevailing wage pages, where "analyst review" is the wrong
          queue entirely: it is the PERM stage, and a reader was being told the
          alert watched a line their request is not in. */}
      <p className="mt-2 text-sm leading-relaxed text-foreground/70">
        {selectedQueue === "perm"
          ? "We’ll email you when the analyst-review queue reaches the month your case was filed."
          : "We’ll email you when the prevailing wage queue you pick reaches the month your request was filed."}{" "}
        It isn’t a newsletter and nothing else follows it.
      </p>{" "}

      <div className="mt-6 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={emailId}>Email</Label>{" "}
          <Input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
          />
        </div>{" "}

        <div className="flex flex-col gap-2">
          <Label htmlFor={monthId}>Month your case was filed</Label>{" "}
          <select
            id={monthId}
            required
            value={filingMonth}
            onChange={(e) => setFilingMonth(e.target.value)}
            className={selectClasses}
          >
            <option value="">Select a month</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>{" "}

      {allowPwdChoice ? (
        <div className="mt-4 flex flex-col gap-2">
          <Label htmlFor={queueId}>Which prevailing-wage queue</Label>{" "}
          <select
            id={queueId}
            value={selectedQueue}
            onChange={(e) =>
              setSelectedQueue(e.target.value as "pwd-oews" | "pwd-nonoews")
            }
            className={cn(selectClasses, "sm:max-w-sm")}
          >
            <option value="pwd-oews">OEWS (the standard wage survey)</option>{" "}
            <option value="pwd-nonoews">
              Non-OEWS (an employer-provided survey)
            </option>
          </select>
        </div>
      ) : null}{" "}

      <div className="mt-4 flex flex-col gap-2">
        <Label htmlFor={roleId}>
          You are <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>{" "}
        <select
          id={roleId}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={cn(selectClasses, "sm:max-w-sm")}
        >
          <option value="">Prefer not to say</option>{" "}
          <option value="attorney">An immigration attorney or paralegal</option>{" "}
          <option value="applicant">The person the case is for</option>{" "}
          <option value="employer">The sponsoring employer</option>
        </select>
      </div>{" "}

      <div className="mt-4 flex items-start gap-2.5">
        <input
          id={newsId}
          type="checkbox"
          checked={news}
          onChange={(e) => setNews(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none border-2 border-border bg-background checked:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />{" "}
        <label htmlFor={newsId} className="cursor-pointer text-sm leading-relaxed text-muted-foreground">
          Also send occasional product news: new data, new tools. The same
          confirmation email covers it, and it&apos;s off by default.
        </label>
      </div>

      {status === "error" && message ? (
        <p className="mt-4 text-sm font-bold text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={status === "sending"} className="mt-6 w-full sm:w-auto">
        {status === "sending" ? "Sending" : "Email me when it happens"}
      </Button>{" "}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        You confirm by email first, and one click opts out.
      </p>
    </form>
  );
}
