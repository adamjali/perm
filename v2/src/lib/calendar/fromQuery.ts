/**
 * One row of the calendar query, as the calendar's event mapper reads it.
 *
 * Everything the row carries passes through. The page used to copy dates by
 * name and left out the professional flag, the additional recruitment steps,
 * the notice of filing start, the stored windows and the denial dates, so a
 * professional case's filing window and a denial's review deadline came out
 * differently on the calendar from the dashboard (Oct 21 2026). The rules
 * treat an empty string or a null as no date, so nothing is rewritten.
 */
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { CalendarCaseData } from "./types";

export type CalendarQueryRow = FunctionReturnType<typeof api.calendar.getCalendarEvents>[number];

export function toCalendarCaseData(row: CalendarQueryRow): CalendarCaseData {
  const { id, ...rest } = row;
  return { ...rest, _id: id } as CalendarCaseData;
}
