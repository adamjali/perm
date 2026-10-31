import type { Metadata } from "next";

import { CaseStatusPage, caseStatusMetadata } from "./CaseStatusPage";

/** /perm-case-status. The page itself is `CaseStatusPage`; the long note on why it's built this way is at the top of that module. */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}): Promise<Metadata> {
  const { case: raw } = await searchParams;
  return caseStatusMetadata(raw);
}

export default async function PermCaseStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: raw } = await searchParams;
  return <CaseStatusPage raw={raw} />;
}
