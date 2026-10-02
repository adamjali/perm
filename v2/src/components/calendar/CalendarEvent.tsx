"use client";

/**
 * CalendarEvent
 *
 * A deadline pill on the calendar, in its stage colour with ink that reads on
 * it, and a case summary on hover. The summary uses the app's own tooltip
 * (Radix) in place of Tippy, whose React wrapper read `element.ref` and warned
 * under React 19 on every calendar render.
 */

import { forwardRef } from "react";
import type { EventProps } from "react-big-calendar";
import { useRouter } from "next/navigation";

import { type CalendarEvent as CalendarEventType, STAGE_COLORS, STAGE_ON_FILL } from "@/lib/calendar/types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface CalendarEventProps extends EventProps<CalendarEventType> {
  event: CalendarEventType;
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

const STAGE_LABELS: Record<string, string> = {
  pwd: "PWD",
  recruitment: "Recruitment",
  eta9089: "ETA 9089",
  i140: "I-140",
  closed: "Closed",
};

function formatDaysText(daysUntil: number): string {
  if (daysUntil < 0) return `${Math.abs(daysUntil)} days ago`;
  if (daysUntil === 0) return "Today";
  return `${daysUntil} days`;
}

/** The hover summary: stage-coloured header, status and stage, the deadline. */
function CaseSummary({ event }: { event: CalendarEventType }) {
  const fill = STAGE_COLORS[event.stage] ?? "#6B7280";
  const ink = STAGE_ON_FILL[event.stage] ?? "#FFFFFF";
  const urgent = event.urgency === "urgent" || event.urgency === "overdue";
  const soon = event.urgency === "soon";

  return (
    <div className="w-72">
      <div className="border-b-2 border-border px-3 py-2" style={{ backgroundColor: fill, color: ink }}>
        <p className="truncate font-heading text-sm font-bold" title={event.employerName || undefined}>
          {event.employerName || "Unknown employer"}
        </p>{" "}
        {event.positionTitle && (
          <p className="truncate text-sm" title={event.positionTitle}>
            {event.positionTitle}
          </p>
        )}
      </div>
      <dl className="space-y-1 px-3 py-2 text-sm">
        {event.caseStatus && (
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>{" "}
            <dd className="font-semibold">{formatStatus(event.caseStatus)}</dd>
          </div>
        )}{" "}
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Stage</dt>{" "}
          <dd className="font-semibold">{STAGE_LABELS[event.stage] ?? event.stage}</dd>
        </div>
      </dl>
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-t-2 border-border px-3 py-2",
          urgent ? "bg-destructive/10" : soon ? "bg-data-warn/15" : "bg-muted",
        )}
      >
        <span className="font-heading text-sm font-bold">{event.title.split(":")[0]}</span>{" "}
        <span
          className={cn(
            "shrink-0 font-mono text-sm font-bold",
            urgent ? "text-destructive" : soon ? "text-data-warn-ink" : "text-foreground",
          )}
        >
          {formatDaysText(event.daysUntil)}
        </span>
      </div>
    </div>
  );
}

interface EventPillProps extends React.HTMLAttributes<HTMLDivElement> {
  fill: string;
  ink: string;
  isUrgent: boolean;
  title: string;
}

const EventPill = forwardRef<HTMLDivElement, EventPillProps>(({ fill, ink, isUrgent, title, style, ...rest }, ref) => (
  <div
    ref={ref}
    className="calendar-event"
    style={{
      ...style,
      backgroundColor: fill,
      color: ink,
      // An urgent deadline gets a full red frame, not a coloured side stripe.
      boxShadow: isUrgent ? "inset 0 0 0 2px var(--urgency-urgent)" : undefined,
    }}
    {...rest}
  >
    <span className="event-title">{title}</span>
  </div>
));
EventPill.displayName = "EventPill";

export function CalendarEvent({ event }: CalendarEventProps) {
  const router = useRouter();
  const isUrgent = event.urgency === "urgent" || event.urgency === "overdue";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/cases/${event.caseId}`);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <EventPill
            fill={STAGE_COLORS[event.stage] ?? "#6B7280"}
            ink={STAGE_ON_FILL[event.stage] ?? "#FFFFFF"}
            isUrgent={isUrgent}
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
