"use client";

import { useState } from "react";
import { Send } from "lucide-react";

/**
 * The contact form. Posts to the Convex HTTP route, which owns the shape
 * checks and budgets; this side owns honest states — sending, sent, refused —
 * and never pretends. The hidden "website" field is the honeypot: humans
 * never see it, bots fill it, the route answers success and writes nothing.
 */

function endpoint(): string {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  return `${cloud.replace(".convex.cloud", ".convex.site")}/contact`;
}

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
    try {
      const res = await fetch(endpoint(), {
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
      setNote("Couldn't reach the server. Email us directly instead.");
    }
  };

  if (phase === "sent") {
    return (
      <div className="border-2 border-border bg-tint-primary p-8 text-center shadow-hard">
        <p className="font-heading text-xl font-black">Message sent</p>{" "}
        <p className="mt-2 text-base text-foreground/70">{note}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="relative border-2 border-border bg-card p-6 shadow-hard sm:p-8">
      <div className="grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
            Name
          </span>{" "}
          <input
            type="text"
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            className="mt-1.5 min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
            Email
          </span>{" "}
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            className="mt-1.5 min-h-[44px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary"
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
          Message
        </span>{" "}
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={4000}
          rows={6}
          className="mt-1.5 w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base outline-none transition-shadow focus:ring-2 focus:ring-primary"
        />
      </label>
      {/* Honeypot: visually gone, still in the form data. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {phase === "error" ? (
        <p role="alert" className="mt-4 border-2 border-border bg-background p-3 text-sm font-bold">
          {note}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={phase === "sending"}
        className="mt-5 inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-primary px-6 py-3 font-bold text-primary-foreground shadow-hard transition-all duration-150 hover:-translate-y-[1px] hover:shadow-hard-lg active:translate-y-0 active:shadow-hard-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === "sending" ? "Sending…" : "Send message"}
        <Send className="h-4 w-4" aria-hidden="true" />
      </button>
      <p className="mt-3 text-sm text-foreground/60">
        Lands in our inbox as email — replies come from a person.
      </p>
    </form>
  );
}
