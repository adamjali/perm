import Link from "next/link";

import { ABOUT_TWO_HALVES } from "@/lib/constants/about";
import { FILM_ATTORNEYS, FILM_WAITING, type Film } from "@/lib/constants/films";

import { ExplainerFilm } from "./ExplainerFilm";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";
import { buttonVariants } from "@/components/ui/button";

/**
 * The two audiences, side by side, with EQUAL headings.
 *
 * Answer engines aggregate a page's H2s into "what this product is".
 * Attorney-only H2s make AI overviews call the site attorney-only, and
 * removing them leaves the page describing one side. This block states both
 * sides at the same
 * weight: the same heading level, the same film-then-list shape.
 *
 * Film first, the list folded. Each half is its film, a fold called "What it does" holding the
 * list and the full description (`ABOUT_TWO_HALVES`), and its two buttons.
 * Every word stays in the HTML for search and for answer engines. `about-surfaces.test.ts` holds the shared description here.
 *
 * Plain server-rendered markup: no Motion wrapper, so the text is in the
 * prerendered HTML for every crawler and every reader before hydration.
 */

interface Half {
  heading: string;
  film: Film;
  lede: string;
  /** Folded under "What it does", with the lede: the film carries the half. */
  items: readonly string[];
  cta: { href: string; label: string };
  secondary: { href: string; label: string };
}

const HALVES: readonly Half[] = [
  {
    heading: "For the person waiting on a PERM case",
    film: FILM_WAITING,
    lede: ABOUT_TWO_HALVES.waiting,
    items: [
      "Look up any PERM, wage request, LCA, H-2A or H-2B number, pending ones included",
      "See where DOL's queue stands and when yours could be decided",
      "Free email alerts when your case moves or DOL reaches your month",
      "Search every filing by employer, law firm, worksite state and occupation",
      "Processing times, wages, denial rates and the visa bulletin, from the government's own files",
    ],
    cta: { href: "/perm-case-status", label: "Check my case" },
    secondary: { href: "/perm-queue", label: "Where the queue stands" },
  },
  {
    heading: "For attorneys, paralegals and HR teams",
    film: FILM_ATTORNEYS,
    lede: ABOUT_TWO_HALVES.practice,
    items: [
      "Every deadline computed per case under 20 CFR 656",
      "Change one date and every date after it recalculates",
      "Reminders by email and push, calendar sync and a weekly case summary",
      "Wage expiration, recruitment clocks, the ETA 9089 window, audit and RFI responses, the I-140 cutoff",
      "Import cases from a JSON file, export to CSV or JSON any time, an AI assistant over your caseload",
      "Client data encrypted at rest and isolated per account, with a privacy mode for screen sharing",
    ],
    cta: { href: "/signup", label: "Start tracking cases" },
    secondary: { href: "/for-attorneys", label: "How the software works" },
  },
];

function Bullets({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-base leading-relaxed text-soft">
          <span aria-hidden="true" className="mt-[0.6em] block size-2 shrink-0 bg-primary" />
          <span>{item}{" "}</span>
        </li>
      ))}
    </ul>
  );
}

export function AudienceBlocks() {
  return (
    <section
      id="who-it-is-for"
      aria-labelledby="who-it-is-for-heading"
      // A dark field, the page's one change of colour: the .dark scope gives
      // everything inside the dark theme's tokens, in both themes.
      className="dark bg-[#161616] py-12 text-foreground sm:py-16"
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <h2 id="who-it-is-for-heading" className="font-heading text-2xl font-bold sm:text-3xl">
          Both sides of a PERM filing
        </h2>{" "}
        <p className="mt-2 max-w-2xl text-base text-soft">Same federal record, both free.</p>{" "}
        <div className="mt-8 grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-10 [&>*]:min-w-0">
          {HALVES.map((h) => (
            <article key={h.heading} className="flex flex-col">
              <h3 className="font-heading text-xl font-bold">
                {h.heading}
              </h3>{" "}
              <ExplainerFilm film={h.film} className="mt-4" />{" "}
              <details className="group mt-4 border-b border-border border-y-2">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between font-semibold [&::-webkit-details-marker]:hidden">
                  What it does{" "}
                  <CaretDownIcon className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>{" "}
                <div className="pb-4">
                  <Bullets items={h.items} />
                  <p className="mt-4 text-base leading-relaxed text-soft">{h.lede}</p>
                </div>
              </details>{" "}
              {/* The page's one lime action is the case box above; these are
                  the next doors, so outline buttons and a link. */}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link href={h.cta.href} className={buttonVariants({ variant: "outline", size: "lg" })}>
                  {h.cta.label}
                </Link>{" "}
                <Link href={h.secondary.href} className="link inline-flex min-h-11 items-center">
                  {h.secondary.label}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
