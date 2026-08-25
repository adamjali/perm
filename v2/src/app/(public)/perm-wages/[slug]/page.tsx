/**
 * One occupation's PERM record.
 *
 * The wage page ranks sixty occupations; these are the pages that answer what
 * a specific one pays and how its cases fare. The wage is the reason anyone
 * arrives here, so it leads, with the national ladder beside it - a salary
 * figure without its field is exactly the kind of number that misleads.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchQuery } from "convex/nextjs";

import { api } from "../../../../../convex/_generated/api";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { openGraphBase } from "@/lib/openGraphBase";
import { DataNav } from "@/components/tools/DataNav";
import { findBySlug, withUniqueSlugs } from "@/lib/entitySlug";

export const revalidate = 3600;

interface OccupationRow {
  code: string;
  title: string;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
  medianAnnualWage: number | null;
}

async function load() {
  const stats = await fetchQuery(api.permDisclosure.getLatest, {}).catch(() => null);
  const rows = [...(stats?.topOccupations ?? [])].sort((a, b) => b.total - a.total);
  return {
    slugged: withUniqueSlugs<OccupationRow>(rows, (r) => r.title),
    nationalDays: stats?.cohorts?.length
      ? median(stats.cohorts.map((c) => c.p50).filter((n): n is number => n != null))
      : null,
    baselineRate: stats?.risk?.baseline.denialRate ?? null,
    ladder: stats?.wageLadder ?? null,
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? null;
}

function approval(r: OccupationRow): number | null {
  const decided = r.certified + r.denied;
  return decided === 0 ? null : (r.certified / decided) * 100;
}

export async function generateStaticParams() {
  const { slugged } = await load();
  return slugged.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { slugged } = await load();
  const row = findBySlug(slugged, slug);
  if (!row) return { title: "Employer not found" };
  const rate = approval(row);
  const title = `${row.title} PERM Salary and Filings`;
  // SOC titles run to 79 characters ("Secretaries and Administrative
  // Assistants, Except Legal, Medical, and Executive"), which pushed the full
  // sentence one character past the 155 the SERP shows. Drop the trailing
  // clause when the title is long rather than truncating mid-word.
  const wagePart =
    row.medianAnnualWage != null
      ? `: $${Math.round(row.medianAnnualWage).toLocaleString("en-US")} median offered`
      : "";
  const head = `${row.title} PERM wages${wagePart} across ${row.total.toLocaleString("en-US")} filings`;
  const description = head.length <= 120 ? `${head}, from DOL's own files.` : `${head}.`;
  return {
    title,
    description,
    alternates: { canonical: `/perm-wages/${slug}` },
    openGraph: {
      ...openGraphBase,
      title: `${title} | PERM Tracker`,
      description,
      url: `/perm-wages/${slug}`,
    },
  };
}

export default async function OccupationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { slugged, nationalDays, baselineRate, ladder } = await load();
  const row = findBySlug(slugged, slug);
  if (!row) notFound();

  const rank = slugged.findIndex((s) => s.slug === slug) + 1;
  const rate = approval(row);
  const nationalApproval = baselineRate == null ? null : 100 - baselineRate;
  const daysDelta =
    row.medianDays != null && nationalDays != null ? row.medianDays - nationalDays : null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `${row.title} PERM offered wages and filings`,
    description: `PERM wage and filing record for ${row.title} from DOL disclosure data.`,
    url: `https://permtracker.app/perm-wages/${slug}`,
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="wages" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          <Link
            href="/perm-wages"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            All sponsors
          </Link>{" "}
          · #{rank} by volume
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          {row.title}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          SOC {row.code}. {row.total.toLocaleString("en-US")} PERM filings in
          DOL&apos;s current disclosure window,{" "}
          {row.certified.toLocaleString("en-US")} certified.
        </p>
      </header>

      <section className="pop mt-10">
        <div className="grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-4">
          {[
            {
              k: "Median wage",
              v: row.medianAnnualWage == null ? "—" : `$${Math.round(row.medianAnnualWage).toLocaleString("en-US")}`,
              sub: ladder?.p50 != null ? `all PERM $${Math.round(ladder.p50).toLocaleString("en-US")}` : "",
            },
            { k: "Filings", v: row.total.toLocaleString("en-US"), sub: `#${rank} of ${slugged.length}` },
            {
              k: "Approval",
              v: rate == null ? "—" : `${rate.toFixed(1)}%`,
              sub: nationalApproval == null ? "" : `field ${nationalApproval.toFixed(1)}%`,
            },
            {
              k: "Median days",
              v: row.medianDays == null ? "—" : Math.round(row.medianDays).toLocaleString("en-US"),
              sub:
                daysDelta == null
                  ? ""
                  : daysDelta === 0
                    ? "at the field median"
                    : `${Math.abs(Math.round(daysDelta))} ${daysDelta > 0 ? "slower" : "faster"} than the field`,
            },
          ].map((d) => (
            <div key={d.k} className="bg-card p-5">
              <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
                {d.k}
              </p>{" "}
              <p className="mt-1.5 font-heading text-2xl font-black tabular-nums">{d.v}</p>{" "}
              {d.sub ? <p className="mt-1 text-xs text-foreground/60">{d.sub}</p> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10 border-2 border-border bg-tint-primary p-6 shadow-hard-sm sm:p-8">
        <h2 className="font-heading text-xl font-black">Reading the wage</h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/70">
          This is the median wage employers committed to in federal filings for
          this occupation, which makes it harder currency than a salary survey.
          It mixes every experience level and every metro, and it is a floor
          rather than a market rate: the employer must offer at least the
          prevailing wage DOL determines for the occupation, level and county.
          The state medians on the map move this figure a long way.
        </p>
      </section>

      <section className="mt-10 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Weighing an offer?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            Compare it against this median, then check the{" "}
            <Link href="/perm-by-state" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              state map
            </Link>
            , where the same occupation&apos;s medians swing hard by worksite.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Setting one?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            All sixty occupations sort together on the{" "}
            <Link href="/perm-wages" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              wages page
            </Link>
            , and{" "}
            <Link href="/perm-denial-risk" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              denial rates
            </Link>{" "}
            show how outcome moves with the offered wage.
          </p>
        </div>
      </section>
    </div>
  );
}
