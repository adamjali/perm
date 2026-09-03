"use client";

import Link from "next/link";

import { useId, useState } from "react";

import { Label } from "@/components/ui";
import {
  CASE_NUMBER_ACCURACY,
  parseCaseNumber,
  type ParsedCaseNumber,
} from "@/lib/permCaseNumber";
import { formatMonth } from "@/lib/dolFormat";

/**
 * Read a filing month out of a PERM case number.
 *
 * A case number carries its own filing date, so someone holding one should
 * not have to remember which month DOL received it. `parseCaseNumber` refuses
 * anything it cannot decode rather than guessing, and this field surfaces
 * that refusal instead of silently leaving the month picker where it was: a
 * wrong month produces a wrong queue position that the reader cannot see
 * happen.
 *
 * The accuracy sentence renders WITH the decoded date, not in a footnote.
 * The date is exact for 89% of cases and a day or two out otherwise, which is
 * immaterial at month grain and must still not be presented as exact.
 */

export interface CaseNumberFieldProps {
  /** Fired only for a number that decodes. */
  onDecode: (parsed: ParsedCaseNumber) => void;
  /**
   * Rendered under the decoded month when the caller could not use it, e.g.
   * the month falls outside the range the calculator covers.
   */
  warning?: string | null;
  className?: string;
}

export function CaseNumberField({ onDecode, warning, className }: CaseNumberFieldProps) {
  const inputId = useId();
  const helpId = useId();
  const [value, setValue] = useState("");
  const [parsed, setParsed] = useState<ParsedCaseNumber | null>(null);

  // Empty is not an error state. Someone who clears the box is not making a
  // mistake, they are using the month picker instead.
  const showError = value.trim().length > 0 && parsed === null;

  function handleChange(next: string) {
    setValue(next);
    const p = parseCaseNumber(next);
    setParsed(p);
    if (p) onDecode(p);
  }

  return (
    <div className={className}>
      <Label htmlFor={inputId} className="text-sm font-bold">
        Or paste your case number
      </Label>{" "}
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        // An example, never a label. The label is above.
        placeholder="G-100-26125-868956"
        autoComplete="off"
        spellCheck={false}
        aria-invalid={showError || undefined}
        aria-describedby={helpId}
        className="mt-2 block w-full min-w-0 min-h-[44px] border-2 border-border bg-background px-3 py-2 font-mono text-base focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 sm:max-w-sm"
      />
      <div id={helpId}>
        {showError ? (
          <p className="mt-2 text-sm font-bold text-destructive">
            That is not a PERM case number. They look like G-100-26125-868956.
          </p>
        ) : parsed ? (
          <>
            <p className="mt-2 text-sm text-foreground/70">
              Filed{" "}
              <b className="font-bold text-foreground">
                {formatMonth(parsed.filingMonth) ?? parsed.filingMonth}
              </b>
              , read from the number itself.
            </p>{" "}
            {warning ? (
              <p className="mt-2 text-sm font-bold text-destructive">{warning}</p>
            ) : null}{" "}
            <p className="mt-1 text-sm text-muted-foreground">{CASE_NUMBER_ACCURACY}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            The month is read straight from the number here. Nothing is looked up
            and nothing is stored. To see DOL&apos;s own status for it, use the{" "}
            <Link href="/perm-case-status" className="underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              case status lookup
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}
