import type { Metadata } from "next";
import { openGraphBase } from "@/lib/openGraphBase";
import Link from "next/link";
import { SignupPageClient } from "./SignupPageClient";
import { DeadlineTrackFigure } from "@/components/marketing/PageFigures";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create a free PERM Tracker account to manage your immigration cases. No account limits and no credit card.",
  alternates: {
    canonical: "/signup",
  },
  openGraph: {
    ...openGraphBase,
    title: "Create Account | PERM Tracker",
    description:
      "Create a free PERM Tracker account.",
    url: "/signup",
  },
  // See login/page.tsx for the noindex+follow rationale (Google: Disallow ≠ noindex).
  robots: { index: false, follow: true },
};

export default function SignupPage() {
  return (
    // TWO COLUMNS AT lg, ONE BELOW IT, and the DOM order is the mobile order.
    // The form is what someone came for, so it is first in the markup and
    // first on a phone; the panel explaining what the account does follows it
    // rather than pushing it down. On a wide screen the grid puts them side
    // by side without either moving in the source.
    <div className="mx-auto w-full max-w-5xl lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="mx-auto w-full max-w-md lg:mx-0">
        <SignupPageClient />
      </div>
      <aside className="mx-auto mt-8 w-full max-w-md border-2 border-border bg-card p-6 shadow-hard lg:mx-0 lg:mt-0 lg:max-w-none">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">
          What the account does
        </p>{" "}
        <h2 className="mt-2 font-heading text-2xl font-black leading-tight">
          Your dates, turned into deadlines
        </h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/70">
          Enter the dates on your case once. The filing window, the wage
          expiration and the audit response dates are computed from them under
          20 CFR 656, and the window closes at whichever comes first.
        </p>
        <figure className="mt-6">
          <DeadlineTrackFigure className="h-auto w-full text-foreground" />{" "}
          <figcaption className="mt-3 border-t-2 border-border pt-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
            The window closes at the earlier of the two
          </figcaption>
        </figure>
        <p className="mt-6 border-t-2 border-border pt-4 text-sm leading-relaxed text-foreground/70">
          Looking up a case number needs no account at all.{" "}
          <Link
            href="/perm-case-status"
            className="font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
          >
            Check a case
          </Link>
          .
        </p>
      </aside>
    </div>
  );
}
