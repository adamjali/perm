import Link from "next/link";

import { ABOUT_ONE_LINER, SABRINA } from "@/lib/constants/about";
import type { RecordFigure } from "@/lib/recordCounts";

import { RecordStrip } from "./RecordStrip";

/**
 * "About PERM Tracker", on the homepage, in plain server-rendered prose.
 *
 * The homepage used to carry the product's self-description and lost the
 * query "perm tracker" the day a rewrite removed it (Search Console, Aug 27
 * 2026: 410 impressions a day to 7). The FAQ page, which kept an "About PERM
 * Tracker" heading, took the query instead. This block is that heading back
 * where the brand query lands, wired to the same facts as /about and the
 * Organization schema. No animation wrapper on purpose: a Motion `initial`
 * serializes as an inline `opacity:0` in the prerendered HTML, and this is the
 * one passage on the page that most needs to be readable before hydration.
 */
export function AboutSection({ record = [] }: { record?: RecordFigure[] }) {
  return (
    <section id="about" className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-[800px] px-4 sm:px-8">
        <p className="mb-4 font-mono text-sm uppercase tracking-widest text-muted-foreground">
          Who runs this
        </p>{" "}
        <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
          About PERM Tracker
        </h2>{" "}
        <p className="mt-5 text-base leading-relaxed text-foreground/90 sm:text-lg">
          {ABOUT_ONE_LINER} Look up a case, see where the queue stands, and
          track your deadlines. It&apos;s run by {SABRINA.name}, an immigration
          attorney who files these cases, with ongoing input from both sides of
          a filing: the people waiting on a case and the attorneys who file for
          them.
          It&apos;s not a law firm, and nothing here is legal advice.{" "}
          <Link
            href="/about"
            className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
          >
            More about us &rarr;
          </Link>
        </p>{" "}
        <RecordStrip record={record} />
      </div>
    </section>
  );
}
