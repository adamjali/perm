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
import { isQueued, replyHeading } from "@/lib/alertReply";
import { formText } from "@/lib/forms/formText";
import { convexSiteUrl } from "@/lib/convexSite";
import { buttonVariants } from "@/components/ui/button";

export function PrefsRequestForm() {
  const [email, setEmail] = React.useState("");
  const [state, setState] = React.useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = React.useState("");
  const [queued, setQueued] = React.useState(false);

  const endpoint = convexSiteUrl("/prefs/request");
  if (!endpoint) return null;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "busy") return;
    // The box itself, not only React's copy: an autofilled address can skip the
    // event React listens for (formText).
    const address = formText(e.currentTarget, "email", email).trim();
    setEmail(address);
    setState("busy");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address }),
      });
      const body = (await res.json()) as { ok?: boolean; message?: string };
      setMessage(String(body.message ?? "Something went wrong. Try again."));
      setQueued(isQueued(body));
      setState(res.ok ? "done" : "error");
    } catch {
      setMessage("Couldn't reach the server. Try again in a moment.");
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="border border-border bg-card p-5">
        <p className="font-heading text-lg font-bold">{replyHeading(queued)}</p>{" "}
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="border border-border bg-card p-5"
    >
      <label htmlFor="prefs-email" className="font-heading text-lg font-bold">
        Get your preferences link
      </label>{" "}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="prefs-email"
          type="email"
          name="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="min-h-[48px] w-full min-w-0 flex-1 border border-input bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />{" "}
        <button
          type="submit"
          disabled={state === "busy"}
          className={buttonVariants({ variant: "default", size: "lg", className: "justify-center" })}
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
