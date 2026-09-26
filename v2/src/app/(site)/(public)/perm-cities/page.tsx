import type { Metadata } from "next";

import { GroupIndexPage, groupIndexMetadata } from "@/components/groups/GroupPages";

/** PERM by city: the index. See components/groups/GroupPages.tsx. */

export const revalidate = 86400;

export const metadata: Metadata = groupIndexMetadata("city");

export default function Page() {
  return <GroupIndexPage kind="city" />;
}
