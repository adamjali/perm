"use client";

import Link from "next/link";
import { ArrowRightIcon, MagnifyingGlassIcon, WarningIcon } from "@phosphor-icons/react";

import { analytics } from "@/lib/analytics";

/**
 * Caution tape across the sign-up form: who the account is for, and where
 * everyone else should go.
 *
 * ADAM, ON WHY IT EXISTS: "i know beneficiaries find themselves there". They
 * do, and the site sends them. The public IA is beneficiary-first (track my
 * case, then alerts, then data, then the app), the footer says "Free for
 * applicants and attorneys", and every page carries a lime Sign Up button
 * naming no audience. The account behind it is a caseload manager.
 *
 * ## Why tape, and why this small
 *
 * A first pass was a two-lane card with a header band: it read correctly and
 * took 380px above a form, which is a lot of room to spend telling most
 * readers they are in the right place. Adam: "make it as concise as possible
 * and not take up too much room", and "needs to have some sort of warning sign
 * symbol caution tape etc".
 *
 * Hazard stripes are the right device precisely because they are not
 * decoration: diagonal tape is the one graphic everybody already reads as
 * "stop and check before you go through this", which is the entire message.
 * They are drawn in the brand's own two colours rather than hazard yellow,
 * because a yellow that appears nowhere else on the site would read as an
 * error state, and being in the wrong place is not an error.
 *
 * ## The layering, which is three flat planes and no gradient wash
 *
 * 1. An offset slab behind the card, so it sits ABOVE the dotted ground.
 * 2. The tape itself, top and bottom, framing the message as a doorway.
 * 3. A black warning tile that OVERLAPS the top tape and breaks its line.
 *    That overlap is the whole 3D moment and the only bold thing here; it is
 *    what stops the block reading as a flat notice bar.
 *
 * Everything else is deliberately quiet so the tape and the tile carry it.
 *
 * ## Theme
 *
 * The tape and the tile are fixed black and lime in BOTH themes, like the
 * header and the footer. `bg-foreground` would flip to near-white in dark and
 * turn hazard tape into a pale smear, the same trap the sign-up split and the
 * badge wall already hit. Only the card ground and the prose follow the theme.
 */

/** Diagonal hazard tape. A repeating gradient is how you draw stripes; it is a
 *  graphic device here, not one of the decorative washes the house style bans. */
const TAPE: React.CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(45deg, #000 0 9px, #2ECC40 9px 18px)",
};

export function SignupAudienceFork() {
  return (
    <section className="relative mb-6">
      {/* Plane one: the offset slab. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 translate-x-[6px] translate-y-[6px] border-2 border-border bg-primary"
      />

      <div className="relative border-2 border-border bg-card">
        {/* Plane two: the tape. */}
        <div className="h-2.5 border-b-2 border-border" style={TAPE} aria-hidden="true" />

        <div className="relative px-4 py-3.5 sm:px-5">
          {/* Plane three: the tile, overlapping the tape above it. */}
          <div
            aria-hidden="true"
            className="absolute -top-[22px] left-4 flex size-9 items-center justify-center border-2 border-border bg-black sm:left-5"
          >
            <WarningIcon size={20} weight="fill" className="text-primary" />
          </div>

          <div className="mt-3.5 sm:flex sm:items-end sm:justify-between sm:gap-5">
            <div className="min-w-0">
              <p className="font-heading text-[15px] font-black leading-snug">
                This account is for people who <span className="bg-primary px-1 text-black">file</span> PERM cases
              </p>{" "}
              <p className="mt-1 text-sm leading-snug text-foreground/70">
                Attorneys, paralegals, HR and employers. Waiting on your own case? You don&rsquo;t need an account.
              </p>
            </div>

            <div className="mt-3 flex shrink-0 flex-col gap-2 sm:mt-0 sm:flex-row">
              <Link
                href="/perm-case-status"
                onClick={() => analytics.capture("signup_fork_taken", { door: "track_my_case" })}
                className="flex min-h-11 items-center justify-center gap-2 whitespace-nowrap border-2 border-border bg-primary px-3.5 font-heading text-sm font-black text-black shadow-hard-sm transition-transform duration-150 hover:-translate-x-[1px] hover:-translate-y-[1px] active:translate-x-0 active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0"
              >
                <MagnifyingGlassIcon size={15} weight="bold" aria-hidden="true" />
                Check my case
              </Link>{" "}
              <Link
                href="/perm-queue"
                onClick={() => analytics.capture("signup_fork_taken", { door: "queue" })}
                className="flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap border-2 border-border bg-background px-3.5 font-heading text-sm font-black transition-colors duration-150 hover:bg-foreground hover:text-background motion-reduce:transition-none"
              >
                The queue
                <ArrowRightIcon size={15} weight="bold" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        <div className="h-2.5 border-t-2 border-border" style={TAPE} aria-hidden="true" />
      </div>
    </section>
  );
}
