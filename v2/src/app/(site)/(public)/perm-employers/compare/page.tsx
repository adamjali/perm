import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { EmployerComparePicker } from "@/components/entities/EmployerComparePicker";
import { DataProvenance } from "@/components/data/DataProvenance";
import { openGraphBase } from "@/lib/openGraphBase";
import { approvalRate } from "@/lib/entityPayload";
import { wilsonInterval } from "@/lib/wageLadder";
import { stateName } from "@/lib/usStateNames";
import { entityFacets, entityPending, resolveEntity, type EntityFacets, type EntityPending, type ResolvedEntity } from "@/lib/turso/entityDetail";

/**
 * Two employers side by side.
 *
 * The honest version of a "transfer risk calculator": the two records next
 * to each other, every figure from DOL's files with its floor and interval,
 * and no score. Which one is the safer sponsor depends on the reader's own
 * facts (the I-140 stage, the priority date, the role), and the page says
 * that instead of pretending to know it.
 *
 * Reads `searchParams`, so it is rendered per request: two indexed entity
 * reads, two pending rows and two facet sets. robots.txt keeps crawlers off
 * the query form, because the number of pairs is the square of the employer
 * count.
 */

const TITLE = "Compare Two Employers";
const DESCRIPTION =
  "Two PERM sponsors side by side from DOL's own files: filings, certifications and denials with their interval, median days, median wage, pending cases now, and the occupations and states each files for.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-employers/compare" },
  robots: { index: false, follow: true },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/perm-employers/compare" },
};

const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const MIN_FOR_RATE = 30;

interface Side {
  entity: ResolvedEntity;
  pending: EntityPending | null;
  facets: EntityFacets;
}

async function loadSide(slug: string): Promise<Side | null> {
  const entity = await resolveEntity("employer", slug);
  if (!entity) return null;
  const [pending, facets] = await Promise.all([
    entityPending("employer", entity.canonicalSlug),
    entityFacets("employer", entity.canonicalSlug),
  ]);
  return { entity, pending, facets };
}

const int = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : n.toLocaleString("en-US"));
const usd = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : `$${Math.round(n).toLocaleString("en-US")}`);
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function rateCell(certified: number, denied: number): string {
  const decided = certified + denied;
  const r = approvalRate({ certified, denied });
  if (r === null || decided < MIN_FOR_RATE) return decided === 0 ? "no decisions" : `withheld under ${MIN_FOR_RATE} decisions`;
  const band = wilsonInterval(denied, decided);
  return band ? `${pct(r)} (denial ${pct(band.lo)} to ${pct(band.hi)})` : pct(r);
}

export default async function CompareEmployersPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const slugA = a && SLUG_RE.test(a) ? a : null;
  const slugB = b && SLUG_RE.test(b) ? b : null;
  const [left, right] = await Promise.all([
    slugA ? loadSide(slugA) : Promise.resolve(null),
    slugB && slugB !== slugA ? loadSide(slugB) : Promise.resolve(null),
  ]);
  const both = left && right;

  const rows: { label: string; value: (s: Side) => string; note?: string }[] = [
    { label: "Rank by volume", value: (s) => `#${int(s.entity.row.rank)}` },
    { label: "PERM filings in the files", value: (s) => int(s.entity.row.total) },
    { label: "Certified", value: (s) => int(s.entity.row.certified) },
    { label: "Denied", value: (s) => int(s.entity.row.denied) },
    { label: "Approval rate", value: (s) => rateCell(s.entity.row.certified ?? 0, s.entity.row.denied ?? 0), note: "of decided cases, with the 95% interval on the denial share" },
    { label: "Median days to a decision", value: (s) => int(s.entity.row.medianDays) },
    { label: "Median offered wage", value: (s) => usd(s.entity.row.medianAnnualWage) },
    { label: "State", value: (s) => (s.entity.row.state ? `${s.entity.row.state}, ${stateName(s.entity.row.state)}` : "n/a") },
    { label: "Pending with DOL now", value: (s) => (s.pending ? int(s.pending.pending) : "n/a"), note: "from the nightly status sweep" },
    { label: "Oldest pending filing", value: (s) => s.pending?.oldest ?? "n/a" },
  ];

  const facetList = (s: Side, kind: "occupation" | "state") =>
    (s.facets[kind] ?? []).slice(0, 5).map((f) => `${f.label} (${int(f.n)})`).join(", ") || "n/a";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:text-sm">
        <Link href="/perm-employers" className="underline underline-offset-2 hover:text-primary">Employers</Link>
      </p>{" "}
      <h1 className="mt-3 font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
        Compare two employers
      </h1>{" "}
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-foreground/70">
        Two PERM sponsors next to each other, every figure from DOL&apos;s own
        files. No score: which one is the safer bet depends on your own case,
        and the numbers are here so you can weigh it.
      </p>{" "}

      <div className="mt-8">
        <EmployerComparePicker
          a={left ? { slug: left.entity.canonicalSlug, name: left.entity.row.name } : null}
          b={right ? { slug: right.entity.canonicalSlug, name: right.entity.row.name } : null}
        />
      </div>{" "}

      {(slugA && !left) || (slugB && !right) ? (
        <p role="alert" className="mt-6 border-2 border-border bg-card p-4 text-sm font-bold">
          One of those employers is not in the index. Pick it again from the search.
        </p>
      ) : null}{" "}

      {both ? (
        <div className="mt-10 overflow-x-auto overscroll-x-none border-2 border-border bg-card shadow-hard">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="bg-foreground text-background">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-mono text-xs font-bold uppercase tracking-[0.1em]">Measure </th>{" "}
                {[left, right].map((s) => (
                  <Fragment key={s.entity.canonicalSlug}>{" "}
                    <th scope="col" className="px-4 py-3 text-left">
                      <Link href={`/perm-employers/${s.entity.canonicalSlug}`} className="font-heading text-base font-black underline decoration-primary decoration-2 underline-offset-2">
                        {s.entity.row.name}
                      </Link>
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.label}>{" "}
                  <tr className="border-t-2 border-border align-top">
                    <th scope="row" className="px-4 py-3 text-left font-semibold">
                      {r.label}{" "}
                      {r.note ? <span className="block text-xs font-normal text-muted-foreground">{r.note}</span> : null}
                    </th>{" "}
                    <td className="px-4 py-3 font-heading font-bold">{r.value(left)} </td>{" "}
                    <td className="px-4 py-3 font-heading font-bold">{r.value(right)} </td>
                  </tr>
                </Fragment>
              ))}{" "}
              <tr className="border-t-2 border-border align-top">
                <th scope="row" className="px-4 py-3 text-left font-semibold">Top occupations filed </th>{" "}
                <td className="px-4 py-3">{facetList(left, "occupation")} </td>{" "}
                <td className="px-4 py-3">{facetList(right, "occupation")} </td>
              </tr>{" "}
              <tr className="border-t-2 border-border align-top">
                <th scope="row" className="px-4 py-3 text-left font-semibold">Top worksite states </th>{" "}
                <td className="px-4 py-3">{facetList(left, "state")} </td>{" "}
                <td className="px-4 py-3">{facetList(right, "state")} </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}{" "}

      {both ? (
        <p className="mt-6 max-w-3xl text-sm leading-relaxed text-foreground/75">
          Moving employers before an I-140 is approved usually means a new
          PERM; after 180 days of an approved I-140 the priority date is
          portable under AC21. Which of those applies to you decides more than
          any figure above.{" "}
          <Link href="/guides/three-180-day-clocks" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
            The three 180-day clocks
          </Link>{" "}
          explains the rules.
        </p>
      ) : null}{" "}

      <DataProvenance datasets={["perm-cases", "entities", "perm-case-status"]} />
    </div>
  );
}
