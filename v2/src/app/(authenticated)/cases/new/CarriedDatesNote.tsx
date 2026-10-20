"use client";

import { CalendarCheckIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { carriedSummary, forgetCarried, type CarriedDates } from "@/lib/carriedCase";

/**
 * Above the new-case form when it opens with dates from the deadline
 * calculator: what was filled in, and where the recruitment dates went.
 */
export function CarriedDatesNote({ dates }: { dates: CarriedDates }) {
  const summary = carriedSummary(dates);
  return (
    <div className="flex flex-col gap-3 border-2 border-border bg-tint p-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3">
        <CalendarCheckIcon className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden="true" />{" "}
        <p className="text-sm leading-relaxed">
          From the deadline calculator: {summary}. The wage determination and its expiration are filled in.
          {dates.first
            ? " The recruitment dates are in the recruitment notes: enter each step's own dates and the filing window follows."
            : ""}
        </p>
      </div>{" "}
      <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => forgetCarried()}>
        Start without them
      </Button>
    </div>
  );
}
