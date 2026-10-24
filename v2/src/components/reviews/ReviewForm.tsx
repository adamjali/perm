"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { CircleNotchIcon, StarIcon, WarningCircleIcon } from "@phosphor-icons/react";

import { buttonVariants } from "@/components/ui/button";
import { CharLimit } from "@/components/ui/char-limit";
import { useQueryParam } from "@/components/ui/pagination";
import { analytics } from "@/lib/analytics";
import { SUPPORT_EMAIL_ADDRESS } from "@/lib/constants/externalLinks";
import { convexSiteUrl } from "@/lib/convexSite";
import { cn } from "@/lib/utils";
import { NOTE_MAX, REVIEW_NAME_MAX, REVIEW_TEXT_MAX, type ReviewField } from "@convex/lib/siteReview";

/**
 * The site's review form, kept to the least a person has to do (owner, Oct 23 2026: "frictionless, easy as
 * possible ... big and clear and calm"): tap the stars, write something if they want, a name, an email if they
 * want, send. Posts to the Convex route (`/review/submit`), which owns the checks and the budgets; this side shows
 * honest states and never pretends. Nothing shows until the owner approves it, and the thanks says so.
 *
 * Prefill, so most people only tap the stars: `?rating=4` picks the stars (a rating email's link); `?t=` is our
 * address sealed into a link we sent, opened by `/review/prefill` and then taken out of the address bar (and kept
 * out of analytics, src/instrumentation-client.ts); a signed-in reader's name and address come from
 * `/api/review-prefill`. A prefill that fails is logged and the form simply starts blank.
 *
 * - The stars are five radio buttons drawn as empty stars (the APG rating radio group): pointing with a mouse
 *   fills them up to the pointer, a tap picks, the arrow keys move, and "3 of 5" says the pick in words.
 * - `method="post"` and `noValidate`: before the script loads a native submit never puts a name or address in the
 *   URL, and every problem is the form's own (owner, Oct 23 2026: no red text, but a red edge on the box that
 *   needs something, or a shake of the stars): with no star picked the stars shake and their hint turns bold;
 *   anything else outlines its box in red, turns its hint into the reason and moves the cursor there. Each is also
 *   read out by a polite status line, and logged.
 * - The hidden "website" field is a honeypot; `elapsed` lets the route mark a very fast send for the owner.
 * - The thanks fits the stars: a 4 or 5 is cheered; a 3 is asked what would have made it a 5, and a 1 or 2 gets an
 *   apology and "What should we do better?", each in a private box tied to the review just posted (NoteBox).
 */

type Phase = "idle" | "sending" | "sent";
type FieldError = { field: ReviewField | "form"; message: string };

const FIELD =
  "mt-2 min-h-14 w-full min-w-0 border-2 border-input bg-background px-4 py-3 text-lg outline-hidden transition-shadow focus:ring-2 focus:ring-primary aria-[invalid=true]:border-destructive aria-[invalid=true]:focus:ring-destructive disabled:opacity-60";
const LABEL = "text-base font-bold";
const HINT = "text-base text-muted-foreground";

/** What the thanks says, by the stars given. */
function thanksWords(rating: number, name: string): { title: string; body: string; ask: string | null } {
  const to = name ? `, ${name}` : "";
  const shows = "Your review shows here once we've read it, usually within a day.";
  if (rating >= 4) return { title: `Thank you${to}.`, body: `Glad PERM Tracker helped. ${shows}`, ask: null };
  if (rating === 3) return { title: `Thank you${to}.`, body: shows, ask: "What would have made it a 5?" };
  return {
    title: `We're sorry it fell short${to}.`,
    body: `Thank you for telling us. ${shows}`,
    ask: "What should we do better?",
  };
}

/**
 * How the stars arrive after sending, by what was given: a 4 or 5 hops in star by star with a small burst behind
 * it, a 3 settles in without a bounce, and a 1 or 2 just fades in, because a low score isn't a celebration.
 */
export function sentMotion(rating: number): string {
  return rating >= 4 ? "review-star-hop" : rating === 3 ? "review-star-settle" : "review-star-calm";
}

/**
 * The burst behind a 4 or 5: twelve small squares that leave from the middle of the stars and spread all the way round
 * them, on an oval as wide as the row, flatter underneath so none reaches the words below. Each is where it ends up.
 */
const BURST: [number, number][] = [
  [172, 10],
  [106, 22],
  [46, 37],
  [-39, 30],
  [-126, 27],
  [-145, 8],
  [-172, -17],
  [-106, -37],
  [-46, -62],
  [39, -50],
  [126, -45],
  [145, -13],
];

/** The fixed header's height and the section's own top margin (scroll-mt-24), which a scrolled-to section sits under. */
const HEADER_ROOM = 96;

export function ReviewForm() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<FieldError | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [pointing, setPointing] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const [sent, setSent] = useState<{ name: string; rating: number; reviewId: string | null } | null>(null);
  /** Bumped to replay the stars' wiggle when someone sends without picking one. */
  const [nudge, setNudge] = useState(0);
  const [fromLink] = useQueryParam("rating");
  const linked = /^[1-5]$/.test(fromLink) ? Number(fromLink) : null;
  const rating = picked ?? linked;
  const shownAt = useRef(0);
  const linkToken = useRef<string | null>(null);
  const thanks = useRef<HTMLHeadingElement>(null);
  const thanksBox = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const starsRef = useRef<HTMLFieldSetElement>(null);

  useEffect(() => {
    shownAt.current = Date.now();
    const url = new URL(window.location.href);
    const t = url.searchParams.get("t");
    // Fill only what the reader hasn't typed already.
    const fill = (got: { name?: unknown; email?: unknown }) => {
      const n = typeof got.name === "string" ? got.name : "";
      const e = typeof got.email === "string" ? got.email : "";
      if (n) setName((cur) => cur || n);
      if (e) setEmail((cur) => cur || e);
      if (n || e) setPrefilled(true);
    };
    const failed = (source: string, reason: string) => {
      console.warn(`[reviews] prefill from ${source} failed:`, reason);
      analytics.capture("review_prefill_failed", { source, reason });
    };
    if (t) {
      linkToken.current = t;
      // The token leaves the address bar at once: it opens to an address, so it's never left to be copied.
      url.searchParams.delete("t");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
      const route = convexSiteUrl("/review/prefill");
      if (!route) return;
      fetch(route, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t }) })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(fill)
        .catch((e: unknown) => failed("link", String(e)));
      return;
    }
    fetch("/api/review-prefill", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(fill)
      .catch((e: unknown) => failed("account", String(e)));
  }, []);

  // The form is tall and the thanks is short, so a reader who pressed Submit at the bottom would be left looking at
  // empty page while the stars played out of sight. Before the thanks is painted it's brought to the middle of the
  // screen, so it arrives in view and its motion is seen; focus follows without moving the page again.
  // The whole section (its heading, the rating and the thanks) is brought into view when it fits under the header,
  // so nothing sits cut off at the top; on a screen too short for all of it, the thanks itself is centred. "instant":
  // the page scrolls smoothly by default (globals.css), and a glide here is the blank moment.
  useLayoutEffect(() => {
    if (phase !== "sent") return;
    const box = thanksBox.current;
    const section = box?.closest("section");
    const room = window.innerHeight - HEADER_ROOM;
    if (section && section.getBoundingClientRect().height <= room) section.scrollIntoView?.({ block: "start", behavior: "instant" });
    else box?.scrollIntoView?.({ block: "center", behavior: "instant" });
    thanks.current?.focus({ preventScroll: true });
  }, [phase]);

  // The cursor goes to a box that needs something; never onto a star (a focus ring there read as a mistake).
  // The stars are only brought into view, so a press of Submit review far below them still shows what's missing.
  // Each is brought to the middle of the screen, so its label and the note in it aren't under the header.
  const focusField = (field: FieldError["field"]) => {
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const show = (el: HTMLElement | null) => el?.scrollIntoView?.({ block: "center", behavior: still ? "auto" : "smooth" });
    if (field === "rating") return show(starsRef.current);
    const target = field === "text" ? textRef.current : field === "name" ? nameRef.current : field === "email" ? emailRef.current : null;
    show(target);
    target?.focus({ preventScroll: true });
  };

  const fail = (e: FieldError) => {
    setError(e);
    setPhase("idle");
    if (e.field === "rating") setNudge((n) => n + 1);
    analytics.capture("review_submit_failed", { field: e.field });
    // After the render that shows the message, so the field it's about is focusable and described.
    requestAnimationFrame(() => focusField(e.field));
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (phase === "sending") return;
    const data = new FormData(e.currentTarget);
    const stars = Number(data.get("rating"));
    if (!stars) return fail({ field: "rating", message: "Tap a star first" });
    if (!name.trim()) return fail({ field: "name", message: "Add a name to show with your review. A first name is fine." });
    setPhase("sending");
    setError(null);
    const url = convexSiteUrl("/review/submit");
    try {
      if (!url) throw new Error("no Convex deployment");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: stars,
          text: data.get("text"),
          name: name.trim(),
          email: email.trim(),
          website: data.get("website"),
          elapsed: shownAt.current ? Date.now() - shownAt.current : 0,
          ...(linkToken.current ? { t: linkToken.current } : {}),
        }),
      });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        field?: ReviewField;
        reviewId?: string;
      } | null;
      if (body?.ok) {
        setSent({ name: name.trim(), rating: stars, reviewId: typeof body.reviewId === "string" ? body.reviewId : null });
        setPhase("sent");
        analytics.capture("review_submitted", { rating: stars, prefilled, hasText: String(data.get("text") ?? "").trim().length > 0 });
        return;
      }
      fail({ field: body?.field ?? "form", message: body?.message ?? `The review couldn't be sent (HTTP ${res.status}). Please try again.` });
    } catch (err) {
      console.warn("[reviews] send failed:", String(err));
      fail({ field: "form", message: "Couldn't reach the server. Your review is still here; please try again in a minute." });
    }
  };

  if (phase === "sent" && sent) {
    const words = thanksWords(sent.rating, sent.name);
    return (
      <div ref={thanksBox} className="review-thanks-in mx-auto max-w-lg py-8 text-center">
        {/* The stars arrive once, in a way that fits what was given (sentMotion); still under reduced motion. */}
        <div className="relative flex justify-center gap-1" aria-hidden="true">
          {sent.rating >= 4 ? (
            <span className="review-burst">
              {BURST.map(([dx, dy], i) => (
                <span key={i} style={{ "--dx": `${dx}px`, "--dy": `${dy}px`, "--r": `${i % 2 ? -1 : 1}` } as React.CSSProperties} />
              ))}
            </span>
          ) : null}
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon
              key={n}
              weight={n <= sent.rating ? "fill" : "regular"}
              style={{ "--i": n - 1 } as React.CSSProperties}
              className={cn(sentMotion(sent.rating), "size-12", n <= sent.rating ? "text-primary" : "text-foreground")}
            />
          ))}
        </div>{" "}
        {/* Focus lands on the heading, so a screen reader starts with it and reads on. */}
        <h2 ref={thanks} tabIndex={-1} className="mt-6 font-heading text-3xl font-bold outline-none">
          {words.title}
        </h2>{" "}
        <p className="mt-3 text-lg leading-relaxed text-soft">{words.body}</p>{" "}
        {words.ask && sent.reviewId ? <NoteBox reviewId={sent.reviewId} ask={words.ask} rating={sent.rating} /> : null}{" "}
        <p className="mt-6 text-base text-muted-foreground">
          {words.ask && !sent.reviewId ? `${words.ask} Write to ` : "To say more, or to change or remove your review later, write to "}
          <a href={`mailto:${SUPPORT_EMAIL_ADDRESS}`} className="link">
            {SUPPORT_EMAIL_ADDRESS}
          </a>
          .
        </p>
      </div>
    );
  }

  const sending = phase === "sending";
  const invalid = (f: ReviewField) => (error?.field === f ? { "aria-invalid": true as const } : {});
  /** A field's hint, or the reason it needs something, in the same quiet place. */
  /** A field's own hint, beside its label, always the same. */
  const hint = (f: ReviewField, normal: string) => (
    <span id={`review-hint-${f}`} className={HINT}>
      {normal}
    </span>
  );
  /** What's wrong with a field, on its own line under the box, marked as an error so it can't be mistaken for a hint. */
  const problem = (f: ReviewField) =>
    error?.field === f ? (
      <p id={`review-error-${f}`} className="mt-2 flex items-start gap-2 text-base font-bold text-destructive-text">
        <WarningCircleIcon weight="fill" className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span>{error.message}</span>
      </p>
    ) : null;
  const described = (f: ReviewField) => (error?.field === f ? `review-hint-${f} review-error-${f}` : `review-hint-${f}`);
  /** Typing in a box that needed something takes its error away. */
  const settle = (f: ReviewField) => {
    if (error?.field === f) setError(null);
  };

  return (
    <form method="post" noValidate onSubmit={onSubmit} className="relative mx-auto max-w-lg">
      <fieldset disabled={sending} className="min-w-0">
        {/* Read out once, politely, whatever went wrong; the page itself stays calm. */}
        <p role="status" className="sr-only">
          {error ? error.message : ""}
        </p>
        <fieldset ref={starsRef} aria-describedby={error?.field === "rating" ? "review-error-rating" : "review-hint-rating"} className="scroll-mt-24 text-center">
          <legend className="block w-full text-center text-xl font-bold">How would you rate PERM Tracker?</legend>{" "}
          <div className="mt-3 flex flex-col items-center">
            <div key={nudge} className={cn("flex", nudge > 0 && "review-stars-nudge")} onPointerLeave={() => setPointing(null)}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= (pointing ?? rating ?? 0);
                return (
                  <label
                    key={n}
                    onPointerEnter={(e) => {
                      if (e.pointerType === "mouse") setPointing(n);
                    }}
                    className="flex size-16 cursor-pointer items-center justify-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground"
                  >
                    <input
                        type="radio"
                      name="rating"
                      value={n}
                      checked={rating === n}
                      onChange={() => {
                        setPicked(n);
                        setPointing(null);
                        if (error?.field === "rating") setError(null);
                      }}
                      aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
                      className="sr-only"
                    />
                    <StarIcon
                      weight={filled ? "fill" : "regular"}
                      className={cn("size-12 transition-transform motion-safe:hover:scale-110", filled ? "text-primary" : "text-foreground")}
                      aria-hidden="true"
                    />
                  </label>
                );
              })}
            </div>{" "}
            {error?.field === "rating" ? (
              problem("rating")
            ) : (
              <span className="mt-1">{rating ? <span id="review-hint-rating" className={HINT}>{`${rating} of 5`}</span> : hint("rating", "Tap a star")}</span>
            )}
          </div>
        </fieldset>{" "}
        <div className="mt-10">
          <label htmlFor="review-text">
            <span className={LABEL}>Your review</span> {hint("text", "(optional)")}
          </label>{" "}
          <CharLimit max={REVIEW_TEXT_MAX} aria-describedby={described("text")} {...invalid("text")}>
            <textarea id="review-text" ref={textRef} name="text" rows={4} autoComplete="off" onInput={() => settle("text")} className={FIELD} />
          </CharLimit>{" "}
          {problem("text")}
        </div>{" "}
        <div className="mt-6">
          <label htmlFor="review-name">
            <span className={LABEL}>Your name</span> {hint("name", "(a first name is fine)")}
          </label>{" "}
          <CharLimit max={REVIEW_NAME_MAX} aria-describedby={described("name")} {...invalid("name")}>
            <input
              id="review-name"
              ref={nameRef}
              type="text"
              name="name"
              autoComplete="given-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                settle("name");
              }}
              className={FIELD}
            />
          </CharLimit>{" "}
          {problem("name")}
        </div>{" "}
        <div className="mt-6">
          <label htmlFor="review-email">
            <span className={LABEL}>Email</span> {hint("email", "(optional, never shown)")}
          </label>{" "}
          <input
            id="review-email"
            ref={emailRef}
            type="email"
            name="email"
            autoComplete="email"
            maxLength={254}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              settle("email");
            }}
            className={FIELD}
            aria-describedby={described("email")}
            {...invalid("email")}
          />{" "}
          {problem("email")}
        </div>
        {/* Honeypot: visually gone, still in the form data. */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
          <label>
            Website
            <input type="text" name="website" tabIndex={-1} autoComplete="off" />
          </label>
        </div>{" "}
        <p className="mt-8 text-base leading-relaxed text-muted-foreground">
          Your review and name show on PERM Tracker once we&apos;ve read it. We don&apos;t show spam, abuse, other
          people&apos;s personal details or reviews of something else, and never hold one back for its stars. No links,
          please. <Link href="/privacy" className="link">Privacy policy</Link>
        </p>{" "}
        {error?.field === "form" ? (
          <p className="mt-5 flex items-start gap-2 text-base font-bold text-destructive-text">
            <WarningCircleIcon weight="fill" className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <span>{error.message}</span>
          </p>
        ) : null}{" "}
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "default", size: "lg" }), "mt-5 h-14 w-full text-lg")}
        >
          {sending ? <CircleNotchIcon className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : null}
          {sending ? "Submitting" : "Submit review"}
        </button>
      </fieldset>
    </form>
  );
}

/**
 * After 3 stars or fewer, a private box for what could be better, tied to the review just posted (the route and
 * siteReviews.addNote hold the rules: one note, within two hours). Only the owner reads it; it isn't posted with
 * the review. Problems are said calmly in its hint and read out, like the form's.
 */
function NoteBox({ reviewId, ask, rating }: { reviewId: string; ask: string; rating: number }) {
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const done = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state === "sent") done.current?.focus();
  }, [state]);

  const refuse = (message: string, status: number) => {
    setState("idle");
    setProblem(message);
    analytics.capture("review_note_failed", { rating, status });
    box.current?.focus();
  };

  const send = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === "sending") return;
    if (!note.trim()) return refuse("Write a few words first.", 0);
    setState("sending");
    setProblem(null);
    const url = convexSiteUrl("/review/note");
    try {
      if (!url) throw new Error("no Convex deployment");
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId, note }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (body?.ok) {
        setState("sent");
        analytics.capture("review_note_sent", { rating });
        return;
      }
      refuse(body?.message ?? `The note couldn't be sent (HTTP ${res.status}). Please try again.`, res.status);
    } catch (err) {
      console.warn("[reviews] note failed:", String(err));
      refuse("Couldn't reach the server. Your note is still here; please try again in a minute.", 0);
    }
  };

  if (state === "sent") {
    return (
      <p ref={done} tabIndex={-1} className="mt-8 text-lg font-bold outline-none">
        Thank you. We read every note, and this one goes straight to the people who build PERM Tracker.
      </p>
    );
  }
  const sending = state === "sending";
  return (
    <form method="post" noValidate onSubmit={send} className="mt-8 text-left">
      <p role="status" className="sr-only">
        {problem ?? ""}
      </p>
      <label htmlFor="review-note" className={LABEL}>
        {ask}
      </label>{" "}
      <textarea
        id="review-note"
        ref={box}
        name="note"
        rows={4}
        maxLength={NOTE_MAX}
        value={note}
        disabled={sending}
        onChange={(e) => {
          setNote(e.target.value);
          if (problem) setProblem(null);
        }}
        aria-describedby="review-note-hint"
        aria-invalid={problem ? true : undefined}
        className={cn(FIELD, "min-h-32 resize-y")}
      />{" "}
      <p id="review-note-hint" className="mt-2">
        {problem ? (
          <span className="text-base font-bold text-foreground">{problem}</span>
        ) : (
          <span className={HINT}>Only we read this. It isn&apos;t shown with your review.</span>
        )}
      </p>{" "}
      <button type="submit" disabled={sending} className={cn(buttonVariants({ variant: "outline", size: "lg" }), "mt-4 h-14 w-full text-lg")}>
        {sending ? <CircleNotchIcon className="size-5 motion-safe:animate-spin" aria-hidden="true" /> : null}
        {sending ? "Sending" : "Send it to us"}
      </button>
    </form>
  );
}
