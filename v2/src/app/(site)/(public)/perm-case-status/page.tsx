import type { Metadata } from "next";

import { CaseStatusPage, caseStatusMetadata } from "./CaseStatusPage";

/**
 * /perm-case-status in English. The page itself is `CaseStatusPage`, shared with the five translations under
 * `[lang]/perm-case-status`; the long note on why it's built this way is at the top of that module.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}): Promise<Metadata> {
  const { case: raw } = await searchParams;
  return caseStatusMetadata("en", raw);
}

export default async function PermCaseStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  const { case: raw } = await searchParams;
  return <CaseStatusPage lang="en" raw={raw} />;
}
