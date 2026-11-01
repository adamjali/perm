import type { FigureTrend } from "@/components/data/FigureRow";

/**
 * A count against the same count a fiscal year earlier, named by that year.
 * Volume is information, never good or bad: more filings isn't better for
 * anyone reading. Within 5% is about level; under 20 the year before, no
 * percentage means much and nothing is said.
 */
export function yearOnYear(now: number | null | undefined, before: number | null | undefined, beforeFy: number): FigureTrend | undefined {
  if (now == null || before == null || before < 20) return undefined;
  const pct = Math.round(((now - before) / before) * 100);
  if (Math.abs(pct) < 5) return { text: `About level with FY${beforeFy}`, dir: "level", tone: "neutral" };
  return { text: `${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% on FY${beforeFy}`, dir: pct > 0 ? "up" : "down", tone: "info" };
}
