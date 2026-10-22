import { Fragment } from "react";

import { AppWindow, type WindowShots } from "@/components/marketing/AppWindow";
import { StageBand } from "@/components/scroll/StageBand";
import { cn } from "@/lib/utils";

/**
 * The extension's three answers as bands, one after another: a sponsor on file, a possible match, no record. Each
 * picture is the extension's own panel drawn over an example posting (extension/store/build.mjs, from the live
 * site), and the words say what each line of the panel means.
 */

const PANEL_DATE = "October 21, 2026";

function shot(name: string): WindowShots {
  const one = { src: `/images/extension/${name}.webp`, width: 1280, height: 800 };
  // One picture in both themes: it's a posting on a job site, which keeps its own colours.
  return { light: one, dark: one };
}

interface Band {
  id: string;
  title: string;
  lead: string;
  facts: Array<[string, string]>;
  shots: WindowShots;
  alt: string;
}

const BANDS: Band[] = [
  {
    id: "on-file",
    title: "A sponsor on file",
    lead: "Open a posting and the panel names the employer as DOL's files print it, with what it has filed.",
    facts: [
      ["PERM cases published", "Green card labor certifications in DOL's quarterly files: decided cases only."],
      ["Certified", "The share DOL certified, once there are 30 or more decided."],
      ["Waiting at DOL now", "Its cases still open in DOL's live case status, checked every day."],
      ["H-1B applications", "Labor condition applications: the first step of an H-1B, not the visa itself."],
    ],
    shots: shot("record"),
    alt: "The extension's panel over an example posting for a software engineer at Microsoft Corporation: 6,875 PERM cases published, 99% certified, 598 waiting at DOL, the newest PERM filing on September 16, 2026, and 58,652 H-1B applications.",
  },
  {
    id: "possible-match",
    title: "A possible match",
    lead: "A brand like Amazon files under several legal names. The panel picks the busiest employer whose name starts with the posting's, and names it.",
    facts: [
      ["The name it chose", "Shown at the top, with a note to check it's the same company."],
      ["The figures", "That employer's own record, never a sum of every name that looks alike."],
    ],
    shots: shot("possible-match"),
    alt: "The extension's panel over an example posting naming Amazon: a possible match, Amazon.com Services LLC, with 2,271 PERM cases published, 99.6% certified, 525 waiting at DOL and 94,258 H-1B applications.",
  },
  {
    id: "no-record",
    title: "No record under that name",
    lead: "Nothing in DOL's files under the name on the posting. Companies often file under their legal name, so it may still sponsor under another.",
    facts: [
      ["What it doesn't say", "That the company won't sponsor. A missing record is only a missing name."],
      ["Where to look next", "A link to search this site for the legal name."],
    ],
    shots: shot("no-record"),
    alt: "The extension's panel over an example posting for a robotics engineer at Acme Robotics Studio: no PERM or H-1B record under this name, with a link to search PERM Tracker.",
  },
];

function Facts({ facts, ink }: { facts: Array<[string, string]>; ink: boolean }) {
  const rule = ink ? "border-white/30 dark:border-border" : "border-border";
  return (
    <dl className={cn("mt-6 border-t-2", rule)}>
      {facts.map(([term, meaning]) => (
        <Fragment key={term}>
          {" "}
          <div className={cn("border-b-2 py-3", rule)}>
            <dt className="text-base font-bold leading-snug">{term}</dt>{" "}
            <dd className={cn("mt-0.5 text-base leading-snug", ink ? "text-white/80 dark:text-soft" : "text-soft")}>{meaning}</dd>
          </div>
        </Fragment>
      ))}
    </dl>
  );
}

export function ExtensionTour() {
  return (
    <div>
      {BANDS.map((b, i) => {
        const ink = i % 2 === 1;
        return (
          <StageBand
            key={b.id}
            id={b.id}
            index={i}
            flip={i % 2 === 1}
            ink={ink}
            title={b.title}
            lead={b.lead}
            bleed={false}
            picture={
              <AppWindow
                url="Example job posting"
                shots={b.shots}
                alt={b.alt}
                caption={`An example posting. The panel and its figures are the extension's own, from DOL's files on ${PANEL_DATE}.`}
                onBand={ink}
              />
            }
          >
            <Facts facts={b.facts} ink={ink} />
          </StageBand>
        );
      })}
    </div>
  );
}
