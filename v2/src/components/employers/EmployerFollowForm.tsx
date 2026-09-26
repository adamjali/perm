"use client";

/**
 * One field: follow an employer by email.
 *
 * Same posture as the other alert forms: a plain fetch to the `.convex.site`
 * twin, double opt-in, the server's own reply rendered verbatim. It sends the
 * SLUG only; the route looks the employer's name up in our records, so the
 * name in the confirmation email is never the form's.
 */

import { useId, useState } from "react";

function subscribeEndpoint(): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}/employer-alert/subscribe`;
}

export function EmployerFollowForm({ slug, source }: { slug: string; source: string }) {
  const emailId = useId();
  const noteId = useId();
  const [email, setEmail] = useState("");
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
        body: JSON.stringify({ email: email.trim(), slug, source }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setMessage(String(body?.message ?? "Something went wrong. Try again in a moment."));
      setStatus(res.ok ? "done" : "error");
    } catch {
      setMessage("Couldn't reach the server. Try again in a moment.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <p role="status" aria-live="polite" className="border-2 border-border bg-primary px-4 py-3 text-base font-bold text-primary-foreground">
        {message} Nothing is sent until you confirm.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} aria-describedby={noteId}>
      <label htmlFor={emailId} className="text-sm font-bold">
        Your email address
      </label>{" "}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <input
          id={emailId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={status === "error" ? true : undefined}
          className="min-h-[48px] w-full min-w-0 flex-1 border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        />{" "}
        <button
          type="submit"
          disabled={status === "sending"}
          className="inline-flex min-h-[48px] shrink-0 items-center justify-center border-2 border-border bg-foreground px-6 text-base font-bold text-background shadow-hard transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none"
        >
          {status === "sending" ? "Sending" : "Follow"}
        </button>
      </div>{" "}
      {status === "error" && message ? (
        <p className="mt-3 text-sm font-bold text-destructive" role="alert">
          {message}
        </p>
      ) : null}{" "}
      <p id={noteId} className="mt-3 text-sm leading-relaxed text-muted-foreground">
        One email a day at most, whatever you follow. You confirm by email first, and one click stops it. We send one confirmation every 10 minutes per address.
      </p>
    </form>
  );
}
