import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { PrefsRequestForm } from "@/components/prefs/PrefsRequestForm";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * The one page about everything we email.
 *
 * The alert systems each carry their own unsubscribe links, but nothing let
 * a person SEE what an address is signed up for across all of them. This
 * page requests the magic link (served by the Convex HTTP router at /prefs)
 * and explains the model: prove the inbox, see everything, turn anything
 * off. Turning things ON always happens from the pages that own them.
 */

export const metadata: Metadata = {
  title: "Email Preferences",
  description:
    "See everything PERM Tracker sends to your address - case status alerts, queue milestones, visa bulletin movements - and turn any of it off with one link.",
  alternates: {
    canonical: "/email-preferences",
  },
  openGraph: {
    ...openGraphBase,
    title: "Email Preferences",
    description:
      "One link to see and stop everything PERM Tracker emails you.",
    url: "/email-preferences",
  },
};

const KINDS = [
  {
    name: "Case status alerts",
    what: "An email when DOL's status for a case you watch changes. Stops on its own once the case is decided.",
    from: { label: "Check a case", href: "/perm-case-status" },
  },
  {
    name: "Queue milestone alerts",
    what: "One email on the day DOL's queue reaches your filing month - the PERM analyst queue, or either prevailing-wage queue.",
    from: { label: "Processing times", href: "/perm-processing-times" },
  },
  {
    name: "Visa bulletin alerts",
    what: "An email when the final-action cutoff you watch moves in a new bulletin.",
    from: { label: "Priority dates", href: "/tools/priority-date-calculator" },
  },
  {
    name: "Product news",
    what: "Occasional notes about new data and tools. Only if you ticked the box on an alert form.",
    from: null,
  },
] as const;

export default function EmailPreferencesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-8 sm:py-16">
      <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        Email
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl">
        Everything we send, in one place
      </h1>{" "}
      <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
        Every alert here is double opt-in: nothing is ever sent to an address
        that hasn&apos;t confirmed it. This page emails you a link that shows
        everything your address is signed up for, and lets you turn any of it
        off. Turning something on always happens from the page that owns it,
        never from a link.
      </p>
      <div className="mt-8">
        <PrefsRequestForm />
      </div>{" "}
      <h2 className="mt-12 font-heading text-2xl font-black">What exists</h2>{" "}
      <ul className="mt-5 space-y-4">
        {KINDS.map((k) => (
          /* Keyed Fragment with a real space: mapped siblings render with
             zero characters between them, and every extractor reads the
             cards as one glued run. Caught by the rendered audit. */
          <Fragment key={k.name}>
            {" "}
            <li className="border-2 border-border bg-card p-4 shadow-hard-sm">
              <p className="font-heading text-lg font-black">{k.name}</p>{" "}
              <p className="mt-1 text-base leading-relaxed text-foreground/70">
                {k.what}
              </p>{" "}
              {k.from ? (
                <p className="mt-2 text-sm">
                  Set up from{" "}
                  <Link
                    href={k.from.href}
                    className="font-bold underline underline-offset-2 hover:text-primary"
                  >
                    {k.from.label}
                  </Link>
                </p>
              ) : null}
            </li>
          </Fragment>
        ))}
      </ul>
      <p className="mt-8 text-sm leading-relaxed text-muted-foreground">
        Signed in? Your account&apos;s deadline reminders and weekly digest live
        in{" "}
        <Link
          href="/settings?tab=notifications"
          className="font-bold underline underline-offset-2 hover:text-primary"
        >
          notification settings
        </Link>
        . The preferences link can turn the weekly digest off too; turning it
        back on happens there.
      </p>
    </div>
  );
}
