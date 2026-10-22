import { formatMonth } from "@/lib/dolFormat";
import { formatInt } from "@/lib/format";

import { RoadStage, type RoadStop } from "./RoadStage";

/**
 * The road to a green card, drawn with each stop's real paperwork.
 *
 * REPLACES TWO SECTIONS THAT SAID ONE THING. "The whole road" (five stage
 * cards) and "Four stages, four questions" (four calculator cards) walked the
 * same stages twice, back to back, in two card kits. One road now carries
 * both: each stop is the stage AND its calculator.
 *
 * THINGS LOOK LIKE THINGS. Every stop shows the document that stage is
 * actually about, taken from the agency that publishes it, never drawn:
 *   - Form ETA-9141, the PDF copy DOL's FLAG site hosts
 *     (flag.dol.gov/sites/default/files/2019-09/ETA_Form_9141.pdf)
 *   - Form ETA-9089 and its Final Determination, "Permanent Employment
 *     Certification Approval", from DOL's forms page (both expire 02/28/2029)
 *   - Forms I-140 and I-485 from uscis.gov
 *   - the October 2026 visa bulletin's employment chart, from the State
 *     Department's own page (adoption.state.gov)
 *   - USCIS's specimen permanent resident card, from uscis.gov
 * Federal documents, so no licence question (17 U.S.C. 105). Each is shown
 * as the top of its first page, lossless WebP in 16 grays, 16 to 30 KB.
 *
 * Each document sits flat in a 2px frame, as a screenshot does. On a phone the
 * stops are a list, the document small beside its name; from 1024px a row of
 * six under reduced motion, and otherwise a scroll stage (RoadStage): the stops
 * down the left, the stop being read in lime, its document large on the right.
 */

export interface RoadSectionProps {
  /** DOL's PWD backlog, summed across its months. Null hides the line. */
  pwdPending: number | null;
  /** The filing month DOL's analysts are deciding, "YYYY-MM" (a day part is ignored). */
  frontierMonth: string | null;
}


function stops({ pwdPending, frontierMonth }: RoadSectionProps): RoadStop[] {
  return [
    {
      n: 1,
      name: "Prevailing wage",
      who: "Labor Dept.",
      dot: "bg-stage-pwd",
      img: {
        src: "/images/road/eta-9141.webp",
        alt: "The first page of Form ETA-9141, Application for Prevailing Wage Determination",
        w: 560,
        h: 449,
      },
      fact: pwdPending ? `${formatInt(pwdPending)} requests waiting` : "How long the wage request takes",
      href: "/tools/pwd-calculator",
      doc: "Form ETA-9141, from DOL's FLAG site",
      cta: "PWD timeline",
    },
    {
      n: 2,
      name: "PERM",
      who: "Labor Dept.",
      dot: "bg-stage-eta9089",
      img: {
        src: "/images/road/eta-9089.webp",
        alt: "The first page of Form ETA-9089, Application for Permanent Employment Certification",
        w: 560,
        h: 449,
      },
      fact: frontierMonth && formatMonth(frontierMonth.slice(0, 7))
        ? `Deciding ${formatMonth(frontierMonth.slice(0, 7))} filings`
        : "When DOL decides",
      href: "/tools/perm-timeline-calculator",
      doc: "Form ETA-9089, from DOL's forms page",
      cta: "PERM timeline",
    },
    {
      n: 3,
      name: "I-140",
      who: "USCIS",
      dot: "bg-stage-i140",
      img: {
        src: "/images/road/i-140.webp",
        alt: "The first page of Form I-140, Immigrant Petition for Alien Workers",
        w: 560,
        h: 449,
      },
      fact: "How deep USCIS's queue is",
      href: "/tools/i140-calculator",
      doc: "Form I-140, from USCIS",
      cta: "I-140 timeline",
    },
    {
      n: 4,
      name: "Visa bulletin",
      who: "State Dept.",
      dot: "bg-stage-recruitment",
      img: {
        src: "/images/road/visa-bulletin-oct-2026.webp",
        alt: "The employment-based final action dates chart from the October 2026 visa bulletin",
        w: 560,
        h: 486,
      },
      fact: "Every bulletin since October 2014",
      href: "/tools/priority-date-calculator",
      doc: "The October 2026 visa bulletin, from the State Department",
      cta: "Is my date current?",
    },
    {
      n: 5,
      name: "I-485",
      who: "USCIS",
      dot: "bg-stage-recruitment",
      img: {
        src: "/images/road/i-485.webp",
        alt: "The first page of Form I-485, Application to Register Permanent Residence or Adjust Status",
        w: 560,
        h: 449,
      },
      fact: "Your place in USCIS's line",
      href: "/tools/i485-queue-position",
      doc: "Form I-485, from USCIS",
      cta: "Queue position",
    },
    {
      n: 6,
      name: "Green card",
      who: "The end of the road",
      dot: "bg-primary-text",
      img: {
        src: "/images/road/green-card-specimen.webp",
        alt: "USCIS's specimen permanent resident card, marked SPECIMEN",
        w: 482,
        h: 306,
      },
      contain: true,
      fact: "Every stage, drawn to scale",
      href: "/tools/green-card-timeline",
      doc: "USCIS's specimen green card",
      cta: "Whole timeline",
    },
  ];
}

export function RoadSection(props: RoadSectionProps) {
  return <RoadStage stops={stops(props)} />;
}
