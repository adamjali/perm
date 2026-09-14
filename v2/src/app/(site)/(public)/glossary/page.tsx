import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";

import { GLOSSARY, glossaryLetters, glossarySorted } from "@/lib/glossary";

/**
 * The first sentence, and everything after it.
 *
 * Splits on ". " (a period FOLLOWED BY A SPACE), so a section number like
 * "20 CFR 656.40" inside a sentence is not a boundary. A one-sentence
 * definition comes back whole as the lead with nothing after it - the entry
 * still collapses, holding only its citations.
 */
function splitLead(definition: string): string[] {
  const i = definition.indexOf(". ");
  if (i < 0) return [definition];
  return [definition.slice(0, i + 1), definition.slice(i + 2)];
}
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The glossary: every term the site uses, defined once, each pointing at the
 * page where it meets real data. Static, alphabetical, one anchor per term,
 * and a DefinedTermSet so a machine reading the site gets the same
 * definitions a person does.
 */

const TITLE = "PERM and Green Card Glossary";
const DESCRIPTION = `${GLOSSARY.length} employment green card terms in plain words, each with the regulation it comes from: PERM, PWD, priority date, cutoff, RFI, audit, BALCA and more.`;
const PATH = "/glossary";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/glossary" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: PATH,
  },
}, "glossary");

export const dynamic = "force-static";

export default function GlossaryPage() {
  const terms = glossarySorted();
  const letters = glossaryLetters();
  const base = "https://permtracker.app";
  const termSet = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet" as const,
    "@id": `${base}${PATH}`,
    name: TITLE,
    description: DESCRIPTION,
    hasDefinedTerm: terms.map((t) => ({
      "@type": "DefinedTerm" as const,
      "@id": `${base}${PATH}#${t.slug}`,
      name: t.term,
      ...(t.aka && t.aka.length > 0 ? { alternateName: t.aka } : {}),
      description: t.definition,
      inDefinedTermSet: `${base}${PATH}`,
    })),
  };

  // Grouped before render rather than by mutating a counter inside the map,
  // which the React compiler's immutability rule rejects.
  const groups: { letter: string; terms: typeof terms }[] = [];
  for (const t of terms) {
    const letter = t.term.charAt(0).toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.terms.push(t);
    else groups.push({ letter, terms: [t] });
  }
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={termSet} />
      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link
            href="/methodology"
            className="underline underline-offset-2 hover:text-primary"
          >
            Reference
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Glossary
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          Every term this site uses, in the order a dictionary would. Each one
          says where it comes from, and where on the site it meets real data.
          The status words DOL prints on a case have{" "}
          <Link
            href="/perm-case-statuses"
            className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
          >
            their own page
          </Link>
          .
        </p>
      </header>

      <nav aria-label="Jump to a letter" className="mt-8 flex flex-wrap gap-2">
        {letters.map((l) => (
          // Mapped siblings arrive with nothing between them; the space is part
          // of each iteration or it does not exist, and a whitespace-only node
          // is not a flex item.
          <Fragment key={l}>
            {" "}
            <a
              href={`#letter-${l}`}
              className="flex size-11 items-center justify-center border-2 border-border bg-card font-heading text-base font-black shadow-hard-sm hover:-translate-y-[1px] hover:bg-tint-primary"
            >
              {l}
            </a>
          </Fragment>
        ))}
      </nav>

      <div className="mt-10">
        {groups.map((g) => (
          <section key={g.letter} aria-labelledby={`letter-${g.letter}`}>
            <h2
              id={`letter-${g.letter}`}
              className="mt-10 scroll-mt-28 border-b-2 border-border pb-2 font-heading text-2xl font-black first:mt-0"
            >
              {g.letter}
            </h2>{" "}
            {/* A DICTIONARY INDEX, NOT A WALL. Measured 2026-09-13: this
                page carried 2,386 visible prose words, 95% of everything on
                it, against 670 for a comparable gov.uk service page. The
                definitions are the content and stay in the DOM whether open
                or shut - <details> keeps its body for every crawler - so the
                first sentence of each is the row a reader scans and the rest
                opens on demand. The A-Z nav targets the <h2>s above, which
                sit outside any <details>; the per-term id sits on the
                <details> itself so a shared link lands on the visible row. */}
            <div className="divide-y divide-border/40">
              {g.terms.map((t) => {
                const [lead, ...rest] = splitLead(t.definition);
                return (
                <details
                  key={t.slug}
                  id={t.slug}
                  className="group scroll-mt-28 py-1"
                >
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:grid sm:grid-cols-[14rem_minmax(0,1fr)_1.25rem] sm:gap-x-8 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0">
                      <span className="font-heading text-lg font-black">
                        {t.term}
                      </span>{" "}
                      {t.aka && t.aka.length > 0 ? (
                        <span className="mt-1 block text-sm text-foreground/60">
                          {t.aka.join(", ")}
                        </span>
                      ) : null}
                    </span>{" "}
                    <span className="hidden text-base leading-relaxed text-foreground/85 sm:block">
                      {lead}
                    </span>{" "}
                    <CaretDownIcon
                      className="mt-1 h-5 w-5 shrink-0 justify-self-end text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>{" "}
                  <div className="max-w-3xl pb-4 sm:ml-[calc(14rem+2rem)]">
                    <p className="text-base leading-relaxed text-foreground/85">
                      <span className="sm:hidden">{lead} </span>
                      {rest.join(" ")}
                    </p>{" "}
                    {t.cite || (t.see && t.see.length > 0) ? (
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {t.cite ? (
                          <a
                            href={t.cite.href}
                            rel="noopener noreferrer"
                            className="font-mono text-xs font-bold underline underline-offset-2 hover:text-primary"
                          >
                            {t.cite.label}
                          </a>
                        ) : null}{" "}
                        {(t.see ?? []).map((s) => (
                          <Fragment key={s.href}>
                            {" "}
                            <Link
                              href={s.href}
                              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                            >
                              {s.label}
                            </Link>
                          </Fragment>
                        ))}
                      </p>
                    ) : null}
                  </div>
                </details>
                );
              })}
            </div>{" "}
          </section>
        ))}
      </div>
    </div>
  );
}
