"use client";

/**
 * CalendarEvent
 *
 * A deadline on the calendar as a quiet pill: the stage's colour on its left
 * edge and in a faint wash, a red mark when it's urgent, and a case summary on
 * hover (the app's own Radix tooltip). A click opens the case.
 */

import { forwardRef } from "react";
import type { EventProps } from "react-big-calendar";
import { useRouter } from "next/navigation";

import { type CalendarEvent as CalendarEventType, STAGE_COLORS } from "@/lib/calendar/types";
import { formatCaseStatus, formatProgressStatus } from "@convex/lib/notificationHelpers";
import { countdownWords } from "@/components/cases/case-card.utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CalendarEventProps extends EventProps<CalendarEventType> {
  event: CalendarEventType;
}

const isUrgent = (e: CalendarEventType) => e.urgency === "urgent" || e.urgency === "overdue";

/** The hover summary: the case, its progress and stage, the deadline. */
function CaseSummary({ event }: { event: CalendarEventType }) {
  return (
    <div className="w-72">
      <div className="border-b border-border px-3 py-2">
        <p className="truncate font-heading text-sm font-bold" title={event.employerName || undefined}>
          {event.employerName || "Unknown employer"}
        </p>{" "}
        {event.positionTitle ? (
          <p className="truncate text-sm text-muted-foreground" title={event.positionTitle}>
            {event.positionTitle}
          </p>
        ) : null}
      </div>
      <dl className="space-y-1 px-3 py-2 text-sm">
        {event.caseStatus ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Progress</dt>{" "}
            <dd className="font-semibold">{formatProgressStatus(event.caseStatus)}</dd>
          </div>
        ) : null}{" "}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Stage</dt>{" "}
          <dd className="font-semibold">{formatCaseStatus(event.stage)}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-border bg-muted px-3 py-2">
        <span className="text-sm font-semibold">{event.title.split(":")[0]}</span>{" "}
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            isUrgent(event) ? "text-destructive" : event.urgency === "soon" ? "text-data-warn-ink" : "text-foreground",
          )}
        >
          {countdownWords(event.daysUntil)}
        </span>
      </div>
    </div>
  );
}

interface EventPillProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The stage's colour, drawn on the pill's left edge and in its wash. */
  color: string;
  urgent: boolean;
  title: string;
}

const EventPill = forwardRef<HTMLDivElement, EventPillProps>(({ color, urgent, title, style, ...rest }, ref) => (
  <div ref={ref} className="calendar-event" style={{ ...style, ["--event-color" as string]: color }} {...rest}>
    {urgent ? <span aria-hidden="true" className="size-2 shrink-0 bg-destructive" /> : null}
    <span className="event-title">{title}</span>
  </div>
));
EventPill.displayName = "EventPill";

export function CalendarEvent({ event }: CalendarEventProps) {
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/cases/${event.caseId}`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <EventPill
            color={STAGE_COLORS[event.stage] ?? "var(--muted-foreground)"}
            urgent={isUrgent(event)}
            title={event.title}
            onClick={handleClick}
          />
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={8} collisionPadding={10} className="overflow-hidden p-0 shadow-hard">
          <CaseSummary event={event} />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
