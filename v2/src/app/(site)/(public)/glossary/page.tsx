import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";

import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { GLOSSARY, glossaryLetters, glossarySorted } from "@/lib/glossary";
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
            <dl>
              {g.terms.map((t) => (
                <div
                  key={t.slug}
                  id={t.slug}
                  className="scroll-mt-28 border-b border-border/40 py-5 sm:grid sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-x-8"
                >
                  <dt>
                    <span className="font-heading text-lg font-black">
                      {t.term}
                    </span>{" "}
                    {t.aka && t.aka.length > 0 ? (
                      <span className="mt-1 block text-sm text-foreground/60">
                        {t.aka.join(", ")}
                      </span>
                    ) : null}
                  </dt>{" "}
                  <dd className="mt-2 max-w-3xl sm:mt-0">
                    <p className="text-base leading-relaxed text-foreground/85">
                      {t.definition}
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
                  </dd>{" "}
                </div>
              ))}
            </dl>{" "}
          </section>
        ))}
      </div>
    </div>
  );
}
