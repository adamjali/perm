"use client";

/**
 * Request a preferences magic link.
 *
 * Same posture as QueueAlertForm: a plain fetch to the `.convex.site` twin,
 * so the public tree ships no Convex client. The reply is rendered verbatim
 * and is deliberately neutral - the endpoint answers the same sentence
 * whether or not the address subscribes to anything, so this form cannot be
 * used to probe who is on a list.
 */

import * as React from "react";

function requestEndpoint(): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}/prefs/request`;
}

export function PrefsRequestForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState("");

  const endpoint = requestEndpoint();
  if (!endpoint) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "busy") return;
    setState("busy");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      setMessage(String(body.message ?? "Something went wrong. Try again."));
      setState(res.ok ? "done" : "error");
    } catch {
      setMessage("Couldn't reach the server. Try again in a moment.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="border-3 border-border bg-card p-5 shadow-hard">
        <p className="font-heading text-lg font-black">Check your inbox</p>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/70">
          {message}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border-3 border-border bg-card p-5 shadow-hard"
    >
      <label htmlFor="prefs-email" className="font-heading text-lg font-black">
        Get your preferences link
      </label>{" "}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="prefs-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="min-h-[48px] w-full min-w-0 flex-1 border-3 border-border bg-background px-4 text-base placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />{" "}
        <button
          type="submit"
          disabled={state === "busy"}
          className="inline-flex min-h-[48px] items-center justify-center border-3 border-border bg-primary px-6 font-heading font-black text-primary-foreground shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-60"
        >
          {state === "busy" ? "Sending…" : "Email me the link"}
        </button>
      </div>
      {state === "error" ? (
        <p className="mt-3 text-sm font-semibold text-destructive" role="alert">
          {message}
        </p>
      ) : null}{" "}
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        The link opens a page listing everything we send to that address, with
        a switch to turn each one off, or all of them at once.
      </p>
    </form>
  );
}
