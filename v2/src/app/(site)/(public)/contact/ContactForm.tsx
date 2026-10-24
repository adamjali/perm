"use client";

import { useState } from "react";
import { PaperPlaneTiltIcon as Send } from "@phosphor-icons/react";
import { CharLimit } from "@/components/ui/char-limit";
import { convexSiteUrl } from "@/lib/convexSite";
import { buttonVariants } from "@/components/ui/button";

/**
 * The contact form. Posts to the Convex HTTP route, which owns the shape
 * checks and budgets; this side owns honest states (sending, sent, refused)
 * and never pretends. The hidden "website" field is the honeypot: humans
 * never see it, bots fill it, the route answers success and writes nothing.
 */

type Phase = "idle" | "sending" | "sent" | "error";

export function ContactForm() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [note, setNote] = useState("");

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase === "sending") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setPhase("sending");
    setNote("");
    const url = convexSiteUrl("/contact");
    try {
      if (!url) throw new Error("no Convex deployment");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          website: data.get("website"),
        }),
      });
      const body = (await res.json()) as { ok: boolean; message: string };
      if (body.ok) {
        setPhase("sent");
        setNote(body.message);
        form.reset();
      } else {
        setPhase("error");
        setNote(body.message);
      }
    } catch {
      setPhase("error");
      setNote("Couldn’t reach the server. Email us directly instead.");
    }
  };

  if (phase === "sent") {
    return (
      <div className="bg-tint p-8 text-center border-2 shadow-hard border-border">
        <p className="font-heading text-xl font-bold">Message sent</p>{" "}
        <p className="mt-2 text-base text-muted-foreground">{note}</p>
      </div>
    );
  }

  return (
    // POST: before the script loads, a native submit must never put a name or an address in the URL.
    <form method="post" onSubmit={onSubmit} className="relative object p-6 sm:p-8">
      {/* Placeholders show the shape of a good answer; the visible label above
          each field stays, because a placeholder used as the label vanishes
          as soon as someone types. */}
      <div className="grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">
            Name
          </span>{" "}
          <CharLimit max={120}>
            <input
              type="text"
              name="name"
              placeholder="Jordan Rivera"
              required
              autoComplete="name"
              className="mt-1.5 min-h-[44px] w-full min-w-0 border-2 border-input bg-background px-3 py-2 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary"
            />
          </CharLimit>
        </label>
        <label className="block">
          <span className="text-sm font-bold text-muted-foreground">
            Email
          </span>{" "}
          <CharLimit max={254}>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              required
              autoComplete="email"
              className="mt-1.5 min-h-[44px] w-full min-w-0 border-2 border-input bg-background px-3 py-2 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary"
            />
          </CharLimit>
        </label>
      </div>
      <label className="mt-4 block">
        <span className="text-sm font-bold text-muted-foreground">
          Message
        </span>{" "}
        <CharLimit max={4000}>
          <textarea
            name="message"
            placeholder="What you are trying to do, and what happened instead. A case number helps if it is about one."
            required
            minLength={10}
            rows={6}
            className="mt-1.5 w-full min-w-0 border-2 border-input bg-background px-3 py-2 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary"
          />
        </CharLimit>
      </label>
      {/* Honeypot: visually gone, still in the form data. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {phase === "error" ? (
        <p role="alert" className="mt-4 bg-tint p-3 text-sm font-bold border-2 border-border">
          {note}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={phase === "sending"}
        className={buttonVariants({ variant: "default", size: "lg", className: "mt-5" })}
      >
        {phase === "sending" ? "Sending…" : "Send message"}
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
      <p className="mt-3 text-sm text-muted-foreground">
        Lands in our inbox as email. Replies come from a person.
      </p>
    </form>
  );
}
