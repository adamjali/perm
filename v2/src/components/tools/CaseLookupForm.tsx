"use client";

import { useId, useState } from "react";

import { normaliseCaseNumber } from "@/lib/caseNumberShape";

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
}

export function CaseLookupForm({ defaultValue = "", className }: CaseLookupFormProps) {
  const inputId = useId();
  const helpId = useId();
  const [value, setValue] = useState(defaultValue);
  const [edited, setEdited] = useState(false);

  // An empty box is not a mistake. Somebody who clears it is starting again.
  //
  // And the hint stays quiet until they have TYPED something. On a submitted
  // bad value the server already renders the withholding notice below, so
  // firing this one as well puts two warnings about one typo on the screen.
  const malformed =
    edited && value.trim().length > 0 && normaliseCaseNumber(value) === null;

  return (
    <form method="get" action="/perm-case-status" className={className}>
      <label
        htmlFor={inputId}
        className="block font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground"
      >
        Your PERM case number
      </label>{" "}
      <div className="mt-2 flex flex-wrap items-stretch gap-3">
        <input
          id={inputId}
          name="case"
          type="text"
          defaultValue={defaultValue}
          onChange={(e) => {
            setValue(e.target.value);
            setEdited(true);
          }}
          // An example, never a label. The label is above.
          placeholder="G-100-26125-868956"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          aria-invalid={malformed || undefined}
          aria-describedby={helpId}
          className="min-h-[52px] w-full min-w-0 flex-1 basis-72 border-2 border-border bg-background px-4 py-3 font-mono text-lg tracking-tight focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        />
        <button
          type="submit"
          className="min-h-[52px] shrink-0 border-2 border-border bg-foreground px-6 font-mono text-sm font-bold uppercase tracking-[0.1em] text-background shadow-hard transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          Look it up
        </button>
      </div>
      <p id={helpId} className="mt-2 text-sm text-muted-foreground">
        {malformed ? (
          <span className="font-bold text-data-bad-ink">
            That is not the shape of a PERM case number. They look like
            G-100-26125-868956.
          </span>
        ) : (
          <>
            It is on your ETA-9089 receipt and on any status email from DOL. The
            number goes into this page&apos;s address so you can bookmark or
            share the result; it is not stored and not sent anywhere else.
          </>
        )}
      </p>
    </form>
  );
}
