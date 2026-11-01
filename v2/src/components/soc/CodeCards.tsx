import Link from "next/link";
import { CaretRightIcon } from "@phosphor-icons/react/ssr";

import { OnetCredit } from "@/components/reference/OnetCredit";
import { formatDollars, formatShareOf } from "@/lib/format";
import type { CodeSummary } from "@/lib/db/reference";
import { codeHref, type TitleCode } from "@/lib/socFinder";
import { cn } from "@/lib/utils";

/**
 * What each SOC code a title was filed under covers, side by side: O*NET's description, its three most
 * important tasks and how much preparation it takes, under the code's share of the title's filings. The
 * reader's question on a title page is which code fits the job, and the duties answer it (the code follows
 * the work, not the title). The most-filed codes show; the rest fold, in the same cards.
 */

const SHOWN = 4;

function Card({ code, summary, total, top, pay }: { code: TitleCode; summary: CodeSummary; total: number; top: number; pay: number | null }) {
  const width = top > 0 ? Math.max(2, (code.filings / top) * 100) : 0;
  return (
    <article className="flex min-w-0 flex-col border-2 border-border bg-card p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="h-2.5 min-w-0 flex-1 bg-sage" aria-hidden="true">
          <div className="h-full bg-primary" style={{ width: `${width}%` }} />
        </div>{" "}
        <span className="shrink-0 font-mono text-base font-bold tabular-nums">{formatShareOf(code.filings, total)}</span>
      </div>{" "}
      <h3 className="mt-2 font-heading text-xl font-bold leading-snug">
        <Link href={codeHref(code.soc, code.slug)} className="link inline-flex min-h-11 items-center">
          <span>
            <span className="whitespace-nowrap font-mono">{code.soc}</span> {code.codeTitle}
          </span>
        </Link>
      </h3>{" "}
      <p className="mt-3 text-base leading-relaxed">{summary.description}</p>{" "}
      {summary.tasks.length ? (
        <>
          <p className="mt-4 text-sm font-bold text-muted-foreground">Main tasks</p>{" "}
          <ul className="mt-1.5 space-y-1.5 text-base leading-relaxed">
            {summary.tasks.map((t) => (
              <li key={t} className="flex gap-2.5">
                <span className="mt-[0.6em] size-1.5 shrink-0 bg-primary-text" aria-hidden="true" />{" "}
                <span className="min-w-0">{t}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}{" "}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {summary.zoneName ? (
          <span className="border-2 border-border bg-sage px-2.5 py-1 text-sm">
            {`Job Zone ${summary.zoneLabel}: ${summary.zoneName}`}
          </span>
        ) : null}{" "}
        {pay ? <span className="border-2 border-border bg-sage px-2.5 py-1 text-sm">{`BLS median ${formatDollars(pay)} a year`}</span> : null}
      </div>
    </article>
  );
}

export function CodeCards({
  title,
  codes,
  summaries,
  total,
  payOf,
  version,
  className,
}: {
  title: string;
  /** The codes the title was filed under, most-filed first. */
  codes: TitleCode[];
  summaries: Map<string, CodeSummary>;
  total: number;
  payOf: Map<string, number | null>;
  /** O*NET's database version, for the credit. */
  version?: string | null;
  className?: string;
}) {
  const described = codes.filter((c) => summaries.has(c.soc));
  if (!described.length) return null;
  const top = described[0]!.filings;
  const shown = described.slice(0, SHOWN);
  const rest = described.slice(SHOWN);
  const grid = (list: TitleCode[]) => (
    <div className={cn("grid grid-cols-1 gap-4 [&>*]:min-w-0", list.length > 1 && "md:grid-cols-2")}>
      {list.map((c) => (
        <Card key={c.soc} code={c} summary={summaries.get(c.soc)!} total={total} top={top} pay={payOf.get(c.soc) ?? null} />
      ))}
    </div>
  );
  return (
    <section className={cn("mt-12", className)} aria-labelledby="covers">
      <h2 id="covers" className="font-heading text-2xl font-bold sm:text-3xl">
        {described.length === 1 ? `What ${described[0]!.soc} covers` : "What each code covers"}
      </h2>{" "}
      <p className="mt-2 max-w-3xl text-base text-soft">
        {described.length === 1
          ? `O*NET's description of the code ${title} is filed under.`
          : "O*NET's description of each code. The job's duties decide which one fits, not its title."}
      </p>
      <div className="mt-6">{grid(shown)}</div>{" "}
      {rest.length ? (
        <details className="group mt-4">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-base font-bold [&::-webkit-details-marker]:hidden">
            <CaretRightIcon aria-hidden="true" weight="bold" className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            {`${rest.length} more ${rest.length === 1 ? "code" : "codes"}, ${formatShareOf(rest[0]!.filings, total)} of filings or fewer each`}
          </summary>
          <div className="mt-3">{grid(rest)}</div>
        </details>
      ) : null}{" "}
      <OnetCredit className="mt-6" version={version} note="only each code's top tasks are shown" />
    </section>
  );
}
