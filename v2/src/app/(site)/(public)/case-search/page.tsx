import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { FinePrint } from "@/components/data/FinePrint";
import { JsonLdScript } from "@/components/seo/JsonLdScript";
import { UnifiedCaseSearch } from "@/components/tools/UnifiedCaseSearch";
import { generateBreadcrumbSchema } from "@/lib/content/seo";
import { openGraphBase } from "@/lib/openGraphBase";
import { getMeta } from "@/lib/turso/cases";
import { getLiveRemainderSummary } from "@/lib/turso/liveCases";
import { getPwdSummary, getPwdDisclosureSummary } from "@/lib/turso/pwdCases";
import { getLcaSummary, getLcaDisclosureSummary } from "@/lib/turso/lcaCases";

/**
 * One search over every DOL filing this site holds.
 *
 * THE GAP THIS CLOSES. The corpus is three programs across six tables, and
 * until now the only way in was to already know which program you wanted.
 * Somebody told "the wage request is in" does not know that a wage request is
 * a different DOL program from the PERM, with a different form, a different
 * number and a different page. They should not have to. One box, one
 * employer, everything that employer has filed.
 *
 * STATIC. Every control lives in the client component and the results come
 * from `/api/case-search`, so no `searchParams` is read here and the page is
 * prerendered. The header counts are the only server read.
 */

const TITLE = "Search Every DOL Case";
const DESCRIPTION =
  "One search across PERM applications, prevailing wage requests and H-1B LCAs: find every filing an employer has made, with status, dates and wage, sortable.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/case-search" },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/case-search",
  },
};

// The counts move once a night; the search itself is live through the route.
export const revalidate = 86400;

const fmt = (n: number) => n.toLocaleString("en-US");

export default async function CaseSearchPage() {
  const [permMeta, permLive, pwd, pwdFile, lca, lcaFile] = await Promise.all([
    getMeta().catch(() => null),
    getLiveRemainderSummary().catch(() => null),
    getPwdSummary().catch(() => null),
    getPwdDisclosureSummary().catch(() => null),
    getLcaSummary().catch(() => null),
    getLcaDisclosureSummary().catch(() => null),
  ]);

  // Each program's holdings are its live rows plus its published file. A
  // single total across the three would be the more impressive number and the
  // less useful one: they are different programs and a reader deciding whether
  // this covers their case needs the breakdown, not the sum.
  const bands: { label: string; n: number | null; href: string; note: string }[] = [
    {
      label: "PERM applications",
      // The published file plus the live remainder, which is exactly what the
      // search reads. `perm_live_recent` holds only cases `perm_cases` does
      // not, so the two cannot double-count.
      n:
        permMeta || permLive
          ? (permMeta?.totalCases ?? 0) + (permLive?.total ?? 0)
          : null,
      href: "/perm-cases",
      note: "Decided cases DOL has published, plus everything still open from the daily check.",
    },
    {
      label: "Wage requests",
      n: pwd && pwdFile ? pwd.total + pwdFile.rows : (pwd?.total ?? pwdFile?.rows ?? null),
      href: "/pwd-cases",
      note: "The ETA-9141 that sets the wage, filed months before the PERM.",
    },
    {
      label: "H-1B LCAs",
      n: lca && lcaFile ? lca.total + lcaFile.rows : (lca?.total ?? lcaFile?.rows ?? null),
      href: "/lca-cases",
      note: "The ETA-9035 an employer files to sponsor or extend an H-1B.",
    },
  ];

  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: "Data", href: "/tools" },
    { name: "Search every case", href: "/case-search" },
  ]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <JsonLdScript schema={breadcrumbSchema} />

      <header className="max-w-2xl">
        <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">
          All three programs, one box
        </p>{" "}
        <h1 className="mt-2 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Search every case an employer has filed
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          The PERM, the wage request before it and the H-1B condition
          application beside it are three separate DOL programs with three
          separate numbers. Type the employer once and see all of them, open
          and decided.
        </p>
      </header>

      <dl className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3 [&>*]:min-w-0">
        {bands.map((b, i) => (
          <div
            key={b.label}
            className={
              "border-2 border-border p-4 shadow-hard " + (i === 1 ? "bg-tint-primary" : "bg-card")
            }
          >
            <dt className="text-sm font-bold text-foreground/70">{b.label}</dt>{" "}
            <dd className="mt-1 font-heading text-3xl font-black tabular-nums">
              {b.n === null ? "—" : fmt(b.n)}
            </dd>{" "}
            <p className="mt-2 text-sm leading-relaxed text-foreground/70">{b.note}</p>{" "}
            <p className="mt-2 text-sm">
              <Link
                href={b.href}
                className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
              >
                Browse just this program
              </Link>
            </p>
          </div>
        ))}
      </dl>

      <div className="mt-10">
        <Suspense fallback={<p className="text-base text-foreground/60">Loading the search…</p>}>
          <UnifiedCaseSearch />
        </Suspense>
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="font-heading text-2xl font-black">How this search works</h2>{" "}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-foreground/80">
          <p>
            <b className="font-bold">The employer field is required.</b> Job
            title, wage and date narrow an employer&apos;s results rather than
            standing on their own. With a case number,{" "}
            <Link
              href="/perm-case-status"
              className="font-bold underline decoration-primary decoration-2 underline-offset-2 hover:text-primary"
            >
              the status lookup
            </Link>{" "}
            takes all three prefixes and asks DOL live. Paste one into the box
            above and it hands you straight there.
          </p>{" "}
          <p>
            <b className="font-bold">A number is live, a name is not.</b> A case
            number is answered by asking DOL at that moment, so a filing made
            yesterday resolves. A name is answered from this site&apos;s own
            copy, rebuilt every night, so one from the last day or two may not
            appear under its employer yet.
          </p>{" "}
          <p>
            <b className="font-bold">Two records per case, merged.</b> An open
            filing exists only in DOL&apos;s case system, checked here daily. A
            decided one is published with its wage in a quarterly file. A case
            in both is shown once, using the published version.
          </p>{" "}
          {/* "One filed in the last day or two arrives with the next nightly
              check" was cut from this list: the paragraph above already says
              it, and a caveat repeated is a caveat skipped. */}
          <p>
            <b className="font-bold">Why a filing might be missing.</b> An open
            one older than the backfill has reached is not there yet. DOL names
            the law firm and the worksite only at publication, so those are
            absent from anything still open. And an employer DOL spells several
            ways answers to the spelling on the filing, so a shorter name
            usually finds more.
          </p>{" "}
          {/* Mechanism, not correction: it says why the search is shaped this
              way rather than changing how a result reads, so it collapses. */}
          <FinePrint summary="Why a name works differently from a number">
            <p>
              Every lookup underneath runs on an index built over the employer
              name. A search on a job title or a wage alone has no index to sit
              on and would read the whole corpus for every visitor.
            </p>{" "}
            <p>
              DOL&apos;s case system answers numbers, not employers, and no
              public endpoint searches it by name. So a name is answered from
              this site&apos;s own copy, which grows by walking forward into the
              numbers DOL has newly issued.
            </p>
          </FinePrint>
        </div>
      </section>
    </div>
  );
}
