import Link from "next/link";
import type { ReactNode } from "react";

import { FacetIndexMini, WindowSpansMini } from "@/components/tools/MiniDiagrams";

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
 * ------------------------------------------------------------------------
 * THE 2026-08-30 REBUILD: FIT, AND A VISUAL LAYER ON THE DOORS
 * ------------------------------------------------------------------------
 *
 * MEASURED BEFORE ANY OF IT. At 390x844 the hero ran 1,894px against 764px of
 * space below the header: it overflowed by 1,130px. At 1440x900 it overflowed
 * by 104px. "It should fit without scrolling" is a measurement, so every
 * decision below is answerable by re-running the same probe rather than by
 * looking at it.
 *
 * THE DATELINE IS A FULL-WIDTH ROW NOW, and that is the alignment fix. It used
 * to sit inside the text column, so the instrument beside it started 20px
 * higher than the headline it belongs to, and the two columns shared no
 * horizontal edge anywhere. Both columns now start on one line. The instrument
 * also lost `ml-auto` and its 600px width cap: it is a grid cell, so its left
 * and right edges are the grid's, which is what makes it look placed rather
 * than floated.
 *
 * THE INSTRUMENT IS DESKTOP-ONLY, and that is a fit decision, not a
 * preference. The ledger is one row per month of determinations plus two
 * display readings and a caption: roughly 520px that grows every time DOL
 * publishes. There is no arrangement in which it, a case-search form and two
 * doors all sit inside 764px on a phone. On a phone the reader's job is to
 * type a case number, so the form and the doors keep the fold and the plate is
 * the first thing met on scroll. Nothing is hidden from a crawler that matters:
 * the same series is in the DOM at every width the plate is drawn at, and the
 * page's own data bands sit directly below at all widths.
 *
 * THE DOORS CARRY A FIGURE. They were a bordered box of text with an arrow,
 * which is the whole of what the site owner objected to. Each is now a plate in
 * four zones - a header rule, a manila figure panel, the claim, and an action
 * row - and the figure is a drawing of that door's actual mechanism from the
 * calculators' own mini-diagram kit, so the hero, the stage strip and the tools
 * read as one drawing system rather than three. `FacetIndexMini` draws a
 * faceted index resolving to one record; `WindowSpansMini` draws the regulatory
 * spans a filing window is computed from. Manila is the same material the
 * instrument is drawn on, which is what ties the three blocks together.
 *
 * BOTH FIGURES SHARE ONE 120x56 VIEWBOX, so two side-by-side panels are
 * exactly the same height without either card being told a pixel value. A card
 * that hardcodes its figure height is a card that goes out of register the
 * first time somebody swaps the drawing.
 *
 * DELIBERATELY ABSENT, all removed from previous versions:
 *   - lucide-react icons (the library is superseded here by Phosphor)
 *   - a browser chrome bar built out of divs around a screenshot, which is
 *     the single most recognisable AI-design tell there is
 *   - a "Scroll" cue with an animated mouse wheel
 *   - "256-bit Encrypted" and "No Credit Card Required" chips: templated, and
 *     the first is an unverifiable security claim sitting directly above data
 *     whose whole value is that it is checkable
 *   - a duplicate dashboard screenshot; HowItWorks already carries the demo
 *     video and three real screenshots
 *   - the form's "Free, no account. The case number is on the filing receipt,
 *     or ask whoever filed for you." tail. Cut on the owner's instruction, and
 *     it is 60px of the fold on a phone.
 */

export interface HeroSectionProps {
  /**
   * DOL determination months with the median filing month of the cases
   * decided in each. Empty during a deploy-skew window or a failed fetch, and
   * the hero must still render, so nothing here is a required prop.
   */
  waitRows?: WaitLedgerRow[];
}

/**
 * One of the two doors: a plate in four zones rather than a box of text.
 *
 * The `ink` tone is a whole surface change, so it restates EVERY colour it
 * overrides - the rules, the body, the eyebrow - because this codebase has
 * shipped invisible text five separate times by setting a background and
 * trusting the rest to inherit. The figure panel is manila in both tones,
 * which is theme-stable, so its drawing is black on tan at every width and in
 * both themes.
 */
function Door({
  eyebrow,
  title,
  body,
  cta,
  href,
  figure,
  ink = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  figure: ReactNode;
  ink?: boolean;
}) {
  const rule = ink ? "border-background/40" : "border-border";
  return (
    <Link
      href={href}
      // The focus ring matches the case input's, deliberately: it lands
      // immediately outside a 3px black border, so the indicator is measured
      // against that border (lime on black, 10:1) rather than against the page
      // ground, where this lime is only 2.0:1. The previous version of these
      // cards had no focus style at all beyond the UA default.
      className={`group flex flex-col border-3 border-border shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-x-0.5 active:translate-y-0.5 ${
        ink ? "bg-foreground text-background" : "bg-card text-foreground"
      }`}
    >
      <span
        className={`border-b-2 px-4 py-1.5 font-mono text-sm font-semibold uppercase tracking-[0.1em] ${rule} ${
          ink ? "text-background/80" : "text-muted-foreground"
        }`}
      >
        {eyebrow}
      </span>{" "}
      {/* The figure panel. Manila is the instrument's own material, so a door
          reads as a page out of the same file rather than as a link with a
          picture on it. Ink text on manila in both themes, which is the only
          sanctioned pairing on that surface.

          The 170px cap is a LEGIBILITY floor, not a taste one: these drawings
          carry 8px mono labels inside a 120-unit viewBox, so below about 130px
          of rendered width the label stops being readable and the figure
          becomes decoration. That is what rules out the shorter
          figure-beside-the-text layout a fit budget keeps asking for. */}
      <span
        className={`flex justify-center border-b-2 bg-manila px-4 py-2 text-black ${rule}`}
      >
        <span className="block w-full max-w-[170px]">{figure}</span>
      </span>{" "}
      <span className="flex flex-1 flex-col px-4 py-2">
        <span className="font-heading text-lg font-black leading-tight">
          {title}
        </span>{" "}
        <span
          className={`mt-1 text-base leading-snug ${
            ink ? "text-background/85" : "text-foreground/70"
          }`}
        >
          {body}
        </span>
      </span>{" "}
      <span
        className={`flex items-center justify-between gap-3 border-t-2 px-4 py-2 font-bold ${rule}`}
      >
        {cta}{" "}
        <ArrowRight className="shrink-0 transition-transform duration-150 group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

export function HeroSection({ waitRows = [] }: HeroSectionProps) {
  const data = measure(waitRows);
  const current = data?.items[data.items.length - 1];
  // `peak` went with the subhead it fed. The peak wait is still drawn - the
  // ledger opposite plots every month, so the high point is visible there as
  // a shape rather than asserted here as a sentence.

  return (
    <section
      id="hero"
      // NEVER h-screen: on iOS the address bar makes 100vh taller than the
      // visible viewport, so the CTAs sit under the browser chrome. The 5rem
      // is the measured distance from the top of the document to the top of
      // this section, so the floor is exactly one screen and no more.
      className="relative border-b-3 border-border lg:min-h-[calc(100dvh-5rem)]"
    >
      {/* pt-8 on a phone and pt-6 on a desktop, which looks backwards and is
          not. The public layout pads `main` by a flat 4.5rem (72px) for the
          fixed header, and at 390px the header's brand lockup wraps to two
          lines and the bar measures 99px. So the first 27px of every public
          page sits under the header on a phone, and the dateline was being
          sliced through its cap-height. 32px of top padding clears it. The
          real fix belongs in the layout, where the padding should track the
          header's measured height rather than a constant; this is the local
          compensation until then. */}
      <div className="relative z-10 mx-auto grid max-w-[1400px] grid-cols-1 items-stretch gap-x-10 gap-y-5 px-4 pb-8 pt-8 [&>*]:min-w-0 sm:px-8 sm:pb-10 sm:pt-7 lg:grid-cols-12 lg:gap-y-6 lg:pb-8 lg:pt-6">
        {/* Dateline. The as-of stamp is the most characteristic artifact in
            this subject's world, so it is set as part of the claim rather
            than hidden in fine print under it. Its own full-width row, so the
            headline and the instrument beside it begin on one line. */}
        <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground lg:col-span-12">
          {current
            ? `DOL determinations through ${shortLabel(current.row.decisionMonth)}`
            : "Live DOL data, automatic deadlines"}
        </p>

        <div className="flex flex-col lg:col-span-7">
          <h1 className="font-heading text-[1.875rem] font-black leading-[1.08] tracking-[-0.03em] sm:text-[2.75rem] lg:text-5xl xl:text-[3.5rem]">
            {/* THE BRAND SITS INSIDE THE H1, not only in the title and the
                prose below.

                Google's site-names doc lists "heading elements" as a source it
                corroborates the declared name against, and this H1 was a pure
                data claim. An earlier pass noticed the same thing and answered
                it by working the name into the lede paragraph instead; that was
                not enough. Measured 2026-08-29: for the query "perm tracker" -
                44,259 impressions over 90 days, our largest by far - Google
                ranks /faq, which carries an "About PERM Tracker" heading, and
                the homepage does not appear at all. The competitor that DOES
                get its name rendered in the SERP has less markup than we do and
                exactly one thing we lacked: its name is its H1.

                Kept visually subordinate so the hook still leads. The stat is
                what earns the scroll; the name is what tells Google, and a
                first-time reader, whose site this is. */}
            <span className="block font-mono text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60 sm:text-sm">
              PERM Tracker
            </span>{" "}
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
          {/* THE SUBHEAD IS GONE, on Adam's call 2026-08-30.
              ("thats down from 17 months.... dols own files, take that whole
              thing out.")

              It was carrying two jobs and doing neither well. As a sentence it
              restated the H1's own number back at the reader, and as an SEO
              device it was the page's insurance policy for the word "PERM
              Tracker" in prominent prose - which is why it is worth being
              explicit that the insurance has not gone with it. The brand still
              sits in the H1 overline, in the title, and now leads the meta
              description. `brand-signals.test.ts` asserts the H1 half, so
              deleting this cannot quietly recreate the state where /faq
              outranked the homepage on the brand query.

              Removing it also buys back ~60px above the fold, which is what
              lets the two action cards below sit higher. The ledger opposite
              stretches to whatever height this column ends at, so the two
              columns stay bottom-aligned without a second measurement. */}
          {/* THE PRIMARY ACTION: check your own case. A plain GET form into
              /perm-case-status?case= - the page's existing, shareable,
              works-without-JS contract - so the hero stays free of client
              JavaScript and a crawler sees an honest form. The answer page
              carries the live federal record, the queue position, the
              stage-aware estimate, and the alert form, in that order. */}
          <form
            action="/perm-case-status"
            method="get"
            className="mt-5 border-3 border-border bg-card p-4 shadow-hard"
          >
            <label
              htmlFor="hero-case"
              className="font-heading text-lg font-black leading-tight"
            >
              Where&apos;s your case? When could it be decided?
            </label>{" "}
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              {/* THE PLACEHOLDER IS THE FORMAT ONLY. Measured against the real
                  input on the live page, "G-100-24339-516453 or an employer
                  name" renders 365px wide while the usable space inside this
                  input is 212px at 320, 267 at 375, 282 at 390 and 322 at 430 -
                  clipped on EVERY phone, not just small ones. A placeholder
                  shows the shape of the input; the hint line below carries the
                  fact that a name works, and it wraps instead of clipping.
                  `hero-placeholder.test.ts` holds the cap. */}
              {/* autoCapitalize "none", not "characters": the field now takes
                  an employer name as well, and forcing MICROSOFT CORPORATION
                  on a phone reads as shouting. A case number is upper-cased by
                  `normaliseCaseNumber` on the answer page anyway. */}
              <input
                id="hero-case"
                name="case"
                type="text"
                required
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="G-100-24339-516453"
                aria-describedby="hero-case-hint"
                className="mono min-h-[48px] w-full min-w-0 flex-1 border-3 border-border bg-background px-4 text-base placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />{" "}
              <button
                type="submit"
                className="inline-flex min-h-[48px] items-center justify-center gap-2 border-3 border-border bg-primary px-6 font-heading font-black text-primary-foreground shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
              >
                Check my case
              </button>
            </div>{" "}
            <p id="hero-case-hint" className="mt-2 text-sm text-foreground/70">
              PERM (G-), wage request (P-) or LCA (I-) number. No number? An
              employer name works too.
            </p>{" "}
            {/* NO HELP LINE. It read "Live DOL status, your place in the
                queue, and an estimate. Free, no account. The case number is on
                the filing receipt, or ask whoever filed for you." The tail was
                cut on instruction; the head went with it because it restated
                the label directly above it, and it is 35px of the desktop fold
                and 58px of the phone's. The label asks the two questions the
                answer page answers, and the placeholder shows the format, so
                nothing the sentence carried is now unsaid. */}
            {/* The second funnel, at button weight. "Processing time" is the
                phrase people actually search (Bing: 6.7K impressions against
                zero for "predictor"), so the control says it verbatim. */}
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t-2 border-border pt-3">
              <span className="text-sm font-bold">No case number?</span>{" "}
              <Link
                href="/tools/perm-timeline-calculator"
                className="inline-flex min-h-[44px] items-center gap-2 border-2 border-border bg-background px-4 font-heading font-black shadow-hard-sm transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
              >
                PERM processing time calculator{" "}
                <ArrowRight className="shrink-0" />
              </Link>
            </p>
          </form>{" "}
          {/* The two doors, secondary to the form above. Real links, so a
              crawler and a middle-click both work. */}
          <div className="mt-5 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2">
            <Door
              eyebrow="Case updates"
              title="Search every PERM case"
              // "state", not "country". DOL's disclosure files carry the
              // worksite state and not the beneficiary's nationality, and the
              // case search indexes employer, occupation, state and law firm.
              // Country is a real axis on this site, but it belongs to the
              // visa bulletin's cutoffs, not to the case corpus this door
              // opens, so claiming it here would be a claim the page cannot
              // answer.
              // ORDERED TO MATCH THE DATA BAND BELOW, which runs state,
              // wages, employers, law firms. Two lists of the same four axes
              // in two different orders is a reader re-reading to check they
              // are the same four, and they are. "Specialty" is the wages
              // page's axis (it is organised by occupation), so the words
              // differ where the page's own vocabulary differs and the
              // sequence does not.
              body="By state, specialty, employer and law firm"
              cta="For foreign workers and employers"
              href="/perm-cases"
              figure={<FacetIndexMini />}
            />
            <Door
              ink
              eyebrow="Managing cases"
              title="Track every deadline"
              body="Filing windows, wage expirations and audit responses, computed per case"
              cta="For attorneys and firms"
              href="/for-attorneys"
              figure={<WindowSpansMini />}
            />
          </div>
        </div>

        {/* The instrument. Its own grid cell, at its own height, beside the
            column above and never sizing anything in it.

            `hidden lg:block`: below `lg` the plate plus the form plus the two
            doors cannot fit one screen at any type scale, and the fold belongs
            to the form there. See the rebuild note at the top of the file. */}
        {/* BOTH COLUMNS END ON THE SAME LINE. The grid stretches (items-stretch
            above) and this cell and the plate inside it both take the full row
            height, so the ledger's bottom edge meets the bottom of the two
            doors rather than floating 65px above them. Previously the grid was
            items-start and the plate was only as tall as its own content, which
            is what made the right side look unfinished. */}
        <div className="hidden lg:col-span-5 lg:flex lg:flex-col">
          {data ? (
            <WaitLedger rows={waitRows} className="h-full" />
          ) : (
            /* Empty state. The deploy-skew window and a failed fetch both land
               here, and it must offer the primary source rather than a blank. */
            <div className="border-3 border-border bg-card p-6 shadow-hard">
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Queue history unavailable
              </p>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/70">
                The determination history couldn’t be read just now. DOL
                publishes the disclosure files itself.
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
