import type { Metadata } from "next";

import { GroupIndexPage, groupIndexMetadata } from "@/components/groups/GroupPages";

/** PERM by industry: the index. See components/groups/GroupPages.tsx. */

export const revalidate = 86400;

export const metadata: Metadata = groupIndexMetadata("industry");

export default function Page() {
  return <GroupIndexPage kind="industry" />;
}
