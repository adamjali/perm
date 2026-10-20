"use client";

import Link from "next/link";
import { CalendarCheckIcon } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { useOnboardingOptional } from "@/components/onboarding/OnboardingProvider";
import { useCarriedDates } from "@/hooks/useCarriedDates";
import { analytics } from "@/lib/analytics";
import { carriedHref, carriedSummary, forgetCarried } from "@/lib/carriedCase";

/**
 * Dates someone brought from the public deadline calculator and hasn't put on
 * a case yet (src/lib/carriedCase.ts): an existing account that signed up
 * again, a sign-in that started elsewhere. Hidden while the setup wizard is
 * open, because its first case takes the dates itself.
 */
export function CarriedCaseCard() {
  const { dates } = useCarriedDates();
  const showWizard = useOnboardingOptional()?.showWizard ?? false;
  if (!dates || showWizard) return null;
  const summary = carriedSummary(dates);
  return (
    <section
      aria-labelledby="carried-case-heading"
      className="flex flex-col gap-4 border-2 border-border bg-tint p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
    >
      <div className="flex items-start gap-3">
        <CalendarCheckIcon className="mt-0.5 size-6 shrink-0 text-primary-text" aria-hidden="true" />{" "}
        <div>
          <h2 id="carried-case-heading" className="font-heading text-lg font-bold leading-tight">
            Your dates from the deadline calculator
          </h2>{" "}
          <p className="mt-1 text-sm text-muted-foreground">
            {summary.charAt(0).toUpperCase() + summary.slice(1)}. Add them as a case and the reminders start.
          </p>
        </div>
      </div>{" "}
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Button asChild>
          <Link
            href={carriedHref("/cases/new", dates)}
            onClick={() => analytics.capture("carried_case_card", { action: "open" })}
          >
            Add as a case
          </Link>
        </Button>{" "}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            forgetCarried();
            analytics.capture("carried_case_card", { action: "dismiss" });
          }}
        >
          Not now
        </Button>
      </div>
    </section>
  );
}
