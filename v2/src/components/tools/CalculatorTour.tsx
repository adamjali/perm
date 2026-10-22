import { Fragment } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { TourStage } from "@/components/home/TourStage";
import { AppWindow } from "@/components/marketing/AppWindow";
import { STAGE_BAND_NO_SCRIPT_CSS, StageBand } from "@/components/scroll/StageBand";
import { CALCULATOR_SHOTS, type CalculatorShot } from "@/components/tools/calculatorShots";
import { cn } from "@/lib/utils";

/**
 * The calculators page as one pinned stage, in the order a case moves (owner, Oct 21 2026, on the attorney page's
 * stage: "keep going more like that"). Each band is one stretch of the process: the calculators for it as links on
 * the left, and one of them answered, captured from the site itself with sample inputs, running off the right edge.
 * From 1024px with motion allowed the bands wipe in over each other under a ribbon of their names; below that and
 * under reduced motion they stack as alternating paper and ink sections.
 */

interface Tool {
  href: string;
  name: string;
  does: string;
}

interface Band {
  id: string;
  short: string;
  title: string;
  lead: string;
  shot: CalculatorShot;
  url: string;
  caption: string;
  tools: Tool[];
}

const BANDS: Band[] = [
  {
    id: "wage",
    short: "Wage",
    title: "The wage determination",
    lead: "Before recruitment, DOL sets the wage the job must pay. These count the queue for it and read the levels.",
    shot: "pwd",
    url: "permtracker.app/tools/pwd-calculator",
    caption: "Captured October 21, 2026, for the newest month DOL has received.",
    tools: [
      { href: "/tools/pwd-calculator", name: "Prevailing wage queue", does: "How many wage requests sit ahead of yours." },
      { href: "/tools/pwd-validity", name: "Wage determination validity", does: "The day a determination expires, and which rule set it." },
      { href: "/tools/wage-levels", name: "Prevailing wage levels", does: "DOL's four levels for a job and an area, read live." },
      { href: "/tools/compare-my-offer", name: "Compare my offer", does: "Where an offer sits among certified filings." },
      { href: "/tools/salary-explorer", name: "Salary explorer", does: "What certified PERM jobs pay, as a ladder." },
    ],
  },
  {
    id: "deadlines",
    short: "Deadlines",
    title: "Recruitment and the filing window",
    lead: "Enter the determination date and the recruitment dates. Every deadline under 20 CFR 656 is worked out and drawn to scale.",
    shot: "deadlines",
    url: "permtracker.app/tools/perm-deadline-calculator",
    caption: "Captured October 21, 2026. Sample dates: a determination on August 3, 2026 and recruitment from August 23 to September 20.",
    tools: [
      { href: "/tools/perm-deadline-calculator", name: "PERM deadline calculator", does: "The quiet period and the filing window." },
      { href: "/tools/rfi-deadline", name: "RFI and audit deadline", does: "Thirty days from the date on DOL's letter." },
    ],
  },
  {
    id: "decision",
    short: "Decision",
    title: "Waiting on DOL",
    lead: "Once the ETA 9089 is filed, DOL works its queue in order. These say when it's likely to reach yours.",
    shot: "decision",
    url: "permtracker.app/tools/perm-timeline-calculator",
    caption: "Captured October 21, 2026, for a sample case DOL received on January 15, 2026.",
    tools: [
      { href: "/tools/perm-timeline-calculator", name: "PERM processing time", does: "The likely decision day and its range." },
      { href: "/tools/green-card-timeline", name: "Green card timeline", does: "Every stage drawn to scale." },
    ],
  },
  {
    id: "i140",
    short: "I-140",
    title: "The I-140",
    lead: "After certification the employer has 180 days to file with USCIS. These cover its queue, the category and what keeps the priority date.",
    shot: "i140",
    url: "permtracker.app/tools/i140-calculator",
    caption: "Captured October 21, 2026, from USCIS's own quarterly counts.",
    tools: [
      { href: "/tools/i140-calculator", name: "I-140 queue", does: "Petitions waiting against how fast USCIS clears them." },
      { href: "/tools/eb2-vs-eb3", name: "EB-2 vs EB-3", does: "Which line has fewer people ahead of your date." },
      { href: "/tools/which-green-card", name: "Which green card fits", does: "The categories your job points to." },
      { href: "/tools/priority-date-retention", name: "Priority date retention", does: "When the date is kept, and when an I-485 can move." },
    ],
  },
  {
    id: "line",
    short: "The line",
    title: "Your place in the line",
    lead: "The visa bulletin decides when a priority date can move to a green card. These show who is ahead of yours and how the cutoff has moved.",
    shot: "line",
    url: "permtracker.app/tools/green-card-line",
    caption: "Captured October 21, 2026, for a sample EB-2 India priority date of June 15, 2019.",
    tools: [
      { href: "/tools/green-card-line", name: "Green card line", does: "Everyone ahead of your priority date." },
      { href: "/tools/priority-date-calculator", name: "Priority date calculator", does: "Your date against every bulletin." },
      { href: "/tools/i485-queue-position", name: "I-485 queue position", does: "Adjustment applications pending ahead of you." },
      { href: "/tools/green-card-fees", name: "Green card fees", does: "USCIS's fees for the whole case." },
    ],
  },
  {
    id: "h1b",
    short: "H-1B",
    title: "H-1B time and work permits",
    lead: "A green card case runs alongside the H-1B clock. These count the six years and what a PERM filing keeps open.",
    shot: "h1b",
    url: "permtracker.app/tools/h1b-six-year-limit",
    caption: "Captured October 21, 2026. Sample dates: status from October 1, 2021, and a PERM filed March 2, 2026.",
    tools: [
      { href: "/tools/h1b-six-year-limit", name: "H-1B six-year limit", does: "The end of six years and the 365-day rule." },
      { href: "/tools/h1b-lottery-odds-calculator", name: "H-1B lottery odds", does: "An offer's wage level and its chance in the draw." },
      { href: "/tools/ead-extension", name: "EAD extension", does: "Whether a renewal keeps work authorization." },
    ],
  },
];

/** Every calculator the stage links, for the page's own counts and structured data. */
export const STAGE_TOOL_HREFS = BANDS.flatMap((b) => b.tools.map((t) => t.href));

function ToolLinks({ tools, ink }: { tools: Tool[]; ink: boolean }) {
  const rule = ink ? "border-white/30 dark:border-border" : "border-border";
  return (
    <ul className={cn("mt-6 border-t-2", rule)}>
      {tools.map((t) => (
        <Fragment key={t.href}>
          {" "}
          <li className={cn("border-b-2", rule)}>
            <Link href={t.href} className="group flex min-h-11 items-center gap-3 py-2.5">
              <span className="min-w-0">
                <span className="block text-base font-bold leading-snug group-hover:underline">{t.name}</span>{" "}
                <span className={cn("block text-sm leading-snug", ink ? "text-white/75 dark:text-muted-foreground" : "text-muted-foreground")}>
                  {t.does}
                </span>
              </span>{" "}
              <ArrowRightIcon
                aria-hidden="true"
                weight="bold"
                className={cn("ml-auto size-4 shrink-0", ink ? "text-primary-on-ink dark:text-primary-text" : "text-primary-text")}
              />
            </Link>
          </li>
        </Fragment>
      ))}
    </ul>
  );
}

export function CalculatorTour() {
  return (
    <>
      <noscript>
        <style>{STAGE_BAND_NO_SCRIPT_CSS}</style>
      </noscript>
      <TourStage labels={BANDS.map((b) => b.short)}>
        {BANDS.map((b, i) => {
          const ink = i % 2 === 1;
          const shot = CALCULATOR_SHOTS[b.shot];
          return (
            <StageBand
              key={b.id}
              id={b.id}
              index={i}
              flip={i % 2 === 1}
              ink={ink}
              title={b.title}
              lead={b.lead}
              picture={<AppWindow url={b.url} shots={shot.shots} alt={shot.alt} caption={b.caption} onBand={ink} />}
            >
              <ToolLinks tools={b.tools} ink={ink} />
            </StageBand>
          );
        })}
      </TourStage>
    </>
  );
}
