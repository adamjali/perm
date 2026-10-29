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
import { isQueued } from "@/lib/alertReply";
import { formText } from "@/lib/forms/formText";
import { convexSiteUrl } from "@/lib/convexSite";
import { useLang } from "@/components/i18n/LangProvider";
import { serverReply } from "@/components/alerts/alerts.messages";
import { FORMS_TEXT } from "@/components/alerts/forms.messages";
import { buttonVariants } from "@/components/ui/button";
import type { Lang } from "@/lib/i18n/lang";

import { PREFS_FORM } from "./prefsForm.messages";

/**
 * The page's language (a translated page wraps it in LangProvider) sets the form's own words, and the server's
 * fixed replies are translated the same way the alert forms translate theirs (serverReply): they're the same for
 * every address, so translating them says nothing about who is signed up.
 */
export function PrefsRequestForm({ lang: given }: { lang?: Lang } = {}) {
  const context = useLang();
  const lang = given ?? context;
  const t = PREFS_FORM[lang];
  const shared = FORMS_TEXT[lang];
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
      setMessage(body.message ? serverReply(lang, String(body.message)) : shared.failed);
      setQueued(isQueued(body));
      setState(res.ok ? "done" : "error");
    } catch {
      setMessage(shared.dropped);
      setState("error");
    }
  };

  if (state === "done") {
    return (
      <div className="object p-5">
        <p className="font-heading text-lg font-bold">{shared.replyHeading(queued)}</p>{" "}
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="bg-tint p-5 border-3 shadow-hard border-border"
    >
      <label htmlFor="prefs-email" className="font-heading text-lg font-bold">
        {t.label}
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
          className="min-h-[48px] w-full min-w-0 flex-1 border-3 border-input bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />{" "}
        <button
          type="submit"
          disabled={state === "busy"}
          className={buttonVariants({ variant: "default", size: "lg", className: "justify-center" })}
        >
          {state === "busy" ? t.sending : t.button}
        </button>
      </div>
      {state === "error" ? (
        <p className="mt-3 text-sm font-semibold text-destructive" role="alert">
          {message}
        </p>
      ) : null}{" "}
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {t.after}
      </p>
    </form>
  );
}
