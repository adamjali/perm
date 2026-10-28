import Link from "next/link";

import { EbSplit } from "@/components/queue/EbSplit";
import { getEbSplit } from "@/lib/db/ebSplit";

/**
 * How many PERM jobs in DOL's line meet the EB-2 bar, live, inside an article:
 * the split /perm-queue draws, from each job's own wage request
 * (scripts/build_eb_split.py). What the jobs could file, never what they did.
 */
export async function EbSplitNow() {
  const split = await getEbSplit().catch(() => null);
  if (!split) {
    return (
      <p>
        The live split is unavailable for the moment.{" "}
        <Link href="/perm-queue" className="link">
          The PERM queue page
        </Link>{" "}
        carries it.
      </p>
    );
  }
  return (
    <div className="not-prose my-8">
      <EbSplit split={split} titled={false} />
    </div>
  );
}
