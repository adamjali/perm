"use client";

import Link from "next/link";

import { analytics } from "@/lib/analytics";
import { buttonVariants } from "@/components/ui/button";

/**
 * Above the sign-up form: who the account is for, and where everyone else
 * should go. People waiting on their own case land here from the site's
 * Sign up links, and they need no account, so the form says so first and
 * offers their two doors. Each door's use is counted (`signup_fork_taken`).
 */
export function SignupAudienceFork() {
  return (
    <section aria-label="Who this account is for" className="mb-6 border border-input bg-card p-4 sm:p-5">
      <p className="font-heading text-base font-bold leading-snug">This account is for people who file PERM cases</p>{" "}
      <p className="mt-1 text-sm leading-snug text-muted-foreground">
        Attorneys, paralegals, HR and employers. Waiting on your own case? You don&rsquo;t need an account.
      </p>{" "}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/perm-case-status"
          onClick={() => analytics.capture("signup_fork_taken", { door: "track_my_case" })}
          className={buttonVariants({ variant: "outline" })}
        >
          Check my case
        </Link>{" "}
        <Link
          href="/perm-queue"
          onClick={() => analytics.capture("signup_fork_taken", { door: "queue" })}
          className={buttonVariants({ variant: "outline" })}
        >
          See the queue
        </Link>
      </div>
    </section>
  );
}
