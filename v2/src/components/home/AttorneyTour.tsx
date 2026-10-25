import { Fragment, type ReactNode } from "react";

import { DeadlineDocket } from "@/components/home/DeadlineDocket";
import { AppWindow } from "@/components/marketing/AppWindow";
import { TOUR_SHOTS, type TourSurface } from "@/components/marketing/tourShots";
import { TourStage } from "@/components/home/TourStage";
import { STAGE_BAND_NO_SCRIPT_CSS, StageBand } from "@/components/scroll/StageBand";
import { cn } from "@/lib/utils";

/**
 * The attorney page's product sections: each one a page of the signed-in app,
 * captured from the sample firm (src/components/tour/), beside what it does in
 * three plain lines. The facts describe behaviour the code has; when a feature
 * changes, the line and the capture change with it.
 *
 * PREVIEW (Oct 21 2026, branch preview/image-led): from 1024px with motion allowed the six
 * sections are one pinned stage (TourStage): a ribbon of page names across the top, each band
 * wiping in over the last as the reader scrolls. Below 1024px and under reduced motion they are
 * the alternating paper and ink sections, unchanged. The extras (the worked-out example case,
 * the reminder email) show in that static layout only: inside the pinned frame they would run
 * past its bottom.
 */

interface TourSection {
  id: string;
  /** The page's name on the ribbon. */
  short: string;
  title: string;
  lead: string;
  facts: string[];
  surface: TourSurface;
  url: string;
  alt: string;
  /** A second picture laid over the first, such as the email beside the inbox. */
  extra?: ReactNode;
}

const SECTIONS: TourSection[] = [
  {
    id: "timeline",
    short: "Timeline",
    title: "Every case on one line",
    lead: "The timeline draws each case from its wage request to the I-140 with today marked, so a crowded month shows before it arrives.",
    facts: [
      "Coloured by stage: wage determination, recruitment, ETA 9089, I-140",
      "Dates too close to tell apart share one numbered square",
      "Three months to two years at a glance, opened at today",
    ],
    surface: "timeline",
    url: "permtracker.app/timeline",
    alt: "The case timeline with eight sample cases on one screen: wage determinations, recruitment, ETA 9089 filings, an I-140 and an RFI response due.",
  },
  {
    id: "cases",
    short: "Cases",
    title: "Each case on a card",
    lead: "Stage, next deadline and days left at a glance, with filters, sorting, search and bulk actions.",
    facts: [
      "Sorted by the next deadline unless you choose otherwise",
      "Import cases from a JSON file, export to CSV or JSON",
      "Calendar sync switched on or off per case",
    ],
    surface: "cases",
    url: "permtracker.app/cases",
    alt: "The cases page showing the sample cases as cards, each with its stage, its next deadline and the days left.",
  },
  {
    id: "case-page",
    short: "Case page",
    title: "One page for the whole case",
    lead: "What to do next, every step done and still ahead, the wage determination and the recruitment report.",
    facts: [
      "The next action and its due date at the top",
      "Every milestone from the wage request to the I-140",
      "The recruitment summary written out for the ETA 9089, ready to copy",
    ],
    surface: "case-detail",
    url: "permtracker.app/cases/juniper",
    alt: "A sample case's page: the RFI response due in 7 days, the timeline of completed steps, the prevailing wage and quick stats.",
  },
  {
    id: "dates",
    short: "Dates",
    title: "Type the dates. The rest is worked out.",
    lead: "Enter the determination date and the wage expiration fills in. Start the job order and its end date, the notice period and the filing window follow.",
    facts: [
      "Every date checked against 20 CFR 656 as you type",
      "An impossible date is stopped with the reason, such as a filing inside the 30-day quiet period",
      "Worked-out fields are marked, and yours to change",
    ],
    surface: "edit-case",
    url: "permtracker.app/cases/tidewater/edit",
    alt: "The case form for a sample case: the wage expiration worked out from the determination date, and the recruitment deadline with 84 days left.",
  },
  {
    id: "reminders",
    short: "Reminders",
    title: "Reminders before every deadline",
    lead: "30, 14, 7, 3 and 1 day out by default, in the app and in one email a day with the most urgent first.",
    facts: [
      "Your own reminder days, set in Settings",
      "Browser notifications if you want them",
      "Every reminder links to its case",
    ],
    surface: "notifications",
    url: "permtracker.app/notifications",
    alt: "The notifications page with the sample firm's reminders: an I-140 filing due in 14 days and an RFI response due in 7.",
  },
  {
    id: "calendar",
    short: "Calendar",
    title: "On your calendar, too",
    lead: "Month, week, day and list views of every deadline, and each one sent to Google Calendar once you connect it.",
    facts: [
      "Each kind of deadline switched on or off",
      "Events move when a date changes",
      "Switching a kind off removes its events",
    ],
    surface: "calendar",
    url: "permtracker.app/calendar",
    alt: "The calendar's month view for October 2026 with the sample firm's RFI response and I-140 deadline.",
  },
];

function Facts({ facts, ink = false }: { facts: string[]; ink?: boolean }) {
  const rule = ink ? "border-white/30 dark:border-border" : "border-border";
  return (
    <ul className={cn("mt-6 border-t-2", rule)}>
      {facts.map((f) => (
        <Fragment key={f}>
          {" "}
          <li className={cn("flex gap-3 border-b-2 py-3 text-base leading-snug", rule)}>
            <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 border-2 border-black bg-primary" />{" "}
            <span>{f}</span>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

/** One of the six pages as a band of the stage (StageBand, shared with the calculators page). */
function Section({ s, index, flip, ink }: { s: TourSection; index: number; flip: boolean; ink: boolean }) {
  return (
    <StageBand
      pinned
      id={s.id}
      index={index}
      flip={flip}
      ink={ink}
      title={s.title}
      lead={s.lead}
      picture={<AppWindow url={s.url} shots={TOUR_SHOTS[s.surface]} alt={s.alt} caption="Sample cases." onBand={ink} />}
      extra={s.extra}
    >
      <Facts facts={s.facts} ink={ink} />
    </StageBand>
  );
}

/** The reminder email laid over the inbox picture, as it arrives. */
function EmailOverlay() {
  const shot = TOUR_SHOTS.email.light;
  return (
    <figure className="relative mx-auto mt-10 w-[86%] max-w-md border-2 border-black bg-card text-foreground shadow-hard lg:absolute lg:-bottom-16 lg:left-[-1%] lg:mt-0 lg:w-[44%]">
      <div className="border-b-2 border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        The reminder email
      </div>
      <picture>
        <img
          src={shot.src}
          width={shot.width}
          height={shot.height}
          alt="The morning reminder email to the sample attorney: an RFI response due in 7 days and an I-140 filing due in 14, most urgent first."
          loading="lazy"
          decoding="async"
          className="block h-auto w-full"
        />
      </picture>
    </figure>
  );
}

const ASSISTANT_ALT =
  "The assistant answering which sample cases have something due in the next two weeks: the Juniper Biologics RFI response on October 8 and the Cobalt Freight Systems I-140 on October 15.";

/**
 * Second pictures laid under or over a section's window: the example case,
 * worked out by the central deadline rules, under the case form; the reminder
 * email over the inbox.
 */
const EXTRAS: Record<string, ReactNode> = {
  dates: (
    <DeadlineDocket className="relative z-10 mx-auto mt-6 w-[94%] max-w-xl lg:-mt-24 lg:mr-[-4%] lg:ml-auto lg:w-[34rem]" />
  ),
  reminders: <EmailOverlay />,
};

/** The assistant, drawn as it opens over a page. */
function AssistantSection() {
  const shots = TOUR_SHOTS.assistant;
  return (
    <section id="assistant" className="overflow-hidden border-b-2 border-black bg-background">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 [&>*]:min-w-0 sm:px-8 sm:py-20 lg:grid-cols-12 lg:items-center lg:gap-14">
        <div className="lg:col-span-5">
          <h2 className="font-heading text-3xl font-bold leading-[1.05] tracking-[-0.02em] sm:text-4xl">Ask about your caseload</h2>{" "}
          <p className="mt-4 text-lg leading-relaxed text-soft">
            The assistant reads your cases and answers in plain words. It can update a case or sync a calendar, and asks
            before it changes anything.
          </p>{" "}
          <Facts
            facts={[
              "Finds cases by stage, deadline or employer",
              "Asks first before every change",
              "Says plainly that it isn't legal advice",
            ]}
          />
        </div>{" "}
        <div className="lg:col-span-7">
          <figure className="mx-auto max-w-sm">
            <div className="relative">
              <div aria-hidden="true" className="absolute inset-0 translate-x-3 translate-y-3 border-2 border-black bg-primary sm:translate-x-4 sm:translate-y-4" />
              <picture className="relative block dark:hidden">
                <img src={shots.light.src} width={shots.light.width} height={shots.light.height} alt={ASSISTANT_ALT} loading="lazy" decoding="async" className="block h-auto w-full" />
              </picture>
              <picture className="relative hidden dark:block">
                <img src={shots.dark.src} width={shots.dark.width} height={shots.dark.height} alt={ASSISTANT_ALT} loading="lazy" decoding="async" className="block h-auto w-full" />
              </picture>
            </div>{" "}
            <figcaption className="mt-6 text-sm text-muted-foreground sm:mt-7">Sample cases.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

export function AttorneyTour() {
  return (
    <>
      <noscript>
        <style>{STAGE_BAND_NO_SCRIPT_CSS}</style>
      </noscript>
      <TourStage labels={SECTIONS.map((s) => s.short)}>
        {SECTIONS.map((s, i) => (
          <Section
            key={s.id}
            s={{ ...s, extra: EXTRAS[s.id] }}
            index={i}
            flip={i % 2 === 1}
            ink={i % 2 === 1}
          />
        ))}
      </TourStage>
      <AssistantSection />
    </>
  );
}
