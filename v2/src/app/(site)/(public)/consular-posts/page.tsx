/**
 * Every US consulate that issues immigrant visas: where State's own records put it. Two of State's
 * tables, side by side: its IV Scheduling Status Tool (the month of complete cases NVC is
 * scheduling at each post, copied in a browser monthly, scripts/ingest_iv_scheduling.py) and its
 * monthly issuances by post (scripts/ingest_visa_issuances.py). The pause is the hand-kept record
 * in scripts/data/consular_facts.json, with State's sworn words.
 *
 * Expired by /api/revalidate-consular when a new table is stored.
 */

import type { Metadata } from "next";
import Link from "next/link";

import { ConsularPauseNote } from "@/components/consular/ConsularPauseNote";
import { ConsularPostsTable } from "@/components/consular/ConsularPostsTable";
import { BarRows, type BarRow } from "@/components/data/BarRows";
import { DataProvenance } from "@/components/data/DataProvenance";
import { Figure, FigureRow } from "@/components/data/FigureRow";
import { FinePrint } from "@/components/data/FinePrint";
import { FigurePlate } from "@/components/tools/FigurePlate";
import { ToolPageFooter } from "@/components/tools/ToolPageFooter";
import { behindLabel, IV_TOOL_URL, monthsBehind } from "@/lib/consular/scheduling";
import { getConsularIndex } from "@/lib/db/consularPosts";
import { monthName } from "@/lib/db/visaIssuances";
import { formatInt } from "@/lib/format";
import { openGraphBase } from "@/lib/openGraphBase";
import { withSocialCard } from "@/lib/socialCard";
import { longDate } from "@convex/lib/months";

export const revalidate = 86400;

const TITLE = "US Consulates: Immigrant Visa Interviews by Post";
const DESCRIPTION =
  "Where each US consulate stands on immigrant visas: the month NVC is scheduling, the visas it issued, and the interview pause, from State's own records.";
const PATH = "/consular-posts";

export const metadata: Metadata = withSocialCard(
  {
    title: { absolute: `${TITLE} | PERM Tracker` },
    description: DESCRIPTION,
    alternates: { canonical: PATH },
    openGraph: { ...openGraphBase, title: `${TITLE} | PERM Tracker`, description: DESCRIPTION, url: PATH },
  },
  "consular-posts",
);

export default async function ConsularPostsPage() {
  const index = await getConsularIndex();
  const { asOf, posts } = index;
  const listed = posts.filter((p) => p.now);
  const caughtUp = asOf ? listed.filter((p) => monthsBehind(p.now?.employment, asOf) === 0).length : 0;
  const employmentAbroad = posts.reduce((a, p) => a + p.employment, 0);
  const behind: BarRow[] = asOf
    ? listed
        .map((p) => ({ p, n: monthsBehind(p.now?.employment, asOf) }))
        .filter((x): x is { p: (typeof listed)[number]; n: number } => x.n !== null && x.n > 0)
        .sort((a, b) => b.n - a.n)
        .map(({ p, n }) => ({
          key: p.key,
          label: (
            <Link href={`/consular-posts/${p.slug}`} className="link">
              {p.name}
            </Link>
          ),
          sub: `Scheduling cases complete in ${p.now?.employment.printed}${p.employment ? `; ${formatInt(p.employment)} employment visas a year` : ""}`,
          value: n,
          text: behindLabel(p.now?.employment, asOf),
          tone: "yellow" as const,
          tip: `${p.name}\n${behindLabel(p.now?.employment, asOf)}\nScheduling cases complete in ${p.now?.employment.printed}`,
        }))
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="pt-10 sm:pt-12" />
      <header>
        <h1 className="font-heading text-4xl font-bold leading-tight sm:text-5xl">US consulates and immigrant visas</h1>{" "}
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-muted-foreground">
          In fiscal 2024, about one employment green card in three ended with an interview at a consulate abroad.
          Here&apos;s where each consulate stands, from the State Department&apos;s own records.
        </p>
      </header>

      <ConsularPauseNote variant="full" className="mt-8" />

      <FigureRow className="mt-8">
        <Figure
          label="Caught up on paper"
          value={asOf ? `${caughtUp} of ${listed.length}` : "Not loaded"}
          note={asOf ? `posts scheduling employment cases completed this month, State's update of ${longDate(asOf)}` : undefined}
        />{" "}
        <Figure
          label="Behind on employment cases"
          value={formatInt(behind.length)}
          note={asOf ? `posts scheduling cases completed in an earlier month` : undefined}
        />{" "}
        <Figure
          label="Employment visas issued abroad"
          value={formatInt(employmentAbroad)}
          note={index.issuedFrom && index.issuedTo ? `${monthName(index.issuedFrom)} to ${monthName(index.issuedTo)}, State's newest tables` : undefined}
        />
      </FigureRow>

      {behind.length ? (
        <FigurePlate
          title="How far back each post is scheduling employment cases"
          subject={asOf ? `State's update of ${longDate(asOf)}` : ""}
          caption="Each bar is how many months before State's update the post's employment cases were completed. It's NVC's paperwork queue: a post at zero has no backlog on paper, and a post holding no interviews can still read zero."
          source="U.S. Department of State, IV Scheduling Status Tool"
          className="mt-10"
        >
          <BarRows inline rows={behind} label="Months back each post is scheduling employment cases" />
        </FigurePlate>
      ) : null}

      <section className="mt-12" aria-labelledby="every-post">
        <h2 id="every-post" className="font-heading text-2xl font-bold">
          Every consulate
        </h2>{" "}
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          The month NVC is scheduling in each category, and the immigrant visas each post issued in the newest 12 months
          State has published. A post&apos;s page has its history.
        </p>
        <div className="mt-5">
          <ConsularPostsTable posts={posts} asOf={asOf} />
        </div>
      </section>

      <FinePrint summary="How to read State's table" className="mt-8">
        <p className="max-w-3xl text-base leading-relaxed">
          State&apos;s own words: the tool shows{" "}
          <q>
            the documentarily complete month and year for which NVC is scheduling most interviews in your classification
            at the selected U.S. embassy or consulate.
          </q>{" "}
          A case is documentarily complete once NVC has the fees, the DS-260 and every document. Compare that month with
          yours: if the post&apos;s month is later, NVC is scheduling cases like yours. A preference case also needs a
          current priority date in the{" "}
          <Link href="/visa-bulletin" className="link">
            visa bulletin
          </Link>
          . State updates the table monthly. Its site refuses automated readers, so it&apos;s copied in a browser each
          month, and the Internet Archive&apos;s copies fill the months before.
        </p>
      </FinePrint>

      <p className="mt-6 text-sm text-muted-foreground">
        Sources:{" "}
        <a href={IV_TOOL_URL} className="link" target="_blank" rel="noopener noreferrer">
          U.S. Department of State, IV Scheduling Status Tool
        </a>
        {asOf ? `, update of ${longDate(asOf)}` : ""}, and its monthly immigrant visa issuances by post
        {index.issuedTo ? ` through ${monthName(index.issuedTo)}` : ""}.
      </p>
      <ToolPageFooter
        currentHref={PATH}
        reading={[
          { href: "/guides/immigrant-visa-interview-pause", label: "The interview pause, explained", note: "what changed, who it reaches, and the court cases" },
          { href: "/visa-issuances", label: "Visas issued abroad", note: "every category, month by month" },
          { href: "/nvc-waiting-list", label: "NVC waiting list", note: "how many wait at the consular stage" },
        ]}
      />
      <DataProvenance datasets={["iv-scheduling", "visa-issuances"]} />
    </div>
  );
}
