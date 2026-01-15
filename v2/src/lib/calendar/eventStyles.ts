/**
 * Event styling utilities for react-big-calendar.
 * Neobrutalist design with stage-based coloring.
 *
 * Phase: 23.1 (Calendar UI)
 * Created: 2026-01-09
 */

import type { EventPropGetter } from "react-big-calendar";
import { STAGE_COLORS, URGENCY_COLORS } from "./types";
import type { CalendarEvent } from "./types";

/**
 * Base styles for all events
 */
export const eventStyleBase = {
  borderRadius: 0,
  border: "2px solid #1a1a1a",
  fontFamily: '"Space Grotesk", sans-serif',
  fontWeight: 600,
  fontSize: "0.7rem",
  padding: "1px 2px",
  boxShadow: "2px 2px 0 rgba(0, 0, 0, 0.2)",
};

/**
 * Event style getter for stage-based coloring.
 * Uses stage color as background, with urgency-based border for deadlines.
 */
export function createEventPropGetter(): EventPropGetter<CalendarEvent> {
  return (event) => {
    const stageColor = STAGE_COLORS[event.stage] ?? "#6B7280";
    const urgencyColor = URGENCY_COLORS[event.urgency] ?? "#059669";

    const borderColor =
      event.urgency === "overdue" || event.urgency === "urgent"
        ? urgencyColor
        : "#1a1a1a";

    return {
      style: {
        ...eventStyleBase,
        backgroundColor: stageColor,
        borderColor,
        color: "#ffffff",
      },
    };
  };
}
