import { CaseDetailSkeleton } from "./CaseDetailPageClient";

/**
 * The case page's own loading skeleton, the one the page renders while the
 * case loads. This file used to draw an older layout of the page (a status
 * bar and an inline timeline), so a click showed that, swapped to the page's
 * own skeleton, then the case.
 */
export default function CaseDetailLoading() {
  return <CaseDetailSkeleton />;
}
