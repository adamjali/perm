import Link from "next/link";

import { ABOUT_TWO_HALVES } from "@/lib/constants/about";
import { FILM_ATTORNEYS, FILM_WAITING, type Film } from "@/lib/constants/films";

import { ExplainerFilm } from "./ExplainerFilm";
import { ArrowRight } from "./icons";

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
        <li key={item} className="flex gap-3 text-base leading-relaxed text-foreground/90">
          <span aria-hidden="true" className="mt-[0.55em] block h-2.5 w-2.5 shrink-0 bg-primary" />
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
      // THE DARK BAND: the films play on ink, like a screen
      // room. `dark` scopes the theme tokens to this section only (the
      // `dark` variant is `&:is(.dark *)`), so every child reads its colours
      // from the dark palette without a second set of classes.
      className="dark border-b-3 border-border bg-background py-16 text-foreground sm:py-20"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <h2
          id="who-it-is-for-heading"
          className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
        >
          Both sides of a PERM filing
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-lg text-foreground/75">
          Same federal record, both free.
        </p>{" "}
        <div className="mt-10 grid grid-cols-1 gap-10 [&>*]:min-w-0 lg:grid-cols-2 lg:gap-8">
          {HALVES.map((h) => (
            <article key={h.heading} className="flex flex-col">
              <h3 className="font-heading text-xl font-black tracking-tight sm:text-2xl">
                {h.heading}
              </h3>{" "}
              <ExplainerFilm film={h.film} className="mt-4" />{" "}
              <details className="mt-4 border-y-2 border-border">
                <summary className="flex min-h-[48px] cursor-pointer items-center font-bold">
                  What it does
                </summary>{" "}
                <div className="pb-4">
                  <Bullets items={h.items} />
                  <p className="mt-4 text-base leading-relaxed text-foreground/80">{h.lede}</p>
                </div>
              </details>{" "}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={h.cta.href}
                  className="group inline-flex min-h-[48px] items-center justify-center gap-2 border-3 border-border bg-primary px-6 font-heading font-black text-primary-foreground shadow-hard transition-transform duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5"
                >
                  {h.cta.label}{" "}
                  <ArrowRight className="transition-transform duration-150 group-hover:translate-x-1" />
                </Link>{" "}
                <Link
                  href={h.secondary.href}
                  className="inline-flex min-h-[48px] items-center justify-center border-3 border-border px-6 font-heading font-black text-foreground transition-colors hover:bg-foreground hover:text-background"
                >
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
