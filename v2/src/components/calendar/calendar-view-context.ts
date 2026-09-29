"use client";

import { createContext } from "react";

/**
 * Lets the calendar's own toolbar offer "List" beside Month, Week and Day, so
 * the switch between the grid and the list lives in one control instead of a
 * separate row above the calendar. Null outside a CalendarView.
 */
export const CalendarListToggleContext = createContext<(() => void) | null>(null);
