/**
 * Custom Calendar Toolbar Component
 *
 * Simple V1-style toolbar for react-big-calendar.
 * One row: month picker, previous/today/next, and the view toggle.
 */

"use client";

import { Fragment, useState, useCallback, useContext, useMemo } from "react";
import type { ToolbarProps, View } from "react-big-calendar";
import { Navigate } from "react-big-calendar";
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, CaretUpIcon, ListIcon } from "@phosphor-icons/react/ssr";

import type { CalendarEvent } from "@/lib/calendar/types";
import { CalendarListToggleContext } from "./calendar-view-context";
import { MONTH_ABBR, MONTH_NAMES } from "@convex/lib/months";
import { buttonVariants } from "@/components/ui/button";
import { choiceVariants } from "@/components/ui/choice";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth();
  const [pickerYear, setPickerYear] = useState(currentYear);

  // The picker opens on the year on screen, and a press outside, Escape or a pick closes it
  // (Radix's popover: it also flips above the label when there's no room below).
  const onPickerOpenChange = useCallback(
    (open: boolean) => {
      if (open) setPickerYear(currentYear);
      setIsPickerOpen(open);
    },
    [currentYear]
  );

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
      {/* The month on screen is the heading; the button inside it opens the month picker. A
          heading can hold a button, never the other way round. */}
      <Popover open={isPickerOpen} onOpenChange={onPickerOpenChange}>
        <h2 className="flex items-center font-heading text-2xl font-bold">
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex min-h-11 items-center gap-2 px-2 text-left transition-colors hover:bg-accent"
              aria-haspopup="dialog"
            >
              {label}{" "}
              {isPickerOpen ? (
                <CaretUpIcon aria-hidden="true" className="size-5 text-muted-foreground" />
              ) : (
                <CaretDownIcon aria-hidden="true" className="size-5 text-muted-foreground" />
              )}
            </button>
          </PopoverTrigger>
        </h2>{" "}
        <PopoverContent
          align="start"
          sideOffset={8}
          collisionPadding={8}
          aria-label="Pick a month"
          className="w-[min(18rem,calc(100vw-1rem))] border-2 border-border bg-card p-4"
        >
          {/* Year nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPickerYear((y) => y - 1)}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="Previous year"
            >
              <CaretLeftIcon aria-hidden="true" className="size-4" />
            </button>{" "}
            <span className="font-bold text-foreground" aria-live="polite">
              {pickerYear}
            </span>{" "}
            <button
              type="button"
              onClick={() => setPickerYear((y) => y + 1)}
              className={buttonVariants({ variant: "ghost", size: "icon" })}
              aria-label="Next year"
            >
              <CaretRightIcon aria-hidden="true" className="size-4" />
            </button>
          </div>

          {/* Months grid: the month on screen is the lime pick, as every choice on the site is. */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_NAMES.map((name, i) => {
              const isCurrent = pickerYear === currentYear && i === currentMonth;
              return (
                <Fragment key={name}>
                  <button
                    type="button"
                    onClick={() => selectMonth(i)}
                    aria-pressed={isCurrent}
                    aria-label={`${name} ${pickerYear}`}
                    className={cn(choiceVariants({ on: isCurrent }), "px-2")}
                  >
                    {MONTH_ABBR[i]}
                  </button>{" "}
                </Fragment>
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
        </PopoverContent>
      </Popover>

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

        <div className="flex border-input border">
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
              className="flex min-h-11 items-center gap-1.5 border-l-2 border-input px-4 text-sm text-soft transition-colors hover:bg-accent hover:text-foreground"
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
