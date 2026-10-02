import Image from "next/image";
import Link from "next/link";

import { formatMonth } from "@/lib/dolFormat";
import { formatInt } from "@/lib/format";

import { ArrowRight } from "./icons";

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
 * THE PERM STOP SHOWS WHAT YOU GET AT THE END OF IT: the certification
 * approval sits behind the application, and pointing at the stop slides it
 * out with DOL's word on it. Both sheets are visible at rest, so nothing is
 * hover-only.
 *
 * A NATIVE SIDEWAYS STRIP ON A PHONE (scroll-snap, no scroll hijack); a row of
 * six on a wide screen, joined by one route line.
 */

export interface RoadSectionProps {
  /** DOL's PWD backlog, summed across its months. Null hides the line. */
  pwdPending: number | null;
  /** The filing month DOL's analysts are deciding, "YYYY-MM" (a day part is ignored). */
  frontierMonth: string | null;
}

interface Stop {
  n: number;
  name: string;
  who: string;
  /** Tailwind class for the stop's top rule, the stage colour. */
  rule: string;
  img: { src: string; alt: string; w: number; h: number };
  fact: string;
  href: string;
  cta: string;
}

function stops({ pwdPending, frontierMonth }: RoadSectionProps): Stop[] {
  return [
    {
      n: 1,
      name: "Prevailing wage",
      who: "Labor Dept.",
      rule: "border-t-stage-pwd",
      img: {
        src: "/images/road/eta-9141.webp",
        alt: "The first page of Form ETA-9141, Application for Prevailing Wage Determination",
        w: 560,
        h: 449,
      },
      fact: pwdPending ? `${formatInt(pwdPending)} requests waiting` : "How long the wage request takes",
      href: "/tools/pwd-calculator",
      cta: "PWD timeline",
    },
    {
      n: 2,
      name: "PERM",
      who: "Labor Dept.",
      rule: "border-t-stage-eta9089",
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
      cta: "PERM timeline",
    },
    {
      n: 3,
      name: "I-140",
      who: "USCIS",
      rule: "border-t-stage-i140",
      img: {
        src: "/images/road/i-140.webp",
        alt: "The first page of Form I-140, Immigrant Petition for Alien Workers",
        w: 560,
        h: 449,
      },
      fact: "How deep USCIS's queue is",
      href: "/tools/i140-calculator",
      cta: "I-140 timeline",
    },
    {
      n: 4,
      name: "Visa bulletin",
      who: "State Dept.",
      rule: "border-t-stage-recruitment",
      img: {
        src: "/images/road/visa-bulletin-oct-2026.webp",
        alt: "The employment-based final action dates chart from the October 2026 visa bulletin",
        w: 560,
        h: 486,
      },
      fact: "Every bulletin since October 2014",
      href: "/tools/priority-date-calculator",
      cta: "Is my date current?",
    },
    {
      n: 5,
      name: "I-485",
      who: "USCIS",
      rule: "border-t-stage-recruitment",
      img: {
        src: "/images/road/i-485.webp",
        alt: "The first page of Form I-485, Application to Register Permanent Residence or Adjust Status",
        w: 560,
        h: 449,
      },
      fact: "Your place in USCIS's line",
      href: "/tools/i485-queue-position",
      cta: "Queue position",
    },
    {
      n: 6,
      name: "Green card",
      who: "The end of the road",
      rule: "border-t-primary",
      img: {
        src: "/images/road/green-card-specimen.webp",
        alt: "USCIS's specimen permanent resident card, marked SPECIMEN",
        w: 482,
        h: 306,
      },
      fact: "Every stage, drawn to scale",
      href: "/tools/green-card-timeline",
      cta: "Whole timeline",
    },
  ];
}

export function RoadSection(props: RoadSectionProps) {
  return (
    <section
      aria-labelledby="road-heading"
      // No fill: the dotted ground and the particles show
      // through, alternating with the white bands either side.
      className="border-b-3 border-border"
    >
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8 sm:py-20">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2
            id="road-heading"
            className="font-heading text-3xl font-black tracking-tight sm:text-4xl"
          >
            The road to a green card
          </h2>{" "}
          <p className="max-w-md text-base text-foreground/75">
            Six stops, three agencies. Each one has a calculator.
          </p>
        </div>{" "}
        <ol className="road" aria-label="The stages, in order">
          {stops(props).map((s) => (
            <li key={s.n} className="road-stop">
              <Link
                href={s.href}
                aria-label={`${s.name}, ${s.who}: ${s.fact}. Open the ${s.cta.toLowerCase()} tool`}
                className={`road-link border-t-[6px] ${s.rule}`}
              >
                <span className="road-top">
                  <span className="road-num">{s.n}</span>{" "}
                  <span className="road-who">{s.who}</span>
                </span>{" "}
                <span className={s.n === 2 ? "road-paper road-paper-pair" : "road-paper"}>
                  {s.n === 2 ? (
                    <span className="road-approval" aria-hidden="true">
                      <Image
                        src="/images/road/eta-9089-approval.webp"
                        alt=""
                        width={560}
                        height={449}
                        unoptimized
                        loading="lazy"
                      />
                      <span className="road-stamp">Certified</span>
                    </span>
                  ) : null}
                  <Image
                    src={s.img.src}
                    alt={s.img.alt}
                    width={s.img.w}
                    height={s.img.h}
                    unoptimized
                    loading="lazy"
                    className="road-sheet"
                  />
                </span>{" "}
                <span className="road-name">
                  {s.name}{" "}
                  <ArrowRight className="shrink-0" />
                </span>{" "}
                <span className="road-fact">{s.fact}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
