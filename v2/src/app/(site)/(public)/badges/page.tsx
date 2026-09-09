import type { Metadata } from "next";
import Link from "next/link";

import { BadgeCatalogue, type BadgeRow } from "@/components/badges/BadgeCatalogue";
import { BADGE_KINDS, BADGE_MEANING, badgeSpec, renderBadgeSvg, renderUnavailableSvg } from "@/lib/badge";
import { badgeInputsFrom } from "@/lib/badgeInputs";
import { formatAsOf } from "@/lib/dolFormat";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { getProcessingTimes } from "@/lib/turso/processingTimes";

/**
 * The badge catalogue.
 *
 * A badge is a claim rendered on somebody else's page, where there is no room
 * for a caveat and no way to add one later. So every one of them carries a
 * figure DOL PUBLISHES - a queue month, an average - and never anything this
 * site derives. The estimator's own record is on the scorecard, deliberately
 * not on a badge.
 *
 * THE PAGE IS A SPECIMEN SHEET, and the badges are the only loud thing on it.
 * The previous version was three badges and six code blocks, which is a page
 * that is mostly chrome for copying. This one opens with every badge live at
 * its real size on the ink band - a demo and the proof it works, in the same
 * object - and moves the copying to one format switch shared by all of them.
 *
 * ONE READ FOR THE WHOLE PAGE. `getProcessingTimes()` is called once and every
 * badge is rendered from it with the same function the SVG route uses, so the
 * previews cannot drift from what the route serves and nine badges cost no
 * extra requests.
 */

const TITLE = "PERM Queue Badges";
const DESCRIPTION =
  "Nine embeddable SVG badges, regenerated daily from DOL's own published figures: the three PERM queues, the average decision days, and the prevailing wage queue for PERM, H-1B, H-2B and CW-1.";
const PATH = "/badges";
const ORIGIN = "https://permtracker.app";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/badges" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "badges");

// The badges themselves are rebuilt daily; the page that shows them should not
// be staler than they are.
export const revalidate = 86400;

export default async function BadgesPage() {
  const snap = await getProcessingTimes().catch(() => null);
  const inputs = badgeInputsFrom(snap);

  const rows: BadgeRow[] = BADGE_KINDS.map((kind) => {
    const spec = badgeSpec(kind, inputs);
    return {
      kind,
      svg: spec ? renderBadgeSvg(spec) : renderUnavailableSvg(kind),
      label: spec?.label ?? kind,
      meaning: BADGE_MEANING[kind],
      href: spec?.href ?? "/",
      src: `${ORIGIN}/badge/${kind}.svg`,
      unavailable: spec === null,
    };
  });

  const live = rows.filter((r) => !r.unavailable).length;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/methodology" className="underline underline-offset-2 hover:text-primary">
            Reference
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">Badges</h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          A federal number that updates itself, wherever you paste it. Each one carries a figure the Department of
          Labor publishes and the date it published it. None of them carries an estimate.
        </p>
      </header>

      {/* THE HERO IS THE BADGES. Every one of them, live, at the size it will
          render on somebody else's page, on the dark ground most of them get
          pasted onto.

          `bg-black`, NOT the site's inverted `bg-foreground` band. That token
          flips with the theme, so in dark mode this became a near-white slab
          (measured: rgb(250,250,250)) - the bright-panel-in-a-dark-page
          problem the sign-up split already ran into. The header and the footer
          are black in both themes for the same reason, and a badge's own label
          segment is #000 whatever the reader's theme is, so a fixed dark
          ground is also the honest preview. */}
      <section className="mt-8 border-2 border-border bg-black p-5 shadow-hard sm:p-8">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-4">
          {rows.map((row) => (
            <li
              key={row.kind}
              className="inline-flex"
              /* Our own string from `renderBadgeSvg`; it escapes its content
                 and every value comes from DOL's table. */
              dangerouslySetInnerHTML={{ __html: row.svg }}
            />
          ))}
        </ul>{" "}
        <p className="mt-6 font-mono text-xs leading-relaxed text-white/70">
          {snap?.permAsOf
            ? `${live} of ${rows.length} carrying a figure. DOL published these on ${formatAsOf(snap.permAsOf)}.`
            : "DOL's processing-times page has not been read yet, so every badge says so rather than showing a number."}
        </p>
      </section>

      <BadgeCatalogue rows={rows} origin={ORIGIN} />

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">What a badge will not do</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          It will not predict anything. Every figure above is one DOL printed on its own processing-times page, and the
          badge is rebuilt once a day from the same read the rest of this site uses. On a day DOL prints no figure for
          a queue, that badge says so rather than showing yesterday&apos;s number, which is the only behaviour that is
          safe on a page nobody is watching.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          The estimator&apos;s own accuracy is kept on{" "}
          <Link href="/estimate-scorecard" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the scorecard
          </Link>{" "}
          and stays off the badges on purpose: a number with a margin of error needs the margin next to it, and a 20px
          image has nowhere to put one.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Hot-linking is fine and expected. The image is cached for a day at the edge, so a badge on a busy page costs
          this site one read, not one per viewer.
        </p>
      </section>
    </div>
  );
}
