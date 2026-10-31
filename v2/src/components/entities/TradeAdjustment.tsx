import { Fragment } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";

import { FinePrint } from "@/components/data/FinePrint";
import type { TaaPetition } from "@/lib/db/taaPetitions";
import { formatInt } from "@/lib/format";
import { shortDate } from "@convex/lib/months";

/**
 * A sponsor's Trade Adjustment Assistance petitions: groups of its workers DOL found, or didn't find, lost their jobs
 * to imports or to work moving abroad. DOL's codes in DOL's words (its Petition Data Dictionary); a code it doesn't
 * list prints as DOL printed it. The program stopped on July 1 2022.
 */

const WORDS: Record<string, string> = {
  C1: "Certified: imports",
  C2: "Certified: work moved abroad or bought from abroad",
  CU: "Certified: supplier to a certified firm",
  CD: "Certified: downstream of a certified firm",
  C: "Certified",
  P: "Partly certified",
  D: "Denied",
  T: "Investigation ended",
};
const CERTIFIED = new Set(["C1", "C2", "CU", "CD", "C", "P"]);
const DATASET_URL = "https://data.dol.gov/datasets/10363";

export function outcomeWords(code: string | null): string {
  if (!code) return "No determination recorded";
  return WORDS[code] ?? `DOL's code ${code}`;
}

export const isCertified = (code: string | null) => code !== null && CERTIFIED.has(code);

const year = (iso: string) => iso.slice(0, 4);

export function TradeAdjustment({ rows, pageName }: { rows: TaaPetition[]; pageName: string }) {
  if (rows.length === 0) return null;
  const certified = rows.filter((r) => isCertified(r.code));
  const denied = rows.filter((r) => r.code === "D");
  const workers = certified.reduce((sum, r) => sum + (r.workers ?? 0), 0);
  const years = rows.map((r) => year(r.decided)).sort();
  const span = years[0] === years[years.length - 1] ? years[0] : `${years[0]} to ${years[years.length - 1]}`;
  const shown = rows.slice(0, 12);
  return (
    <section id="trade-adjustment" className="mt-8 border-2 border-border bg-card p-5 shadow-hard sm:p-6" aria-labelledby="taa-heading">
      <h3 id="taa-heading" className="font-heading text-xl font-bold">
        Jobs lost to imports or work moved abroad
      </h3>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed">
        Workers at {pageName} petitioned DOL for Trade Adjustment Assistance {formatInt(rows.length)}{" "}
        {rows.length === 1 ? "time" : "times"} ({span}).{" "}
        {certified.length > 0
          ? `DOL certified ${formatInt(certified.length)}${workers > 0 ? `, covering an estimated ${formatInt(workers)} workers` : ""}`
          : "DOL certified none"}
        {denied.length > 0 ? ` and denied ${formatInt(denied.length)}` : ""}.
      </p>{" "}
      <details className="group mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          {rows.length > shown.length ? `The ${shown.length} newest petitions` : "Every petition"}{" "}
        </summary>{" "}
        <ul className="divide-y divide-border/40 border-t border-border/40">
          {shown.map((r) => (
            <Fragment key={r.petition}>
              {" "}
              <li className="py-3 text-sm leading-relaxed">
                <span className="font-bold">{outcomeWords(r.code)}</span>, {shortDate(r.decided) ?? r.decided}:{" "}
                {r.name}
                {r.city || r.state ? `, ${[r.city, r.state].filter(Boolean).join(", ")}` : ""}
                {r.workers ? `, about ${formatInt(r.workers)} workers` : ""}
                {r.product ? `. ${r.product}` : ""}.{" "}
              </li>
            </Fragment>
          ))}
        </ul>
      </details>{" "}
      <FinePrint className="mt-1" summary="What a petition means">
        A certification meant DOL found that imports or a shift of the work abroad contributed to the group&apos;s job
        losses, and the workers could get training and income support. A denial meant DOL didn&apos;t find that. The
        program stopped taking petitions on July 1 2022. Matched to this employer by name and city; different companies
        can share a name. From{" "}
        <a href={DATASET_URL} rel="noopener noreferrer" target="_blank" className="link">
          DOL&apos;s TAA petition data
        </a>
        .
      </FinePrint>
    </section>
  );
}
