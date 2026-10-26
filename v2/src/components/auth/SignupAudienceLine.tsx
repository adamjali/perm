"use client";

import Link from "next/link";

import { analytics } from "@/lib/analytics";

/**
 * The fork as one line, for phones (owner's yes, Oct 26 2026). On a phone the tape box filled the first screen with a
 * lime "Check my case" button, so an attorney who'd just tapped "Start free" met a warning before any form: the two
 * phone visitors from a Facebook post who reached sign-up both left without a tap. The line keeps the way out for
 * someone waiting on their own case and leaves the form first.
 */
export function SignupAudienceLine({ className }: { className?: string }) {
  return (
    <p className={`mt-3 text-sm leading-relaxed text-muted-foreground ${className ?? ""}`}>
      Waiting on your own case? You don&rsquo;t need an account:{" "}
      <Link
        href="/perm-case-status"
        onClick={() => analytics.capture("signup_fork_taken", { door: "track_my_case_line" })}
        className="link font-semibold"
      >
        check it here
      </Link>
      .
    </p>
  );
}
