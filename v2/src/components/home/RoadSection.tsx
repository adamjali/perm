import Image from "next/image";
import Link from "next/link";

import { formatMonth } from "@/lib/dolFormat";
import { formatInt } from "@/lib/format";

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
 * Each document sits flat in a 1px frame, as a screenshot does. On a phone the
 * stops are a list, the document small beside its name; from 1024px a row of
 * six.
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
  /** The stage's colour, as a dot beside its number. */
  dot: string;
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
      dot: "bg-stage-pwd",
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
      fact: "Every stage, drawn to scale",
      href: "/tools/green-card-timeline",
      cta: "Whole timeline",
    },
  ];
}

export function RoadSection(props: RoadSectionProps) {
  return (
    <section aria-labelledby="road-heading" className="border-b border-border">
      <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-8 sm:py-20">
        <h2 id="road-heading" className="font-heading text-2xl font-bold sm:text-3xl">
          The road to a green card
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-soft">Six stops, three agencies. Each one has a calculator.</p>{" "}
        <ol aria-label="The stages, in order" className="mt-8 grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-6 lg:gap-y-8">
          {stops(props).map((s) => (
            <li key={s.n}>
              <Link
                href={s.href}
                aria-label={`${s.name}, ${s.who}: ${s.fact}. Open the ${s.cta.toLowerCase()} tool`}
                className="group grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-4 py-2 lg:grid-cols-1 lg:items-start lg:gap-3"
              >
                <span className="block overflow-hidden border border-border bg-card lg:order-2">
                  <Image
                    src={s.img.src}
                    alt={s.img.alt}
                    width={s.img.w}
                    height={s.img.h}
                    unoptimized
                    loading="lazy"
                    className="block h-auto w-full"
                  />
                </span>{" "}
                <span className="min-w-0 lg:order-1">
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span aria-hidden="true" className={`size-2.5 shrink-0 ${s.dot}`} />
                    {s.n} · {s.who}
                  </span>{" "}
                  <span className="mt-1 block font-heading text-lg font-bold group-hover:underline">{s.name}</span>{" "}
                  <span className="mt-0.5 block text-sm leading-snug text-soft">{s.fact}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
