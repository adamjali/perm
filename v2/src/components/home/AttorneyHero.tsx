import Link from "next/link";
import { ArrowRightIcon, BellSimpleRingingIcon, MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";

import { AppWindow } from "@/components/marketing/AppWindow";
import { TOUR_SHOTS } from "@/components/marketing/tourShots";
import { deadlineTitle } from "@convex/lib/notificationHelpers";

/**
 * The attorney page's hero: the headline over the page an attorney opens every
 * morning, the dashboard's deadline hub, drawn from the sample firm
 * (src/components/tour/). One of its cases is laid over the corner as the case
 * card the cases page shows, and a reminder over the top. The reminder reads
 * from the same phrase table the real notifications use, and is the same RFI
 * the hub and the card show.
 *
 * Sized so the headline, both buttons and most of the hub fit one 1440x900
 * screen (the hub's top had sat 539px down, 60% of it visible; now about 80%,
 * and all of it at 1080 tall).
 */

const HUB_ALT =
  "The dashboard's deadline hub for eight sample cases: none overdue, an RFI response due this week, an I-140 filing and a filing window this month, and nine deadlines later.";
const CARD_ALT =
  "A sample case's card on the cases page: Juniper Biologics, ETA 9089 stage, RFI response due in 7 days.";

/** The light-on-band colour: the page background in light mode, the text colour in dark. */
const BAND = "[--band-ink:var(--background)] dark:[--band-ink:var(--foreground)]";

function Reminder({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`items-start gap-3 border-3 border-border bg-card p-3 text-foreground shadow-hard ${className ?? ""}`}
    >
      <span className="grid size-10 shrink-0 place-items-center border-2 border-border bg-primary text-primary-foreground">
        <BellSimpleRingingIcon weight="bold" className="size-5" />
      </span>{" "}
      <span className="min-w-0">
        <span className="block font-heading text-base font-black leading-tight">{deadlineTitle("rfi_due", 7)}</span>{" "}
        <span className="mt-0.5 block text-sm text-muted-foreground">Juniper Biologics, Senior Statistician</span>{" "}
        <span className="mt-1 block font-mono text-sm text-muted-foreground">Reminder email</span>
      </span>
    </div>
  );
}

export function AttorneyHero() {
  return (
    <section
      className={`${BAND} relative overflow-hidden border-b-3 border-border bg-foreground text-background dark:bg-card dark:text-foreground`}
    >
      <div className="mx-auto max-w-[1400px] px-4 pt-8 pb-14 sm:px-8 sm:pt-12 lg:pb-20">
        <div className="grid gap-6 [&>*]:min-w-0 lg:grid-cols-12 lg:items-end lg:gap-12">
          <h1 className="font-heading text-4xl font-black leading-[1.02] tracking-[-0.03em] sm:text-5xl lg:col-span-7 xl:text-[3.5rem]">
            Every PERM deadline, worked out from the dates you enter
          </h1>{" "}
          <div className="lg:col-span-5 lg:pb-2">
            <p className="max-w-xl text-lg leading-relaxed opacity-80 sm:text-xl">
              Free case management for immigration attorneys and their teams. Enter a case&apos;s dates once; the
              deadlines, reminders and calendar follow.
            </p>{" "}
            <div className="mt-6 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 border-3 border-[var(--band-ink)] bg-primary px-6 font-heading font-black text-primary-foreground transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5 motion-reduce:transition-none"
              >
                Start free
                <ArrowRightIcon className="h-5 w-5" aria-hidden="true" />
              </Link>{" "}
              <Link
                href="/perm-case-status"
                className="inline-flex min-h-[52px] items-center justify-center gap-2 border-3 border-[var(--band-ink)] px-6 font-heading font-black text-[var(--band-ink)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0.5 motion-reduce:transition-none"
              >
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
                Check a case first
              </Link>
            </div>
          </div>
        </div>

        {/* The picture: the deadline hub in an app window on a lime block, a
            case card over its lower-left corner and a reminder over its top.
            On wide screens the card stands half off the window; narrower, the
            phone capture of the hub stands in and the card follows it. */}
        <div className="relative mt-12 sm:mt-14">
          <Reminder className="absolute -top-9 right-4 z-20 hidden max-w-sm sm:flex xl:right-[6%]" />

          <AppWindow
            url="permtracker.app/dashboard"
            shots={TOUR_SHOTS.hub}
            alt={HUB_ALT}
            priority
            onBand
            className="xl:ml-[27%] xl:w-[73%]"
          />

          <AppWindow
            url="permtracker.app/cases"
            shots={TOUR_SHOTS["case-card"]}
            alt={CARD_ALT}
            caption={null}
            className="relative z-10 mx-auto mt-10 w-[86%] max-w-sm xl:absolute xl:bottom-[22%] xl:left-0 xl:mx-0 xl:mt-0 xl:w-[30%] xl:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}
