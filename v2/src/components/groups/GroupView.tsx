import { Fragment } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { YearBars, type YearCount } from "@/components/entities/YearBars";
import { GROUP_PATH, type GroupDetail, type GroupKind, type GroupSummary } from "@/lib/turso/groups";
import { stateName } from "@/lib/usStateNames";

/**
 * One city's, industry's or country's PERM record: the headline counts, the
 * decisions by year, and who and what sits inside it, every list a way into
 * another page. A link to another group is drawn only when that group is big
 * enough to have a page (the builder's floor), so no link here 404s.
 */

const FLOOR = 20;

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-2 border-border bg-card p-5 sm:p-6">
      <h2 className="font-heading text-lg font-black">{title}</h2>{" "}
      {children}
    </section>
  );
}

function Ranked({
  items,
}: {
  items: { key: string; label: ReactNode; n: number }[];
}) {
  const top = items[0]?.n ?? 0;
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((it) => (
        <Fragment key={it.key}>
          {" "}
          <li>
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm font-bold">{it.label}</span>{" "}
              <span className="shrink-0 font-mono text-sm tabular-nums text-foreground/70">{fmt(it.n)}</span>
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
  );
}

const LINK = "underline decoration-primary decoration-2 underline-offset-2 hover:text-primary";

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
        <Ranked
          items={d.employers.map((e) => ({
            key: e.slug,
            n: e.n,
            label: (
              <Link href={`/perm-employers/${e.slug}`} className={LINK}>
                {e.name}
              </Link>
            ),
          }))}
        />
      </Box>,
    );
  }
  if (d.occupations.length > 0) {
    boxes.push(
      <Box key="occ" title="Top occupations">
        <Ranked
          items={d.occupations.map((o) => ({
            key: o.code,
            n: o.n,
            label: o.slug ? (
              <Link href={`/perm-wages/${o.slug}`} className={LINK}>
                {o.title}
              </Link>
            ) : (
              o.title
            ),
          }))}
        />
      </Box>,
    );
  }
  if (kind !== "city" && d.states.length > 0) {
    boxes.push(
      <Box key="st" title="Worksite states">
        <Ranked items={d.states.map((s) => ({ key: s.key, n: s.n, label: stateName(s.key) }))} />
      </Box>,
    );
  }
  if (d.cities.length > 0) {
    boxes.push(
      <Box key="city" title="Worksite cities">
        <Ranked
          items={d.cities.map((c) => ({
            key: c.key,
            n: c.n,
            label:
              c.n >= FLOOR ? (
                <Link href={`${GROUP_PATH.city}/${c.slug}`} className={LINK}>
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
    boxes.push(
      <Box key="ind" title="Industries">
        <Ranked
          items={d.industries.map((i) => ({
            key: i.code,
            n: i.n,
            label:
              i.n >= FLOOR && i.code.length === 6 ? (
                <Link href={`${GROUP_PATH.industry}/${i.code}`} className={LINK}>
                  {i.title}
                </Link>
              ) : (
                i.title
              ),
          }))}
        />
      </Box>,
    );
  }
  if (d.countries.length > 0) {
    boxes.push(
      <Box key="cty" title="Countries of citizenship">
        <Ranked
          items={d.countries.map((c) => ({
            key: c.key,
            n: c.n,
            label:
              c.n >= FLOOR ? (
                <Link href={`${GROUP_PATH.country}/${c.slug}`} className={LINK}>
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
        <Ranked items={d.education.map((e) => ({ key: e.key, n: e.n, label: e.key }))} />
      </Box>,
    );
  }
  if (d.visa.length > 0) {
    boxes.push(
      <Box key="visa" title="Visa held when filed">
        <Ranked items={d.visa.map((v) => ({ key: v.key, n: v.n, label: v.key }))} />
      </Box>,
    );
  }

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-4 [&>*]:min-w-0 sm:grid-cols-4">
        {[
          ["Decisions", fmt(group.total)],
          ["Approved", rate == null ? "too few" : `${rate.toFixed(1)}%`],
          ["Median certified wage", group.medianWage == null ? "n/a" : `$${fmt(Math.round(group.medianWage))}`],
          ["Years", group.fyFrom && group.fyTo ? `FY${group.fyFrom} to FY${group.fyTo}` : "n/a"],
        ].map(([k, v]) => (
          <Fragment key={k}>
            {" "}
            <div className="border-2 border-border bg-card p-4">
              <dt className="text-sm font-bold text-foreground/70">{k}</dt>{" "}
              <dd className="mt-1 font-heading text-2xl font-black tabular-nums">{v}</dd>
            </div>
          </Fragment>
        ))}
      </dl>

      {years.length > 1 ? (
        <section className="mt-10">
          <h2 className="font-heading text-2xl font-black">Year by year</h2>{" "}
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
