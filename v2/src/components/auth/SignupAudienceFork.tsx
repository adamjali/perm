"use client";

import Link from "next/link";
import { ArrowRightIcon, MagnifyingGlassIcon } from "@phosphor-icons/react";

import { analytics } from "@/lib/analytics";

/**
 * Who the account is for, and where everyone else should go.
 *
 * ADAM, ON WHY THIS EXISTS: "i know beneficiaries find themselves there". They
 * do, and the site sends them. The public IA is deliberately beneficiary-first
 * (track my case, then alerts, then data, then the app), the footer says "Free
 * for applicants and attorneys", and every page carries a lime Sign Up button
 * that says nothing about who it is for. Then the account behind it is a case
 * manager built for someone handling OTHER people's matters, and the role step
 * offers attorney, paralegal, HR, employer and "Other" - so a person waiting on
 * their own PERM picks "Other" and lands in a portfolio tool.
 *
 * SO THIS IS A FORK, NOT A WARNING. Arriving here is not their mistake, and
 * the treatment for "you are in the wrong place" is a door, not a scolding.
 * The two paths are deliberately NOT drawn as two equal cards: there is one
 * product behind the form, and for everyone else the answer is that they never
 * needed an account at all. Equal cards would imply a choice between two
 * accounts and would make the free path look like the lesser one.
 *
 * IT SITS ABOVE THE FORM, on the form's own side. The left panel already
 * carried a line about looking up a case without an account, at 75% opacity,
 * under a screenshot, at the bottom of a column most people scroll past. That
 * is where you put something you are technically disclosing. This is where you
 * put something you want read.
 *
 * The two captures are the point of the whole thing: they are the only
 * evidence of how much beneficiary demand is arriving at a page built for
 * somebody else, and that number is the input to whether the beneficiary
 * product ever gets built.
 */
export function SignupAudienceFork() {
  return (
    <section className="mb-6 border-2 border-border bg-card p-4 shadow-hard sm:p-5">
      <h2 className="font-heading text-lg font-black leading-snug">
        This account is for people who file PERM cases
      </h2>{" "}
      <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
        Attorneys, paralegals, HR teams and employers, managing cases on behalf
        of someone else. It is a case manager: deadlines, recruitment steps and
        documents across a caseload.
      </p>

      <div className="mt-4 border-t-2 border-border pt-4">
        <p className="font-heading text-sm font-black">
          Waiting on your own case? You don&rsquo;t need an account.
        </p>{" "}
        <p className="mt-1.5 text-sm leading-relaxed text-foreground/75">
          Look up your case number, see where DOL&rsquo;s queue is against your
          filing month, and get an alert the day your status changes. All of it
          is free and none of it asks you to sign up.
        </p>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link
            href="/perm-case-status"
            onClick={() => analytics.capture("signup_fork_taken", { door: "track_my_case" })}
            className="flex min-h-11 items-center justify-center gap-2 border-2 border-border bg-primary px-4 font-heading text-sm font-black text-black shadow-hard-sm transition-transform duration-150 hover:-translate-y-[1px] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <MagnifyingGlassIcon size={16} weight="bold" aria-hidden="true" />
            Check my case
          </Link>{" "}
          <Link
            href="/perm-queue"
            onClick={() => analytics.capture("signup_fork_taken", { door: "queue" })}
            className="flex min-h-11 items-center justify-center gap-2 border-2 border-border bg-background px-4 font-heading text-sm font-black shadow-hard-sm transition-transform duration-150 hover:-translate-y-[1px] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            Where the queue is
            <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
