import type { Metadata } from "next";

import { LiveQueueBoard } from "@/components/tools/LiveQueueBoard";
import { DataNav } from "@/components/tools/DataNav";
import { getLiveBacklog } from "@/lib/turso/publicData";
import { MIRROR_COMPLETE } from "@/lib/liveQueueGate";
import { openGraphBase } from "@/lib/openGraphBase";

/**
 * Where DOL's PERM queue stands right now, from a per-case scan.
 *
 * This is the one surface on the site whose figures DOL does not publish.
 * Its quarterly disclosure files carry a decision date on every record and no
 * pending rows at all, so "how much is still waiting" is underivable from
 * them at any level of effort.
 *
 * NOINDEX WHILE THE MIRROR LOADS. Not merely unlisted: a page carrying
 * provisional counts should not be the answer a search engine gives someone,
 * and the same constant that hides it from the sitemap sets the robots
 * directive, so the two cannot disagree.
 */

const TITLE = "PERM Queue, Live";
const DESCRIPTION =
  "Which filing month DOL is deciding, how far back the work front sits, and how many PERM cases are still undecided in every month.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/perm-queue" },
  robots: MIRROR_COMPLETE ? undefined : { index: false, follow: true },
  openGraph: {
    ...openGraphBase,
    title: `${TITLE} | PERM Tracker`,
    description: DESCRIPTION,
    url: "/perm-queue",
  },
};

// The mirror updates continuously, so an hour is the right bound while it is
// loading and stays reasonable afterwards: this is a queue position, not a
// live ticker, and nobody's decision changes on a ten-minute boundary.
export const revalidate = 3600;

export default async function PermQueuePage() {
  const months = await getLiveBacklog();

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6 sm:pb-16">
      <DataNav active="overview" />
      <div className="pt-10 sm:pt-12" />

      <header>
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          From a per-case scan
        </p>{" "}
        <h1 className="mt-3 font-heading text-4xl font-black leading-tight sm:text-5xl">
          Where the PERM queue stands
        </h1>{" "}
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-foreground/70">
          DOL publishes which month it is working and nothing about the size of
          what is behind it. Its disclosure files carry no pending rows at all.
          These counts come from the status of individual cases.
        </p>
      </header>

      <section className="mt-10">
        <LiveQueueBoard months={months} />
      </section>
    </div>
  );
}
