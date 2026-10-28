import { Fragment } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { AppWindow } from "@/components/marketing/AppWindow";
import { StageBand } from "@/components/scroll/StageBand";
import { DATA_SHOTS, type DataShot } from "@/components/tools/dataShots";
import { GROUPS, SECTIONS, type DataGroup } from "@/lib/siteMap";
import { cn } from "@/lib/utils";
import { longDate } from "@convex/lib/months";

/**
 * The data overview's groups as bands, one after another: each lists the group's pages straight from the site
 * map (the same list the Data menu and the data rail draw, so the three can't drift) beside a dated capture of the
 * group's main page.
 */

const BANDS: Record<DataGroup, { lead: string; shot: DataShot; url: string }> = {
  "Your case": {
    lead: "Look a case up by its number, or find it by the employer's name, for PERM, wage requests, H-1B LCAs and the seasonal visas, and plan every step to the green card.",
    shot: "cases",
    url: "permtracker.app/perm-cases",
  },
  "Wage request": {
    lead: "Every wage request DOL holds, the month it's deciding now, and DOL's four wage levels for a job and a place.",
    shot: "pwd",
    url: "permtracker.app/pwd-cases",
  },
  Recruitment: {
    lead: "Where employers advertise and how long before filing they start, from DOL's own record of each case, and every deadline for your dates.",
    shot: "recruitment",
    url: "permtracker.app/perm-recruitment",
  },
  PERM: {
    lead: "Where DOL's queue stands, how fast it moves, what gets denied or audited, and the record by state, city, industry and citizenship.",
    shot: "wait",
    url: "permtracker.app/perm-processing-times",
  },
  "I-140": {
    lead: "How long USCIS takes, how many petitions are approved and waiting on a visa number, and how often USCIS asks for more evidence.",
    shot: "i140",
    url: "permtracker.app/uscis-processing-times",
  },
  "Green card line": {
    lead: "The visa bulletin since 2005, who is ahead of a priority date, the I-485 by office, and the visas the State Department issues.",
    shot: "line",
    url: "permtracker.app/visa-bulletin",
  },
  "Employers and firms": {
    lead: "Every sponsor and law firm in DOL's files, with its record, its cases waiting now, and any layoff notice or debarment.",
    shot: "employers",
    url: "permtracker.app/perm-employers/google-llc",
  },
  Breakdowns: {
    lead: "The PERM record by worksite state, city, industry and the worker's citizenship.",
    shot: "places",
    url: "permtracker.app/perm-by-state",
  },
  Wages: {
    lead: "What certified jobs pay, and where an offer sits among them.",
    shot: "wages",
    url: "permtracker.app/tools/salary-explorer",
  },
  "Other visas": {
    lead: "H-1B LCAs and the lottery, and the seasonal H-2A, H-2B and CW-1 programs, from the same DOL counter.",
    shot: "visas",
    url: "permtracker.app/lca-cases",
  },
};

function PageLinks({ group, ink }: { group: DataGroup; ink: boolean }) {
  const rule = ink ? "border-white/30 dark:border-border" : "border-border";
  const pages = SECTIONS.filter((s) => s.group === group);
  return (
    <ul className={cn("mt-6 grid grid-cols-1 border-t-2 sm:grid-cols-2 sm:gap-x-6", rule)}>
      {pages.map((p) => (
        <Fragment key={p.href}>
          {" "}
          <li className={cn("border-b-2", rule)}>
            <Link href={p.href} className="group flex min-h-11 items-center gap-2 py-2 text-base font-bold leading-snug">
              <span className="min-w-0 group-hover:underline">{p.name}</span>{" "}
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

export function DataTour() {
  return (
    <div>
      {GROUPS.map((g, i) => {
        const band = BANDS[g];
        const ink = i % 2 === 1;
        const shot = DATA_SHOTS[band.shot];
        return (
          <StageBand
            measure="max-w-7xl px-4 sm:px-6"
            key={g}
            id={`data-${band.shot}`}
            index={i}
            flip={i % 2 === 1}
            ink={ink}
            title={g}
            lead={band.lead}
            picture={<AppWindow url={band.url} shots={shot.shots} alt={shot.alt} caption={shot.captured ? `Captured ${longDate(shot.captured)}.` : null} onBand={ink} />}
          >
            <PageLinks group={g} ink={ink} />
          </StageBand>
        );
      })}
    </div>
  );
}
