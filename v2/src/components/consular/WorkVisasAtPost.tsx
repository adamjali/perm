import Link from "next/link";

import { Figure, FigureRow } from "@/components/data/FigureRow";
import { ColumnChart, type Column } from "@/components/numbers/ColumnChart";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { ScrollBox } from "@/components/ui/scroll-box";
import { classRows, nivClass, WORK_CLASSES } from "@/lib/consular/niv";
import { postNiv, type PostNiv } from "@/lib/db/nivIssuances";
import { monthName } from "@/lib/db/visaIssuances";
import { formatInt } from "@/lib/format";
import { monthTick } from "@convex/lib/months";

/**
 * A consulate's nonimmigrant visas, work visas first (State's monthly issuances by post,
 * scripts/ingest_niv_issuances.py): the newest month's H-1B and L-1 and every work visa, those
 * two month by month, then every class the post issued in the months shown. K-1 fiancé(e) visas
 * are a row of that table: State's scheduling table above lists immigrant visas only.
 *
 * Its own file, so the consulate page carries it as one line.
 */
export async function WorkVisasAtPost({ postKey, name, className }: { postKey: string; name: string; className?: string }) {
  const data = await postNiv(postKey);
  if (!data) return null;
  return <WorkVisasView data={data} name={name} className={className} />;
}

const sumOf = (byMonth: PostNiv["byMonth"], months: readonly string[], classes: readonly string[]) =>
  months.reduce((a, m) => a + classes.reduce((b, c) => b + (byMonth.get(m)?.[c] ?? 0), 0), 0);

/** One stacked column a month: H-1B in lime at the foot, L-1 in blue above; a month not held is a gap. */
function chartColumns(data: PostNiv, name: string): Column[] {
  const held = new Set(data.held);
  const newest = data.months.at(-1);
  return data.months.map((m) => {
    if (!held.has(m)) return { key: m, value: 0, gap: true, label: monthName(m), tip: `${monthName(m)}\nNo table for this month` };
    const h = data.byMonth.get(m)?.H1B ?? 0;
    const l = data.byMonth.get(m)?.L1 ?? 0;
    return {
      key: m,
      value: h + l,
      now: m === newest,
      label: monthName(m),
      parts: [
        { value: h, fill: "bg-primary" },
        { value: l, fill: "bg-chart-blue" },
      ],
      tip: `${name}, ${monthName(m)}\n${formatInt(h)} H-1B\n${formatInt(l)} L-1`,
    };
  });
}

export function WorkVisasView({ data, name, className }: { data: PostNiv; name: string; className?: string }) {
  const newest = data.months.at(-1)!;
  const first = data.months[0]!;
  const rows = classRows(data.byMonth, data.held);
  const heading = (
    <h2 id="work-visas" className="font-heading text-2xl font-bold">
      Work visas issued here
    </h2>
  );
  if (!rows.length) {
    return (
      <section aria-labelledby="work-visas" className={className}>
        {heading}{" "}
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          State&apos;s monthly tables show no nonimmigrant visas issued in {name} from {monthName(first)} to {monthName(newest)}.
        </p>
      </section>
    );
  }
  const newestOf = (cls: string) => data.byMonth.get(newest)?.[cls] ?? 0;
  const workNewest = WORK_CLASSES.reduce((a, c) => a + newestOf(c), 0);
  const columns = chartColumns(data, name);
  const charted = columns.some((c) => c.value > 0);
  return (
    <section aria-labelledby="work-visas" className={className}>
      {heading}{" "}
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-muted-foreground">
        Nonimmigrant visas the consulate in {name} issued, from State&apos;s monthly tables. {monthName(newest)} is the newest
        month State has posted.
      </p>
      <FigureRow className="mt-6">
        <Figure
          label={`H-1B, ${monthName(newest)}`}
          value={formatInt(newestOf("H1B"))}
          note={`${formatInt(sumOf(data.byMonth, data.held, ["H1B"]))} in the ${data.months.length} months to ${monthName(newest)}`}
        />{" "}
        <Figure
          label={`L-1, ${monthName(newest)}`}
          value={formatInt(newestOf("L1"))}
          note={`${formatInt(sumOf(data.byMonth, data.held, ["L1"]))} in the ${data.months.length} months`}
        />{" "}
        <Figure
          label={`Every work visa, ${monthName(newest)}`}
          value={formatInt(workNewest)}
          note="H, L, E, O, P, Q, R, TN, CW and media visas, with the families who come with them"
        />
      </FigureRow>

      {charted ? (
        <FigurePlate
          title="H-1B and L-1 visas issued each month"
          subject={`${name}, ${monthName(first)} to ${monthName(newest)}`}
          caption="Each column is one month: H-1B in lime at the foot, L-1 in blue above. A dashed outline is a month this site doesn't hold State's table for. State calls the figures preliminary."
          source="U.S. Department of State, monthly nonimmigrant visa issuances by post"
          className="mt-8"
        >
          <ColumnChart
            columns={columns}
            label={`H-1B and L-1 visas issued in ${name} each month`}
            first={monthTick(first) ?? ""}
            last={monthTick(newest) ?? ""}
            unit="visas"
            gapKey="No table for this month"
          />
          <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Colour key">
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 bg-primary" /> H-1B
            </li>{" "}
            <li className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block size-3 bg-chart-blue" /> L-1
            </li>
          </ul>
        </FigurePlate>
      ) : null}

      <h3 className="mt-8 font-heading text-lg font-bold">Every visa class issued here</h3>{" "}
      <p className="mt-1 max-w-3xl text-base text-muted-foreground">
        Work visas first, then everything else, visitors, students and K-1 fiancé(e) visas among them.
      </p>
      <ScrollBox label={`Nonimmigrant visas issued in ${name}, by class`} className="mt-3 border-t-2 border-[var(--object-border)] bg-card">
        <table className="w-full min-w-[36rem] text-left text-base">
          <caption className="sr-only">Nonimmigrant visas issued in {name} by class, {monthName(newest)} and the {data.months.length} months to it{" "}</caption>
          <thead className="border-b-2 border-border bg-sage">
            <tr>
              <th scope="col" className="px-4 py-3 font-bold">Visa{" "}</th>
              <th scope="col" className="px-4 py-3 font-bold">What it is{" "}</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">{monthName(newest)}{" "}</th>
              <th scope="col" className="px-4 py-3 text-right font-bold">{data.months.length} months{" "}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} className="border-b border-border last:border-b-0">
                <th scope="row" className="whitespace-nowrap px-4 py-3 font-bold">
                  {r.symbol === "K1" ? "K-1 fiancé(e)" : r.name}{" "}
                </th>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.symbol === "K1" ? `${nivClass("K1").what} of a U.S. citizen` : r.what}
                  {r.work ? <span className="sr-only">, a work visa</span> : null}{" "}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatInt(r.newest)}{" "}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{formatInt(r.year)}{" "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollBox>
      <p className="mt-3 text-sm text-muted-foreground">
        Why a visa is refused, worldwide and year by year:{" "}
        <Link href="/visa-refusals" className="link">
          visa refusals by ground
        </Link>
        .
      </p>
    </section>
  );
}
