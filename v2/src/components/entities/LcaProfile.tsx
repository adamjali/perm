import { Fragment } from "react";

import { ChartTips } from "@/components/data/ChartTips";
import { FinePrint } from "@/components/data/FinePrint";
import { hasLcaDetail, newVersusTransfer, percent, type LcaProfile as Profile } from "@/lib/lcaProfile";
import { cn } from "@/lib/utils";
import { formatInt } from "@/lib/format";

/**
 * What one employer's H-1B LCAs were for: new hires against transfers, the
 * OES wage level it chose, the two declarations Section H asks for, and the
 * visas the LCAs support. Every figure is read off DOL's quarterly LCA files
 * (`src/lib/lcaProfile.ts` has the field-by-field sources); nothing here is
 * estimated, and a block with nothing behind it isn't drawn.
 *
 * Rendered only when there's something beyond "they file H-1B LCAs", which
 * the program ledger above already says.
 */

const ECFR = "https://www.ecfr.gov/current/title-20/chapter-V/part-655/subpart-H";

function longDate(iso: string | null): string | null {
  const d = iso?.slice(0, 10) ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function yesNo(v: boolean | null): string {
  return v === null ? "not answered" : v ? "Yes" : "No";
}

/** One labelled bar, drawn to the block's own leader so concentration shows before the number. */
function BarRow({
  label,
  sub,
  n,
  of,
  top,
  strong,
  noun,
}: {
  label: string;
  sub?: string;
  n: number;
  of: number;
  top: number;
  strong?: boolean;
  /** What `of` counts, for the hover detail ("worker positions"). */
  noun: string;
}) {
  const pct = percent(n, of);
  return (
    <li data-tip={`${label}${sub ? ` (${sub})` : ""}\n${formatInt(n)} of ${formatInt(of)} ${noun}${pct !== null ? `\n${pct}%` : ""}`}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 text-sm font-bold">
          {label}
          {sub ? " " : null}
          {sub ? <span className="ml-0.5 font-mono text-sm font-bold text-foreground/60">{sub}</span> : null}
        </span>{" "}
        <span className="shrink-0 font-mono text-sm tabular-nums text-foreground/70">
          {formatInt(n)}
          {pct !== null ? ` · ${pct}%` : ""}
        </span>
      </span>{" "}
      <span className="mt-1 block h-2.5 w-full bg-muted" aria-hidden="true">
        <span
          className={cn("block h-full", strong ? "bg-foreground" : "bg-foreground/35")}
          style={{ width: `${top > 0 && n > 0 ? Math.max(2, (n / top) * 100) : 0}%` }}
        />
      </span>
    </li>
  );
}

export function LcaProfile({
  name,
  profile,
  className,
}: {
  name: string;
  profile: Profile | null;
  className?: string;
}) {
  if (!hasLcaDetail(profile)) return null;
  const p = profile;
  const split = newVersusTransfer(p);
  const kindTop = Math.max(0, ...p.kinds.map((k) => k.n));
  const leveled = p.levels.reduce((s, l) => s + l.n, 0);
  const levelTop = Math.max(0, ...p.levels.map((l) => l.n));
  const visas = p.visas.filter((v) => v.n > 0);
  const declared = p.dependent.of > 0 || p.violator.of > 0;
  const filed = longDate(p.newest?.filed ?? null);

  return (
    <section className={cn("mt-10 border-2 border-border bg-card p-6 shadow-hard sm:p-8", className)}>
      <h2 className="font-heading text-xl font-black sm:text-2xl">What its H-1B LCAs were for</h2>{" "}
      <p className="mt-2 max-w-2xl text-base leading-relaxed text-foreground/70">
        From DOL&apos;s quarterly LCA files: {formatInt(p.filings)} {p.filings === 1 ? "LCA" : "LCAs"} filed by {name}
        {p.detailRows > 0
          ? `, ${formatInt(p.detailRows)} of them certified with the worker breakdown on Form ETA-9035.`
          : "."}
      </p>{" "}
      {p.detailRows > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-6 [&>*]:min-w-0 lg:grid-cols-2">
          <div>
            <h3 className="font-heading text-lg font-black">New hires and transfers</h3>{" "}
            {split ? (
              <p className="mt-1 text-base">
                <b className="font-heading text-2xl font-black">{formatInt(split.newN)}</b> positions for new
                employment, <b className="font-heading text-2xl font-black">{formatInt(split.transferN)}</b> moving here
                from another employer.
              </p>
            ) : null}{" "}
            <ChartTips label="Worker positions requested, by kind" className="mt-4">
            <ul className="space-y-3">
              {p.kinds.map((k) => (
                <Fragment key={k.kind.key}>
                  {" "}
                  <BarRow
                    label={k.kind.label}
                    sub={k.kind.item}
                    n={k.n}
                    of={p.positions}
                    top={kindTop}
                    strong={k.kind.key === "newEmployment" || k.kind.key === "changeEmployer"}
                    noun="worker positions requested"
                  />
                </Fragment>
              ))}
            </ul>
            </ChartTips>{" "}
            <p className="mt-3 text-sm text-foreground/70">
              Shares of the {formatInt(p.positions)} worker positions requested. These are positions on certified
              LCAs, not people hired: DOL certifies an LCA before any petition, and many are never used.
            </p>{" "}
            <FinePrint summary="What each box on the form means" className="mt-2">
              <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-foreground/80">
                {p.kinds.map((k) => (
                  <Fragment key={k.kind.key}>
                    {" "}
                    <li>
                      <b className="font-bold">
                        {k.kind.label} ({k.kind.item}).
                      </b>{" "}
                      {k.kind.meaning}
                    </li>
                  </Fragment>
                ))}
              </ul>{" "}
              <p className="mt-2 text-sm text-foreground/70">
                Form ETA-9035, Section B, Item 7, in DOL&apos;s words from its LCA record layout. One LCA can
                tick several boxes.
              </p>
            </FinePrint>
          </div>{" "}
          <div>
            <h3 className="font-heading text-lg font-black">Wage level it chose</h3>{" "}
            {leveled > 0 ? (
              <ChartTips label="Certified LCAs by OES wage level" className="mt-4">
              <ul className="space-y-3">
                {p.levels.map((l) => (
                  <Fragment key={l.level}>
                    {" "}
                    <BarRow label={`Level ${l.level}`} n={l.n} of={leveled} top={levelTop} noun="certified LCAs that named a level" />
                  </Fragment>
                ))}
              </ul>
              </ChartTips>
            ) : null}{" "}
            <p className="mt-3 text-sm text-foreground/70">
              {leveled > 0
                ? `Shares of the ${formatInt(leveled)} certified LCAs that named an OES level. `
                : "None of its certified LCAs named an OES level. "}
              The form asks for the level only when the employer set the wage from the OES survey itself;{" "}
              {formatInt(p.levelBlank)} of {formatInt(p.detailRows)} used another source, such as a DOL wage
              determination or another survey. Level I is entry, Level IV fully competent.
            </p>
          </div>
        </div>
      ) : null}{" "}

      {declared ? (
        <div className="mt-8 border-t-2 border-border/60 pt-6">
          <h3 className="font-heading text-lg font-black">What it declared on Section H</h3>{" "}
          {p.newest ? (
            <dl className="mt-3 grid grid-cols-1 gap-3 [&>*]:min-w-0 sm:grid-cols-2">
              <div className="border-2 border-border p-4">
                <dt className="text-sm font-bold text-foreground/70">H-1B-dependent</dt>{" "}
                <dd className="mt-1 font-heading text-2xl font-black">{yesNo(p.newest.dependent)}</dd>
              </div>{" "}
              <div className="border-2 border-border p-4">
                <dt className="text-sm font-bold text-foreground/70">Found a willful violator</dt>{" "}
                <dd className="mt-1 font-heading text-2xl font-black">{yesNo(p.newest.violator)}</dd>
              </div>
            </dl>
          ) : null}{" "}
          <p className="mt-3 text-sm text-foreground/70">
            {p.newest ? `As answered on its newest LCA${filed ? `, filed ${filed}` : ""}. ` : ""}
            Declared H-1B-dependent on {formatInt(p.dependent.yes)} of {formatInt(p.dependent.of)} LCAs, and a willful
            violator on {formatInt(p.violator.yes)} of {formatInt(p.violator.of)}. Both are the employer&apos;s own answers.
          </p>{" "}
          <FinePrint summary="What the two answers mean" className="mt-2">
            <div className="mt-2 space-y-2 text-sm leading-relaxed text-foreground/80">
              <p>
                <b className="font-bold">H-1B-dependent</b> (20 CFR 655.736(a)): 25 or fewer full-time-equivalent
                employees in the US and more than 7 H-1B workers; 26 to 50 and more than 12; or 51 or more, with
                H-1B workers equal to at least 15% of them.
              </p>{" "}
              <p>
                <b className="font-bold">Willful violator</b> (655.736(f)): DOL or the Justice Department found a
                willful failure or a misrepresentation of a material fact in the five years before the LCA was
                filed.
              </p>{" "}
              <p>
                Either one adds two promises to the employer&apos;s LCAs: not to displace US workers, and to
                recruit US workers before hiring H-1B workers (655.738, 655.739). They don&apos;t apply to an LCA
                used only for exempt workers, paid at least $60,000 a year or holding a related master&apos;s
                degree (655.737).{" "}
                <a
                  href={ECFR}
                  className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
                >
                  The rule on eCFR
                </a>
              </p>
            </div>
          </FinePrint>
        </div>
      ) : null}{" "}

      {visas.length > 1 || p.otherVisa > 0 || (visas.length === 1 && visas[0]!.key !== "h1b") ? (
        <p className="mt-6 text-sm text-foreground/80">
          <b className="font-bold">Visas these LCAs support:</b>{" "}
          {visas.map((v, i) => (
            <Fragment key={v.key}>
              {i > 0 ? " · " : ""}
              {v.label} {formatInt(v.n)}
            </Fragment>
          ))}
          {p.otherVisa > 0 ? ` · other ${formatInt(p.otherVisa)}` : ""}
          . E-3 and H-1B1 use the same LCA as the H-1B.
        </p>
      ) : null}
    </section>
  );
}
