import type { Metadata } from "next";
import Link from "next/link";

import { BadgeCatalogue, type BadgeRow } from "@/components/badges/BadgeCatalogue";
import { BADGE_DEFS, BADGE_THEMES, badgeSpec } from "@/lib/badge";
import { getBadgeData } from "@/lib/badgeData";
import { renderBadge, renderUnavailable } from "@/lib/badgeRender";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The badge catalogue.
 *
 * A badge is a claim rendered on somebody else's page, where there is no room
 * for a caveat and no way to add one later. So every one carries a figure a
 * federal source published or a count of the records this site holds, with the
 * date it was true for and the name of who published it drawn into the image.
 * None of them carries an estimate; the estimator's record lives on the
 * scorecard, where its margin of error can sit beside it.
 *
 * THE PAGE IS A SPECIMEN SHEET. It opens with a live wall of every badge at
 * its real size - a demo and the proof it works in one object - then three
 * shared controls, then the catalogue grouped by where the number comes from.
 *
 * ONE READ FOR THE WHOLE PAGE. `getBadgeData()` is `cache()`d and every badge,
 * in every shape and both themes, is rendered from it with the same functions
 * the SVG route uses. The previews cannot drift from what the route serves and
 * roughly 200 rendered variants cost no extra queries.
 */

const TITLE = "PERM and Visa Bulletin Badges";
const DESCRIPTION =
  "Embeddable SVG badges carrying figures DOL and the State Department publish: queue positions, decision days, visa bulletin cutoffs. Rebuilt daily.";
const PATH = "/badges";
const ORIGIN = "https://permtracker.app";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/badges" },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
}, "badges");

// The badges are rebuilt daily; the page that shows them should not be staler
// than they are.
export const revalidate = 86400;

export default async function BadgesPage() {
  const data = await getBadgeData();

  const rows: BadgeRow[] = BADGE_DEFS.map((def) => {
    const spec = badgeSpec(def.id, data);
    const variants = def.styles.flatMap((style) =>
      BADGE_THEMES.map((theme) => ({
        style,
        theme,
        path: `${def.id}.${style}.${theme}`,
        svg: spec ? renderBadge(spec, style, theme) : renderUnavailable(def.id, style, theme),
      })),
    );
    return {
      kind: def.id,
      group: def.group,
      label: def.label,
      meaning: def.meaning,
      href: def.href,
      unavailable: spec === null,
      variants,
      styles: [...def.styles],
    };
  });

  const live = rows.filter((r) => !r.unavailable).length;
  // The wall shows the strip form where a figure has one, because thirty-nine
  // cards is a wall of cards rather than a wall of badges.
  const wall = rows
    .map((r) => r.variants.find((v) => v.style === "shield" && v.theme === "dark") ?? r.variants[0])
    .filter((v): v is NonNullable<typeof v> => Boolean(v));

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
          A federal number that updates itself, wherever you paste it. {rows.length} of them: the queues DOL is
          working, the visa bulletin cutoffs, where pending cases sit, and the size of the record behind all of it.
          Every one names its source and its date. None of them guesses.
        </p>
      </header>

      {/* THE HERO IS THE BADGES: every one of them, live, at the size it will
          render on somebody else's page.

          `bg-black`, not the site's inverted `bg-foreground` band. That token
          flips with the theme, so in dark mode this became a near-white slab
          (measured rgb(250,250,250)) - the bright-panel-in-a-dark-page problem
          the sign-up split already ran into. The header and footer are black in
          both themes for the same reason. */}
      <section className="mt-8 border-2 border-border bg-black p-5 shadow-hard sm:p-8">
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-3">
          {wall.map((v) => (
            <li
              key={v.path}
              className="inline-flex"
              /* Our own string from the renderer, which escapes its content. */
              dangerouslySetInnerHTML={{ __html: v.svg }}
            />
          ))}
        </ul>{" "}
        <p className="mt-6 font-mono text-xs leading-relaxed text-white/70">
          {live} of {rows.length} carrying a figure right now. The rest say so rather than showing an old number.
        </p>
      </section>

      <BadgeCatalogue rows={rows} origin={ORIGIN} />

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">What a badge will not do</h2>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          It will not predict anything. Every figure is one a federal source printed or one this site counted from
          federal files, and each badge draws the publisher and the date into the image, because a number on a page
          that is not ours has to say where it came from. On a day nothing was published for a figure, that badge says
          so rather than showing yesterday&apos;s, which is the only behaviour that is safe on a page nobody is
          watching.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          The estimator&apos;s own accuracy is kept on{" "}
          <Link href="/estimate-scorecard" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
            the scorecard
          </Link>{" "}
          and stays off the badges on purpose: a number with a margin of error needs the margin next to it, and a badge
          has nowhere to put one.
        </p>{" "}
        <p className="mt-3 text-base leading-relaxed text-foreground/80">
          Hot-linking is fine and expected. Every variant is a static image cached for a day at the edge, so a badge on
          a busy page costs this site one read, not one per viewer.
        </p>
      </section>
    </div>
  );
}
