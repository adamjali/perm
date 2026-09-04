import type { ReactNode } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DataProvenance } from "@/components/data/DataProvenance";
import {
  BROWSE_BUCKETS,
  BROWSE_KINDS,
  bucketLabel,
  bucketPhrase,
  browseHref,
  isBrowseBucket,
  type BrowseBucket,
} from "@/lib/entityBrowse";
import type { EntityKind } from "@/lib/entityPayload";
import { openGraphBase } from "@/lib/openGraphBase";
import { browseBucket, browseCounts } from "@/lib/turso/entityBrowse";

import { BrowseIndexGrid, BrowseList, BrowseStrip } from "./EntityBrowse";

/**
 * The A-Z browse pages, written once and mounted by all three kinds.
 *
 * Six routes (`/perm-employers/browse`, `/perm-employers/browse/[letter]`, and
 * the same for law firms and occupations) that differ only in a noun. Copying
 * the body three times is how a fix lands on one of them: the entity DETAIL
 * pages are three separate files for good reason (each says different things
 * about its own subject), and these say the same thing about three subjects.
 *
 * The route files keep what has to be per-file - the `metadata`/
 * `generateMetadata` export, `revalidate`, `generateStaticParams` - because
 * Next reads those off the module it loads, not off a component.
 */

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/**
 * The reader's own share, to one decimal, never rounded to a bare integer.
 *
 * A letter holding 0.4% of the corpus reads as "0%" at zero decimals, which
 * says the letter is empty when it holds 65 real pages.
 */
function pct(part: number, whole: number): string {
  if (whole <= 0) return "0";
  return (Math.round((part / whole) * 1000) / 10).toFixed(1);
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

/**
 * Metadata for one letter page.
 *
 * The description carries the bucket's own count, so no two of the 81 are the
 * same sentence. It reads the SAME `browseBucket` call the body does, and that
 * function is React-cached, so metadata and body share one query rather than
 * issuing two.
 *
 * Length is bounded by construction against `scripts/audit_all_pages.py`'s
 * 70-155 window: the fixed text is ~110 characters, the count adds at most 6
 * and the phrase at most 8, so the longest possible rendering is ~134.
 */
export async function browseLetterMetadata(
  kind: EntityKind,
  letter: string,
): Promise<Metadata> {
  // Decided here rather than in the body, and that is the whole reason it is
  // here: a `notFound()` thrown after the response starts streaming can swap
  // the UI but never the status. `dynamicParams = false` on the route already
  // makes a junk letter a routing-level 404, and this is the belt to that
  // brace for anything that reaches the module directly.
  if (!isBrowseBucket(letter)) notFound();
  const cfg = BROWSE_KINDS[kind];
  const entries = await browseBucket(kind, letter);
  const label = bucketLabel(letter);
  const phrase = bucketPhrase(letter);

  const title = `${cfg.titleNoun} Starting With ${label}`;
  const description =
    entries.length === 0
      ? `No ${cfg.plural} in DOL's PERM disclosure files begin with ${phrase} often enough to have a page. Every other letter is indexed here.`
      : `${fmt(entries.length)} ${cfg.plural} whose name begins with ${phrase}, each linked to its own PERM record with filing counts, from DOL's disclosure files.`;

  return {
    title,
    description,
    // A letter nobody can reach is not offered to the index either. Same rule
    // the sub-floor entity pages follow, and the sitemap omits it in step.
    ...(entries.length === 0 ? { robots: { index: false, follow: true } } : {}),
    alternates: { canonical: browseHref(cfg.base, letter) },
    openGraph: {
      ...openGraphBase,
      title: `${title} | PERM Tracker`,
      description,
      url: browseHref(cfg.base, letter),
    },
  };
}

/** Metadata for a kind's browse index. No query: the copy is fixed. */
export function browseIndexMetadata(kind: EntityKind): Metadata {
  const cfg = BROWSE_KINDS[kind];
  const title = `Browse ${cfg.titleNoun} A-Z`;
  const description = `Every ${cfg.singular} with a PERM record here, grouped by the first letter of its name, with how many sit behind each letter.`;
  return {
    title,
    description,
    alternates: { canonical: browseHref(cfg.base) },
    openGraph: {
      ...openGraphBase,
      title: `${title} | PERM Tracker`,
      description,
      url: browseHref(cfg.base),
    },
  };
}

/** Every letter, for `generateStaticParams`. 27 per kind, all prerendered. */
export function browseStaticParams(): Array<{ letter: string }> {
  return BROWSE_BUCKETS.map((letter) => ({ letter }));
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** The A-Z landing page for one kind. */
/**
 * One paragraph per kind, and they must stay genuinely DIFFERENT.
 *
 * These three indexes render from one component, so before this existed they
 * served the same ~470 words with a noun swapped: measured against production,
 * each shared 67-72% of its five-word runs with its two siblings, the highest
 * duplication anywhere on the site. Google's crawl-budget guidance is to
 * "eliminate duplicate content to focus crawling on unique content rather than
 * unique URLs", and these pages exist ONLY to be crawled through - they are what
 * puts every entity page two hops from its hub. A duplicate cluster is therefore
 * a risk to the 30,000 pages behind them, not just to their own ranking.
 *
 * So each note states a fact that is TRUE OF THAT INDEX AND NOT THE OTHER TWO,
 * measured rather than written to fill space. Three variants of one sentence
 * would just move the duplication.
 */
const BROWSE_NOTE: Record<EntityKind, ReactNode> = {
  employer: (
    <>
      DOL spells one company several ways, so a sponsor can sit under the same
      letter more than once: <b className="font-bold">DISH NETWORK LLC</b> and{" "}
      <b className="font-bold">DISH NETWORK L.L.C.</b> are one employer filing
      under two names. Around 5,000 of the names here carry more than one
      spelling. Each employer page pools them and says which other spellings DOL
      printed.
    </>
  ),
  attorney: (
    <>
      A practice can appear here several times over, and unlike the employer
      index these are not pooled. DOL prints Fragomen under six different
      spellings, and each one takes its own page with its own rank, so a firm
      page counts the filings under the spelling it matched rather than
      everything the practice filed. Read a single firm&apos;s total as a floor.
    </>
  ),
  occupation: (
    <>
      Occupations are grouped by the title DOL prints, but the six-digit SOC
      code underneath is what the filings actually join on, and DOL writes the
      same code two ways: <b className="font-bold">15-1252.00</b> on most rows
      and <b className="font-bold">15-1252</b> on the rest. Both spellings are
      pooled here, which is worth about a quarter of the cases on a busy
      occupation.
    </>
  ),
};

export async function BrowseIndexBody({ kind }: { kind: EntityKind }) {
  const cfg = BROWSE_KINDS[kind];
  const counts = await browseCounts(kind);
  const total = BROWSE_BUCKETS.reduce((sum, b) => sum + (counts[b] ?? 0), 0);
  const live = BROWSE_BUCKETS.filter((b) => (counts[b] ?? 0) > 0);
  const busiest = live.reduce(
    (best, b) => ((counts[b] ?? 0) > (counts[best] ?? 0) ? b : best),
    live[0] ?? "a",
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link
            href={cfg.base}
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            {cfg.titleNoun}
          </Link>{" "}
          · A-Z index
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Browse {cfg.plural} A to Z
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          All {fmt(total)} {cfg.plural} with a page of their own, grouped by the
          first letter of the name DOL prints. {bucketLabel(busiest)} is the
          biggest group at {fmt(counts[busiest] ?? 0)}. The ranked table on the{" "}
          <Link
            href={cfg.base}
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            main page
          </Link>{" "}
          sorts the same set by volume.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="font-heading text-2xl font-black">
          Pick a letter
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-foreground/70">
          A {cfg.singular} reaches this index once DOL&apos;s disclosure files
          name it three times or more. Below that it stays searchable on the
          main page and takes no page of its own, because a record of one case
          is not a page.
        </p>{" "}
        <p className="mt-3 max-w-2xl text-base text-foreground/70">
          {BROWSE_NOTE[kind]}
        </p>
        <BrowseIndexGrid
          base={cfg.base}
          counts={counts}
          plural={cfg.plural}
          className="mt-6"
        />
      </section>

      <DataProvenance datasets={["entities", "perm-cases"]} />
    </div>
  );
}

/**
 * The A-Z strip as it appears on a HUB page.
 *
 * This is the module that closes the actual gap. `/perm-employers` served 54
 * crawlable `<a href="/perm-employers/...">` links against 16,309 employer
 * pages; the strip puts all 27 letter pages one hop from the hub, which puts
 * every entity page two. Linking only to `/browse` would have made it three,
 * and depth is the thing being fixed.
 *
 * Its own query is the TTL-cached counts read, shared with every letter page
 * rendered in the same hour.
 */
export async function BrowseTeaser({
  kind,
  className,
}: {
  kind: EntityKind;
  className?: string;
}) {
  const cfg = BROWSE_KINDS[kind];
  const counts = await browseCounts(kind);
  const total = BROWSE_BUCKETS.reduce((sum, b) => sum + (counts[b] ?? 0), 0);
  if (total === 0) return null;

  return (
    <section className={className}>
      <h2 className="font-heading text-2xl font-black">Browse A to Z</h2>{" "}
      <p className="mt-2 max-w-3xl text-base text-foreground/70">
        The table above sorts by volume. This sorts by name: {fmt(total)}{" "}
        {cfg.plural} with a page of their own, split across 26 letters and one
        bucket for the names that start with a number. The{" "}
        <Link
          href={browseHref(cfg.base)}
          className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
        >
          full A-Z index
        </Link>{" "}
        gives the count behind each letter.
      </p>
      <BrowseStrip base={cfg.base} counts={counts} className="mt-5" />
    </section>
  );
}

/** One letter's full list for one kind. */
export async function BrowseLetterBody({
  kind,
  letter,
}: {
  kind: EntityKind;
  letter: string;
}) {
  if (!isBrowseBucket(letter)) notFound();
  const bucket: BrowseBucket = letter;
  const cfg = BROWSE_KINDS[kind];
  const [entries, counts] = await Promise.all([
    browseBucket(kind, bucket),
    browseCounts(kind),
  ]);
  const total = BROWSE_BUCKETS.reduce((sum, b) => sum + (counts[b] ?? 0), 0);
  const label = bucketLabel(bucket);
  const phrase = bucketPhrase(bucket);

  // Measured from this bucket and nowhere else, which is what stops 81 pages
  // being one page with a letter swapped: the share, the busiest member and
  // the floor are different numbers on every one of them.
  const busiest = entries.reduce(
    (best, e) => (e.total > (best?.total ?? -1) ? e : best),
    entries[0],
  );
  const smallest = entries.reduce(
    (min, e) => Math.min(min, e.total),
    Number.POSITIVE_INFINITY,
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />

      <header className="max-w-3xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link
            href={cfg.base}
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            {cfg.titleNoun}
          </Link>{" "}
          ·{" "}
          <Link
            href={browseHref(cfg.base)}
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            A-Z index
          </Link>{" "}
          · {label}
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          {cfg.plural.charAt(0).toUpperCase() + cfg.plural.slice(1)} beginning
          with {phrase}
        </h1>{" "}
        {entries.length > 0 && busiest ? (
          <p className="mt-4 text-lg leading-relaxed text-foreground/70">
            {fmt(entries.length)} of the {fmt(total)} {cfg.plural} with a page
            here, {pct(entries.length, total)}% of them. The busiest is{" "}
            <Link
              href={`${cfg.base}/${busiest.slug}`}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              {busiest.name}
            </Link>{" "}
            with {fmt(busiest.total)} {cfg.unit}; the smallest carry{" "}
            {fmt(smallest)}. Every name is DOL&apos;s own spelling from the
            disclosure files.
          </p>
        ) : (
          <p className="mt-4 text-lg leading-relaxed text-foreground/70">
            DOL&apos;s disclosure files name no {cfg.singular} beginning with{" "}
            {phrase} three times or more, so there is nothing to list under{" "}
            {label}. Every other letter is one click away.
          </p>
        )}
      </header>

      <BrowseStrip
        base={cfg.base}
        counts={counts}
        active={bucket}
        className="mt-8"
      />

      {entries.length > 0 ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-black">
            All {fmt(entries.length)}, alphabetically
          </h2>{" "}
          <p className="mt-2 max-w-3xl text-base text-foreground/70">
            The number beside each name is how many PERM cases DOL&apos;s
            current disclosure window records for it. Opening one gives that{" "}
            {cfg.singular}&apos;s certifications, denials, median days and where
            it sits against the field.
          </p>
          <BrowseList
            base={cfg.base}
            entries={entries}
            unit={cfg.unit}
            className="mt-6"
          />
        </section>
      ) : null}

      <section className="mt-12 grid grid-cols-1 gap-4 [&>*]:min-w-0 sm:grid-cols-2">
        <div className="border-2 border-border bg-tint-primary p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">
            Looking for one in particular?
          </h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            The{" "}
            <Link
              href={cfg.base}
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              ranked table
            </Link>{" "}
            searches every {cfg.singular} in the corpus, including the ones too
            small for a page of their own.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">
            Holding a case number?
          </h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/70">
            A{" "}
            <Link
              href="/perm-case-status"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              case lookup
            </Link>{" "}
            reads DOL&apos;s live record for one case, which is a different and
            fresher source than the counts on this page.
          </p>
        </div>
      </section>

      <DataProvenance datasets={["entities", "perm-cases"]} />
    </div>
  );
}
