import { Fragment } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "@phosphor-icons/react/ssr";

import { AppWindow } from "@/components/marketing/AppWindow";
import { StageBand } from "@/components/scroll/StageBand";
import { DATA_SHOTS, type DataShot } from "@/components/tools/dataShots";
import { GROUPS, SECTIONS, type DataGroup } from "@/lib/siteMap";
import { cn } from "@/lib/utils";

/**
 * The data overview's six groups as bands, one after another: each lists the group's pages straight from the site
 * map (the same list the Data menu and the data rail draw, so the three can't drift) beside a dated capture of the
 * group's main page.
 */

const CAPTURED = "October 21, 2026";

const BANDS: Record<DataGroup, { lead: string; shot: DataShot; url: string }> = {
  Cases: {
    lead: "Every case DOL has published and every case still waiting, for PERM, wage requests, H-1B LCAs and the seasonal visas.",
    shot: "cases",
    url: "permtracker.app/perm-cases",
  },
  "Wait times": {
    lead: "Where DOL's queue stands, how fast it moves, and how long each agency takes, from their own published figures.",
    shot: "wait",
    url: "permtracker.app/perm-processing-times",
  },
  "Employers and firms": {
    lead: "Every sponsor and law firm in DOL's files, with its record, its cases waiting now, and any layoff notice or debarment.",
    shot: "employers",
    url: "permtracker.app/perm-employers/google-llc",
  },
  Wages: {
    lead: "What certified jobs pay, DOL's four wage levels, and where an offer sits among them.",
    shot: "wages",
    url: "permtracker.app/tools/salary-explorer",
  },
  "Green card line": {
    lead: "The visa bulletin since 2005, who is ahead of a priority date, and the visas the State Department issues.",
    shot: "line",
    url: "permtracker.app/visa-bulletin",
  },
  "Approvals and denials": {
    lead: "What gets denied, audited or sent an RFI, and how the record looks by state, city, industry and citizenship.",
    shot: "denials",
    url: "permtracker.app/perm-denial-risk",
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
            picture={<AppWindow url={band.url} shots={shot.shots} alt={shot.alt} caption={`Captured ${CAPTURED}.`} onBand={ink} />}
          >
            <PageLinks group={g} ink={ink} />
          </StageBand>
        );
      })}
    </div>
  );
}
