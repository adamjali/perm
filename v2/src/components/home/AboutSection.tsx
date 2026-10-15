import Link from "next/link";

import { ABOUT_ONE_LINER, SABRINA } from "@/lib/constants/about";
import type { RecordFigure } from "@/lib/recordCounts";

import { RecordStrip } from "./RecordStrip";
import { ReviewsLine } from "./ReviewsLine";

/**
 * "About PERM Tracker", on the homepage, in plain server-rendered prose.
 *
 * The brand query "perm tracker" goes to the page that says plainly what the
 * name is; without this heading on the homepage it drifts to /faq. Wired to
 * the same facts as /about and the Organization schema. No animation wrapper
 * on purpose: a Motion `initial`
 * serializes as an inline `opacity:0` in the prerendered HTML, and this is the
 * one passage on the page that most needs to be readable before hydration.
 */
export function AboutSection({ record = [] }: { record?: RecordFigure[] }) {
  return (
    <section id="about" className="py-12 sm:py-16 border-b-3 border-border">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-8 px-4 [&>*]:min-w-0 sm:px-8 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-5">
          <h2 className="font-heading text-2xl font-bold sm:text-3xl">About PERM Tracker</h2>{" "}
          {/* The definition is the hero's opening line; screen readers and
              crawlers get it here too, readers aren't shown it twice. */}
          <p className="sr-only">{ABOUT_ONE_LINER}</p>{" "}
          <p className="mt-4 text-base leading-relaxed text-soft sm:text-lg">
            It&apos;s run by {SABRINA.name}, an immigration attorney. It&apos;s not a law firm, and nothing here is
            legal advice.{" "}
            <Link href="/about" className="link">
              More about us
            </Link>
          </p>{" "}
          <ReviewsLine />
        </div>{" "}
        <div className="lg:col-span-7">
          <RecordStrip record={record} className="lg:pt-1" />
        </div>
      </div>
    </section>
  );
}
