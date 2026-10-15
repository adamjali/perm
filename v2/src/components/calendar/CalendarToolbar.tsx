/**
 * Custom Calendar Toolbar Component
 *
 * Simple V1-style toolbar for react-big-calendar.
 * One row: month picker, previous/today/next, and the view toggle.
 */

"use client";

import { useState, useCallback, useContext, useMemo, useEffect, useRef } from "react";
import type { ToolbarProps, View } from "react-big-calendar";
import { Navigate } from "react-big-calendar";
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon, ListIcon } from "@phosphor-icons/react/ssr";

import type { CalendarEvent } from "@/lib/calendar/types";
import { CalendarListToggleContext } from "./calendar-view-context";
import { MONTH_NAMES } from "@/lib/dolFormat";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ============================================================================
// Constants
// ============================================================================

const VIEW_LABELS: Record<View, string> = {
  month: "Month",
  week: "Week",
  day: "Day",
  agenda: "Agenda",
  work_week: "Work week",
};


// ============================================================================
// Component
// ============================================================================

export function CalendarToolbar(props: ToolbarProps<CalendarEvent, object>) {
  const toggleList = useContext(CalendarListToggleContext);
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

  const btnIcon = buttonVariants({ variant: "outline", size: "icon" });
  const btnText = buttonVariants({ variant: "outline" });

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {/* Month Label with Dropdown */}
      <div className="relative flex items-center">
        <button
          ref={buttonRef}
          onClick={togglePicker}
          className="flex min-h-11 items-center gap-2 px-2 transition-colors hover:bg-accent"
          aria-expanded={isPickerOpen}
        >
          <h2 className="font-heading text-2xl font-bold">
            {label}
          </h2>
          {isPickerOpen ? (
            <CaretUpIcon className="size-5 text-muted-foreground" />
          ) : (
            <CaretDownIcon className="size-5 text-muted-foreground" />
          )}
        </button>

        {/* Month Picker Dropdown */}
        {isPickerOpen && (
          <div
            ref={dropdownRef}
            className="absolute left-0 top-full mt-2 border border-border bg-card p-4 shadow-overlay"
            style={{ minWidth: 260, zIndex: 100 }}
          >
            {/* Year nav */}
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <CaretLeftIcon className="size-4" />
              </button>
              <span className="font-bold text-foreground">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
              >
                <CaretRightIcon className="size-4" />
              </button>
            </div>

            {/* Months grid */}
            <div className="grid grid-cols-3 gap-1">
              {MONTH_NAMES.map((name, i) => {
                const isCurrent = pickerYear === currentYear && i === currentMonth;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => selectMonth(i)}
                    className={cn(
                      "min-h-11 border px-2 text-sm transition-colors",
                      isCurrent ? "border-primary-text bg-tint font-semibold" : "border-transparent hover:bg-accent",
                    )}
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
              className={buttonVariants({ variant: "outline", className: "mt-3 w-full" })}
            >
              Today
            </button>
          </div>
        )}
      </div>

      {/* Navigation Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goToPrev}
            className={btnIcon}
            aria-label="Previous"
          >
            <CaretLeftIcon className="size-5" />
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
            <CaretRightIcon className="size-5" />
          </button>
        </div>

        <div className="flex border border-input">
          {viewArray.map((v, index) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={cn(
                "min-h-11 px-4 text-sm transition-colors",
                index > 0 && "border-l border-input",
                view === v ? "bg-tint font-semibold" : "text-soft hover:bg-accent hover:text-foreground",
              )}
              aria-pressed={view === v}
            >
              {VIEW_LABELS[v]}
            </button>
          ))}
          {toggleList && (
            <button
              type="button"
              onClick={toggleList}
              className="flex min-h-11 items-center gap-1.5 border-l border-input px-4 text-sm text-soft transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Switch to list view"
            >
              <ListIcon className="size-4" aria-hidden="true" />
              List
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
