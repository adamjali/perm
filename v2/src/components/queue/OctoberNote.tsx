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
 * THE CAUSE IS NOW SOURCED, AND IT WAS NOT WHEN THIS SHIPPED. The first
 * version stated the stoppage and refused to name a cause, because DOL's
 * resumption notice does not give one. DOL published the cause on a different
 * host eleven days later, in an announcement that never reached flag.dol.gov
 * at all. Everything asserted below is a quotation from that announcement or
 * a count from our own data; nothing is inferred.
 *
 * WHAT IS STILL NOT SOURCED AND STAYS OUT. When the appropriations lapse
 * ITSELF ended. DOL's announcement gives the dates OFLC was down and the date
 * its staff came back, and nothing about the lapse's own end. So the note
 * never says processing resumed "when the shutdown ended", which would be a
 * claim about a date we have not read anywhere.
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
 * DOL's resumption notice, on OFLC's own filing portal.
 *
 * Dated the same day the filing count recovers, which is the strongest single
 * piece of corroboration here: DOL published "resumed" on the exact date the
 * data turns.
 */
const FLAG_NOTICE_URL = "https://flag.dol.gov/announcement/2025-10-31";

/**
 * The announcement that gives the cause, read through the Internet Archive.
 *
 * `www.dol.gov` refuses automated clients, so the live URL cannot be verified
 * from here and may behave differently in a reader's browser. The archived
 * capture is what was actually read, so that is what is linked, and the page
 * says which. The live address is printed beside it rather than linked, so a
 * reader can go to DOL directly and knows they are not being sent to an
 * archive by sleight of hand.
 */
const ARCHIVED_NOTICE_URL =
  "https://web.archive.org/web/20251113005349/https://www.dol.gov/agencies/eta/foreign-labor/news";
const LIVE_NOTICE_URL = "www.dol.gov/agencies/eta/foreign-labor/news";

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
        <span>October 2025: DOL shut the filing system</span>
      </h2>{" "}

      <p className="mt-4 text-base leading-relaxed text-foreground/80">
        1,616 applications carry an October 2025 filing date, against 13,629 in
        September and 15,034 in November. That&rsquo;s a real event at DOL
        rather than a hole in the scan, and DOL has published what caused it.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        In an announcement dated 5 November 2025, DOL wrote that{" "}
        <b className="font-bold">
          &ldquo;due to the government shutdown, beginning October 1, OFLC
          ceased all application processing activities and suspended public
          access to its Foreign Labor Application Gateway (FLAG) system&rdquo;
        </b>
        , so employers &ldquo;were unable to prepare and submit requests for
        prevailing wage determinations or labor certifications using the FLAG
        system&hellip; between October 1, 2025, through October 31, 2025&rdquo;.
        DOL extended affected response deadlines by 33 calendar days, which it
        describes as the span during which staff, &ldquo;officially recalled
        back to work on November 3&rdquo;, could not accept or process
        applications.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        Our own counts land on DOL&rsquo;s dates without being fitted to them.
        The last ordinary day of determinations is 30 September; there are two
        in the 30 days that follow; the filing system reopens on 31 October,
        the day DOL announced the resumption; and ordinary volume returns on 3
        November, the day DOL says staff came back.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        The collapse also appears in{" "}
        <b className="font-bold">DOL&rsquo;s own quarterly disclosure release</b>
        , which is first-party and built from separate records: DOL issued{" "}
        <b className="font-bold">21 PERM determinations in the whole of October
        2025</b>, against 14,239 in September and 8,890 in November. Nineteen
        of the 21 landed on 31 October.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        October isn&rsquo;t empty because paper kept moving. DOL says employers
        who couldn&rsquo;t file electronically posted their applications, that
        OFLC entered those by hand once FLAG was back, and that each one
        &ldquo;will be considered to have been filed on the date it was
        postmarked&rdquo;. So a good part of the 1,616 is mail, backdated into
        a month when the portal was shut.
      </p>{" "}

      <p className="mt-3 text-base leading-relaxed text-foreground/80">
        One observation rather than a finding: OFLC&rsquo;s filing portal
        carries the 31 October resumption notice and nothing announcing the
        stoppage. Its announcements run from 16 May 2025 straight to 31
        October. The explanation above is on{" "}
        <span className="font-mono text-sm">{LIVE_NOTICE_URL}</span>, a
        different DOL host, which refuses automated clients, so the text quoted
        here was read from an Internet Archive capture of that page.
      </p>{" "}

      <p className="mt-4 flex flex-col gap-2 text-base leading-relaxed text-foreground/80 sm:flex-row sm:gap-6">
        <a
          href={ARCHIVED_NOTICE_URL}
          className="font-bold underline underline-offset-2 hover:text-primary"
          rel="noopener"
        >
          DOL&rsquo;s announcement of 5 November 2025, archived
        </a>{" "}
        <a
          href={FLAG_NOTICE_URL}
          className="font-bold underline underline-offset-2 hover:text-primary"
          rel="noopener"
        >
          OFLC&rsquo;s resumption notice of 31 October 2025
        </a>
      </p>
    </section>
  );
}
