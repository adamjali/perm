import Link from "next/link";

import { ArrowRight } from "./icons";
import {
  WaitLedger,
  type WaitLedgerRow,
  measure,
  shortLabel,
} from "./WaitLedger";

/**
 * The hero.
 *
 * WHAT IT LEADS WITH, AND WHY. A live federal-data product whose hero was two
 * buttons and three trust chips was making a claim it never evidenced. This
 * opens with the one measurement the subject is actually about: how long a
 * PERM case waits, and which way that number is going.
 *
 * WHY NOT THE FRONTIER MONTH. "DOL is deciding cases filed September 2025" is
 * the obvious data lead and it is already the headline of LiveDataBand
 * directly below, drawn as a tape by QueueTape. Repeating it here would put
 * the same fact on the page twice in two hundred pixels. Position and motion
 * are complementary: the band below says where the line IS, the hero says how
 * fast it is MOVING, and only the second half is absent from every rival's
 * marketing copy because DOL does not publish it.
 *
 * A SERVER COMPONENT. The previous version was a client component for a
 * navigation spinner, which also meant the two primary calls to action were
 * `<button onClick>` rather than links: not crawlable, no middle-click, no
 * open-in-new-tab. They are `<Link>`s now, there is no client JavaScript in
 * the hero at all, and the entry motion is CSS keyed off the preloader's own
 * `html[data-pre="off"]` so it plays when the curtain lifts instead of behind
 * it.
 *
 * WHY THE DOORS LIVE IN THE TEXT COLUMN. They used to be a second grid row,
 * and the instrument beside them spanned both rows. Grid sizes a row to fit a
 * spanning item, so the instrument's height became the height of the space
 * between the subcopy and the doors: at 33 monthly rows that was roughly
 * 400px of nothing, with both primary calls to action pushed below the fold
 * on a 900px screen. Text and doors are one flow now, so no third element can
 * size the gap between them however tall it grows.
 *
 * DELIBERATELY ABSENT, all removed from the previous version:
 *   - lucide-react icons (the library is superseded here by Phosphor)
 *   - a browser chrome bar built out of divs around a screenshot, which is
 *     the single most recognisable AI-design tell there is
 *   - a "Scroll" cue with an animated mouse wheel
 *   - "256-bit Encrypted" and "No Credit Card Required" chips: templated, and
 *     the first is an unverifiable security claim sitting directly above data
 *     whose whole value is that it is checkable
 *   - a duplicate dashboard screenshot; HowItWorks already carries the demo
 *     video and three real screenshots
 */

export interface HeroSectionProps {
  /**
   * DOL determination months with the median filing month of the cases
   * decided in each. Empty during a deploy-skew window or a failed fetch, and
   * the hero must still render, so nothing here is a required prop.
   */
  waitRows?: WaitLedgerRow[];
}

export function HeroSection({ waitRows = [] }: HeroSectionProps) {
  const data = measure(waitRows);
  const current = data?.items[data.items.length - 1];
  const peak = data?.items.reduce(
    (worst, i) => (i.wait > worst.wait ? i : worst),
    data.items[0]!,
  );

  return (
    <section
      id="hero"
      className="relative border-b-3 border-border lg:min-h-[calc(100dvh-4rem)]"
    >
      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-1 items-start gap-10 px-4 pb-12 pt-8 [&>*]:min-w-0 sm:px-8 sm:pb-16 sm:pt-12 lg:grid-cols-12 lg:gap-x-12 lg:pb-20 lg:pt-16">
        {/* Dateline. The as-of stamp is the most characteristic artifact in
            this subject's world, so it is set as part of the claim rather
            than hidden in fine print under it. */}
        <div className="flex flex-col lg:col-span-5">
          <p className="font-mono text-[14px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            {current
              ? `DOL determinations through ${shortLabel(current.row.decisionMonth)}`
              : "Live DOL data, automatic deadlines"}
          </p>{" "}
          <h1 className="mt-4 font-heading text-[2rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-5xl lg:text-[3.25rem] xl:text-6xl">
            {current ? (
              <>
                A PERM case takes{" "}
                <span className="inline-block bg-primary px-[0.22em] text-primary-foreground shadow-hard">
                  {current.wait} months
                </span>
              </>
            ) : (
              <>
                The whole PERM process,{" "}
                <span className="inline-block bg-primary px-[0.22em] text-primary-foreground shadow-hard">
                  tracked
                </span>
              </>
            )}
          </h1>{" "}
          <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-foreground/70 sm:text-lg">
            {current && peak && peak.wait > current.wait ? (
              <>
                That&apos;s down from {peak.wait} months at the peak, measured
                across every month DOL has decided since{" "}
                {shortLabel(data.items[0]!.row.decisionMonth)}.
              </>
            ) : (
              <>
                A PERM case runs about a year and one missed date can end it. We
                read DOL&apos;s own published figures and compute every deadline
                in your case automatically. Free.
              </>
            )}
          </p>{" "}
          {/* The two doors, inside the text column on purpose. They used to be a
              second grid row whose height the instrument set; now nothing sits
              between them and the subcopy that can grow. Real links, so a
              crawler and a middle-click both work. */}
          <div className="mt-8 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2 lg:mt-10">
            <Link
              href="/tools"
              className="group flex flex-col border-3 border-border bg-card p-5 shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Waiting on a case
              </span>{" "}
              <span className="mt-2 font-heading text-lg font-black leading-tight">
                See where the queue stands
              </span>{" "}
              <span className="mt-2 text-base leading-relaxed text-foreground/70">
                Live DOL figures and an alert when your filing month comes up.
              </span>{" "}
              <span className="mt-3 inline-flex items-center gap-2 font-bold">
                Open the data{" "}
                <ArrowRight className="transition-transform duration-150 group-hover:translate-x-1" />
              </span>
            </Link>
            <Link
              href="/signup"
              className="group flex flex-col border-3 border-border bg-foreground p-5 text-background shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
            >
              <span className="font-mono text-[14px] font-semibold uppercase tracking-[0.1em] text-background/70">
                Managing cases
              </span>{" "}
              <span className="mt-2 font-heading text-lg font-black leading-tight">
                Track every deadline
              </span>{" "}
              <span className="mt-2 text-base leading-relaxed text-background/80">
                Filing windows, wage expirations and audit responses, computed
                per case.
              </span>{" "}
              <span className="mt-3 inline-flex items-center gap-2 font-bold underline decoration-primary decoration-2 underline-offset-4">
                Start tracking free{" "}
                <ArrowRight className="transition-transform duration-150 group-hover:translate-x-1" />
              </span>
            </Link>
          </div>
        </div>

        {/* The instrument. One grid cell, its own height, beside the column
            above and never sizing anything in it. */}
        <div className="lg:col-span-7">
          {data ? (
            <WaitLedger rows={waitRows} />
          ) : (
            /* Empty state. The deploy-skew window and a failed fetch both land
               here, and it must offer the primary source rather than a blank. */
            <div className="border-3 border-border bg-card p-6 shadow-hard">
              <p className="font-mono text-[14px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Queue history unavailable
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                The determination history couldn’t be read just now. DOL
                publishes the underlying disclosure files itself.
              </p>{" "}
              <a
                href="https://flag.dol.gov/programs/perm"
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 font-bold underline decoration-primary decoration-2 underline-offset-4"
                rel="noopener noreferrer"
                target="_blank"
              >
                DOL PERM program data
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
