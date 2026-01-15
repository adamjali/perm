/**
 * Custom Calendar Toolbar Component
 *
 * Simple V1-style toolbar for react-big-calendar.
 * Clean neobrutalist design with consistent styling.
 *
 * Phase: 23.1 (Calendar UI)
 * Updated: 2025-12-30
 */

"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import type { ToolbarProps, View } from "react-big-calendar";
import { Navigate } from "react-big-calendar";
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from "lucide-react";

import type { CalendarEvent } from "@/lib/calendar/types";

// ============================================================================
// Constants
// ============================================================================

const VIEW_LABELS: Record<View, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
  work_week: "Work Week",
};

const MONTHS = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December",
];

// ============================================================================
// Component
// ============================================================================

export function CalendarToolbar(props: ToolbarProps<CalendarEvent, object>) {
  const { label, onNavigate, onView, view, views, date } = props;
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();
  const [pickerYear, setPickerYear] = useState(currentYear);

  // Click outside to close
  useEffect(() => {
    if (!isPickerOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsPickerOpen(false);
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPickerOpen]);

  // Handlers
  const togglePicker = useCallback(() => {
    setIsPickerOpen((prev) => {
      if (!prev) setPickerYear(currentYear);
      return !prev;
    });
  }, [currentYear]);

  const selectMonth = useCallback(
    (monthIndex: number) => {
      const newDate = new Date(pickerYear, monthIndex, 1);
      onNavigate(Navigate.DATE, newDate);
      setIsPickerOpen(false);
    },
    [onNavigate, pickerYear]
  );

  const goToPrev = useCallback(() => {
    onNavigate(Navigate.PREVIOUS);
  }, [onNavigate]);

  const goToNext = useCallback(() => {
    onNavigate(Navigate.NEXT);
  }, [onNavigate]);

  const goToToday = useCallback(() => {
    onNavigate(Navigate.TODAY);
  }, [onNavigate]);

  const viewArray = useMemo(() => {
    if (Array.isArray(views)) return views;
    if (typeof views === "object") {
      return Object.keys(views).filter(
        (v) => views[v as keyof typeof views]
      ) as View[];
    }
    return [];
  }, [views]);

  // Neobrutalist button base styles
  const btnBase = `
    border-2 border-border bg-card text-foreground
    shadow-[4px_4px_0_hsl(var(--border))]
    hover:shadow-[6px_6px_0_hsl(var(--border))]
    hover:-translate-y-0.5
    active:shadow-[2px_2px_0_hsl(var(--border))]
    active:translate-y-0
    transition-all duration-150
    font-semibold
  `;

  const btnIcon = `${btnBase} p-3`;
  const btnText = `${btnBase} px-4 py-3`;

  return (
    <div className="flex flex-col gap-4 mb-6">
      {/* Month Label with Dropdown */}
      <div className="flex items-center justify-center relative">
        <button
          ref={buttonRef}
          onClick={togglePicker}
          className="flex items-center gap-2 px-4 py-2 hover:bg-muted/50 transition-colors rounded-none"
          aria-expanded={isPickerOpen}
        >
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
            {label}
          </h2>
          {isPickerOpen ? (
            <ChevronUp className="size-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" />
          )}
        </button>

        {/* Month Picker Dropdown */}
        {isPickerOpen && (
          <div
            ref={dropdownRef}
            className="absolute top-full mt-2 bg-card border-2 border-border shadow-[6px_6px_0_hsl(var(--border))] p-4"
            style={{ minWidth: 260, zIndex: 100 }}
          >
            {/* Year nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className="p-2 hover:bg-muted border-2 border-border bg-card text-foreground transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="font-bold text-foreground">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="p-2 hover:bg-muted border-2 border-border bg-card text-foreground transition-colors"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            {/* Months grid */}
            <div className="grid grid-cols-3 gap-1">
              {MONTHS.map((name, i) => {
                const isCurrent = pickerYear === currentYear && i === currentMonth;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectMonth(i)}
                    className={`
                      px-2 py-2 text-sm font-medium border-2 transition-colors
                      ${isCurrent
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-card text-foreground hover:bg-muted"
                      }
                    `}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>

            {/* Today button */}
            <button
              type="button"
              onClick={() => {
                onNavigate(Navigate.TODAY);
                setIsPickerOpen(false);
              }}
              className="w-full mt-3 py-2 text-sm font-semibold border-2 border-border bg-card text-foreground hover:bg-muted transition-colors"
            >
              Today
            </button>
          </div>
        )}
      </div>

      {/* Navigation Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
        {/* Nav buttons - neobrutalist style */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPrev}
            className={btnIcon}
            aria-label="Previous"
          >
            <ChevronLeft className="size-5" />
          </button>

          <button
            type="button"
            onClick={goToToday}
            className={btnText}
          >
            Today
          </button>

          <button
            type="button"
            onClick={goToNext}
            className={btnIcon}
            aria-label="Next"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>

        {/* View toggle - same neobrutalist style */}
        <div className="flex border-2 border-border shadow-[4px_4px_0_hsl(var(--border))]">
          {viewArray.map((v, index) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={`
                px-4 py-3 font-semibold text-sm transition-colors
                ${index > 0 ? "border-l-2 border-border" : ""}
                ${view === v
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground hover:bg-muted"
                }
              `}
              aria-pressed={view === v}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CalendarToolbar;
