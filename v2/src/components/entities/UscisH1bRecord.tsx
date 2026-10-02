import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { FinePrint } from "@/components/data/FinePrint";
import {
  H1B_KINDS,
  USCIS_H1B_GLOSSARY,
  USCIS_H1B_HUB,
  approvalRate,
  leadYear,
  sum,
  type UscisH1bRecord as Record_,
} from "@/lib/uscisH1b";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

/**
 * What USCIS decided on one employer's H-1B petitions, year by year, from its
 * H-1B Employer Data Hub. The LCA panel above it says what DOL certified the
 * employer to file; this is what USCIS then approved and denied. Counts of
 * workers on USCIS's first decision; the definitions and every exclusion are
 * USCIS's own (`lib/uscisH1b.ts`).
 */

function pct(r: number): string {
  return `${(r * 100).toFixed(r >= 0.995 || r < 0.005 ? 1 : 0)}%`;
}

function longDate(iso: string | null): string | null {
  const d = iso?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

export function UscisH1bRecord({
  record,
  through,
  className,
}: {
  record: Record_ | null;
  /** The hub's last date (its freshness `as_of`), so a part-year is labelled as one. */
  through: string | null;
  className?: string;
}) {
  if (!record || record.years.length === 0) return null;
  const lead = leadYear(record.years, through);
  if (!lead) return null;
  const y = lead.year;
  const approved = sum(y.approved);
  const denied = sum(y.denied);
  const rate = approvalRate(approved, denied);
  const first = record.years[0]!.fy;
  const newest = record.years[record.years.length - 1]!;
  const throughLabel = longDate(through);
  const peak = Math.max(...record.years.map((v) => sum(v.approved) + sum(v.denied)), 1);
  const others = record.nameCount - record.names.length;

  return (
    <section className={cn("mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8", className)}>
      <h2 className="font-heading text-xl font-black sm:text-2xl">What USCIS decided on its H-1B petitions</h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        Workers approved and denied on USCIS&apos;s first decision, FY{first} to FY{newest.fy}
        {throughLabel && through && through < `${newest.fy}-09-30` ? ` (through ${throughLabel})` : ""}, from{" "}
        <a href={USCIS_H1B_HUB} rel="noopener noreferrer" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
          USCIS&apos;s H-1B Employer Data Hub
        </a>
        .
      </p>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        <div className="border-2 border-border p-4">
          <p className="text-sm font-bold text-foreground/70">Approved, FY{y.fy}{lead.partial ? " so far" : ""}</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{formatInt(approved)}</p>
        </div>{" "}
        <div className="border-2 border-border p-4">
          <p className="text-sm font-bold text-foreground/70">Denied</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{formatInt(denied)}</p>
        </div>{" "}
        <div className="border-2 border-border bg-tint-primary p-4">
          <p className="text-sm font-bold text-foreground/70">Approved on first decision</p>{" "}
          <p className="mt-1 font-heading text-3xl font-black tabular-nums">{rate === null ? "Too few" : pct(rate)}</p>{" "}
          {rate === null ? <p className="text-sm text-foreground/70">Under 20 decisions that year.</p> : null}
        </div>
      </div>{" "}
      <p className="mt-3 text-base">
        New employment: <b className="font-bold tabular-nums">{formatInt(y.approved.new)}</b> approved. Moving here from another
        employer: <b className="font-bold tabular-nums">{formatInt(y.approved.chg)}</b> approved.
      </p>{" "}
      <h3 className="mt-8 font-heading text-lg font-black">Every year</h3>{" "}
      <ChartTips label="Workers approved and denied each fiscal year" className="mt-3">
      <ul className="space-y-1.5" aria-label="Workers approved and denied each fiscal year">
        {[...record.years].reverse().map((v) => {
          const a = sum(v.approved);
          const d = sum(v.denied);
          const r = approvalRate(a, d);
          const tip = [
            `FY${v.fy}`,
            `${formatInt(a)} approved, ${formatInt(d)} denied`,
            r === null ? null : `${pct(r)} approved on first decision`,
            ...H1B_KINDS.filter((k) => v.approved[k.key] + v.denied[k.key] > 0).map(
              (k) => `${k.label}: ${formatInt(v.approved[k.key])} approved, ${formatInt(v.denied[k.key])} denied`,
            ),
          ]
            .filter(Boolean)
            .join("\n");
          return (
            <Fragment key={v.fy}>
              {" "}
              <li data-tip={tip} className="grid grid-cols-[4rem_1fr_auto] items-center gap-3 [&>*]:min-w-0">
                <span className="font-mono text-sm font-bold">FY{v.fy}</span>{" "}
                <span className="flex h-3 w-full bg-muted" aria-hidden="true">
                  <span className="h-full bg-data-good-ink" style={{ width: `${(a / peak) * 100}%` }} />
                  <span className="h-full bg-data-bad-ink" style={{ width: `${(d / peak) * 100}%` }} />
                </span>{" "}
                <span className="font-mono text-sm tabular-nums text-foreground/80">
                  {formatInt(a)} approved, {formatInt(d)} denied
                </span>
              </li>
            </Fragment>
          );
        })}
      </ul>
      </ChartTips>{" "}
      <p className="mt-2 text-sm text-foreground/70">Green: approved. Red: denied. Bars to the busiest year&apos;s scale.</p>{" "}

      <p className="mt-4 text-sm text-foreground/70">
        Counted under {record.names.map((x) => x.name).join(", ")}
        {others > 0 ? ` and ${formatInt(others)} other ${others === 1 ? "spelling" : "spellings"}` : ""}, matched by name, the way
        the LCA counts above are.
      </p>{" "}
      <FinePrint summary="What these counts are, and aren't" className="mt-2">
        <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/80">
          <p>
            Counts of workers on USCIS&apos;s first decision, by the fiscal year USCIS recorded it. Appeals, revocations
            and petitions still pending aren&apos;t in them, and the location is the employer&apos;s mailing address,
            not where the work is.
          </p>{" "}
          <ul className="space-y-1.5">
            {H1B_KINDS.map((k) => (
              <Fragment key={k.key}>
                {" "}
                <li>
                  <b className="font-bold">{k.label}.</b> {k.meaning}
                </li>
              </Fragment>
            ))}
          </ul>{" "}
          <p>
            In USCIS&apos;s words on its{" "}
            <a href={USCIS_H1B_GLOSSARY} rel="noopener noreferrer" className="font-bold underline underline-offset-2 hover:text-primary">
              data hub glossary
            </a>
            .
          </p>
        </div>
      </FinePrint>
    </section>
  );
}
