import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Warning } from "@phosphor-icons/react/ssr";

import { DataNav } from "@/components/tools/DataNav";
import { formatMonth } from "@/lib/dolFormat";
import { splitCohort } from "@/lib/liveQueue";
import { MIRROR_COMPLETE, PROVISIONAL_NOTICE } from "@/lib/liveQueueGate";
import { getLiveCohort } from "@/lib/turso/publicData";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * One filing month, split across the queues DOL actually runs.
 *
 * The split is the whole point. ANALYST REVIEW is the ordinary queue where
 * waiting is the entire story; an RFI, an audit or supervised recruitment
 * takes a case OUT of filing order, which is the honest answer to "DOL passed
 * my month and I still have nothing".
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ month: string }>;
}): Promise<Metadata> {
  const { month } = await params;
  if (!MONTH_RE.test(month)) return {};
  const label = formatMonth(month) ?? month;
  const title = `PERM Cases Filed ${label}`;
  return {
    title,
    description: `How many PERM cases filed in ${label} are still undecided, and which of DOL's queues they are sitting in.`,
    alternates: { canonical: `/perm-queue/${month}` },
    robots: MIRROR_COMPLETE ? undefined : { index: false, follow: true },
    openGraph: { ...openGraphBase, title: `${title} | PERM Tracker`, url: `/perm-queue/${month}` },
  };
}

export const revalidate = 3600;

const int = (n: number) => n.toLocaleString("en-US");

/** Title case for a screaming-caps status, so a page is not shouted at. */
function pretty(status: string): string {
  return status
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bRfi\b/, "RFI")
    .replace(/\bNord\b/, "NORD")
    .replace(/\bBalca\b/, "BALCA");
}

export default async function CohortPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  // Shape-checked before the query: the month goes into SQL, and a route
  // segment is caller input however ordinary it looks.
  if (!MONTH_RE.test(month)) notFound();

  const counts = await getLiveCohort(month);
  if (counts.length === 0) notFound();
  const split = splitCohort(counts);
  const label = formatMonth(month) ?? month;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="overview" />
      <div className="pt-10 sm:pt-12" />

      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <Link href="/perm-queue" className="underline underline-offset-2 hover:text-primary">
            PERM queue
          </Link>
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Filed {label}
        </h1>{" "}
        <p className="mt-4 text-lg leading-relaxed text-foreground/70">
          {int(split.total)} cases, {int(split.pending)} of them still
          undecided.
        </p>
      </header>

      {!MIRROR_COMPLETE ? (
        <p className="mt-8 flex items-start gap-2 border-2 border-data-warn bg-data-warn/8 px-4 py-3 text-base text-foreground/80">
          <Warning className="mt-0.5 h-4 w-4 shrink-0 text-data-warn-ink" weight="fill" aria-hidden="true" />{" "}
          <span>{PROVISIONAL_NOTICE}</span>
        </p>
      ) : null}

      <section className="mt-8 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black">Still waiting</h2>{" "}
        <p className="mt-2 text-base leading-relaxed text-foreground/70">
          {int(split.ordinary)} in analyst review, the ordinary queue that
          moves in filing order.
          {split.outOfOrder.length > 0 ? (
            <>
              {" "}
              The rest are in queues that take a case out of that order, so
              their wait does not follow the month.
            </>
          ) : null}
        </p>

        {split.outOfOrder.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {split.outOfOrder.map((s) => (
              <li
                key={s.status}
                className="flex items-baseline justify-between gap-4 border-b-2 border-border pb-2 text-base"
              >
                <span className="text-foreground/70">{pretty(s.status)}</span>{" "}
                <span className="font-bold tabular-nums">{int(s.count)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="mt-6 border-2 border-border bg-card p-6 shadow-hard sm:p-8">
        <h2 className="font-heading text-xl font-black">Already decided</h2>
        <ul className="mt-4 space-y-2">
          {split.decided.map((s) => (
            <li
              key={s.status}
              className="flex items-baseline justify-between gap-4 border-b-2 border-border pb-2 text-base"
            >
              <span className="text-foreground/70">{pretty(s.status)}</span>{" "}
              <span className="font-bold tabular-nums">{int(s.count)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
