import Link from "next/link";

import { longDate } from "@convex/lib/months";
import { getRecruitmentSummary } from "@/lib/db/recruitment";
import { formatInt } from "@/lib/format";

/**
 * How far ahead of filing employers start recruiting, read from DOL's own
 * record of every decided case on its current form
 * (perm_docs['recruitment_summary']), so a guide says it as of the day it's
 * read. Inline, to sit inside a paragraph. When the figure can't be read, the
 * sentence points at the page that carries it, and says nothing it can't know.
 */
export async function RecruitmentNow() {
  const doc = await getRecruitmentSummary().catch((err: unknown) => {
    // The guide still reads without the figure; the log says it was missing.
    console.error("[recruitmentNow] summary unreadable", err);
    return null;
  });
  const first = doc?.lead.firstStep;
  const page = (
    <Link href="/perm-recruitment" className="link">
      PERM recruitment
    </Link>
  );
  if (!doc || !first) return <>How far ahead of filing employers start is on the {page} page.</>;
  return (
    <>
      {`In the ${formatInt(doc.cases)} decided cases filed on DOL's current form${doc.asOf ? `, through ${longDate(doc.asOf)}` : ""}, the first recruitment step came a median ${first.p50} days before filing, and half the cases started between ${first.p25} and ${first.p75} days before it (`}
      {page}
      ).
    </>
  );
}
