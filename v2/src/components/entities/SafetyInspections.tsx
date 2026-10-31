import { Fragment } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";

import { FinePrint } from "@/components/data/FinePrint";
import { formatInt } from "@/lib/format";
import type { OshaInspection, OshaSummary } from "@/lib/db/osha";

/**
 * A PERM sponsor's OSHA inspections, on its own page: the totals first, the newest inspections folded under them.
 *
 * OSHA's own cautions go with them: different companies can share a name; an open inspection's citations can still
 * be contested, settled or deleted; the penalty shown is the amount assessed now, which a settlement can lower.
 */

const DATASET_URL = "https://data.dol.gov/datasets/10334";

// OSHA's inspection types (its data dictionary, DOL dataset 10334), in plain words.
const TYPE_WORDS: Record<string, string> = {
  A: "After an accident",
  B: "After a complaint",
  C: "After a referral",
  D: "Monitoring",
  E: "A variance request",
  F: "A follow-up",
  G: "Unplanned, tied to another inspection",
  H: "Planned",
  I: "Planned, tied to another inspection",
  J: "Unplanned, other",
  K: "Planned, other",
  L: "Other",
  M: "After a death or catastrophe",
  N: "Unplanned, an emphasis program",
};

export function inspectionType(code: string | null): string {
  return (code && TYPE_WORDS[code]) || "Type not given";
}

/** OSHA's own page for one inspection, for people (its robots.txt asks scripts off; nothing here reads it). */
export function inspectionUrl(activityNr: string): string {
  return `https://www.osha.gov/ords/imis/establishment.inspection_detail?id=${encodeURIComponent(activityNr)}`;
}

const money = (v: number) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 });
const day = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const monthYear = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }) : null;
const plural = (k: number, one: string, many = `${one}s`) => `${formatInt(k)} ${k === 1 ? one : many}`;

export function citedLine(
  i: Pick<OshaInspection, "violations" | "serious" | "willful" | "repeat" | "penalty"> & { open?: boolean },
): string {
  // An open inspection can still bring citations: nothing cited yet isn't a clean result.
  if (i.violations === 0) return i.open ? "No violations cited yet." : "No violations cited.";
  const kinds = [
    i.willful > 0 ? `${formatInt(i.willful)} willful` : null,
    i.repeat > 0 ? `${formatInt(i.repeat)} repeat` : null,
    i.serious > 0 ? `${formatInt(i.serious)} serious` : null,
  ].filter(Boolean);
  const head = plural(i.violations, "violation") + (kinds.length ? ` (${kinds.join(", ")})` : "");
  return `${head}${i.penalty > 0 ? `, ${money(i.penalty)} in penalties` : ""}.`;
}

export function SafetyInspections({ summary, pageName }: { summary: OshaSummary | null; pageName: string }) {
  if (!summary) return null;
  const grave = summary.serious + summary.willful + summary.repeat;
  const notes = [
    summary.open > 0 ? `${plural(summary.open, "inspection")} still open` : null,
    summary.afterHarm > 0 ? `${formatInt(summary.afterHarm)} after an accident, a death or a catastrophe` : null,
  ].filter(Boolean);
  const from = monthYear(summary.firstOpen);
  const to = monthYear(summary.lastOpen);
  return (
    <section id="safety-inspections" className="mt-8 border-2 shadow-hard p-5 sm:p-6 bg-card border-border" aria-labelledby="osha-heading">
      <h2 id="osha-heading" className="font-heading text-xl font-bold">
        OSHA inspections at {pageName}
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        Workplace safety and health inspections by OSHA and the state plans{from ? `, opened ${from === to ? `in ${from}` : `from ${from} to ${to}`}` : ""},
        matched to this employer by name.
      </p>{" "}

      <dl className="mt-4 grid grid-cols-1 border-y-2 border-border sm:grid-cols-3 [&>*]:min-w-0">
        <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:pr-4">
          <dt className="text-sm text-muted-foreground">Inspections</dt>{" "}
          <dd className="font-heading text-2xl font-bold tabular-nums">{formatInt(summary.inspections)}</dd>{" "}
          <dd className="text-sm">{formatInt(summary.withViolations)} cited a violation</dd>
        </div>{" "}
        <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:px-4">
          <dt className="text-sm text-muted-foreground">Serious, willful or repeat</dt>{" "}
          <dd className="font-heading text-2xl font-bold tabular-nums">{formatInt(grave)}</dd>{" "}
          <dd className="text-sm">of {plural(summary.violations, "violation")} cited</dd>
        </div>{" "}
        <div className="py-3 sm:pl-4">
          <dt className="text-sm text-muted-foreground">Penalties assessed</dt>{" "}
          <dd className="font-heading text-2xl font-bold tabular-nums">{money(summary.penalty)}</dd>{" "}
          {summary.initialPenalty > summary.penalty ? (
            <dd className="text-sm">{money(summary.initialPenalty)} when first assessed</dd>
          ) : null}
        </div>
      </dl>{" "}

      {notes.length > 0 ? <p className="mt-3 text-base">{notes.join("; ")}.</p> : null}{" "}

      <details className="group mt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          {summary.inspections > summary.newest.length ? `The ${summary.newest.length} newest inspections` : "Every inspection"}{" "}
        </summary>{" "}
        <ul className="divide-y divide-border/40 border-t border-border/40">
          {summary.newest.map((i) => (
            <Fragment key={i.activityNr}>
              {" "}
              <li className="py-3 text-sm leading-relaxed">
                <span className="font-bold">{day(i.openDate)}</span>
                {i.city || i.state ? `, ${[i.city, i.state].filter(Boolean).join(", ")}` : ""}: {inspectionType(i.type)}
                {i.closeDate ? "" : ", still open"}. {citedLine({ ...i, open: !i.closeDate })}{" "}
                <span className="block text-muted-foreground">
                  As inspected: {i.name}.{" "}
                  <a href={inspectionUrl(i.activityNr)} rel="noopener noreferrer" target="_blank" className="link">
                    OSHA&apos;s record of inspection {i.activityNr}
                  </a>
                </span>{" "}
              </li>
            </Fragment>
          ))}
        </ul>
      </details>{" "}

      <FinePrint className="mt-1" summary="What OSHA says about these figures">
        OSHA&apos;s notes: different companies can have similar names, so check the place and the record; an open
        inspection&apos;s citations can still be contested, settled or deleted; violations deleted by a settlement or a
        court aren&apos;t counted, and grouped violations count once; the penalty is the amount assessed now, which a
        settlement can lower. Inspections from October 2016 on.{" "}
        <a href={DATASET_URL} rel="noopener noreferrer" target="_blank" className="link">
          OSHA&apos;s inspection data
        </a>
        .
      </FinePrint>
    </section>
  );
}
