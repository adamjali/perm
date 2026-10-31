"use client";

import { useId, useState } from "react";
import Link from "next/link";

import { trackLookup } from "@/lib/funnelEvents";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
import { looksLikeReceipt } from "@/lib/uscis/receipt";

/**
 * The one input on the page, as a plain GET form.
 *
 * NO SUBMIT HANDLER AND NO ROUTER PUSH. `method="get"` puts the number in
 * `?case=` by itself, which is what makes a result shareable and bookmarkable
 * (the thing attorneys asked for on the I-485 review), and it means the page
 * works with JavaScript switched off, which for a government-record lookup is
 * worth more than a slightly smoother transition.
 *
 * The client component earns its keep on one thing only: telling somebody
 * their number is the wrong shape BEFORE they submit and wait on a round
 * trip. That hint never blocks submission, because the server validates again
 * and is the authority, and a client-side gate on a typo is how a valid input
 * with an unusual prefix becomes unenterable.
 *
 * Layout is flex rather than grid on purpose. A form control in a grid with
 * no unprefixed column track is sized from its CONTENT on iOS and from its
 * column everywhere else, which is a phone-only overflow this codebase has
 * already paid for once.
 */

export interface CaseLookupFormProps {
  /** Repopulates the box after a submit, so the URL and the field agree. */
  defaultValue?: string;
  className?: string;
  /** The box's label. Kept for screen readers when `compact` hides it. */
  label?: string;
  /** For a block that already asks the question: the label is read, not shown. */
  compact?: boolean;
  /** Box and button one under the other at every width (a narrow column). */
  stack?: boolean;
  /** Where "Don't have the number?" goes, and its words; null leaves it off. */
  searchHref?: string | null;
  searchLabel?: string;
  /** Which page sent the lookup, for the funnel's lookup event. */
  source?: string;
  /** Where the number goes. The embed answers inside its own frame. */
  action?: string;
  /** An example number, never a label. */
  placeholder?: string;
  /** The line under the box before anything is typed; null leaves it off. */
  help?: React.ReactNode | null;
  /** The button's word in another language; "Check" otherwise. */
  buttonLabel?: string;
  /** Fields the form carries along unseen (the embed's host site). */
  hiddenFields?: Readonly<Record<string, string>>;
  /**
   * The box also takes an employer's name (the homepage's): the case page
   * sends a name on to the search, so a name typed here is never "the wrong
   * shape", and the box is set in the body face rather than the numbers' mono.
   */
  names?: boolean;
}

/** The button's one word, everywhere a case number is asked for. */
export const CHECK_LABEL = "Check";

export function CaseLookupForm({
  defaultValue = "",
  className,
  label = "Your PERM case number",
  compact = false,
  stack = false,
  searchHref = "/case-search",
  searchLabel = "Find a case by employer name",
  source,
  action = "/perm-case-status",
  placeholder = "G-100-26125-868956",
  help = "It's on your ETA-9089 receipt. It goes into the page's address, so you can bookmark the result.",
  buttonLabel = CHECK_LABEL,
  hiddenFields,
  names = false,
}: CaseLookupFormProps) {
  const inputId = useId();
  const helpId = useId();
  const [value, setValue] = useState(defaultValue);
  const [edited, setEdited] = useState(false);

  // An empty box is not a mistake, and the hint stays quiet until something is
  // TYPED: on a submitted bad value the server already says so, and two
  // warnings about one typo is one too many. A USCIS receipt is another
  // agency's number; the server sends a complete one to its own page, and the
  // hint says so first.
  const isReceipt = edited && looksLikeReceipt(value);
  const looksLikeName = names && /[A-Za-z]{2}/.test(value) && (value.match(/[A-Za-z]/g) ?? []).length > (value.match(/\d/g) ?? []).length;
  const malformed =
    edited && !isReceipt && !looksLikeName && value.trim().length > 0 && normaliseCaseNumber(value) === null;
  const hint = isReceipt ? (
    <span className="text-data-warn-ink">
      That looks like a USCIS receipt number, which is USCIS&apos;s record rather than DOL&apos;s.
      Checking it takes you to the USCIS page.
    </span>
  ) : malformed ? (
    <span className="text-data-bad-ink">That isn&apos;t the shape of a case number. They look like G-100-26125-868956.</span>
  ) : (
    help
  );

  return (
    <form
      method="get"
      action={action}
      className={className}
      // A plain GET still navigates; this only records which page sent it and
      // the shape of what was typed (never the number itself).
      onSubmit={(e) => {
        if (!source) return;
        const typed = new FormData(e.currentTarget).get("case");
        trackLookup(source, typeof typed === "string" ? typed : "");
      }}
    >
      <label htmlFor={inputId} className={compact ? "sr-only" : "block text-base font-semibold"}>
        {label}
      </label>{" "}
      <div className={cn("flex flex-wrap items-stretch gap-3", !compact && "mt-2")}>
        <input
          id={inputId}
          name="case"
          type="text"
          defaultValue={defaultValue}
          onChange={(e) => {
            setValue(e.target.value);
            setEdited(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          autoCapitalize={names ? "none" : "characters"}
          spellCheck={false}
          enterKeyHint="search"
          translate="no"
          maxLength={names ? 120 : 40}
          aria-invalid={malformed || undefined}
          aria-describedby={hint ? helpId : undefined}
          className={cn(
            "h-12 w-full min-w-0 flex-1 border border-input bg-card px-4 text-base placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring",
            stack ? "basis-full" : "basis-56",
            !names && "font-mono",
          )}
        />
        <button
          type="submit"
          data-ph-capture-attribute-cta="case-lookup"
          className={cn(buttonVariants({ size: "lg" }), "h-12 w-full", !stack && "sm:w-auto")}
        >
          {buttonLabel}
        </button>
      </div>
      {hiddenFields
        ? Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)
        : null}
      {hint ? (
        <p id={helpId} className={cn("mt-2 text-sm", compact && !isReceipt && !malformed ? "sr-only" : "text-muted-foreground")}>
          {hint}
        </p>
      ) : null}{" "}
      {/* Many people waiting never saw the receipt (the lawyer filed it).
          Finding the case by employer reaches pending cases too. */}
      {searchHref ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Don&apos;t have the number?{" "}
          <Link href={searchHref} className="link">
            {searchLabel}
          </Link>
          .
        </p>
      ) : null}
    </form>
  );
}
