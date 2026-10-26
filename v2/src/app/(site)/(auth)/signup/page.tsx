import type { Metadata } from "next";
import Link from "next/link";

import { openGraphBase } from "@/lib/openGraphBase";
import { formatAsOf, formatMonth } from "@/lib/dolFormat";
import {
  analystReviewQueue,
  analystReviewAverage,
} from "@convex/lib/dolProcessingTimes";
import { getProcessingTimes } from "@/lib/db/processingTimes";
import { ProductShot } from "@/components/marketing/ProductShot";
import { TOUR_SHOTS } from "@/components/marketing/tourShots";
import { SignupPageClient } from "./SignupPageClient";

// Daily, the same window every data page uses, AND force-static. The (auth)
// layout's Convex provider reads cookies, and one cookie read makes a route
// dynamic no matter what `revalidate` says: without force-static, /signup
// serves `private, no-cache, no-store` and renders on every hit.
// force-static makes the cookie read a no-op at render
// (the same shape /login uses), while `revalidate` keeps the live DOL figure
// on the left refreshing daily and on the DOL-change hook. Signed-in
// visitors never reach this render: the proxy redirects them to /dashboard.
export const dynamic = "force-static";
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
 * THE SPLIT IS THE SITE OWNER'S CALL, made over an objection that is kept
 * because it is the thing to watch: `login-02` and `signup-02` in the shadcn
 * block library are, verbatim, "A two column login page with a cover image",
 * which makes this skeleton the one nearly every AI-assisted build reaches
 * for, while the established auth pages use a centred single column.
 *
 * SO THE SKELETON IS THE TEMPLATE'S AND NOTHING ELSE IS. The block's left half
 * is a stock cover image; ours is the live federal queue - the month DOL is
 * working, the average days to a determination, the wage requests outstanding -
 * dated, and the same three figures /tools publishes from the same snapshot.
 * That is the status-line idea ("All systems operational"): information at
 * the moment somebody wants it. Everyone creating an account
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
 * under a screen of marketing would be the mistake. No `order` utilities, no
 * duplicated markup, and
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
    // Full width and full height.
    //
    // The negative margins cancel the auth layout's own padding on all four
    // sides - `px-4 sm:px-8` and `pb-8 sm:pb-12` on its `main`, `pt-6 sm:pt-10`
    // on the wrapper inside it - so the split reaches every edge. The one thing
    // NOT cancelled is that layout's top padding, which reserves the fixed
    // header's 71px and is the number both route groups have to keep agreeing
    // on. The min-height subtracts the same expression, so the split fills
    // exactly what is left of the viewport.
    //
    // 13:12: the pitch keeps the larger share by a hair and the form column
    // takes about 48%, with a 576px card. `minmax(28rem,12fr)` is the guard: a fixed fraction
    // of a 1024px screen can fall under the card's own width, so the ratio
    // holds wherever there is room and degrades to a usable measure before it
    // starts crushing the form.
    <div
      className="-mx-4 -mb-8 flex flex-col-reverse sm:-mx-8 sm:-mb-12 lg:grid lg:grid-cols-[minmax(0,13fr)_minmax(28rem,12fr)] lg:items-stretch"
      style={{
        marginTop: "calc(-1 * var(--auth-pad-top, 1.5rem))",
        minHeight:
          "calc(100dvh - var(--site-header-h))",
      }}
    >
      {/* LEFT: what you are waiting on. A band, not a card - it runs the full
          height of the row so it cannot end short of the form beside it, which
          is exactly how the earlier two-card version left a void. */}
      <section
        aria-label="Where the PERM queue stands"
        // The page's one tinted panel. Centred when it fits; above `lg` it
        // top-aligns and sticks, because the form beside it is taller than a
        // laptop screen and centring would push it below the fold.
        className="dark flex flex-col items-center justify-center border-t-2 border-black bg-[#141414] px-6 py-12 text-foreground sm:px-10 lg:justify-start lg:border-r-2 lg:border-t-0 lg:py-16"
      >
        <div className="w-full max-w-lg lg:sticky lg:top-24">
          <p className="text-base font-semibold text-muted-foreground">
            Where DOL is
            {snapshot?.permAsOf ? `, as of ${formatAsOf(snapshot.permAsOf)}` : null}
          </p>{" "}
          {figures.length > 0 ? (
            <dl className="mt-6 space-y-5">
              {figures.map((f) => (
                <div key={f.label}>
                  <dt className="text-sm text-muted-foreground">
                    {f.label}
                  </dt>{" "}
                  <dd className="mt-1 font-heading text-4xl font-bold leading-none">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
          <div className="mt-8 border-t-2 border-border pt-6">
            <ProductShot
              src={TOUR_SHOTS.dashboard.light.src}
              width={TOUR_SHOTS.dashboard.light.width}
              height={TOUR_SHOTS.dashboard.light.height}
              alt="The dashboard's Deadlines panel, grouping sample cases into overdue, this week, this month and later, each entry naming the case, the deadline and the date"
              caption="Your dates, sorted into deadlines. Sample cases"
            />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Looking up a case number needs no account.{" "}
            <Link
              href="/perm-case-status"
              className="link"
            >
              Check a case
            </Link>
            .
          </p>
        </div>
      </section>

      {/* RIGHT: the form, centred in its column. */}
      <div className="flex items-center justify-center px-4 py-12 sm:px-6 lg:px-10 lg:py-16">
        <div className="w-full max-w-xl">
          <SignupPageClient />
        </div>
      </div>
    </div>
  );
}
