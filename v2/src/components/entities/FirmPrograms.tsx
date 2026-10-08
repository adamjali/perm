import { Fragment } from "react";
import Link from "next/link";

import { formatInt, formatShare } from "@/lib/format";
import type { FirmProgramLine, FirmPrograms as FirmProgramsData } from "@/lib/turso/firmPrograms";

/**
 * A law firm's H-1B, wage-request and H-2A, H-2B and CW-1 work, beside its
 * PERM record: how many of each it filed for clients, and the employers it
 * filed the most for. Plain server markup; absent when DOL's files name the
 * firm on none of them.
 */

const LINK = "font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

function monthYear(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Column({ label, noun, line }: { label: string; noun: string; line: FirmProgramLine }) {
  const from = monthYear(line.firstDecided);
  const to = monthYear(line.lastDecided);
  return (
    <div>
      <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground/70">{label}</h3>{" "}
      <p className="mt-2">
        <span className="font-heading text-3xl font-black tabular-nums">{formatInt(line.filings)}</span>{" "}
        <span className="text-sm text-foreground/70">
          {noun}
          {line.certified !== null && line.filings > 0
            ? `, ${formatShare(line.certified / line.filings)} certified`
            : ""}
        </span>
      </p>{" "}
      {from && to ? (
        <p className="mt-1 text-sm text-foreground/70">
          Decided {from === to ? `in ${from}` : `from ${from} to ${to}`}.
        </p>
      ) : null}{" "}
      {line.employers.length ? (
        <>
          <p className="mt-4 text-sm font-bold">The employers it filed the most for</p>
          <ol className="mt-1 divide-y divide-border/60">
            {line.employers.map((e, i) => (
              <Fragment key={`${e.slug ?? e.name}-${i}`}>
                {" "}
                <li className="flex items-baseline gap-3 py-1.5 text-base">
                  {e.slug ? (
                    <Link href={`/perm-employers/${e.slug}`} className={`min-w-0 truncate ${LINK}`}>
                      {e.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate">{e.name}</span>
                  )}{" "}
                  <span className="ml-auto font-mono text-sm tabular-nums text-foreground/70">{formatInt(e.filings)}</span>
                </li>
              </Fragment>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}

export function FirmPrograms({ name, data, className = "mt-10" }: { name: string; data: FirmProgramsData | null; className?: string }) {
  if (!data || (!data.lca && !data.pwd && !data.seasonal)) return null;
  return (
    <section className={`${className} border-2 border-border bg-card p-6 shadow-hard sm:p-8`}>
      <h2 className="font-heading text-xl font-black sm:text-2xl">Beyond PERM: its other work for clients</h2>{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-foreground/70">
        DOL names the law firm or agent on each H-1B labor condition application, prevailing wage request and H-2A,
        H-2B and CW-1 application it publishes.
        These are the ones that name {name}
        {data.spellings > 1 ? `, under ${formatInt(data.spellings)} spellings of its name` : ""}.
      </p>{" "}
      <div className="mt-5 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0">
        {data.lca ? <Column label="H-1B LCAs" noun="LCAs filed for clients" line={data.lca} /> : null}{" "}
        {data.pwd ? <Column label="Prevailing wage requests" noun="wage requests" line={data.pwd} /> : null}{" "}
        {data.seasonal ? <Column label="H-2A, H-2B and CW-1" noun="applications" line={data.seasonal} /> : null}
      </div>
    </section>
  );
}
