import Link from "next/link";

import { correctionsSorted } from "@/lib/corrections";

/**
 * The corrections log, as a section of the changelog.
 *
 * IT USED TO BE ITS OWN ROUTE at `/corrections` and Adam retired it: fourteen
 * entries did not earn a page, and a reader looking for "what changed" already
 * goes to the changelog. The RECORD is worth keeping on a site whose whole
 * argument is that its numbers are checkable, so the data outlived the page -
 * `src/lib/corrections.ts` is untouched and still its own tested module.
 *
 * The two lists say different things and are deliberately not merged. The
 * timeline above is what the site GAINED; this is what it got WRONG. Folding
 * a correction into a release note is how a correction stops being one.
 */
const long = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

export function CorrectionsLog() {
  const items = correctionsSorted();

  return (
    <section id="corrections" className="mt-14 scroll-mt-24 border-t-3 border-border pt-10">
      <h2 className="font-heading text-3xl font-black leading-tight sm:text-4xl">Corrections</h2>{" "}
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70">
        What this site published that was wrong, what was true, and what changed. The bar for an entry is a reader who
        could have believed something false from a page. Entries are added and never removed.
      </p>

      <ol className="mt-8 space-y-6">
        {items.map((c) => (
          <li key={`${c.date}-${c.where}`} className="border-2 border-border bg-card p-5 shadow-hard sm:p-6">
            <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <time dateTime={c.date} className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/60">
                {long(c.date)}
              </time>{" "}
              <span className="font-heading text-lg font-black">{c.where}</span>
            </p>{" "}
            <dl className="mt-4 grid grid-cols-1 gap-y-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-x-6 sm:gap-y-3">
              <dt className="text-sm font-bold">What it said</dt>{" "}
              <dd className="text-sm leading-relaxed text-foreground/80">{c.said}</dd>{" "}
              <dt className="text-sm font-bold">What was true</dt>{" "}
              <dd className="text-sm leading-relaxed text-foreground/80">{c.truth}</dd>{" "}
              <dt className="text-sm font-bold">What changed</dt>{" "}
              <dd className="text-sm leading-relaxed text-foreground/80">
                {c.fix}
                {c.href ? (
                  <>
                    {" "}
                    <Link href={c.href} className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
                      See the page
                    </Link>
                  </>
                ) : null}
              </dd>
            </dl>{" "}
          </li>
        ))}
      </ol>

      <p className="mt-8 max-w-3xl text-base leading-relaxed text-foreground/80">
        A wrong figure, a wrong date, a wrong description of what the site can do, or a rule stated incorrectly, on a
        page a reader could see. Estimates that missed are not corrections; they are scored on{" "}
        <Link href="/estimate-scorecard" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
          the scorecard
        </Link>
        . To report something wrong, write to{" "}
        <a href="mailto:support@permtracker.app?subject=Correction" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
          support@permtracker.app
        </a>
        .
      </p>
    </section>
  );
}
