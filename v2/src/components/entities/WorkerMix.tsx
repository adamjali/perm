import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import type { WorkerFacet, WorkerFacetRow } from "@/lib/db/employerHistory";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

/**
 * Who an employer (or an occupation) sponsored, from its FY2016 to FY2023
 * cases: countries of citizenship, education, the visa held at filing, the
 * schools and the fields of study. DOL publishes these on its old form only;
 * the form in use since mid-2023 carries none of them, so the section names
 * its years rather than implying it describes today's filings.
 *
 * Bars inside each panel, scaled to that panel's own leader: the question is
 * "how concentrated", and a bar answers it before a number does.
 */

const PANELS: { facet: WorkerFacet; title: string }[] = [
  { facet: "citizenship", title: "Country of citizenship" },
  { facet: "education", title: "Worker's education" },
  { facet: "visa_class", title: "Visa held when filed" },
  { facet: "institution", title: "Schools" },
  { facet: "major", title: "Fields of study" },
];

function Panel({ title, rows }: { title: string; rows: WorkerFacetRow[] }) {
  const top = rows[0]?.n ?? 0;
  return (
    <section >
      <h3 className="font-heading text-lg font-bold">{title}</h3>{" "}
      <ChartTips label={`${title}, FY2016 to FY2023 cases`} className="mt-4">
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <Fragment key={r.key}>
            {" "}
            <li data-tip={`${r.label}\n${formatInt(r.n)} ${r.n === 1 ? "case" : "cases"}, FY2016 to FY2023\n#${i + 1} of the top ${rows.length}`}>
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm font-bold">{r.label}</span>{" "}
                <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{formatInt(r.n)}</span>
              </span>{" "}
              <span className="mt-1 block h-2 w-full bg-sage" aria-hidden="true">
                <span
                  className="block h-full bg-primary"
                  style={{ width: `${top > 0 ? Math.max(2, (r.n / top) * 100) : 0}%` }}
                />
              </span>
            </li>
          </Fragment>
        ))}
      </ul>
      </ChartTips>
    </section>
  );
}

export function WorkerMix({
  facets,
  subject,
  className,
}: {
  facets: Partial<Record<WorkerFacet, WorkerFacetRow[]>>;
  /** "they" for an employer, "this occupation" for an occupation. */
  subject: "employer" | "occupation";
  className?: string;
}) {
  const panels = PANELS.filter((p) => (facets[p.facet]?.length ?? 0) > 0);
  if (panels.length === 0) return null;
  return (
    <section className={cn("mt-12", className)}>
      <h2 className="font-heading text-2xl font-bold">
        {subject === "employer" ? "Who they sponsored, FY2016 to FY2023" : "Who filled these jobs, FY2016 to FY2023"}
      </h2>{" "}
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        From DOL&apos;s old form; the form in use since mid-2023 doesn&apos;t carry
        them. Top six of each.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2 xl:grid-cols-3">
        {panels.map((p) => (
          <Panel key={p.facet} title={p.title} rows={facets[p.facet]!} />
        ))}
      </div>
    </section>
  );
}
