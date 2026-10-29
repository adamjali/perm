import Link from "next/link";

import { BarRows } from "@/components/data/BarRows";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { getNewestQuarterKey, getQuarterReport } from "@/lib/db/quarterReport";
import { formatDollars, formatInt, formatShare } from "@/lib/format";
import {
  changeWords,
  quarterMonths,
  quarterName,
  type QuarterReport,
  type RankedEntry,
} from "@/lib/quarterReport";
import { US_STATE_NAMES } from "@/lib/usStateNames";

/**
 * One part of a quarter's post, every figure read from that quarter's report
 * (scripts/build_quarter_report.py), so a post types no number and an older
 * post keeps its own quarter's figures.
 *
 *   <QuarterNow quarter="2026q3" part="headline" />
 */

export type QuarterPart = "headline" | "outcomes" | "employers" | "firms" | "jobs" | "states" | "new" | "programs" | "newer";

const LIST_LINK = "link py-[10px] sm:py-0";

function beforeNote(r: QuarterReport, now: number, prior: number, yearAgo: number): string {
  return `${changeWords(now, prior)} on ${quarterMonths(r.prior)}, ${changeWords(now, yearAgo)} on a year before`;
}

function Headline({ r }: { r: QuarterReport }) {
  const t = r.figures.this;
  const p = r.figures.prior;
  const y = r.figures.yearAgo;
  const pts = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((a - b) * 1000) / 10);
  const shareMove = pts(t.certifiedShare, p.certifiedShare);
  return (
    <FigureRow className="not-prose prose-reset my-8">
      <Figure tone="lime" label="Decisions" value={formatInt(t.total)} note={beforeNote(r, t.total, p.total, y.total)} />{" "}
      <Figure
        label="Certified, of those decided"
        value={t.certifiedShare === null ? "None" : formatShare(t.certifiedShare)}
        note={shareMove === null ? undefined : shareMove === 0 ? "the same as the quarter before" : `${Math.abs(shareMove)} point${Math.abs(shareMove) === 1 ? "" : "s"} ${shareMove > 0 ? "higher" : "lower"} than the quarter before`}
      />{" "}
      <Figure
        label="Days from filing to certification"
        value={t.medianDays === null ? "None" : formatInt(t.medianDays)}
        note={t.p90Days === null ? "the median" : `the median; one in ten took ${formatInt(t.p90Days)} or more`}
      />{" "}
      <Figure label="Offered wage, certified cases" value={t.medianWage === null ? "None" : formatDollars(t.medianWage)} note="the median, a year" />
    </FigureRow>
  );
}

function Outcomes({ r }: { r: QuarterReport }) {
  const rows = (["yearAgo", "prior", "this"] as const).map((k) => {
    const ref = k === "this" ? r.quarter : r[k];
    const f = r.figures[k];
    return {
      key: k,
      label: quarterMonths(ref),
      sub: `${formatInt(f.certified)} certified, ${formatInt(f.denied)} denied, ${formatInt(f.withdrawn)} withdrawn`,
      value: f.total,
      text: formatInt(f.total),
      tone: (k === "this" ? "primary" : "blue") as "primary" | "blue",
    };
  });
  return <BarRows label="PERM decisions by quarter" rows={rows} className="not-prose prose-reset my-8" />;
}

function Ranked({ r, list, label, href, nameOf }: { r: QuarterReport; list: RankedEntry[]; label: string; href?: (k: string) => string; nameOf?: (e: RankedEntry) => string }) {
  if (list.length === 0) return null;
  return (
    <BarRows
      label={label}
      className="not-prose prose-reset my-8"
      rows={list.map((e, i) => {
        const name = nameOf ? nameOf(e) : e.name;
        return {
          key: e.key,
          label: (
            <>
              <span className="mr-1.5 font-mono tabular-nums text-muted-foreground">{i + 1}</span>{" "}
              {href && e.linked ? (
                <Link href={href(e.key)} className={LIST_LINK}>
                  {name}
                </Link>
              ) : (
                name
              )}
            </>
          ),
          sub: `${formatInt(e.prior)} the quarter before, ${formatInt(e.yearAgo)} a year before`,
          value: e.n,
          text: formatInt(e.n),
          tone: i === 0 ? "primary" : "blue",
          tip: `${name}\n${formatInt(e.n)} decisions in ${quarterMonths(r.quarter)}\n${beforeNote(r, e.n, e.prior, e.yearAgo)}`,
        };
      })}
    />
  );
}

function NewEmployers({ r }: { r: QuarterReport }) {
  const n = r.newEmployers;
  if (n.count === 0) return <p>No employer was new to DOL&apos;s files this quarter.</p>;
  return (
    <>
      <p>
        {formatInt(n.count)} employers had their first decided PERM case in DOL&apos;s files (back to October 2015) in{" "}
        {quarterMonths(r.quarter)}, {formatInt(n.cases)} cases among them. The busiest:
      </p>{" "}
      <BarRows
        label={`Employers new to DOL's PERM files, ${quarterMonths(r.quarter)}`}
        className="not-prose prose-reset my-8"
        rows={n.top.map((e, i) => ({
          key: e.key,
          label: e.linked ? (
            <Link href={`/perm-employers/${e.key}`} className={LIST_LINK}>
              {e.name}
            </Link>
          ) : (
            e.name
          ),
          value: e.n,
          text: formatInt(e.n),
          tone: i === 0 ? "primary" : "blue",
        }))}
      />
    </>
  );
}

function Programs({ r }: { r: QuarterReport }) {
  const pw = (k: "this" | "prior" | "yearAgo") => r.programs[k].pw.n;
  const lca = (k: "this" | "prior" | "yearAgo") => r.programs[k].lca.n;
  return (
    <FigureRow className="not-prose prose-reset my-8">
      <Figure label="Wage requests DOL determined" value={formatInt(pw("this"))} note={beforeNote(r, pw("this"), pw("prior"), pw("yearAgo"))} />{" "}
      <Figure label="H-1B LCAs DOL certified" value={formatInt(lca("this"))} note={beforeNote(r, lca("this"), lca("prior"), lca("yearAgo"))} />
    </FigureRow>
  );
}

async function Newer({ r }: { r: QuarterReport }) {
  const newest = await getNewestQuarterKey().catch(() => null);
  if (!newest || newest === r.quarter.key) return null;
  return (
    <p className="not-prose prose-reset my-6 border-l-4 border-chart-blue bg-sage p-4 text-base">
      DOL has published a newer file since this one.{" "}
      <Link href={`/blog/dol-perm-file-fy${newest.slice(0, 4)}-q${newest.slice(5)}`} className="link">
        What the newest file says
      </Link>
    </p>
  );
}

export async function QuarterNow({ quarter, part }: { quarter: string; part: QuarterPart }) {
  const r = await getQuarterReport(quarter).catch(() => null);
  if (!r) {
    return (
      <p>
        This quarter&apos;s figures are unavailable for the moment.{" "}
        <Link href="/perm-cases" className="link">
          DOL&apos;s PERM files
        </Link>{" "}
        are searchable meanwhile.
      </p>
    );
  }
  switch (part) {
    case "headline":
      return <Headline r={r} />;
    case "outcomes":
      return <Outcomes r={r} />;
    case "employers":
      return <Ranked r={r} list={r.employers} label={`The busiest employers, ${quarterMonths(r.quarter)}`} href={(k) => `/perm-employers/${k}`} />;
    case "firms":
      return <Ranked r={r} list={r.firms} label={`The busiest law firms, ${quarterMonths(r.quarter)}`} href={(k) => `/perm-attorneys/${k}`} />;
    case "jobs":
      return <Ranked r={r} list={r.jobs} label={`The busiest jobs, ${quarterMonths(r.quarter)}`} />;
    case "states":
      return <Ranked r={r} list={r.states} label={`The busiest states, ${quarterMonths(r.quarter)}`} nameOf={(e) => US_STATE_NAMES[e.key] ?? e.key} />;
    case "new":
      return <NewEmployers r={r} />;
    case "programs":
      return <Programs r={r} />;
    case "newer":
      return <Newer r={r} />;
  }
}

/** The quarter in words, for a post's own sentences: "April to June 2026 (fiscal 2026, Q3)". */
export async function QuarterName({ quarter }: { quarter: string }) {
  const r = await getQuarterReport(quarter).catch(() => null);
  return r ? <>{`${quarterMonths(r.quarter)} (${quarterName(r.quarter)})`}</> : <>this quarter</>;
}
