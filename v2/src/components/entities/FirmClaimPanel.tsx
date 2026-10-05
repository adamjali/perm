"use client";

/**
 * "Is this your firm?": claim the page, or ask for a link to edit a claim.
 *
 * Folded shut by default so the page stays about DOL's figures. The form is
 * uncontrolled and read whole from the form element at submit, so an
 * autofilled or script-filled box is never missed (the iPhone case formText
 * exists for). The rules are checked here first, with the same function the
 * backend checks with (src/lib/firmProfile.ts), and the server's own reply is
 * shown as it came. It sends the SLUG only: the firm's name in every email
 * comes from our records.
 */

import { useId, useState } from "react";

import {
  CITY_MAX,
  DESCRIPTION_MAX,
  FOCUS_OPTIONS,
  LANGUAGE_MAX,
  ROLE_MAX,
  WEBSITE_MAX,
  checkProfile,
  profileFromForm,
  type ProfileField,
} from "@/lib/firmProfile";

function endpoint(path: string): string | null {
  const cloud = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!cloud) return null;
  return `${cloud.replace(".convex.cloud", ".convex.site")}${path}`;
}

type Status = "idle" | "sending" | "done" | "error";
type FieldErrors = Partial<Record<ProfileField | "email" | "role", string>>;

const INPUT =
  "mt-1.5 block min-h-[48px] w-full min-w-0 border-2 border-border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2";
const LABEL = "block text-sm font-bold";
const HINT = "block text-sm font-normal text-foreground/70";
const BUTTON =
  "inline-flex min-h-[48px] items-center justify-center border-2 border-border bg-foreground px-6 text-base font-bold text-background shadow-hard transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:hover:translate-y-0 motion-reduce:transition-none";

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? (
    <p id={id} className="mt-1.5 text-sm font-bold text-destructive">
      {text}
    </p>
  ) : null;
}

async function post(url: string, body: unknown): Promise<{ ok: boolean; message: string; errors?: FieldErrors }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as { message?: string; errors?: FieldErrors } | null;
    return { ok: res.ok, message: String(json?.message ?? "Something went wrong. Try again in a moment."), errors: json?.errors };
  } catch {
    return { ok: false, message: "Couldn't reach the server. Try again in a moment." };
  }
}

function ClaimForm({ slug }: { slug: string }) {
  const base = useId();
  const id = (n: string) => `${base}-${n}`;
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [chars, setChars] = useState(0);
  const url = endpoint("/firm-claim/request");
  if (!url) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const form = new FormData(e.currentTarget);
    const get = (n: string) => {
      const v = form.get(n);
      return typeof v === "string" ? v : null;
    };
    const getAll = (n: string) => form.getAll(n).filter((v): v is string => typeof v === "string");
    const email = (get("email") ?? "").trim();
    const role = (get("role") ?? "").trim();
    const profile = profileFromForm(get, getAll);
    const local: FieldErrors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.slice(0, 254))) local.email = "Enter your work email address.";
    if (!role) local.role = "Say what your role at the firm is.";
    const checked = checkProfile(profile);
    if (!checked.ok) Object.assign(local, checked.errors);
    if (Object.keys(local).length > 0) {
      setErrors(local);
      setMessage("Some of the details need a fix.");
      setStatus("error");
      return;
    }
    setErrors({});
    setStatus("sending");
    const reply = await post(url!, { email, role, slug, profile, source: "firm-page" });
    setMessage(reply.message);
    setErrors(reply.errors ?? {});
    setStatus(reply.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <p role="status" aria-live="polite" className="mt-4 border-2 border-border bg-primary px-4 py-3 text-base font-bold text-primary-foreground">
        {message} Nothing shows on the page until you confirm and we&apos;ve read it.
      </p>
    );
  }

  const described = (n: string, hint = false) =>
    [hint ? id(`${n}-hint`) : null, errors[n as keyof FieldErrors] ? id(`${n}-err`) : null].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Claim this firm's page" className="mt-4 grid grid-cols-1 gap-5 [&>*]:min-w-0 sm:grid-cols-2">
      <div>
        <label htmlFor={id("email")} className={LABEL}>
          Your work email{" "}
          <span id={id("email-hint")} className={HINT}>
            At the firm&apos;s own domain if you can.
          </span>
        </label>{" "}
        <input id={id("email")} name="email" type="email" autoComplete="email" required maxLength={254} className={INPUT} aria-describedby={described("email", true)} aria-invalid={errors.email ? true : undefined} />
        <FieldError id={id("email-err")} text={errors.email} />
      </div>
      <div>
        <label htmlFor={id("role")} className={LABEL}>
          Your role at the firm{" "}
          <span id={id("role-hint")} className={HINT}>
            Only we see it.
          </span>
        </label>{" "}
        <input id={id("role")} name="role" type="text" required maxLength={ROLE_MAX} placeholder="Partner, office manager" className={INPUT} aria-describedby={described("role", true)} aria-invalid={errors.role ? true : undefined} />
        <FieldError id={id("role-err")} text={errors.role} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={id("website")} className={LABEL}>
          Website{" "}
          <span id={id("website-hint")} className={HINT}>
            On the same domain as your email, starting https://
          </span>
        </label>{" "}
        <input id={id("website")} name="website" type="url" inputMode="url" autoComplete="url" maxLength={WEBSITE_MAX} placeholder="https://www.yourfirm.com" className={INPUT} aria-describedby={described("website", true)} aria-invalid={errors.website ? true : undefined} />
        <FieldError id={id("website-err")} text={errors.website} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor={id("description")} className={LABEL}>
          About the firm{" "}
          <span id={id("description-hint")} className={HINT}>
            Plain text, up to {DESCRIPTION_MAX} characters: no links, phone numbers or people&apos;s names. {chars > 0 ? `${chars} used.` : ""}
          </span>
        </label>{" "}
        <textarea
          id={id("description")}
          name="description"
          rows={5}
          maxLength={DESCRIPTION_MAX}
          onInput={(e) => setChars(e.currentTarget.value.length)}
          className={`${INPUT} min-h-[140px]`}
          aria-describedby={described("description", true)}
          aria-invalid={errors.description ? true : undefined}
        />
        <FieldError id={id("description-err")} text={errors.description} />
      </div>
      <div>
        <label htmlFor={id("languages")} className={LABEL}>
          Languages{" "}
          <span id={id("languages-hint")} className={HINT}>
            Separated by commas.
          </span>
        </label>{" "}
        <input id={id("languages")} name="languages" type="text" maxLength={(LANGUAGE_MAX + 2) * 12} placeholder="Spanish, Mandarin" className={INPUT} aria-describedby={described("languages", true)} aria-invalid={errors.languages ? true : undefined} />
        <FieldError id={id("languages-err")} text={errors.languages} />
      </div>
      <div>
        <label htmlFor={id("offices")} className={LABEL}>
          Offices{" "}
          <span id={id("offices-hint")} className={HINT}>
            One a line, city then state.
          </span>
        </label>{" "}
        <textarea id={id("offices")} name="offices" rows={3} maxLength={(CITY_MAX + 8) * 10} placeholder={"Tampa, FL\nMiami, FL"} className={INPUT} aria-describedby={described("offices", true)} aria-invalid={errors.offices ? true : undefined} />
        <FieldError id={id("offices-err")} text={errors.offices} />
      </div>
      <fieldset className="sm:col-span-2">
        <legend className={LABEL}>What the firm handles</legend>{" "}
        <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1">
          {FOCUS_OPTIONS.map((o) => (
            <label key={o.id} className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 text-base">
              <input type="checkbox" name="focus" value={o.id} className="size-5 shrink-0 accent-[var(--primary)]" />
              {o.label}{" "}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="sm:col-span-2">
        {status === "error" && message ? (
          <p role="alert" className="mb-3 text-sm font-bold text-destructive">
            {message}
          </p>
        ) : null}{" "}
        <button type="submit" disabled={status === "sending"} className={BUTTON}>
          {status === "sending" ? "Sending" : "Send the confirmation link"}
        </button>{" "}
        <p className="mt-3 text-sm text-foreground/70">
          Free. An address at a domain DOL&apos;s own filings list for this firm is confirmed by the link alone; any
          other address is checked by a person first. What you send shows here as the firm&apos;s own words once we&apos;ve
          read it, and we can take it down.
        </p>
      </div>
    </form>
  );
}

function EditLinkForm({ slug }: { slug: string }) {
  const emailId = useId();
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const url = endpoint("/firm-claim/edit-link");
  if (!url) return null;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setStatus("sending");
    const reply = await post(url!, { email, slug });
    setMessage(reply.message);
    setStatus(reply.ok ? "done" : "error");
  }

  if (status === "done") {
    return (
      <p role="status" aria-live="polite" className="mt-3 text-base font-bold">
        {message}
      </p>
    );
  }
  return (
    <form onSubmit={onSubmit} aria-label="Get a link to edit this firm's profile" className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0 flex-1">
        <label htmlFor={emailId} className={LABEL}>
          The address you claimed with
        </label>{" "}
        <input id={emailId} name="email" type="email" autoComplete="email" required maxLength={254} className={INPUT} />
      </div>{" "}
      <button type="submit" disabled={status === "sending"} className={BUTTON}>
        {status === "sending" ? "Sending" : "Email me an edit link"}
      </button>
      {status === "error" && message ? (
        <p role="alert" className="text-sm font-bold text-destructive">
          {message}
        </p>
      ) : null}
    </form>
  );
}

/** The fold at the foot of a firm's page. */
export function FirmClaimPanel({ slug, firmName, claimed }: { slug: string; firmName: string; claimed: boolean }) {
  return (
    <section aria-labelledby="claim-this-page" className="mt-10 border-2 border-border bg-card shadow-hard-sm">
      <details className="group">
        <summary className="flex min-h-[56px] cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 [&::-webkit-details-marker]:hidden">
          <h2 id="claim-this-page" className="font-heading text-lg font-black">
            {claimed ? `Work at ${firmName}? Edit or claim this page` : `Work at ${firmName}? Claim this page`}
          </h2>{" "}
          <span aria-hidden className="text-2xl font-black transition-transform group-open:rotate-45 motion-reduce:transition-none">
            +
          </span>
        </summary>
        <div className="border-t-2 border-border px-6 pb-6 pt-4">
          <p className="max-w-3xl text-base leading-relaxed text-foreground/80">
            Add the firm&apos;s website, a short description, languages, offices and what it handles. Once we&apos;ve read
            it, it shows on this page apart from DOL&apos;s figures, marked as the firm&apos;s own words.
          </p>{" "}
          <ClaimForm slug={slug} />
          <div className="mt-8 border-t-2 border-border pt-5">
            <h3 className="font-heading text-base font-black">Already claimed it?</h3>{" "}
            <EditLinkForm slug={slug} />
          </div>
        </div>
      </details>
    </section>
  );
}
