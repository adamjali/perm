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
import { isQueued, replyHeading } from "@/lib/alertReply";
import { AlertDone, AlertNote, EmailField, OptInFold } from "@/components/alerts/AlertParts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectInput } from "@/components/forms/SelectInput";
import { formText } from "@/lib/forms/formText";
import { trackAlertSignup } from "@/lib/alertSignupEvent";
import { useAlertFormTelemetry } from "@/lib/funnelEvents";
import { convexSiteUrl } from "@/lib/convexSite";

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
  const { observe, onFocusCapture } = useAlertFormTelemetry("bulletin", source);
  const emailId = useId();
  const catId = useId();
  const countryId = useId();
  const newsId = useId();

  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("EB2");
  const [country, setCountry] = useState("india");
  const [news, setNews] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const [queued, setQueued] = useState(false);

  const endpoint = convexSiteUrl("/bulletin-alert/subscribe");
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
        body: JSON.stringify({
          email: address,
          category,
          country,
          source,
          news: news || undefined,
          newsletter: newsletter || undefined,
        }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null;
      setMessage(
        String(body?.message ?? "Something went wrong. Try again in a moment."),
      );
      setQueued(isQueued(body));
      setStatus(res.ok ? "done" : "error");
      trackAlertSignup("bulletin", res.ok ? "accepted" : "refused", { status: res.status });
    } catch {
      trackAlertSignup("bulletin", "error");
      setMessage("Couldn't reach the server. Try again in a moment.");
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="border border-border bg-card p-5 sm:p-6">
        <p className="font-heading text-lg font-bold">{replyHeading(queued)}</p>{" "}
        <AlertDone message={message} queued={queued} className="mt-2" />{" "}
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Once confirmed, you&apos;ll hear from us when a new bulletin moves your cutoff, and not otherwise.
        </p>
      </div>
    );
  }

  return (
    <form
      ref={observe}
      onFocusCapture={onFocusCapture}
      onSubmit={handleSubmit}
      className="border border-border bg-card p-5 sm:p-6 print:hidden"
    >
      <h2 className="font-heading text-xl font-bold">Email me when my cutoff moves</h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-soft">
        When a new bulletin changes the final-action cutoff for your category and country, one email with the
        change. Nothing in the months it doesn&apos;t move.
      </p>
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3 [&>*]:min-w-0">
        <div>
          <Label htmlFor={catId}>Category</Label>{" "}
          <SelectInput
            id={catId}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
            className="mt-2 h-12"
          />
        </div>{" "}
        <div>
          <Label htmlFor={countryId}>Country of birth</Label>{" "}
          <SelectInput
            id={countryId}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            options={COUNTRIES.map((c) => ({ value: c.value, label: c.label }))}
            className="mt-2 h-12"
          />
        </div>{" "}
        <div>
          <Label htmlFor={emailId}>Email</Label>{" "}
          <EmailField id={emailId} value={email} onChange={setEmail} invalid={status === "error"} className="mt-2" />
        </div>
      </div>{" "}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={status === "sending"} data-ph-capture-attribute-cta="bulletin-alert">
          Email me when it moves
        </Button>{" "}
        {status === "error" && message ? (
          <p className="text-sm font-semibold text-data-warn-ink" role="alert">
            {message}
          </p>
        ) : (
          <AlertNote />
        )}
      </div>{" "}
      <OptInFold
        id={newsId}
        news={news}
        newsletter={newsletter}
        onNews={setNews}
        onNewsletter={setNewsletter}
        className="mt-1"
      />
    </form>
  );
}
