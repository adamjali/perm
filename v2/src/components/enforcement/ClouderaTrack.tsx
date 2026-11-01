import { ChartTips } from "@/components/data/ChartTips";
import { shortDate } from "@convex/lib/months";
import { barEnds } from "@/lib/enforcement/actions";

/**
 * Cloudera's case on one time line: DOJ's investigation and lawsuit, DOL's 180-day suspension, and the 24
 * months without PERM it agreed to. Each date is read from its source: the complaint (the investigation
 * opened Jan 10 2025), DOL's published file (its last PERM filing and its withdrawals), DOJ's and DOL's
 * releases, and the settlement agreement, whose bar runs "from the date of its most recent PERM application
 * withdrawal". DOL's record dates that Jul 11 2025, so the end is drawn dashed: the agreement doesn't name
 * the day, and this is our reading of it.
 */

export const CLOUDERA = {
  investigationOpened: "2025-01-10",
  lastWithdrawal: "2025-07-11",
  firstWithdrawal: "2025-06-23",
  withdrawn: 11,
  lawsuit: "2026-04-28",
  suspended: "2026-05-12",
  suspensionDays: 180,
  settled: "2026-10-13",
  announced: "2026-10-16",
  barMonths: 24,
} as const;

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const addDays = (iso: string, n: number) => new Date(dayNumber(iso) + n * 86_400_000).toISOString().slice(0, 10);

export function ClouderaTrack({ lastPerm, today }: { lastPerm: string | null; today: string }) {
  const c = CLOUDERA;
  const barEnd = barEnds(c.lastWithdrawal, c.barMonths);
  const suspensionEnd = addDays(c.suspended, c.suspensionDays);
  const start = "2025-01-01";
  const end = "2027-10-01";
  const span = dayNumber(end) - dayNumber(start);
  const x = (iso: string) => ((dayNumber(iso) - dayNumber(start)) / span) * 100;
  const w = (a: string, b: string) => x(b) - x(a);
  const todayPast = today > barEnd ? barEnd : today;

  const rows: { label: string; bar: { from: string; to: string; fill: string; tip: string; dashedFrom?: string }; marks?: { at: string; tip: string }[] }[] = [
    {
      label: "DOJ's case",
      bar: { from: c.investigationOpened, to: c.settled, fill: "bg-chart-sage", tip: `DOJ's investigation, opened ${shortDate(c.investigationOpened)}, to the settlement on ${shortDate(c.settled)}` },
      marks: [{ at: c.lawsuit, tip: `${shortDate(c.lawsuit)}\nDOJ sues Cloudera (OCAHO case 2026B00044)` }],
    },
    {
      label: "DOL's suspension",
      bar: { from: c.suspended, to: suspensionEnd, fill: "bg-chart-orange", tip: `${shortDate(c.suspended)} to ${shortDate(suspensionEnd)}\nDOL stops processing Cloudera's PERM applications for 180 days` },
    },
    {
      label: "No PERM filing",
      bar: {
        from: c.lastWithdrawal,
        to: barEnd,
        fill: "bg-chart-red",
        dashedFrom: todayPast,
        tip: `${shortDate(c.lastWithdrawal)} to about ${shortDate(barEnd)}\n24 months from its most recent withdrawal, which DOL's record dates ${shortDate(c.lastWithdrawal)}`,
      },
      marks: [
        ...(lastPerm ? [{ at: lastPerm, tip: `${shortDate(lastPerm)}\nCloudera's last PERM filing in DOL's record` }] : []),
        { at: c.firstWithdrawal, tip: `${shortDate(c.firstWithdrawal)} and ${shortDate(c.lastWithdrawal)}\n${c.withdrawn} PERM applications withdrawn` },
      ],
    },
  ];
  const years = ["2025-01-01", "2026-01-01", "2027-01-01"];

  return (
    <figure>
      <ChartTips label="Cloudera's case, from the investigation to the end of its PERM bar" scroll="overflow-x-auto pb-2">
        <div className="min-w-[640px]" role="group" aria-label={`Cloudera: DOJ's investigation from ${shortDate(c.investigationOpened)}, DOL's suspension from ${shortDate(c.suspended)}, no PERM filing until about ${shortDate(barEnd)}`}>
          {rows.map((r) => (
            <div key={r.label} className="grid grid-cols-[8.5rem_1fr] items-center border-b border-border/60">
              <p className="pr-3 text-sm font-bold">{r.label}</p>{" "}
              <div className="relative h-14">
                <span
                  data-tip={r.bar.tip}
                  className={`absolute top-1/2 h-5 -translate-y-1/2 border-2 border-foreground ${r.bar.fill}`}
                  style={{ left: `${x(r.bar.from)}%`, width: `${w(r.bar.from, r.bar.dashedFrom ?? r.bar.to)}%` }}
                />
                {r.bar.dashedFrom && r.bar.dashedFrom < r.bar.to ? (
                  <span
                    data-tip={r.bar.tip}
                    className="absolute top-1/2 h-5 -translate-y-1/2 border-2 border-dashed border-foreground bg-hatch text-input"
                    style={{ left: `${x(r.bar.dashedFrom)}%`, width: `${w(r.bar.dashedFrom, r.bar.to)}%` }}
                  />
                ) : null}
                {(r.marks ?? []).map((m) => (
                  <span
                    key={m.at}
                    data-tip={m.tip}
                    className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-foreground bg-card"
                    style={{ left: `${x(m.at)}%` }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className="grid grid-cols-[8.5rem_1fr]" aria-hidden="true">
            <span />
            <div className="relative h-8">
              {years.map((y) => (
                <span key={y} className="absolute top-1 text-sm tabular-nums text-muted-foreground" style={{ left: `${x(y)}%` }}>
                  {y.slice(0, 4)}{" "}
                </span>
              ))}
              <span className="absolute -top-[10.5rem] h-[10.5rem] border-l-2 border-foreground" style={{ left: `${x(today)}%` }} />
              <span className="absolute top-1 -translate-x-1/2 bg-foreground px-1.5 text-sm font-bold text-background" style={{ left: `${x(today)}%` }}>
                Today{" "}
              </span>
            </div>
          </div>
        </div>
      </ChartTips>{" "}
      <figcaption className="mt-3 text-sm text-muted-foreground">
        Diamonds mark single days: the lawsuit, Cloudera&apos;s last PERM filing, and its withdrawals. The
        hatched end is our reading: the agreement counts the 24 months from its most recent withdrawal and
        doesn&apos;t name the day. DOL&apos;s record dates it {shortDate(CLOUDERA.lastWithdrawal)}, which puts
        the end about {shortDate(barEnd)}.
      </figcaption>
    </figure>
  );
}
