/**
 * Event styling utilities for react-big-calendar.
 * Neobrutalist design with stage-based coloring.
 */

import type { EventPropGetter } from "react-big-calendar";
import { STAGE_COLORS, STAGE_ON_FILL, URGENCY_COLORS } from "./types";
import type { CalendarEvent } from "./types";

/**
 * Base styles for all events
 */
export const eventStyleBase = {
  borderRadius: 0,
  border: "2px solid #1a1a1a",
  fontFamily: '"Space Grotesk", sans-serif',
  fontWeight: 600,
  fontSize: "0.875rem",
  padding: "1px 2px",
  boxShadow: "var(--shadow-hard-sm)",
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
        : "#000000";

    return {
      style: {
        ...eventStyleBase,
        backgroundColor: stageColor,
        borderColor,
        color: STAGE_ON_FILL[event.stage] ?? "#FFFFFF",
      },
    };
  };
}
