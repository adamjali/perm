import Link from "next/link";

import { ABOUT_TWO_HALVES } from "@/lib/constants/about";

import { ArrowRight } from "./icons";

/**
 * The two audiences, side by side, with EQUAL headings.
 *
 * Answer engines aggregate a page's H2s into "what this product is". The Sep 3
 * 2026 audit removed the attorney H2s from the homepage because AI overviews
 * were calling the site attorney-only; that fixed the framing by absence and
 * left the page describing one side. This block states both sides in full at
 * the same weight: the same heading level, the same list length, the same
 * shape. `/for-attorneys` keeps the long form; this is the complete short one.
 *
 * Plain server-rendered markup on purpose: no Motion wrapper, so the text is in
 * the prerendered HTML for every crawler and every reader before hydration.
 */

interface Half {
  eyebrow: string;
  heading: string;
  lede: string;
  items: readonly string[];
  cta: { href: string; label: string };
  secondary: { href: string; label: string };
}

const HALVES: readonly Half[] = [
  {
    eyebrow: "If you are waiting on a case",
    heading: "For the person waiting on a PERM case",
    lede: ABOUT_TWO_HALVES.waiting,
    items: [
      "Look up any PERM (G- or A-), prevailing wage (P-) or H-1B LCA (I-) number, pending included",
      "See the federal record, where DOL's queue stands, and an estimate that says when it is one",
      "Free email alerts: a status change, DOL reaching your filing month, a visa bulletin move",
      "Search every filing by employer, law firm, worksite state and occupation",
      "Processing times, wages, denial rates and the visa bulletin, from the government's own files",
    ],
    cta: { href: "/perm-case-status", label: "Check my case" },
    secondary: { href: "/perm-queue", label: "Where the queue stands" },
  },
  {
    eyebrow: "If you file or manage cases",
    heading: "For attorneys, paralegals and HR teams",
    lede: ABOUT_TWO_HALVES.practice,
    items: [
      "Every deadline computed per case under 20 CFR 656: wage expiration, recruitment clocks, the ETA 9089 window, audit and RFI responses, the I-140 cutoff",
      "Change one date and every downstream date recalculates",
      "Email and push reminders 1 to 30 days out, quiet hours, calendar sync, a Monday digest",
      "CSV import with field mapping, export any time, an AI assistant over your caseload",
      "Client data encrypted at rest and isolated per account, with a privacy mode for screen sharing",
    ],
    cta: { href: "/signup", label: "Start tracking cases" },
    secondary: { href: "/for-attorneys", label: "How the software works" },
  },
];

export function AudienceBlocks() {
  return (
    <section
      id="who-it-is-for"
      aria-labelledby="who-it-is-for-heading"
      className="border-b-3 border-border bg-background py-16 sm:py-20"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-8">
        <h2
          id="who-it-is-for-heading"
          className="font-heading text-2xl font-black tracking-tight sm:text-3xl lg:text-4xl"
        >
          Both sides of a PERM filing
        </h2>{" "}
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
          One site, two halves, both free. The person waiting on a case and the
          people who file it read the same federal record.
        </p>{" "}
        <div className="mt-10 grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-2">
          {HALVES.map((h) => (
            <article
              key={h.heading}
              className="flex flex-col border-3 border-border bg-card p-6 shadow-hard sm:p-8"
            >
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {h.eyebrow}
              </p>{" "}
              <h3 className="mt-3 font-heading text-xl font-black tracking-tight sm:text-2xl">
                {h.heading}
              </h3>{" "}
              <p className="mt-3 text-base leading-relaxed text-foreground/80">
                {h.lede}
              </p>{" "}
              <ul className="mt-5 flex flex-col gap-3">
                {h.items.map((item) => (
                  <li key={item} className="flex gap-3 text-base leading-relaxed text-foreground/90">
                    <span aria-hidden="true" className="mt-[0.55em] block h-2.5 w-2.5 shrink-0 bg-primary" />
                    <span>{item}{" "}</span>
                  </li>
                ))}
              </ul>{" "}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
