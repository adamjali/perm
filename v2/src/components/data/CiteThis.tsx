"use client";

import { useState } from "react";
import { CaretRightIcon } from "@phosphor-icons/react";

import { CopyButton } from "@/components/badges/BadgeCatalogue";
import { intlLocale, type Lang } from "@/lib/i18n/lang";

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
/** A translated page's own words for the citation; English otherwise. */
export interface CiteWords {
  summary: string;
  data: (date: string) => string;
  accessed: (date: string) => string;
  locale: Lang;
}

export function citationFor(
  title: string,
  url: string,
  dataThrough: string | null,
  today: string,
  words?: Pick<CiteWords, "data" | "accessed">,
): string {
  const name = title.replace(/\s*\|\s*PERM Tracker\s*$/, "").trim();
  const data = dataThrough ? (words ? words.data(dataThrough) : `, data through ${dataThrough}`) : "";
  const accessed = words ? words.accessed(today) : `(accessed ${today})`;
  return `${name}. PERM Tracker${data}. ${url} ${accessed}.`;
}

export function CiteThis({ dataThrough, words }: { dataThrough: string | null; words?: CiteWords }) {
  const [text, setText] = useState("");
  function build(open: boolean) {
    if (!open || text) return;
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    const url = canonical || window.location.href.split("#")[0] || "";
    const today = new Date().toLocaleDateString(words ? intlLocale(words.locale) : "en-US", {
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
        {words?.summary ?? "Cite this page"}
      </summary>{" "}
      <div className="flex max-w-3xl flex-wrap items-start gap-3 pb-1 pl-5">
        <p className="min-w-0 flex-1 text-sm leading-relaxed text-muted-foreground">{text}</p>{" "}
        {text ? <CopyButton text={text} /> : null}
      </div>
    </details>
  );
}
