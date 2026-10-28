import Link from "next/link";

import { Eb2VsEb3 } from "@/components/tools/Eb2VsEb3";
import { getLineSnapshot } from "@/lib/db/greenCardLine";
import type { CountryKey } from "@/lib/perm";

/**
 * EB-2 and EB-3 side by side, live, inside an article: the same comparison the
 * EB-2 or EB-3 tool draws, from the same snapshot (this month's bulletin, USCIS's
 * counts of who stands ahead). An article that quotes the two lines reads them
 * here instead of typing a cutoff that's wrong next month.
 */
export async function EbLinesNow({ country = "india" }: { country?: CountryKey }) {
  const snapshot = await getLineSnapshot().catch(() => null);
  if (!snapshot) {
    return (
      <p>
        The live comparison is unavailable for the moment. The{" "}
        <Link href="/tools/eb2-vs-eb3" className="link">
          EB-2 or EB-3 tool
        </Link>{" "}
        carries the same figures.
      </p>
    );
  }
  return (
    <div className="not-prose my-8">
      <Eb2VsEb3 snapshot={snapshot} defaultCountry={country} />
    </div>
  );
}
