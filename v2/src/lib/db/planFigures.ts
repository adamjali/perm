import "server-only";

import { cache } from "react";

import { rulerOf } from "@/lib/board";
import { paceByLine, RECRUITMENT_MIN_DAYS, type PlanFigures, type PlanStage } from "@/lib/perm";
import { quarterLabel } from "@/lib/uscisQuarterlyShape";
import { shortDate } from "@convex/lib/months";

import { getPermBoard, getPwdBoard } from "./board";
import { getBulletinBoard } from "./bulletin";
import { getUscisFormMedian } from "./uscisQuarterly";

/** The categories the planner plans for. */
const PLAN_CATEGORIES = new Set(["EB2", "EB3"]);

export interface PlanReading {
  /** Every length the plan assumes, as measured today. */
  figures: PlanFigures;
  /** Where each step stands today, one short line each. */
  standing: Partial<Record<PlanStage, string>>;
}

/**
 * The planner's figures, read once per render from the readers the board uses, so
 * the planner and /today can't print two different lengths for one step. A source
 * that fails leaves its step undated rather than failing the page.
 */
export const getPlanReading = cache(async (): Promise<PlanReading> => {
  const [perm, pwd, board, i140, i485] = await Promise.all([
    getPermBoard().catch(() => null),
    getPwdBoard().catch(() => null),
    getBulletinBoard().catch(() => null),
    getUscisFormMedian("I-140"),
    getUscisFormMedian("I-485", "Employment"),
  ]);
  const waited = (b: typeof perm | typeof pwd) => (b?.span ? (rulerOf(b.span, b.day)?.waitedDays ?? null) : null);

  const figures: PlanFigures = {
    pwdWaitDays: waited(pwd),
    recruitmentDays: RECRUITMENT_MIN_DAYS,
    permWaitDays: waited(perm),
    i140Months: i140?.medianMonths ?? null,
    i485Months: i485?.medianMonths ?? null,
    pace: paceByLine(board?.finalAction ?? [], (c) => (PLAN_CATEGORIES.has(c.category) ? `${c.category}|${c.country}` : null)),
    bulletinMonth: board?.lastMonth ?? null,
  };

  const standing: Partial<Record<PlanStage, string>> = {};
  if (pwd?.span) standing.pwd = `Now: DOL is deciding wage requests filed around ${shortDate(pwd.span.middle)}`;
  if (perm?.span) standing.perm = `Now: DOL is deciding PERM cases filed around ${shortDate(perm.span.middle)}`;
  if (i140) standing.i140 = `Now: USCIS's median is ${i140.medianMonths} months, ${quarterLabel(i140.fy, i140.quarter)}`;
  if (i485) standing.i485 = `Now: USCIS's median is ${i485.medianMonths} months, ${quarterLabel(i485.fy, i485.quarter)}`;
  return { figures, standing };
});
