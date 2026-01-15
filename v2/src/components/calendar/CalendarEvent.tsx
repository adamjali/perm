/**
 * Custom Calendar Event Component - V1 Style
 *
 * Simple colorful event pills with Tippy.js tooltips.
 * Exactly matches v1 calendar design.
 *
 * Phase: 23.1 (Calendar UI)
 * Updated: 2025-12-30
 */

"use client";

import { forwardRef } from "react";
import Tippy from "@tippyjs/react";
import "tippy.js/dist/tippy.css";
import type { EventProps } from "react-big-calendar";
import { useRouter } from "next/navigation";

import type { CalendarEvent as CalendarEventType } from "@/lib/calendar/types";

// ============================================================================
// Stage Colors (matching v1)
// ============================================================================

const STAGE_COLORS: Record<string, string> = {
  pwd: "#0066FF",        // Blue
  recruitment: "#9333ea", // Purple
  eta9089: "#D97706",    // Orange/Amber
  i140: "#059669",       // Green
  closed: "#6B7280",     // Gray
};

// ============================================================================
// Types
// ============================================================================

interface CalendarEventProps extends EventProps<CalendarEventType> {
  event: CalendarEventType;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatStage(stage: string): string {
  const stageLabels: Record<string, string> = {
    pwd: "PWD",
    recruitment: "Recruitment",
    eta9089: "ETA 9089",
    i140: "I-140",
    closed: "Closed",
  };
  return stageLabels[stage] ?? stage;
}

function getUrgencyClass(urgency: string): string {
  if (urgency === "overdue" || urgency === "urgent") {
    return "case-tooltip-deadline--urgent";
  }
  if (urgency === "soon") {
    return "case-tooltip-deadline--warning";
  }
  return "case-tooltip-deadline--info";
}

function formatDaysText(daysUntil: number): string {
  if (daysUntil < 0) {
    return `${Math.abs(daysUntil)} days ago`;
  }
  if (daysUntil === 0) {
    return "Today";
  }
  return `${daysUntil} days`;
}

// ============================================================================
// Tooltip Content Component
// ============================================================================

function TooltipContent({ event }: { event: CalendarEventType }) {
  const stageColor = STAGE_COLORS[event.stage] ?? "#6B7280";
  const urgencyClass = getUrgencyClass(event.urgency);
  const daysText = formatDaysText(event.daysUntil);

  return (
    <div className="case-tooltip">
      {/* Header - black background with white text (v1 style) */}
      <div
        className="case-tooltip-header"
        style={{ backgroundColor: stageColor }}
      >
        <div className="case-tooltip-employer">
          {event.employerName || "Unknown Employer"}
        </div>
        {event.positionTitle && (
          <div className="case-tooltip-position">{event.positionTitle}</div>
        )}
      </div>

      {/* Body */}
      <div className="case-tooltip-body">
        {/* Status row */}
        {event.caseStatus && (
          <div className="case-tooltip-row">
            <span className="case-tooltip-label">Status</span>
            <span
              className="case-tooltip-status"
              style={{ color: stageColor, borderColor: stageColor }}
            >
              {formatStatus(event.caseStatus)}
            </span>
          </div>
        )}

        {/* Stage row */}
        <div className="case-tooltip-row">
          <span className="case-tooltip-label">Stage</span>
          <span className="case-tooltip-value">{formatStage(event.stage)}</span>
        </div>

        {/* Deadline info */}
        <div className={`case-tooltip-deadline ${urgencyClass}`}>
          <div className="case-tooltip-deadline-label">{event.title.split(":")[0]}</div>
          <div className="case-tooltip-deadline-value">{daysText}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Event Pill Component (forwardRef for React 19 + Tippy compatibility)
// ============================================================================

interface EventPillProps {
  stageColor: string;
  isUrgent: boolean;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}

const EventPill = forwardRef<HTMLDivElement, EventPillProps>(
  ({ stageColor, isUrgent, title, onClick }, ref) => (
    <div
      ref={ref}
      className="calendar-event"
      style={{
        backgroundColor: stageColor,
        borderLeft: isUrgent ? "4px solid #dc2626" : undefined,
      }}
      onClick={onClick}
    >
      <span className="event-title">{title}</span>
      <span className="sync-icon">📅</span>
    </div>
  )
);
EventPill.displayName = "EventPill";

// ============================================================================
// Main Component
// ============================================================================

export function CalendarEvent({ event }: CalendarEventProps) {
  const router = useRouter();
  const stageColor = STAGE_COLORS[event.stage] ?? "#6B7280";
  const isUrgent = event.urgency === "urgent" || event.urgency === "overdue";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/cases/${event.caseId}`);
  };

  return (
    <Tippy
      content={<TooltipContent event={event} />}
      placement="top"
      arrow={true}
      theme="case-summary"
      interactive={true}
      appendTo={() => document.body}
      maxWidth={320}
      offset={[0, 8]}
      delay={[200, 0]}
      duration={[200, 150]}
      popperOptions={{
        modifiers: [
          {
            name: "flip",
            options: { fallbackPlacements: ["bottom", "left", "right"] },
          },
          {
            name: "preventOverflow",
            options: { boundary: "viewport", padding: 10 },
          },
        ],
      }}
    >
      <EventPill
        stageColor={stageColor}
        isUrgent={isUrgent}
        title={event.title}
        onClick={handleClick}
      />
    </Tippy>
  );
}

export default CalendarEvent;
