import { Warning } from "@phosphor-icons/react/ssr";

/**
 * Why one month in the backlog is a twelfth the size of its neighbours.
 *
 * THIS NOTE EXISTS BECAUSE THE NUMBER ON ITS OWN IS MISLEADING. A reader
 * scanning the wall sees a short bar between two of the tallest ones and has
 * exactly two ways to read it: either very few people filed that month, or
 * this site lost the data. One of those is true, the other would be our fault
 * to fix rather than to publish, and the row cannot say which.
 *
 * WHAT IS ASSERTED HERE AND WHAT IS NOT. The stoppage is stated, because it
 * is measured in two sources that do not share a pipeline and DOL itself
 * published that processing had resumed. The CAUSE is not stated, because no
 * primary source we can find gives one. A plausible wrong explanation is
 * worse than none: a reader repeats it, and it arrives somewhere else with
 * this site's name on it.
 *
 * EVERY FIGURE BELOW IS A LITERAL AND THAT IS DELIBERATE. They are counts of
 * a closed month taken from a fixed disclosure window, so they do not move,
 * and a sentence built around a live query would quietly restate itself the
 * first time that query changed. `OctoberNote.test.tsx` pins each one and
 * carries the SQL it came from, so changing a number here is a deliberate act
 * with a way to check it rather than a typo nobody can catch.
 */

/** The month this note is about, and where it sits in the document. */
export const OCTOBER_2025 = {
  month: "2025-10",
  anchorId: "october-2025",
} as const;

/**
 * DOL's own announcement, which is the only primary source on the stoppage.
 *
 * Dated the same day the filing count recovers, which is the strongest single
 * piece of evidence here: DOL published "resumed" on the exact date the data
 * turns.
 */
const DOL_NOTICE_URL = "https://flag.dol.gov/announcement/2025-10-31";

export function OctoberNote() {
  return (
    <section
      id={OCTOBER_2025.anchorId}
      className="scroll-mt-32 border-2 border-data-warn bg-data-warn/8 p-6 sm:p-8"
      aria-labelledby="october-2025-heading"
    >
      <h2
        id="october-2025-heading"
        className="flex items-start gap-2 font-heading text-xl font-black sm:text-2xl"
      >
        <Warning
          className="mt-1 h-5 w-5 shrink-0 text-data-warn-ink"
          weight="fill"
          aria-hidden="true"
        />{" "}
        <span>October 2025 is not a gap in this data</span>
      </h2>{" "}

      <p className="mt-4 text-base leading-relaxed text-foreground/80">
        1,616 applications carry an October 2025 filing date, against 13,629 in
        September and 15,034 in November. That is a real event at DOL rather
        than a hole in the scan, and it shows up in two sources that don&rsquo;t
        share a pipeline.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        In the per-case scan, filings run at roughly 600 a working day through
        September, fall to single figures on 2 October, and stay there until 30
        October. In DOL&rsquo;s quarterly disclosure files, which are a
        separate publication built from separate records, DOL issued{" "}
        <b className="font-bold">21 PERM determinations in the whole of October
        2025</b>, against 14,239 in September and 8,890 in November. Nineteen
        of those 21 landed on 31 October.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        DOL published a notice on 31 October 2025 saying its Office of Foreign
        Labor Certification &ldquo;has resumed application processing&rdquo;
        and that the FLAG filing system &ldquo;is now accessible and permits
        system users to prepare and submit new applications&rdquo;. That is the
        same day the filing count recovers.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        The notice doesn&rsquo;t say what stopped processing, and no other
        primary source we&rsquo;ve found does either, so the cause isn&rsquo;t
        established here.
      </p>{" "}

      <p className="mt-4 text-base leading-relaxed text-foreground/80">
        <a
          href={DOL_NOTICE_URL}
          className="font-bold underline underline-offset-2 hover:text-primary"
          rel="noopener"
        >
          Read DOL&rsquo;s announcement of 31 October 2025
        </a>
      </p>
    </section>
  );
}
