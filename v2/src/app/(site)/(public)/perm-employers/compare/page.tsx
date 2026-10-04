import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";

import { EmployerComparePicker } from "@/components/entities/EmployerComparePicker";
import { DataProvenance } from "@/components/data/DataProvenance";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { approvalRate } from "@/lib/entityPayload";
import { wilsonInterval } from "@/lib/wageLadder";
import { stateName } from "@/lib/usStateNames";
import { entityFacets, entityPending, resolveEntity, type EntityFacets, type EntityPending, type ResolvedEntity } from "@/lib/turso/entityDetail";
import { getSponsorProfile } from "@/lib/turso/sponsorIndex";
import { partValue, type SponsorPart } from "@/lib/sponsorProfile";
import { formatDollars, formatInt, formatPercent } from "@/lib/format";

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
  "Two PERM sponsors side by side, from DOL's files: filings, approval rate, median days and wage, and the occupations and states each files for.";

export const metadata: Metadata = withSocialCard({
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-employers/compare" },
  robots: { index: false, follow: true },
  openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: "/perm-employers/compare" },
}, "employer-compare");

const SLUG_RE = /^[a-z0-9-]{1,120}$/;
const MIN_FOR_RATE = 30;

interface Side {
  entity: ResolvedEntity;
  pending: EntityPending | null;
  facets: EntityFacets;
  /** Its parts ranked among other sponsors (sponsor_index), by part id. */
  parts: Map<string, SponsorPart>;
}

async function loadSide(slug: string): Promise<Side | null> {
  const entity = await resolveEntity("employer", slug);
  if (!entity) return null;
  const [pending, facets, profile] = await Promise.all([
    entityPending("employer", entity.canonicalSlug),
    entityFacets("employer", entity.canonicalSlug),
    getSponsorProfile(entity.canonicalSlug).catch(() => null),
  ]);
  return { entity, pending, facets, parts: new Map((profile?.parts ?? []).map((p) => [p.id, p])) };
}

/** A ranked part's figure and where it stands, or why there's none. */
function partCell(s: Side, id: SponsorPart["id"], none: string): string {
  const p = s.parts.get(id);
  if (!p) return none;
  const share = Math.round(p.pct * 100);
  return `${partValue(p)} (${share >= 100 ? "top" : share <= 0 ? "bottom" : `higher than ${share}%`} of ${formatInt(p.of)})`;
}

const int = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : formatInt(n));
const usd = (n: number | null | undefined) => (n === null || n === undefined ? "n/a" : formatDollars(n));

function rateCell(certified: number, denied: number): string {
  const decided = certified + denied;
  const r = approvalRate({ certified, denied });
  if (r === null || decided < MIN_FOR_RATE) return decided === 0 ? "no decisions" : `withheld under ${MIN_FOR_RATE} decisions`;
  const band = wilsonInterval(denied, decided);
  return band ? `${formatPercent(r, 1)} (denial ${formatPercent(band.lo, 1)} to ${formatPercent(band.hi, 1)})` : formatPercent(r, 1);
}

/**
 * Pairs to start from when nothing is picked yet: three of the busiest sponsors
 * in DOL's files. Their slugs are kept across rebuilds, so the links stay good.
 */
const EXAMPLES = [
  { label: "Microsoft and Apple", a: "microsoft-corporation", b: "apple-inc" },
  { label: "Intel and Microsoft", a: "intel-corporation", b: "microsoft-corporation" },
  { label: "FPL Food and JCG Foods of Georgia", a: "fpl-food-llc", b: "jcg-foods-of-georgia-llc" },
] as const;

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
    // Ranked among other sponsors with enough cases (sponsor_index).
    { label: "PERM filings in the last 12 months", value: (s) => partCell(s, "perm_recent", "none"), note: "and where it ranks among sponsors that filed any" },
    { label: "H-1B LCAs certified, last 24 months", value: (s) => partCell(s, "lca_24m", "none") },
    { label: "H-1B positions that were transfers", value: (s) => partCell(s, "transfer_share", "too few positions to rate"), note: "a change of employer, over the newest 24 months of LCA detail" },
    { label: "USCIS H-1B approval rate", value: (s) => partCell(s, "uscis_rate", "too few decisions to rate"), note: "last three fiscal years of USCIS's Employer Data Hub" },
  ];

  const facetList = (s: Side, kind: "occupation" | "state") =>
    (s.facets[kind] ?? []).slice(0, 5).map((f) => `${f.label} (${int(f.n)})`).join(", ") || "n/a";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pb-24 sm:pt-14">
      <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
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

      {!slugA && !slugB ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Or start from a pair:{" "}
          {EXAMPLES.map((e, i) => (
            <Fragment key={e.label}>
              {i > 0 ? ", " : ""}
              <Link
                href={`/perm-employers/compare?a=${e.a}&b=${e.b}`}
                rel="nofollow"
                className="font-semibold text-foreground underline decoration-primary decoration-2 underline-offset-2 hover:text-primary-text"
              >
                {e.label}
              </Link>
            </Fragment>
          ))}
          .
        </p>
      ) : null}{" "}

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
                <th scope="col" className="px-4 py-3 text-left font-mono text-sm font-bold uppercase tracking-[0.1em]">Measure{" "} </th>
                {[left, right].map((s) => (
                  <Fragment key={s.entity.canonicalSlug}>
                    <th scope="col" className="px-4 py-3 text-left">
                      <Link href={`/perm-employers/${s.entity.canonicalSlug}`} className="font-heading text-base font-black underline decoration-primary decoration-2 underline-offset-2">
                        {s.entity.row.name}
                      </Link>{" "}
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody translate="no">
              {rows.map((r) => (
                <Fragment key={r.label}>
                  <tr className="border-t-2 border-border align-top">
                    <th scope="row" className="px-4 py-3 text-left font-semibold">
                      {r.label}{" "}
                      {r.note ? <span className="block text-sm font-normal text-muted-foreground">{r.note}</span> : null}{" "}
                    </th>
                    <td className="px-4 py-3 font-heading font-bold">{r.value(left)}{" "} </td>
                    <td className="px-4 py-3 font-heading font-bold">{r.value(right)}{" "} </td>
                  </tr>
                </Fragment>
              ))}
              <tr className="border-t-2 border-border align-top">
                <th scope="row" className="px-4 py-3 text-left font-semibold">Top occupations filed{" "} </th>
                <td className="px-4 py-3">{facetList(left, "occupation")}{" "} </td>
                <td className="px-4 py-3">{facetList(right, "occupation")}{" "} </td>
              </tr>
              <tr className="border-t-2 border-border align-top">
                <th scope="row" className="px-4 py-3 text-left font-semibold">Top worksite states{" "} </th>
                <td className="px-4 py-3">{facetList(left, "state")}{" "} </td>
                <td className="px-4 py-3">{facetList(right, "state")}{" "} </td>
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}{" "}

      {both ? (
        <section className="mt-8 max-w-3xl border-2 border-border bg-card p-5 sm:p-6" aria-labelledby="switching">
          <h2 id="switching" className="font-heading text-xl font-black">
            If you&apos;re moving from one to the other
          </h2>{" "}
          <p className="mt-2 text-base leading-relaxed text-foreground/80">
            Where your own case stands matters more than any figure above.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/80">
            <li>Before the I-140 is approved, a move usually means a new PERM with the new employer.</li>{" "}
            <li>
              Once it&apos;s approved, the priority date stays yours for a later employment-based petition unless
              USCIS revokes the approval for fraud or a willful misrepresentation, a revoked or invalidated labor
              certification, or a material error (8 CFR 204.5(e)).
            </li>{" "}
            <li>
              If the old employer withdraws the I-140 180 days or more after approval, it stays approved (8 CFR
              205.1(a)(3)(iii)(C)).
            </li>{" "}
            <li>
              An I-485 pending 180 days or more can move to a same or similar job (INA 204(j); 8 CFR 245.25).
            </li>{" "}
            <li>
              In H-1B status, you can start with the new employer once it files a nonfrivolous H-1B petition for you,
              or on its requested start date, whichever is later (8 CFR 214.2(h)(2)(i)(H)).
            </li>
          </ul>{" "}
          <p className="mt-3 text-base">
            <Link href="/tools/priority-date-retention" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              Check your own dates
            </Link>
            , read{" "}
            <Link href="/guides/three-180-day-clocks" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              the three 180-day clocks
            </Link>
            , or see{" "}
            <Link href="/tools/h1b-six-year-limit" className="font-semibold text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
              how H-1B time past six years works
            </Link>
            .
          </p>
        </section>
      ) : null}{" "}

      <DataProvenance datasets={["perm-cases", "entities", "perm-case-status"]} />
    </div>
  );
}
