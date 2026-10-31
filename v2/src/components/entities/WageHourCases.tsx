import { Fragment } from "react";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";

import { FinePrint } from "@/components/data/FinePrint";
import { formatInt } from "@/lib/format";
import type { WhdCase, WhdSummary } from "@/lib/db/whd";

/**
 * An employer's Wage and Hour Division cases, on its own page: the totals first, the newest cases folded under them.
 *
 * A case is DOL's record of a compliance action, and DOL's own cautions go with it: a case with no violations is a
 * case, not a finding; back wages are what the employer agreed to pay, not what it paid; the findings period isn't
 * when the case opened or closed. The visa programs get their own line, because those are the findings a worker on
 * a visa came here for.
 */

const DATASET_URL = "https://data.dol.gov/datasets/10362";

// Cents only where a small sum has them: "$0", "$12.50", "$15,501".
const money = (v: number) =>
  v.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: v >= 1000 || Number.isInteger(v) ? 0 : 2,
  });
const monthYear = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : null;
const plural = (k: number, one: string, many = `${one}s`) => `${formatInt(k)} ${k === 1 ? one : many}`;

function period(c: WhdCase): string {
  const a = monthYear(c.findingsStart);
  const b = monthYear(c.findingsEnd);
  if (a && b) return a === b ? a : `${a} to ${b}`;
  return a ?? b ?? "Dates not given";
}

function caseLine(c: WhdCase): string {
  if (c.violations === 0 && c.backWages === 0) return "No violations found.";
  const parts = [plural(c.violations, "violation")];
  if (c.backWages > 0) parts.push(`${money(c.backWages)} in back wages to ${plural(c.workersOwed, "worker")}`);
  if (c.penalties > 0) parts.push(`${money(c.penalties)} in penalties`);
  return `${parts.join(", ")}.`;
}

export function WageHourCases({ summary, pageName }: { summary: WhdSummary | null; pageName: string }) {
  if (!summary) return null;
  const visa = [
    ["H-1B", summary.h1b],
    ["H-2A", summary.h2a],
    ["H-2B", summary.h2b],
  ] as const;
  const visaFound = visa.filter(([, t]) => t.cases > 0);
  return (
    <section id="wage-cases" className="mt-8 border-2 shadow-hard p-5 sm:p-6 bg-card border-border" aria-labelledby="whd-heading">
      <h2 id="whd-heading" className="font-heading text-xl font-bold">
        Wage and Hour cases at {pageName}
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
        The Labor Department&apos;s concluded compliance actions{summary.firstStart ? ` with findings from ${monthYear(summary.firstStart)}` : ""}
        {summary.lastEnd ? ` to ${monthYear(summary.lastEnd)}` : ""}, matched to this employer by name.
      </p>{" "}

      <dl className="mt-4 grid grid-cols-1 border-y-2 border-border sm:grid-cols-3 [&>*]:min-w-0">
        <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:pr-4">
          <dt className="text-sm text-muted-foreground">Cases</dt>{" "}
          <dd className="font-heading text-2xl font-bold tabular-nums">{formatInt(summary.cases)}</dd>{" "}
          <dd className="text-sm">{plural(summary.withViolations, "with violations", "with violations")} found</dd>
        </div>{" "}
        <div className="border-b-2 border-border py-3 sm:border-b-0 sm:border-r-2 sm:px-4">
          <dt className="text-sm text-muted-foreground">Back wages agreed</dt>{" "}
          <dd className="font-heading text-2xl font-bold tabular-nums">{money(summary.backWages)}</dd>{" "}
          <dd className="text-sm">to {plural(summary.workersOwed, "worker")}</dd>
        </div>{" "}
        <div className="py-3 sm:pl-4">
          <dt className="text-sm text-muted-foreground">Penalties assessed</dt>{" "}
          <dd className="font-heading text-2xl font-bold tabular-nums">{money(summary.penalties)}</dd>
        </div>
      </dl>{" "}

      {visaFound.length > 0 ? (
        <ul className="mt-4 space-y-1" aria-label="Visa program findings">
          {visaFound.map(([label, t]) => (
            <li key={label} className="text-base">
              <span className="mr-2 inline-block bg-soft-warn px-1.5 font-bold">{label}</span>
              {plural(t.cases, "case")}, {plural(t.violations, "violation")}
              {t.backWages > 0 ? `, ${money(t.backWages)} in back wages to ${plural(t.workers, "worker")}` : ""}.{" "}
            </li>
          ))}
        </ul>
      ) : null}{" "}

      <details className="group mt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-bold [&::-webkit-details-marker]:hidden">
          <CaretRightIcon aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
          {summary.cases > summary.newest.length ? `The ${summary.newest.length} newest cases` : "Every case"}{" "}
        </summary>{" "}
        <ul className="divide-y divide-border/40 border-t border-border/40">
          {summary.newest.map((c) => (
            <Fragment key={c.caseId}>
              {" "}
              <li className="py-3 text-sm leading-relaxed">
                <span className="font-bold">{period(c)}</span>
                {c.city || c.state ? `, ${[c.city, c.state].filter(Boolean).join(", ")}` : ""}: {caseLine(c)}{" "}
                {c.visa.map((v) => (
                  <span key={v.program} className="block">
                    {v.program}: {plural(v.violations, "violation")}
                    {v.backWages > 0 ? `, ${money(v.backWages)} to ${plural(v.workers, "worker")}` : ""}.{" "}
                  </span>
                ))}
                <span className="block text-muted-foreground">
                  As filed: {c.name}, DOL case {c.caseId}
                </span>{" "}
              </li>
            </Fragment>
          ))}
        </ul>
      </details>{" "}

      <FinePrint className="mt-1" summary="What DOL says about these figures">
        DOL&apos;s notes: the findings period isn&apos;t when the case opened or closed; back wages are what the employer
        agreed to pay, not what was paid; a case with no violations is still listed; counts loaded after October 1,
        2025 aren&apos;t directly comparable with earlier ones. Matched by the employer&apos;s legal name, so another
        company with the same name can be missed or, rarely, included.{" "}
        <a href={DATASET_URL} rel="noopener noreferrer" target="_blank" className="link">
          DOL&apos;s Wage and Hour data
        </a>
        .
      </FinePrint>
    </section>
  );
}
