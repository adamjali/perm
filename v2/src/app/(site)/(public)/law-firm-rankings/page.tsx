import type { Metadata } from "next";

import { FirmRankingsPage, firmRanksMetadata } from "@/components/firms/FirmRankingsPage";
import { NATION } from "@/lib/firmRanks";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The busiest immigration law firms each fiscal year, nationally. Its data moves
 * when DOL publishes a PERM or LCA file, so a weekly window, and POST
 * /api/revalidate-disclosure expires it the day a file lands.
 */

export const revalidate = 604800;

export async function generateMetadata(): Promise<Metadata> {
  return withSocialCard(await firmRanksMetadata(NATION), "law-firm-rankings");
}

export default function Page() {
  return <FirmRankingsPage state={NATION} />;
}
