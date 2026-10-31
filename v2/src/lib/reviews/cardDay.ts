import { longDate, monthYear } from "@convex/lib/months";

import { reviewDay } from "./senjaParse";

/**
 * A review card's date: the day it was left, or, for a rating from an alert email, the month alone. That rating
 * was tapped the day a case was decided, and the day beside "Case alert reader" would point at one case.
 */
export function cardDay(date: string, viaAlert?: boolean): string | null {
  const day = reviewDay(date);
  if (!day) return null;
  return viaAlert ? monthYear(day.slice(0, 7)) : longDate(day);
}
