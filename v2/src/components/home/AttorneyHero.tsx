import Link from "next/link";
import { ArrowRightIcon, BellSimpleRingingIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";

import { AppWindow } from "@/components/marketing/AppWindow";
import { TOUR_SHOTS } from "@/components/marketing/tourShots";
import { deadlineTitle } from "@convex/lib/notificationHelpers";
import { buttonVariants } from "@/components/ui/button";

/**
 * The attorney page's hero: the headline over the page an attorney opens every
 * morning, the dashboard's Deadlines panel, drawn from the sample firm
 * (src/components/tour/). One of its cases is laid over the corner as the case
 * card the cases page shows, and a reminder over the top. The reminder reads
 * from the same phrase table the real notifications use, and is the same RFI
 * the hub and the card show.
 *
 * Sized so the headline, both buttons and most of the hub fit one 1440x900
 * screen (the hub's top had sat 539px down, 60% of it visible; now about 80%,
 * and all of it at 1080 tall).
 *
 * The picture is one composition at every width, scaled as a whole (owner, Oct
 * 25 2026: below 1280px the card had dropped under the hub on its own). It's a
 * container, so the hub and card are shares of its width and the reminder is
 * sized in container units; the hub keeps its wide capture at every width.
 */

/** The hub's wide captures only: the phone capture would change the picture's shape. */
const HUB_WIDE = { light: TOUR_SHOTS.hub.light, dark: TOUR_SHOTS.hub.dark };

const HUB_ALT =
  "The dashboard's Deadlines panel for eight sample cases: none overdue, an RFI response due this week, an I-140 filing and a filing window this month, and nine deadlines later.";
const CARD_ALT =
  "A sample case's card on the cases page: Juniper Biologics, ETA 9089 stage, RFI response due in 7 days.";

function Reminder({ className }: { className?: string }) {
  return (
    // Sized in container units, so it shrinks with the picture: at full width
    // 1cqw is about 13px, so 1.2cqw is the 16px title and 1.05cqw the 14px lines.
    <div
      aria-hidden="true"
      className={`items-start gap-[0.9cqw] border-2 border-black bg-card p-[0.9cqw] text-foreground shadow-hard ${className ?? ""}`}
    >
      <span className="grid size-[3cqw] shrink-0 place-items-center border border-border bg-primary text-primary-foreground">
        <BellSimpleRingingIcon weight="bold" className="size-[1.5cqw]" />
      </span>{" "}
      <span className="min-w-0">
        <span className="block font-heading text-[1.2cqw] font-bold leading-tight">{deadlineTitle("rfi_due", 7)}</span>{" "}
        <span className="mt-[0.15cqw] block text-[1.05cqw] leading-snug text-muted-foreground">Juniper Biologics, Senior Statistician</span>{" "}
        <span className="mt-[0.3cqw] block text-[1.05cqw] leading-snug text-muted-foreground">Reminder email</span>
      </span>
    </div>
  );
}

export function AttorneyHero() {
  return (
    // An ink band (round 2, Oct 15 2026: "alternating sections of dark and
    // light"), its light colour handed to the window frame through --band-ink.
    <section
      className="relative overflow-hidden border-b-2 border-black bg-[#141414] text-white [--band-ink:#ffffff] dark:bg-card dark:text-foreground dark:[--band-ink:var(--foreground)]"
    >
      <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-14 sm:px-8 sm:pt-12 lg:pb-20">
        <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-12 lg:items-end lg:gap-12">
          <h1 className="font-heading text-4xl font-bold leading-[1.02] tracking-[-0.03em] sm:text-5xl lg:col-span-7 xl:text-[3.5rem]">
            Every PERM deadline, worked out from the dates you enter
          </h1>{" "}
          <div className="lg:col-span-5 lg:pb-2">
            <p className="max-w-xl text-lg leading-relaxed text-white/80 sm:text-xl dark:text-soft">
              Free case management for immigration attorneys and their teams. Enter a case&apos;s dates once; the
              deadlines, reminders and calendar follow.
            </p>{" "}
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className={buttonVariants({ size: "lg" })}
              >
                Start free
                <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
              </Link>{" "}
              <Link
                href="/perm-case-status"
                className={buttonVariants({ variant: "outline", size: "lg", className: "border-white bg-transparent text-white hover:bg-white/10 dark:border-foreground dark:text-foreground" })}
              >
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                Check a case first
              </Link>
            </div>
          </div>
        </div>

        {/* The picture: the Deadlines panel in an app window on a lime block, a
            case card over its lower-left corner and a reminder over its top.
            The same picture at every width, smaller on a smaller screen; on a
            phone the reminder is left out. */}
        <div className="relative mt-12 @container sm:mt-14">
          <Reminder className="absolute -top-[2.7cqw] right-[6%] z-20 hidden max-w-[28.7cqw] sm:flex" />

          <AppWindow
            url="permtracker.app/dashboard"
            shots={HUB_WIDE}
            alt={HUB_ALT}
            caption="Sample cases."
            priority
            onBand
            fluid
            className="ml-[27%] w-[73%]"
          />

          <AppWindow
            url="permtracker.app/cases"
            shots={TOUR_SHOTS["case-card"]}
            alt={CARD_ALT}
            caption={null}
            fluid
            className="absolute bottom-[22%] left-0 z-10 w-[30%]"
          />
        </div>
      </div>
    </section>
  );
}
