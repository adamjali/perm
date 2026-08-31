import type { Metadata } from "next";
import Link from "next/link";

import { openGraphBase } from "@/lib/openGraphBase";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "../../../../../convex/lib/dolProcessingTimes";
import { getProcessingTimes } from "@/lib/turso/processingTimes";
import { ProductShot } from "@/components/marketing/ProductShot";
import { SignupPageClient } from "./SignupPageClient";

// Daily, the same window every data page uses. It was `force-static`, which is
// right for a bare form and wrong the moment the page prints a live figure.
export const revalidate = 86400;

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
    description: "Create a free PERM Tracker account.",
    url: "/signup",
  },
  // See login/page.tsx for the noindex+follow rationale (Google: Disallow ≠ noindex).
  robots: { index: false, follow: true },
};

/**
 * Sign up: the pitch on the left, the form on the right.
 *
 * ADAM ASKED FOR THIS TWICE, AND THE SECOND TIME AFTER I ARGUED AGAINST IT, so
 * it is his call and it is recorded as his call. The objection, kept because it
 * is the thing to watch: `login-02` and `signup-02` in the shadcn block library
 * are, verbatim, "A two column login page with a cover image", which makes this
 * skeleton the one nearly every AI-assisted build reaches for. And of seven
 * auth pages readable live on 2026-08-31 - Vercel login and signup, Resend,
 * Cal.com, GitHub, Supabase, Railway - NONE used a split screen; all seven were
 * a centred single column.
 *
 * SO THE SKELETON IS THE TEMPLATE'S AND NOTHING ELSE IS. The block's left half
 * is a stock cover image; ours is the live federal queue - the month DOL is
 * working, the average days to a determination, the wage requests outstanding -
 * dated, and the same three figures /tools publishes from the same snapshot.
 * That is Railway's idea, which prints "All systems operational" on its login:
 * information at the moment somebody wants it. Everyone creating an account
 * here is waiting on a PERM case, and where DOL has got to is the first thing
 * they want to know.
 *
 * What it is NOT is the thing the research names as the loudest template tell:
 * a fabricated testimonial with a name, a role and five stars. Nothing on this
 * page is invented, and the screenshot's caption says outright that its cases
 * are a demo account's.
 *
 * `flex-col-reverse` BELOW `lg` IS DOING REAL WORK. Source order is pitch then
 * form, which the grid renders left-then-right on a wide screen. On a phone the
 * reverse puts the FORM first - it is what someone came for, and burying it
 * under a screen of marketing is the mistake the previous version of this page
 * made in the other direction. No `order` utilities, no duplicated markup, and
 * one image element either way.
 */
export default async function SignupPage() {
  const snapshot = await getProcessingTimes();
  const analyst = snapshot ? analystReviewQueue(snapshot.permQueues) : undefined;
  const analystAvg = snapshot
    ? analystReviewAverage(snapshot.permAverageDays)
    : undefined;
  const pwdPending = snapshot?.pwdPermBacklog?.length
    ? snapshot.pwdPermBacklog.reduce((sum, r) => sum + r.remainingRequests, 0)
    : null;

  // A figure DOL did not publish is dropped rather than rendered as a dash.
  // The whole reason the panel is there is that the numbers are real.
  const figures = [
    {
      label: "Deciding cases filed",
      value: formatMonth(analyst?.priorityDate ?? null),
    },
    {
      label: "Average to a determination",
      value:
        analystAvg?.calendarDays != null
          ? `${analystAvg.calendarDays} days`
          : null,
    },
    {
      label: "Wage requests pending",
      value: pwdPending != null ? pwdPending.toLocaleString("en-US") : null,
    },
  ].filter((f): f is { label: string; value: string } => Boolean(f.value));

  return (
    // Full bleed: the auth layout centres a padded column, so this cancels its
    // gutter the same way the data rail cancels the shell's.
    // FULL WIDTH AND FULL HEIGHT. Adam: "make sure it takes the full width and
    // height! and is 2/3 visual 1/3 sign up".
    //
    // The negative margins cancel the auth layout's own padding on all four
    // sides - `px-4 sm:px-8` and `pb-8 sm:pb-12` on its `main`, `pt-6 sm:pt-10`
    // on the wrapper inside it - so the split reaches every edge. The one thing
    // NOT cancelled is that layout's top padding, which reserves the fixed
    // header's 71px and is the number both route groups have to keep agreeing
    // on. The min-height subtracts the same expression, so the split fills
    // exactly what is left of the viewport.
    //
    // 3:2, not 2:1. Adam: "make sign up a bit bigger actually, less than half
    // but more than 1/3" - 40% is the natural stop between those two, and a
    // 576px column at 1440 gives the 448px card real air rather than pinning it
    // to its own gutter. `minmax(23rem,2fr)` keeps the guard: a fixed fraction
    // of a 1024px screen can fall under the card's own width, so the ratio
    // holds wherever there is room and degrades to a usable measure before it
    // starts crushing the form.
    <div
      className="-mx-4 -mb-8 flex flex-col-reverse sm:-mx-8 sm:-mb-12 lg:grid lg:grid-cols-[3fr_minmax(23rem,2fr)] lg:items-stretch"
      style={{
        marginTop: "calc(-1 * var(--auth-pad-top, 1.5rem))",
        minHeight:
          "calc(100dvh - 4.5rem - var(--security-banner-h, 0px))",
      }}
    >
      {/* LEFT: what you are waiting on. A band, not a card - it runs the full
          height of the row so it cannot end short of the form beside it, which
          is exactly how the earlier two-card version left a void. */}
      <section
        aria-label="Where the PERM queue stands"
        // DARK IN BOTH THEMES, which is a deliberate departure from the
        // site's usual inverted band. `bg-foreground text-background` is the
        // established pairing here - 95 uses - and it FLIPS with the theme: in
        // dark mode it paints near-white. That is right for a stat card and
        // wrong for half a viewport, which would become a white slab on a
        // #0A0A0A page. So light mode gets the ink and dark mode gets `--card`
        // (#1A1A1A), a surface that still reads as a distinct panel against the
        // page without inverting.
        //
        // Everything inside sets its muted tone with `opacity` on
        // currentColor rather than a `--background`-derived token, because
        // those invert too and would have needed a second definition each.
        // CENTRED WHEN IT FITS, TOP-ALIGNED WHEN IT DOES NOT. The form
        // drives this row's height and is taller than a laptop viewport, so
        // centring the panel's content in the FULL column pushed it below the
        // fold - a screen of empty black on load. Above `lg` the content
        // top-aligns and then sticks, so it is visible immediately and travels
        // with the reader while the long form scrolls past it.
        className="relative flex flex-col items-center justify-center border-t-2 border-border bg-foreground px-6 py-12 text-background dark:bg-card dark:text-foreground sm:px-10 lg:justify-start lg:border-r-2 lg:border-t-0 lg:py-16"
      >
        {/* THE SEAM. Adam: "the vertical divider between the sides make it
            unique plz". Rather than adding a decoration to a plain rule, the
            panel's own edge is castellated - the dark half steps 12px into the
            light half in alternating teeth, so the two sides interlock instead
            of merely abutting. It is one masked strip painted in the panel's
            own colour, so it inverts with the panel and cannot drift from it.

            A mask rather than a gradient of two colours: the tooth has to be
            the panel and the gap has to be whatever is behind it - the dotted
            ground in light, the page in dark - and only a mask leaves the gap
            genuinely transparent.

            `lg:` only. Below that the halves stack, so the seam is horizontal
            and a vertical comb would be nonsense; the stacked join keeps the
            plain `border-t-2` it already has.

            Both `maskImage` and the `-webkit-` prefix: Safari still needs it. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-full hidden w-3 bg-foreground dark:bg-card lg:block"
          style={{
            maskImage:
              "repeating-linear-gradient(to bottom, #000 0 18px, transparent 18px 36px)",
            WebkitMaskImage:
              "repeating-linear-gradient(to bottom, #000 0 18px, transparent 18px 36px)",
          }}
        />
        <div className="w-full max-w-lg lg:sticky lg:top-24">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.12em] opacity-60">
            What you&rsquo;re waiting on
            {snapshot?.permAsOf
              ? ` · DOL as of ${formatAsOf(snapshot.permAsOf)}`
              : null}
          </p>{" "}
          {figures.length > 0 ? (
            <dl className="mt-6 space-y-5">
              {figures.map((f) => (
                <div key={f.label}>
                  <dt className="font-mono text-xs font-bold uppercase tracking-wider opacity-60">
                    {f.label}
                  </dt>{" "}
                  <dd className="mt-1 font-heading text-4xl font-black leading-none">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-8 border-t-2 border-current/25 pt-6">
            <ProductShot
              src="/images/screenshots/dashboard-small.png"
              width={1200}
              height={761}
              alt="The deadline hub, grouping a set of cases into overdue, this week, this month and later, each entry naming the case, the deadline type and the date"
              caption="Your dates, sorted into deadlines. Demo account"
              tone="dark"
            />
          </div>
          <p className="mt-6 text-sm leading-relaxed opacity-75">
            Looking up a case number needs no account.{" "}
            <Link
              href="/perm-case-status"
              className="font-bold underline decoration-primary decoration-2 underline-offset-4 hover:text-primary"
            >
              Check a case
            </Link>
            .
          </p>
        </div>
      </section>

      {/* RIGHT: the form, on the page ground rather than in a box. */}
      {/* RIGHT: the form, centred in its column and back in a container -
          "sign up can be in a container square thing". It lost the box while it
          was the whole page; beside a solid two-thirds panel it needs an edge
          of its own or it floats on the dotted ground. */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:py-16">
        <div className="w-full max-w-md">
          <SignupPageClient />
        </div>
      </div>
    </div>
  );
}
