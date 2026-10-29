import type { Metadata } from "next";
import { CaseDetailPageClient } from "./CaseDetailPageClient";
import { getAppCaseCorpus } from "@/lib/db/appCaseCorpus";
import { CaseCorpusProvider } from "@/components/app/CaseCorpusProvider";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Case details",
    robots: { index: false, follow: false },
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CaseDetailPage({ params }: Props) {
  // The case-independent estimate corpus, loaded once on the server and shared
  // down the client tree. Null on failure: the live-status block still renders
  // from the case's own record; only the estimate is withheld.
  const corpus = await getAppCaseCorpus().catch(() => null);
  return (
    <CaseCorpusProvider corpus={corpus}>
      <CaseDetailPageClient params={params} />
    </CaseCorpusProvider>
  );
}
