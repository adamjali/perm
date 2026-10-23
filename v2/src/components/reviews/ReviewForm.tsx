"use client";

import { useState } from "react";
import { PaperPlaneTiltIcon, StarIcon } from "@phosphor-icons/react";

import { buttonVariants } from "@/components/ui/button";
import { CharLimit } from "@/components/ui/char-limit";
import { choiceVariants } from "@/components/ui/choice";
import { useQueryParam } from "@/components/ui/pagination";
import { analytics } from "@/lib/analytics";
import { convexSiteUrl } from "@/lib/convexSite";
import { cn } from "@/lib/utils";
import { REVIEW_NAME_MAX, REVIEW_TEXT_MAX, REVIEW_TEXT_MIN } from "@convex/lib/siteReview";

/**
 * The site's review form. Posts to the Convex route (`/review/submit`), which owns the shape checks and the
 * budgets; this side owns honest states (sending, sent, refused) and never pretends. Nothing shows until the
 * owner approves it, and the thanks says so. `?rating=4` (from a rating email) picks the stars ahead. The hidden
 * "website" field is the honeypot: people never see it, bots fill it, the route answers as if it worked.
 */

type Phase = "idle" | "sending" | "sent" | "error";

const FIELD =
  "mt-1.5 min-h-[44px] w-full min-w-0 border-2 border-input bg-background px-3 py-2 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary";

export function ReviewForm() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [fromLink] = useQueryParam("rating");
  const linked = /^[1-5]$/.test(fromLink) ? Number(fromLink) : null;
  const rating = picked ?? linked;

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    const stars = Number(data.get("rating"));
    if (!stars) {
      setPhase("error");
      setNote("Pick from 1 to 5 stars.");
      return;
    }
    setPhase("sending");
    setNote("");
    const url = convexSiteUrl("/review/submit");
    try {
      if (!url) throw new Error("no Convex deployment");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: stars,
          text: data.get("text"),
          name: data.get("name"),
          email: data.get("email"),
          consent: data.get("consent") === "yes",
          website: data.get("website"),
        }),
      });
      const body = (await res.json()) as { ok: boolean; message: string };
      if (body.ok) {
        setPhase("sent");
        setNote(body.message);
        analytics.capture("review_submitted", { rating: stars });
        form.reset();
      } else {
        setPhase("error");
        setNote(body.message);
      }
    } catch {
      setPhase("error");
      setNote("Couldn't reach the server. Please try again in a minute.");
    }
  };

  if (phase === "sent") {
    return (
      <div role="status" className="border-2 border-border bg-card p-6 shadow-hard-sm">
        <p className="font-heading text-xl font-bold">Review sent</p>{" "}
        <p className="mt-2 text-base text-muted-foreground">{note}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative border-2 border-border bg-card p-5 shadow-hard-sm sm:p-6">
      <fieldset>
        <legend className="text-sm font-bold text-muted-foreground">Your rating</legend>{" "}
        <div className="mt-2 flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className={cn(
                choiceVariants({ on: rating === n }),
                "cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              )}
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setPicked(n)}
                className="sr-only"
              />
              <StarIcon weight="fill" className="size-4" aria-hidden="true" />
              {`${n} ${n === 1 ? "star" : "stars"}`}
            </label>
          ))}
        </div>
      </fieldset>{" "}
      <label className="mt-5 block">
        <span className="text-sm font-bold text-muted-foreground">Your review</span>{" "}
        <CharLimit max={REVIEW_TEXT_MAX}>
          <textarea
            name="text"
            required
            minLength={REVIEW_TEXT_MIN}
            rows={5}
            placeholder="What you used PERM Tracker for, and how it went."
            className={FIELD}
          />
        </CharLimit>
      </label>{" "}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 [&>*]:min-w-0">
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Name to show</span>{" "}
          <CharLimit max={REVIEW_NAME_MAX}>
            <input type="text" name="name" required autoComplete="given-name" placeholder="A first name or initials is fine" className={FIELD} />
          </CharLimit>
        </label>{" "}
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">Email (optional, never shown)</span>{" "}
          <input type="email" name="email" autoComplete="email" maxLength={254} placeholder="you@example.com" className={FIELD} />
        </label>
      </div>{" "}
      <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 text-base">
        <input type="checkbox" name="consent" value="yes" required className="mt-1 size-5 shrink-0 accent-primary" />
        <span>Show my review and the name above on PERM Tracker.</span>
      </label>
      {/* Honeypot: visually gone, still in the form data. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>{" "}
      {phase === "error" ? (
        <p role="alert" className="mt-4 border-2 border-border bg-background p-3 text-sm font-bold">
          {note}
        </p>
      ) : null}{" "}
      <button
        type="submit"
        disabled={phase === "sending"}
        className={buttonVariants({ variant: "default", size: "lg", className: "mt-5" })}
      >
        {phase === "sending" ? "Sending…" : "Send review"}
        <PaperPlaneTiltIcon className="size-4" aria-hidden="true" />
      </button>{" "}
      <p className="mt-3 text-sm text-muted-foreground">
        We read each review before it shows, and turn away only spam and abuse, never a review for its stars.
      </p>
    </form>
  );
}
