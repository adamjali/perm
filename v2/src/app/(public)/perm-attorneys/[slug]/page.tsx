/**
 * One law firm's PERM record.
 *
 * The same treatment as the employer pages, for the half of the audience the
 * rival product does not serve. An attorney gets a public benchmark of their
 * own practice against the field; a beneficiary gets to see whether the firm
 * on their case has done this before.
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

interface AttorneyRow {
  name: string;
  state: string;
  total: number;
  certified: number;
  denied: number;
  medianDays: number | null;
}

async function load() {
  const stats = await fetchQuery(api.permDisclosure.getLatest, {}).catch(() => null);
  const rows = [...(stats?.topAttorneys ?? [])].sort((a, b) => b.total - a.total);
  return {
    slugged: withUniqueSlugs<AttorneyRow>(rows, (r) => r.name),
    nationalDays: stats?.cohorts?.length
      ? median(stats.cohorts.map((c) => c.p50).filter((n): n is number => n != null))
      : null,
    baselineRate: stats?.risk?.baseline.denialRate ?? null,
  };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? null;
}

function approval(r: AttorneyRow): number | null {
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
  const title = `${row.name} PERM Cases`;
  const description = `${row.name} filed ${row.total.toLocaleString("en-US")} PERM labor certifications in DOL's current disclosure window${rate != null ? `, with a ${rate.toFixed(1)}% approval rate` : ""}. Case volume, certifications and median processing days from DOL's own files.`;
  return {
    title,
    description,
    alternates: { canonical: `/perm-attorneys/${slug}` },
    openGraph: {
      ...openGraphBase,
      title: `${title} | PERM Tracker`,
      description,
      url: `/perm-attorneys/${slug}`,
    },
  };
}

export default async function AttorneyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { slugged, nationalDays, baselineRate } = await load();
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
    name: `${row.name} PERM labor certification cases`,
    description: `PERM case record for ${row.name} from DOL disclosure data.`,
    url: `https://permtracker.app/perm-attorneys/${slug}`,
    creator: { "@type": "Organization", name: "PERM Tracker" },
    isBasedOn: "https://www.dol.gov/agencies/eta/foreign-labor/performance",
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="attorneys" />
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={schema} />

      <header className="max-w-3xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-foreground/50">
          <Link
            href="/perm-attorneys"
            className="inline-flex min-h-[44px] items-center underline underline-offset-2 hover:text-primary"
          >
            All sponsors
          </Link>{" "}
          · #{rank} by volume
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          {row.name}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {row.total.toLocaleString("en-US")} PERM cases in DOL&apos;s current
          disclosure window, {row.certified.toLocaleString("en-US")} certified.
          {row.state ? ` Filed from ${row.state}.` : ""} Firm name as filed.
        </p>
      </header>

      <section className="pop mt-10">
        <div className="grid [&>*]:min-w-0 grid-cols-2 gap-px border-2 border-border bg-border sm:grid-cols-4">
          {[
            { k: "Cases", v: row.total.toLocaleString("en-US"), sub: `#${rank} of ${slugged.length}` },
            { k: "Certified", v: row.certified.toLocaleString("en-US"), sub: `${row.denied.toLocaleString("en-US")} denied` },
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
        <h2 className="font-heading text-xl font-black">What this does and does not say</h2>{" "}
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-foreground/70">
          Volume says how much PERM work a firm does, and the approval rate
          says whether those filings hold up. Neither is a measure of the
          advice, and neither affects speed: DOL works one national queue,
          oldest first, whoever filed the case. Approval rates cluster above
          99% across every firm at this volume, so the number that separates
          practices is not on this page.
        </p>
      </section>

      <section className="mt-10 grid [&>*]:min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">They&apos;re handling your case?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            The{" "}
            <Link href="/tools/perm-timeline-calculator" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              decision estimator
            </Link>{" "}
            reads your filing month against where DOL is now, which is the part
            that actually decides your wait.
          </p>
        </div>
        <div className="border-2 border-border bg-card p-6 shadow-hard-sm">
          <h2 className="font-heading text-lg font-black">Running the practice?</h2>{" "}
          <p className="mt-2 text-sm leading-relaxed text-foreground/70">
            The{" "}
            <Link href="/perm-attorneys" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              full ranking
            </Link>{" "}
            sorts every column, and the{" "}
            <Link href="/signup" className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary">
              free tracker
            </Link>{" "}
            carries the deadlines on every case.
          </p>
        </div>
      </section>
    </div>
  );
}
