import { CASE_STATUS_FRAME, LookupSkeleton } from "./CaseStatusShell";
import { LoadingHead } from "./LoadingHead";

/**
 * The one public segment that keeps a loading boundary, and the boundary is
 * segment-local ON PURPOSE. A group-level one made Next stream a 200 before
 * notFound() could run (soft 404s on junk entity slugs), and it was a home
 * skeleton on every data page. This page renders per request (a live lookup),
 * so a visitor deserves feedback, and an unknown case renders its own
 * explanation at 200.
 *
 * It renders exactly what the page renders while the answer streams: the same
 * frame, heading and form (filled with the number being looked up) and the
 * same reservation. So the loading state and the page's first paint are one
 * picture, and the only change a reader sees is the answer arriving.
 */
export default function CaseStatusLoading() {
  return (
    <div className={CASE_STATUS_FRAME}>
      <div className="pt-10 sm:pt-12" />
      <LoadingHead />
      <div className="mt-8">
        <LookupSkeleton />
      </div>
    </div>
  );
}
