import type { Metadata } from "next";

import { H1bEmployersPage, h1bMetadata } from "@/components/h1b/H1bEmployersPage";
import { NATION } from "@/lib/h1bRanks";
import { withSocialCard } from "@/lib/socialCard";

/**
 * The busiest H-1B employers each fiscal year, nationally. Its data moves
 * when DOL publishes an LCA file or USCIS a Data Hub quarter, so a weekly
 * window, and POST /api/revalidate-disclosure expires it the day a file lands.
 */

export const revalidate = 604800;

export async function generateMetadata(): Promise<Metadata> {
  return withSocialCard(await h1bMetadata(NATION), "h1b-employers");
}

export default function Page() {
  return <H1bEmployersPage state={NATION} />;
}
