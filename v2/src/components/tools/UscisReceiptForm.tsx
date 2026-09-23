"use client";

import { useId, useState } from "react";

import { RECEIPT_SHAPE_MESSAGE, normaliseReceipt } from "@/lib/uscis/receipt";

/**
 * The receipt box on `/uscis-case-status`, as a plain GET form.
 *
 * Same contract as `CaseLookupForm`: `method="get"` puts the receipt in
 * `?receipt=` so a result has an address, and the page works with JavaScript
 * off. The client half does one thing: says the shape is wrong BEFORE a round
 * trip, and says when the thing typed is a DOL number that belongs on the
 * other page. Neither hint blocks submission; the server is the authority.
 */

export interface UscisReceiptFormProps {
  defaultValue?: string;
  className?: string;
}

/** A DOL FLAG number: letter, dash, digits. Never a USCIS receipt. */
const DOL_SHAPE = /^[A-Z]-\d/i;

export function UscisReceiptForm({ defaultValue = "", className }: UscisReceiptFormProps) {
  const inputId = useId();
  const helpId = useId();
  const [value, setValue] = useState(defaultValue);
  const [edited, setEdited] = useState(false);

  const typed = value.trim();
  const isDol = edited && DOL_SHAPE.test(typed);
  const malformed = edited && typed.length > 0 && !isDol && normaliseReceipt(typed) === null;

  return (
    <form method="get" action="/uscis-case-status" className={className}>
      <label
        htmlFor={inputId}
        className="block font-mono text-sm font-bold uppercase tracking-[0.1em] text-muted-foreground"
      >
        Your USCIS receipt number
      </label>{" "}
      <div className="mt-2 flex flex-wrap items-stretch gap-3">
        <input
          id={inputId}
          name="receipt"
          type="text"
          defaultValue={defaultValue}
          onChange={(e) => {
            setValue(e.target.value);
            setEdited(true);
          }}
          placeholder="EAC2190123456"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint="search"
          maxLength={20}
          aria-invalid={malformed || undefined}
          aria-describedby={helpId}
          className="min-h-[52px] w-full min-w-0 flex-1 basis-72 border-2 border-border bg-background px-4 py-3 font-mono text-lg tracking-tight focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        />{" "}
        <button
          type="submit"
          className="min-h-[52px] shrink-0 border-2 border-border bg-foreground px-6 font-mono text-sm font-bold uppercase tracking-[0.1em] text-background shadow-hard transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        >
          Look it up
        </button>
      </div>{" "}
      <p id={helpId} className="mt-2 text-sm text-muted-foreground">
        {isDol ? (
          <span className="font-bold text-data-warn-ink">
            That is a Department of Labor number, not a USCIS receipt. Submitting
            takes you to the PERM case page, which reads it.
          </span>
        ) : malformed ? (
          <span className="font-bold text-data-bad-ink">{RECEIPT_SHAPE_MESSAGE}</span>
        ) : (
          <>
            It is at the top of every I-797 notice USCIS mailed. The number goes
            into this page&apos;s address so you can bookmark or share the result.
            The receipt number and USCIS&apos;s answer are kept for twelve months
            after the last lookup; nothing about you is.
          </>
        )}
      </p>
    </form>
  );
}
