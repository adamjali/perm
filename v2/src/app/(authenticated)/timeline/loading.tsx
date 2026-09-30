import { TimelineSkeleton } from "./TimelinePageClient";

/** The timeline's own loading skeleton, the one the page renders while it loads. */
export default function TimelineLoading() {
  return <TimelineSkeleton />;
}
