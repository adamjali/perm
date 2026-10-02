import Image from "next/image";
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
    <section id="about" className="border-b-3 border-border py-16 sm:py-20">
      <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 px-4 [&>*]:min-w-0 sm:px-8 lg:grid-cols-12 lg:gap-14">
        {/* THE PERSON, SHOWN: the portrait /about ships sits here too,
            tilted and loose like a photo on a desk, not boxed, so the block
            that names her shows her. */}
        <figure className="m-0 lg:col-span-4">
          <div className="mx-auto max-w-[280px] -rotate-2 border-3 border-border bg-card p-2 shadow-hard-lg lg:mx-0">
            <Image
              src={SABRINA.image}
              alt={`${SABRINA.name}, ${SABRINA.jobTitle.toLowerCase()}`}
              width={SABRINA.imageSize[0]}
              height={SABRINA.imageSize[1]}
              sizes="280px"
              className="block h-auto w-full"
            />
          </div>{" "}
          <figcaption className="mt-4 text-center text-base lg:text-left">
            <span className="block font-heading text-lg font-black">{SABRINA.name}</span>{" "}
            <span className="block text-foreground/75">
              {SABRINA.jobTitle} who files these cases
            </span>
          </figcaption>
        </figure>{" "}
        <div className="lg:col-span-8">
          <h2 className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl">
            About PERM Tracker
          </h2>{" "}
          {/* The definition is the hero's opening line; screen readers and
              crawlers get it here too, readers aren't shown it twice. */}
          <p className="sr-only">{ABOUT_ONE_LINER}</p>{" "}
          <p className="mt-5 text-base leading-relaxed text-foreground/90 sm:text-lg">
            It&apos;s run by {SABRINA.name}, an immigration attorney who files
            these cases. It&apos;s not a law firm, and nothing here is legal
            advice.{" "}
            <Link
              href="/about"
              className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
            >
              More about us &rarr;
            </Link>
          </p>{" "}
          <RecordStrip record={record} />{" "}
          <ReviewsLine />
        </div>
      </div>
    </section>
  );
}
