import { Fragment } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { AppWindow } from "@/components/marketing/AppWindow";
import { StageBand } from "@/components/scroll/StageBand";
import type { WindowShots } from "@/components/marketing/AppWindow";
import { CALCULATOR_SHOTS } from "@/components/tools/calculatorShots";
import { DATA_SHOTS } from "@/components/tools/dataShots";
import { GROUPS, SECTIONS, type DataGroup, type DataNavSection } from "@/lib/siteMap";
import { cn } from "@/lib/utils";

/**
 * The calculators page as bands in the order a case moves, one after another as the reader scrolls (the attorney
 * page's pinned sideways stage stays that page's alone: owner, Oct 21 2026). Each band is one step of the Data
 * menu, its calculators read from the site map (the same list the menu, the rail and /today draw, so none can
 * drift), beside one of them answered, captured from the site itself with sample inputs.
 */

interface BandLook {
  lead: string;
  picture: { shots: WindowShots; alt: string };
  url: string;
  caption: string;
}

/**
 * How each step's band looks. A step with calculators and no look here fails the page's build (it renders statically),
 * and `calculator-tour.test.ts` fails first.
 */
export const LOOK: Partial<Record<DataGroup, BandLook>> = {
  "Your case": {
    lead: "Where your case is and its dates in, every step to the green card out, with the fees, and which category fits.",
    picture: CALCULATOR_SHOTS.plan,
    url: "permtracker.app/tools/green-card-timeline",
    caption: "Captured October 28, 2026, for a sample PERM filed January 15, 2026.",
  },
  "Wage request": {
    lead: "Before recruitment, DOL sets the wage the job must pay. These count the queue for it and read the levels.",
    picture: CALCULATOR_SHOTS.pwd,
    url: "permtracker.app/tools/pwd-calculator",
    caption: "Captured October 21, 2026, for the newest month DOL has received.",
  },
  Recruitment: {
    lead: "Enter the determination date and the recruitment dates. Every deadline under 20 CFR 656 is worked out and drawn to scale.",
    picture: CALCULATOR_SHOTS.deadlines,
    url: "permtracker.app/tools/perm-deadline-calculator",
    caption: "Captured October 21, 2026. Sample dates: a determination on August 3, 2026 and recruitment from August 23 to September 20.",
  },
  PERM: {
    lead: "Once the ETA 9089 is filed, DOL works its queue in order. These say when it's likely to reach yours.",
    picture: CALCULATOR_SHOTS.decision,
    url: "permtracker.app/tools/perm-timeline-calculator",
    caption: "Captured October 21, 2026, for a sample case DOL received on January 15, 2026.",
  },
  "I-140": {
    lead: "After certification the employer has 180 days to file with USCIS. These cover its queue and what keeps the priority date.",
    picture: CALCULATOR_SHOTS.i140,
    url: "permtracker.app/tools/i140-calculator",
    caption: "Captured October 21, 2026, from USCIS's own quarterly counts.",
  },
  "Green card line": {
    lead: "The visa bulletin decides when a priority date can move to a green card. These show who is ahead of yours and how the cutoff has moved.",
    picture: CALCULATOR_SHOTS.line,
    url: "permtracker.app/tools/green-card-line",
    caption: "Captured October 21, 2026, for a sample EB-2 India priority date of June 15, 2019.",
  },
  Wages: {
    lead: "What certified jobs pay, and where an offer sits among them.",
    picture: DATA_SHOTS.wages,
    url: "permtracker.app/tools/salary-explorer",
    caption: "Captured October 21, 2026.",
  },
  "Students and OPT": {
    lead: "An F-1 student's status between OPT and the H-1B, and the unemployment days OPT allows, each from its regulation.",
    picture: CALCULATOR_SHOTS.capgap,
    url: "permtracker.app/tools/cap-gap-calculator",
    caption: "Captured October 31, 2026. Sample dates: OPT ending June 10, 2026, an H-1B start of October 1, filed April 1.",
  },
  "Other visas": {
    lead: "A green card case runs alongside the H-1B clock. These count the six years and an offer's chance in the lottery.",
    picture: CALCULATOR_SHOTS.h1b,
    url: "permtracker.app/tools/h1b-six-year-limit",
    caption: "Captured October 21, 2026. Sample dates: status from October 1, 2021, and a PERM filed March 2, 2026.",
  },
};

/** Every step that has calculators, in the menu's order, with its calculators. */
export const TOOL_BANDS = GROUPS.map((group) => ({ group, tools: SECTIONS.filter((x) => x.group === group && x.tool) })).filter(
  (b) => b.tools.length > 0,
);

function ToolLinks({ tools, ink }: { tools: readonly DataNavSection[]; ink: boolean }) {
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
    <div>
      {TOOL_BANDS.map((b, i) => {
        const look = LOOK[b.group];
        if (!look) throw new Error(`CalculatorTour: the "${b.group}" step has calculators and no band look`);
        const ink = i % 2 === 1;
        return (
          <StageBand
            measure="max-w-7xl px-4 sm:px-6"
            key={b.group}
            id={b.group.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
            index={i}
            flip={i % 2 === 1}
            ink={ink}
            title={b.group}
            lead={look.lead}
            picture={<AppWindow url={look.url} shots={look.picture.shots} alt={look.picture.alt} caption={look.caption} onBand={ink} />}
          >
            <ToolLinks tools={b.tools} ink={ink} />
          </StageBand>
        );
      })}
    </div>
  );
}
