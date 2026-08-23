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
import { Bell, CheckCircle2 } from "lucide-react";

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
 * page sets `revalidate = 3600`, so its HTML is served from cache for an hour;
 * a component that computed "this month" itself would, for up to an hour after
 * a month boundary, render a client list one option longer than the cached
 * server list and hydrate with a mismatched <select>.
 */
function filingMonthOptions(newest: string): { value: string; label: string }[] {
  const m = /^(\d{4})-(\d{2})$/.exec(newest);
  const newestYear = m ? Number(m[1]) : 2020;
  const newestMonth = m ? Number(m[2]) - 1 : 11;

  const options: { value: string; label: string }[] = [];
  for (let year = newestYear; year >= 2020; year--) {
    const startMonth = year === newestYear ? newestMonth : 11;
    for (let mo = startMonth; mo >= 0; mo--) {
      options.push({
        value: `${year}-${String(mo + 1).padStart(2, "0")}`,
        label: `${MONTH_NAMES[mo]} ${year}`,
      });
    }
  }
  return options;
}

/** Native select styled to match the Input component (no Select primitive exists here). */
const selectClasses = cn(
  "border-input h-11 w-full min-w-0 border-2 bg-background px-3 py-1 text-base",
  "shadow-hard-sm transition-all duration-150 outline-none md:text-sm",
  "hover:shadow-hard hover:-translate-y-[1px]",
  "focus:shadow-hard focus:ring-2 focus:ring-ring focus-visible:border-ring focus:-translate-y-[1px]",
  "disabled:shadow-none disabled:pointer-events-none disabled:opacity-50",
);

export function QueueAlertForm({
  source,
  newestMonth,
}: {
  source: string;
  /** Newest selectable filing month, "YYYY-MM". Supplied by the server render. */
  newestMonth: string;
}) {
  const emailId = useId();
  const monthId = useId();
  const roleId = useId();

  const [email, setEmail] = useState("");
  const [filingMonth, setFilingMonth] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const options = filingMonthOptions(newestMonth);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;

    setStatus("sending");
    setMessage("");

    try {
      const endpoint = subscribeEndpoint();
      if (!endpoint) throw new Error("Convex URL is not configured");

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          filingMonth,
          role: role || undefined,
          source,
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
            <p className="font-heading text-lg font-black">Check your inbox</p>
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
        <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="font-heading text-xl font-black sm:text-2xl">
          Get told when DOL reaches your month
        </h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/70">
        One email, sent when the analyst-review queue reaches the month your case was filed.
        It is not a newsletter and nothing else follows it.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={emailId}>Email</Label>
          <Input
            id={emailId}
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={monthId}>Month your case was filed</Label>
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
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <Label htmlFor={roleId}>
          You are <span className="font-normal text-foreground/50">(optional)</span>
        </Label>
        <select
          id={roleId}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className={cn(selectClasses, "sm:max-w-sm")}
        >
          <option value="">Prefer not to say</option>
          <option value="attorney">An immigration attorney or paralegal</option>
          <option value="applicant">The person the case is for</option>
          <option value="employer">The sponsoring employer</option>
        </select>
      </div>

      {status === "error" && message ? (
        <p className="mt-4 text-sm font-bold text-destructive" role="alert">
          {message}
        </p>
      ) : null}

      <Button type="submit" disabled={status === "sending"} className="mt-6 w-full sm:w-auto">
        {status === "sending" ? "Sending" : "Email me when it happens"}
      </Button>

      <p className="mt-4 text-xs leading-relaxed text-foreground/50">
        The month is the only thing that decides when we write to you. You confirm by email
        first, so an address cannot be signed up by someone who does not control it, and one
        click opts out.
      </p>
    </form>
  );
}
