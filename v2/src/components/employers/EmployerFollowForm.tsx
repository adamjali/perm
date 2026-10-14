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
import { AlertDone, AlertNote, EmailField } from "@/components/alerts/AlertParts";
import { Button } from "@/components/ui/button";
import { formText } from "@/lib/forms/formText";
import { trackAlertSignup } from "@/lib/alertSignupEvent";
import { useAlertFormTelemetry } from "@/lib/funnelEvents";
import { convexSiteUrl } from "@/lib/convexSite";

export function EmployerFollowForm({ slug, source }: { slug: string; source: string }) {
  const { observe, onFocusCapture } = useAlertFormTelemetry("employer", source);
  const emailId = useId();
  const noteId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  const endpoint = convexSiteUrl("/employer-alert/subscribe");
  if (!endpoint) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    // The box itself, not only React's copy: an autofilled address can skip the
    // event React listens for (formText).
    const address = formText(e.currentTarget, "email", email).trim();
    setEmail(address);
    setStatus("sending");
    try {
      const res = await fetch(endpoint!, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, slug, source }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      setMessage(String(body?.message ?? "Something went wrong. Try again in a moment."));
      setStatus(res.ok ? "done" : "error");
      trackAlertSignup("employer", res.ok ? "accepted" : "refused", { source, status: res.status });
    } catch {
      trackAlertSignup("employer", "error", { source });
      setMessage("Couldn't reach the server. Try again in a moment.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return <AlertDone message={message} />;
  }

  return (
    <form ref={observe} onFocusCapture={onFocusCapture} onSubmit={handleSubmit} aria-describedby={noteId} className="print:hidden">
      <label htmlFor={emailId} className="block text-base font-semibold">
        Your email address
      </label>{" "}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <EmailField id={emailId} value={email} onChange={setEmail} invalid={status === "error"} className="sm:flex-1" />{" "}
        <Button
          type="submit"
          variant="outline"
          size="lg"
          loading={status === "sending"}
          data-ph-capture-attribute-cta="employer-follow"
        >
          Follow
        </Button>
      </div>{" "}
      {status === "error" && message ? (
        <p id={noteId} className="mt-2 text-sm font-semibold text-data-warn-ink" role="alert">
          {message}
        </p>
      ) : (
        <AlertNote id={noteId} className="mt-2" />
      )}
    </form>
  );
}
