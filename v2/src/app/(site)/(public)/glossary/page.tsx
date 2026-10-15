import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { CaretDownIcon } from "@phosphor-icons/react/ssr";

import { GLOSSARY, glossaryLetters, glossarySorted } from "@/lib/glossary";
import { GLOSSARY_STAGES, type GlossaryStage } from "@/lib/glossaryStages";

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
import { SITE_URL } from "@/lib/constants/site";
import { buttonVariants } from "@/components/ui/button";

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
  const names = new Map(GLOSSARY.map((t) => [t.slug, t.term]));
  const base = SITE_URL;
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
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">
          Glossary
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Every term this site uses, placed where it comes up on the way to a
          green card, then A to Z. The status words DOL prints on a case have{" "}
          <Link
            href="/perm-case-statuses"
            className="link"
          >
            their own page
          </Link>
          .
        </p>
      </header>

      <TermMap names={names} />

      <h2 className="mt-14 font-heading text-2xl font-bold sm:text-3xl">A to Z</h2>{" "}
      <nav aria-label="Jump to a letter" className="mt-5 flex flex-wrap gap-2">
        {letters.map((l) => (
          // Mapped siblings arrive with nothing between them; the space is part
          // of each iteration or it does not exist, and a whitespace-only node
          // is not a flex item.
          <Fragment key={l}>
            {" "}
            <a
              href={`#letter-${l}`}
              className="flex size-11 items-center justify-center border border-input bg-card font-heading text-base font-bold hover:bg-tint"
            >
              {l}
            </a>
          </Fragment>
        ))}
      </nav>

      <div className="mt-10">
        {groups.map((g) => (
          <section key={g.letter} aria-labelledby={`letter-${g.letter}`}>
            <h3
              id={`letter-${g.letter}`}
              className="mt-10 scroll-mt-28 border-b border-border pb-2 font-heading text-2xl font-bold first:mt-0"
            >
              {g.letter}
            </h3>{" "}
            {/* A DICTIONARY INDEX, NOT A WALL. Uncollapsed, this page is
                almost all prose, several times the words of a comparable
                gov.uk service page. The
                definitions are the content and stay in the DOM whether open
                or shut - <details> keeps its body for every crawler - so the
                first sentence of each is the row a reader scans and the rest
                opens on demand. The A-Z nav targets the letter headings above, which
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
                      <span className="font-heading text-lg font-bold">
                        {t.term}
                      </span>{" "}
                      {t.aka && t.aka.length > 0 ? (
                        <span className="mt-1 block text-sm text-muted-foreground">
                          {t.aka.join(", ")}
                        </span>
                      ) : null}
                    </span>{" "}
                    <span className="mt-1 block text-base leading-relaxed text-soft sm:mt-0">
                      {lead}
                    </span>{" "}
                    <CaretDownIcon
                      className="mt-1 h-5 w-5 shrink-0 justify-self-end text-primary transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                      aria-hidden="true"
                    />
                  </summary>{" "}
                  <div className="max-w-3xl pb-4 sm:ml-[calc(14rem+2rem)]">
                    {rest.length > 0 ? (
                      <p className="text-base leading-relaxed text-soft">
                        {rest.join(" ")}
                      </p>
                    ) : null}{" "}
                    {t.cite || (t.see && t.see.length > 0) ? (
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        {t.cite ? (
                          <a
                            href={t.cite.href}
                            rel="noopener noreferrer"
                            className="link font-mono text-sm"
                          >
                            {t.cite.label}
                          </a>
                        ) : null}{" "}
                        {(t.see ?? []).map((s) => (
                          <Fragment key={s.href}>
                            {" "}
                            <Link
                              href={s.href}
                              className="link"
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

/** One term as a jump link to its entry below. */
function TermChips({ slugs, names }: { slugs: readonly string[]; names: Map<string, string> }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {slugs.map((slug) => (
        <li key={slug}>
          <a
            href={`#${slug}`}
            className={buttonVariants({ variant: "outline", size: "default" })}
          >
            {names.get(slug) ?? slug}
          </a>{" "}
        </li>
      ))}
    </ul>
  );
}

function StageName({ stage }: { stage: GlossaryStage }) {
  return (
    <span className="block">
      <span className="block font-heading text-lg font-bold leading-tight">{stage.name}</span>{" "}
      <span className="block text-sm text-muted-foreground">{stage.who}</span>
    </span>
  );
}

/**
 * The terms placed on the road to a green card: six numbered stops joined by
 * a line, then the groups beside the road. Each term jumps to its entry.
 */
function TermMap({ names }: { names: Map<string, string> }) {
  const road = GLOSSARY_STAGES.filter((s) => s.onRoad);
  const beside = GLOSSARY_STAGES.filter((s) => !s.onRoad);
  return (
    <section aria-labelledby="glossary-map" className="mt-10">
      <h2 id="glossary-map" className="font-heading text-2xl font-bold sm:text-3xl">
        Where each term comes up
      </h2>{" "}
      <ol className="mt-6">
        {road.map((stage, i) => (
          <li
            key={stage.id}
            className="relative grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-4 gap-y-3 pb-7 last:pb-0 md:grid-cols-[2.75rem_13rem_minmax(0,1fr)]"
          >
            {/* The line joining one stop to the next. */}
            {i < road.length - 1 ? (
              <span aria-hidden="true" className="absolute bottom-0 left-[1.3rem] top-11 w-[3px] bg-border" />
            ) : null}
            <span className="relative flex h-11 w-11 items-center justify-center border border-input bg-card font-heading text-lg font-bold">
              {i + 1}
            </span>{" "}
            <StageName stage={stage} />{" "}
            <div className="col-start-2 md:col-start-3 md:row-start-1">
              <TermChips slugs={stage.slugs} names={names} />
            </div>
          </li>
        ))}
      </ol>{" "}
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 [&>*]:min-w-0">
        {beside.map((stage) => (
          <div key={stage.id} className="border border-dashed border-border p-4">
            <StageName stage={stage} />{" "}
            <div className="mt-3">
              <TermChips slugs={stage.slugs} names={names} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
