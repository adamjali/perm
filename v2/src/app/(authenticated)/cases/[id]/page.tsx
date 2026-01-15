import type { Metadata } from "next";
import { CaseDetailPageClient } from "./CaseDetailPageClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Case Details",
    robots: { index: false, follow: false },
  };
}

interface Props {
  params: Promise<{ id: string }>;
}

export default function CaseDetailPage({ params }: Props) {
  return <CaseDetailPageClient params={params} />;
}
