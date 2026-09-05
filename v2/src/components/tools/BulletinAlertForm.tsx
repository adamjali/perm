"use client";

/**
 * Subscribe to one visa-bulletin series: an email when the final-action
 * cutoff for a category x country moves in a new bulletin.
 *
 * Same posture as QueueAlertForm: a plain fetch to the `.convex.site` twin,
 * double opt-in, the server's own reply rendered verbatim. The category and
 * country lists are the exact keys the archive stores - offering a series
 * the sweep cannot read would be a subscription that never fires.
 */

import { useId, useState } from "react";

function subscribeEndpoint(): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}/bulletin-alert/subscribe`;
}

const CATEGORIES = [
  { value: "EB1", label: "EB-1" },
  { value: "EB2", label: "EB-2" },
  { value: "EB3", label: "EB-3" },
  { value: "EW3", label: "EB-3 Other Workers" },
  { value: "EB4", label: "EB-4" },
  { value: "EB5", label: "EB-5 (unreserved)" },
] as const;

const COUNTRIES = [
  { value: "worldwide", label: "All countries (worldwide)" },
  { value: "india", label: "India" },
  { value: "china", label: "China" },
  { value: "mexico", label: "Mexico" },
  { value: "philippines", label: "Philippines" },
] as const;

export function BulletinAlertForm({ source }: { source: string }) {
  const emailId = useId();
  const catId = useId();
  const countryId = useId();
  const newsId = useId();

  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("EB2");
  const [country, setCountry] = useState("india");
  const [news, setNews] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const endpoint = subscribeEndpoint();
  if (!endpoint) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    try {
      const res = await fetch(endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          category,
          country,
          source,
          news: news || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      setMessage(
        String(body?.message ?? "Something went wrong. Try again in a moment."),
      );
      setStatus(res.ok ? "done" : "error");
    } catch {
      setMessage("Couldn't reach the server. Try again in a moment.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div
        className="border-2 border-border bg-card p-6 shadow-hard sm:p-8"
        role="status"
        aria-live="polite"
      >
        <p className="font-heading text-xl font-black">Check your inbox</p>{" "}
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
          {message} Once confirmed, you&apos;ll hear from us when a new
          bulletin moves your cutoff, and not otherwise.
        </p>
      </div>
    );
  }

  const inputClasses =
    "min-h-[48px] w-full border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";

  return (
    <form
      onSubmit={handleSubmit}
      className="border-2 border-border bg-card p-6 shadow-hard sm:p-8"
    >
      <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
        Alert
      </p>{" "}
      <h2 className="mt-1 font-heading text-2xl font-black">
        Email me when my cutoff moves
      </h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        Pick your category and country. When a new bulletin changes that
        final-action cutoff, we email the change, before and after. Nothing on
        the months it doesn&apos;t move.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={catId} className="text-sm font-bold">
            Category
          </label>{" "}
          <select
            id={catId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClasses}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={countryId} className="text-sm font-bold">
            Country of birth
          </label>{" "}
          <select
            id={countryId}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputClasses}
          >
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <label htmlFor={emailId} className="text-sm font-bold">
          Your email address
        </label>{" "}
        <input
          id={emailId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className={inputClasses}
        />
      </div>
      <div className="mt-4 flex items-start gap-2.5">
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
      </div>
      {status === "error" && message ? (
        <p className="mt-4 text-sm font-bold text-destructive" role="alert">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 inline-flex min-h-[48px] items-center justify-center border-2 border-border bg-foreground px-6 font-mono text-sm font-bold uppercase tracking-[0.1em] text-background shadow-hard transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none"
      >
        {status === "sending" ? "Sending" : "Email me when it moves"}
      </button>{" "}
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Double opt-in: you confirm by email first, so an address can&apos;t be
        signed up by someone who doesn&apos;t control it, and one click opts
        out. We send one confirmation every 10 minutes per address - if nothing
        lands, wait that long before trying again.
      </p>
    </form>
  );
}
