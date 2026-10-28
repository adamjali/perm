"use client";

import { useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";

import { CopyButton } from "@/components/badges/BadgeCatalogue";
import { intlLocale, type Lang } from "@/lib/i18n/lang";
import { PROVENANCE } from "./DataProvenance.messages";

/**
 * "Cite this page": the page's title, PERM Tracker, the date its data runs
 * to, its address and today's date, ready to copy. A writer who can lift a
 * citation in one click links to the page; one who has to assemble it often
 * names the site and leaves the link out.
 *
 * Built when the fold opens, from the page's own title and canonical address,
 * so one component serves every data page. Shut, it costs nothing; a crawler
 * reads only the summary line.
 */
/** The citation's own words in a language. */
export interface CiteWords {
  data: (date: string) => string;
  accessed: (date: string) => string;
}

export function citationFor(
  title: string,
  url: string,
  dataThrough: string | null,
  today: string,
  words?: CiteWords,
): string {
  const name = title.replace(/\s*\|\s*PERM Tracker\s*$/, "").trim();
  const data = dataThrough ? (words ? words.data(dataThrough) : `, data through ${dataThrough}`) : "";
  const accessed = words ? words.accessed(today) : `(accessed ${today})`;
  return `${name}. PERM Tracker${data}. ${url} ${accessed}.`;
}

/**
 * `lang` is the one thing a translated page passes: the words come from the messages module here, in the
 * browser, because a server component can't hand a function to a client one (every translated case page
 * rendered the error screen until Oct 28 2026, when this took `words` with two functions in it).
 */
export function CiteThis({ dataThrough, lang = "en" }: { dataThrough: string | null; lang?: Lang }) {
  const t = PROVENANCE[lang];
  const words = lang === "en" ? undefined : { data: t.citeData, accessed: t.citeAccessed };
  const [text, setText] = useState("");
  function build(open: boolean) {
    if (!open || text) return;
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const url = canonical || window.location.href.split("#")[0] || "";
    const today = new Date().toLocaleDateString(intlLocale(lang), {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });
    setText(citationFor(document.title, url, dataThrough, today, words));
  }
  return (
    <details className="group mt-1" onToggle={(e) => build(e.currentTarget.open)}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center gap-1.5 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
        <CaretRightIcon
          className="h-3.5 w-3.5 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          weight="bold"
          aria-hidden="true"
        />{" "}
        {t.citeSummary}
      </summary>{" "}
      <div className="flex max-w-3xl flex-wrap items-start gap-3 pb-1 pl-5">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p>{" "}
        {text ? <CopyButton text={text} /> : null}
      </div>
    </details>
  );
}
