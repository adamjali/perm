"use client";

import Link from "next/link";
import { ArrowsClockwiseIcon, BellRingingIcon, CalendarCheckIcon } from "@phosphor-icons/react";

import { AppWindow } from "@/components/marketing/AppWindow";
import { TOUR_SHOTS } from "@/components/marketing/tourShots";
import { Button } from "@/components/ui/button";
import { analytics } from "@/lib/analytics";
import { carriedHref, rememberCarried, type CarriedDates } from "@/lib/carriedCase";

/**
 * Under the deadline calculator's dates: keep them as a case in the app.
 *
 * The dates go with the visitor to sign-up or sign-in (src/lib/carriedCase.ts),
 * so the first case they create starts with them. Each reason here is a thing
 * the app does today: the reminder days are the defaults in
 * convex/lib/userDefaults.ts, and the calendar is the Google Calendar sync.
 */
const REASONS = [
  {
    Icon: BellRingingIcon,
    text: "Reminders 30, 14, 7, 3 and 1 day before each deadline, by email and in the app.",
  },
  {
    Icon: ArrowsClockwiseIcon,
    text: "Enter a recruitment step and every deadline that hangs on it is worked out again.",
  },
  {
    Icon: CalendarCheckIcon,
    text: "The filing window, the I-140 deadline after certification, and Google Calendar if you connect it.",
  },
];

export function SaveDatesAsCase({ dates, headingId }: { dates: CarriedDates; headingId: string }) {
  const go = (door: "signup" | "login") => {
    rememberCarried(dates);
    analytics.capture("deadline_calculator_save", { door, recruitment: Boolean(dates.first) });
  };
  return (
    // data-embed-hide: inside another site's page the offer would open the
    // app in their frame; the embed's own source line links here instead.
    <section data-embed-hide aria-labelledby={headingId} className="border-t-2 border-border p-6 sm:p-8">
      <div className="grid grid-cols-1 gap-8 [&>*]:min-w-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
        <div>
          <h3 id={headingId} className="font-heading text-xl font-bold leading-tight sm:text-2xl">
            Keep these dates with the case
          </h3>{" "}
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">
            Save them as a case in PERM Tracker, free for attorneys and their teams.
          </p>{" "}
          <ul className="mt-5 space-y-3">
            {REASONS.map(({ Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-base leading-relaxed">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-text" aria-hidden="true" />{" "}
                <span>{text}</span>{" "}
              </li>
            ))}
          </ul>{" "}
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button asChild>
              <Link href={carriedHref("/signup", dates)} onClick={() => go("signup")}>
                Save as a case
              </Link>
            </Button>{" "}
            <Link
              href={carriedHref("/login", dates)}
              onClick={() => go("login")}
              className="link inline-flex min-h-11 items-center text-sm"
            >
              Have an account? Sign in
            </Link>
          </div>{" "}
          <p className="mt-3 text-sm text-muted-foreground">
            The dates come with you. You add the employer, the job and the beneficiary.
          </p>
        </div>{" "}
        <AppWindow
          url="permtracker.app/dashboard"
          shots={TOUR_SHOTS.hub}
          alt="The dashboard's Deadlines panel for a sample firm's cases: an RFI response due this week, an I-140 filing and a filing window this month, and the deadlines after them."
        />
      </div>
    </section>
  );
}
