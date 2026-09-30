import { CalendarSkeleton } from "./CalendarPageClient";

/** The calendar's own loading skeleton, the one the page renders while its events load. */
export default function CalendarLoading() {
  return <CalendarSkeleton />;
}
