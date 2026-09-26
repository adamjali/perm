import type { Metadata } from "next";

import { GroupIndexPage, groupIndexMetadata } from "@/components/groups/GroupPages";
import { withSocialCard } from "@/lib/socialCard";

/** PERM by country: the index. See components/groups/GroupPages.tsx. */

export const revalidate = 86400;

export const metadata: Metadata = withSocialCard(groupIndexMetadata("country"), "perm-countries");

export default function Page() {
  return <GroupIndexPage kind="country" />;
}
