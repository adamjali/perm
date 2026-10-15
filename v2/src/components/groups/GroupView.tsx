import { Fragment } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { ChartTips } from "@/components/data/ChartTips";
import { plainText } from "@/components/data/MoreText";
import { YearBars, type YearCount } from "@/components/entities/YearBars";
import { GROUP_PATH, type GroupDetail, type GroupKind, type GroupSummary } from "@/lib/db/groups";
import { stateName } from "@/lib/usStateNames";
import { formatInt } from "@/lib/format";

/**
 * One city's, industry's or country's PERM record: the headline counts, the
 * decisions by year, and who and what sits inside it, every list a way into
 * another page. A link to another group is drawn only when that group is big
 * enough to have a page (the builder's floor), so no link here 404s.
 */

const FLOOR = 20;

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section >
      <h2 className="font-heading text-lg font-bold">{title}</h2>{" "}
      {children}
    </section>
  );
}

function Ranked({
  items,
  label,
}: {
  items: { key: string; label: ReactNode; n: number }[];
  /** What the list ranks, for the keyboard focus announcement. */
  label: string;
}) {
  const top = items[0]?.n ?? 0;
  return (
    <ChartTips label={label} className="mt-4">
    <ul className="space-y-2.5">
      {items.map((it, i) => (
        <Fragment key={it.key}>
          {" "}
          <li data-tip={`${plainText(it.label)}\n${formatInt(it.n)} ${it.n === 1 ? "case" : "cases"}\n#${i + 1} of ${items.length} shown`}>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-bold">{it.label}</span>{" "}
              <span className="shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{formatInt(it.n)}</span>
            </span>{" "}
            <span className="mt-1 block h-2 w-full bg-muted" aria-hidden="true">
              <span
                className="block h-full bg-foreground"
                style={{ width: `${top > 0 ? Math.max(2, (it.n / top) * 100) : 0}%` }}
              />
            </span>
          </li>
        </Fragment>
      ))}
    </ul>
    </ChartTips>
  );
}


/**
 * A title that repeats in one list carries its code. Agencies reuse a title
 * across code vintages (SOC 2010's 15-1121 and SOC 2018's 15-1211 are both
 * "Computer Systems Analysts"; NAICS 2017's 454110 and 2022's 45411 are both
 * "Electronic Shopping and Mail-Order Houses"), so two rows would otherwise
 * read as one name with two counts.
 */
function codedWhereRepeated<T>(
  rows: readonly T[],
  title: (r: T) => string,
  code: (r: T) => string,
  kind: string,
): (r: T) => string {
  const seen = new Map<string, number>();
  for (const r of rows) seen.set(title(r), (seen.get(title(r)) ?? 0) + 1);
  return (r) => ((seen.get(title(r)) ?? 0) > 1 ? `${title(r)} (${kind} ${code(r)})` : title(r));
}

export const KIND_NOUN: Record<GroupKind, string> = {
  city: "city",
  industry: "industry",
  country: "country of citizenship",
};

export function GroupView({
  kind,
  group,
  yearsOverride,
}: {
  kind: GroupKind;
  group: GroupSummary & { detail: GroupDetail };
  /** A country's FY2008 onward series from perm_country_years. */
  yearsOverride?: YearCount[];
}) {
  const d = group.detail;
  const decided = group.certified + group.denied;
  const rate = decided >= FLOOR ? (group.certified / decided) * 100 : null;
  const years = yearsOverride && yearsOverride.length > 0 ? yearsOverride : d.years;
  const boxes: ReactNode[] = [];

  if (d.employers.length > 0) {
    boxes.push(
      <Box key="emp" title="Top sponsors">
        <Ranked label="Top sponsors"
          items={d.employers.map((e) => ({
            key: e.slug ?? `name:${e.name}`,
            n: e.n,
            label: e.slug ? (
              <Link href={`/perm-employers/${e.slug}`} className="link">
                {e.name}
              </Link>
            ) : (
              e.name
            ),
          }))}
        />
      </Box>,
    );
  }
  if (d.occupations.length > 0) {
    const occName = codedWhereRepeated(d.occupations, (o) => o.title, (o) => o.code, "SOC");
    boxes.push(
      <Box key="occ" title="Top occupations">
        <Ranked label="Top occupations"
          items={d.occupations.map((o) => ({
            key: o.code,
            n: o.n,
            label: o.slug ? (
              <Link href={`/perm-wages/${o.slug}`} className="link">
                {occName(o)}
              </Link>
            ) : (
              occName(o)
            ),
          }))}
        />
      </Box>,
    );
  }
  if (kind !== "city" && d.states.length > 0) {
    boxes.push(
      <Box key="st" title="Worksite states">
        <Ranked label="Worksite states" items={d.states.map((s) => ({ key: s.key, n: s.n, label: stateName(s.key) }))} />
      </Box>,
    );
  }
  if (d.cities.length > 0) {
    boxes.push(
      <Box key="city" title="Worksite cities">
        <Ranked label="Worksite cities"
          items={d.cities.map((c) => ({
            key: c.key,
            n: c.n,
            label:
              c.n >= FLOOR ? (
                <Link href={`${GROUP_PATH.city}/${c.slug}`} className="link">
                  {c.label}
                </Link>
              ) : (
                c.label
              ),
          }))}
        />
      </Box>,
    );
  }
  if (d.industries.length > 0) {
    const named = codedWhereRepeated(d.industries, (i) => i.title, (i) => i.code, "NAICS");
    boxes.push(
      <Box key="ind" title="Industries">
        <Ranked label="Industries"
          items={d.industries.map((i) => ({
            key: i.code,
            n: i.n,
            label:
              i.n >= FLOOR && i.code.length === 6 ? (
                <Link href={`${GROUP_PATH.industry}/${i.code}`} className="link">
                  {named(i)}
                </Link>
              ) : (
                named(i)
              ),
          }))}
        />
      </Box>,
    );
  }
  if (d.countries.length > 0) {
    boxes.push(
      <Box key="cty" title="Countries of citizenship">
        <Ranked label="Countries of citizenship"
          items={d.countries.map((c) => ({
            key: c.key,
            n: c.n,
            label:
              c.n >= FLOOR ? (
                <Link href={`${GROUP_PATH.country}/${c.slug}`} className="link">
                  {c.label}
                </Link>
              ) : (
                c.label
              ),
          }))}
        />
      </Box>,
    );
  }
  if (d.education.length > 0) {
    boxes.push(
      <Box key="edu" title="Worker's education">
        <Ranked label="Worker's education" items={d.education.map((e) => ({ key: e.key, n: e.n, label: e.key }))} />
      </Box>,
    );
  }
  if (d.visa.length > 0) {
    boxes.push(
      <Box key="visa" title="Visa held when filed">
        <Ranked label="Visa held when filed" items={d.visa.map((v) => ({ key: v.key, n: v.n, label: v.key }))} />
      </Box>,
    );
  }

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-4 [&>*]:min-w-0 sm:grid-cols-4">
        {[
          ["Decisions", formatInt(group.total)],
          ["Approved", rate == null ? "too few" : `${rate.toFixed(1)}%`],
          ["Median certified wage", group.medianWage == null ? "n/a" : `$${formatInt(Math.round(group.medianWage))}`],
          ["Years", group.fyFrom && group.fyTo ? `FY${group.fyFrom} to FY${group.fyTo}` : "n/a"],
        ].map(([k, v]) => (
          <Fragment key={k}>
            {" "}
            <div className="bg-tint p-4 border-2 border-border">
              <dt className="text-sm font-bold text-muted-foreground">{k}</dt>{" "}
              <dd className="mt-1 font-heading text-2xl font-bold tabular-nums">{v}</dd>
            </div>
          </Fragment>
        ))}
      </dl>

      {years.length > 1 ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-bold">Year by year</h2>{" "}
          <div className="mt-4">
            <YearBars
              years={years}
              note={
                kind === "country"
                  ? "Fiscal years run October to September. DOL printed the worker's citizenship on its old form, so the series runs FY2008 to FY2023; the form in use since mid-2023 doesn't carry it."
                  : "Fiscal years run October to September. FY2016 to FY2023 come from DOL's closed-year files, FY2024 on from its current ones; the newest year is partial until DOL publishes its fourth quarter."
              }
            />
          </div>
        </section>
      ) : null}

      {boxes.length > 0 ? (
        <div className="mt-10 grid grid-cols-1 gap-4 [&>*]:min-w-0 md:grid-cols-2">{boxes}</div>
      ) : null}
    </>
  );
}
