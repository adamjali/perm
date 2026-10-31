import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { formatInt } from "@/lib/format";
import { monthSeries, type WaitTrend } from "@/lib/pwdNow";
import { monthTick, monthYear } from "@convex/lib/months";

/**
 * How long each month's decisions waited, one column a month (the median,
 * filing to decision), from build_wait_trends.py. A month with no reading is
 * an empty outline, never a zero: October 2025 was the federal shutdown, and
 * the months between DOL's last published file and our own check's dated
 * months have no measurement yet. The newest month is lime; one still under
 * way is hatched.
 */
export function WaitTrendChart({ trend, noun, label }: { trend: WaitTrend; noun: string; label: string }) {
  const filesEnd = trend.filesThrough.slice(0, 7);
  const series = monthSeries(trend);
  const columns: Column[] = series.map((m, i) => {
    const name = monthYear(m.m) ?? m.m;
    if (m.gap) {
      const why =
        m.m === "2025-10"
          ? "the federal shutdown: DOL decided almost nothing"
          : m.m > filesEnd
            ? "after DOL's last published file, before our own check's measured months"
            : "too few decisions to measure";
      return { key: m.m, value: 0, gap: true, label: name, tip: `${name}\nNo reading: ${why}` };
    }
    return {
      key: m.m,
      value: m.p50,
      label: name,
      now: i === series.length - 1,
      partial: m.partial === true,
      tip: `Decided in ${name}${m.partial ? " (so far)" : ""}\nmedian ${formatInt(m.p50)} days\nmiddle half ${formatInt(m.p25)} to ${formatInt(m.p75)} days\n${formatInt(m.n)} ${noun}\n${m.from === "sweep" ? "our check of DOL's case status" : "DOL's published files"}`,
    };
  });
  return (
    <ColumnChart
      columns={columns}
      label={label}
      first={monthTick(`${series[0]!.m}-01`) ?? ""}
      last={monthTick(`${series[series.length - 1]!.m}-01`) ?? ""}
      unit="days"
    />
  );
}
