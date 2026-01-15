/**
 * CaseCard Utility Functions
 * Pure functions for formatting and display logic in CaseCard component.
 */

/**
 * Format closure reason for display.
 * Returns just the reason label (not the date).
 */
export function formatClosureReasonLabel(
  reason: string | undefined | null
): string {
  const reasonMap: Record<string, string> = {
    withdrawn: "Withdrawn",
    denied: "Denied",
    pwd_expired: "PWD expired",
    recruitment_window_missed: "Recruitment window missed",
    filing_window_missed: "Filing window missed",
    eta9089_expired: "ETA 9089 expired",
    manual: "",
    other: "",
  };
  return reason ? (reasonMap[reason] ?? "") : "";
}

/**
 * Parse ISO date string as local date (not UTC).
 * Appending T12:00:00 ensures the date stays the same regardless of timezone.
 */
function parseLocalDate(dateStr: string): Date {
  // If already has time component, parse as-is
  if (dateStr.includes("T")) {
    return new Date(dateStr);
  }
  // Date-only strings: append noon to avoid timezone shift
  return new Date(`${dateStr}T12:00:00`);
}

/**
 * Format deadline for display.
 * ALWAYS shows the actual date, plus relative time for context.
 */
export function formatDeadline(deadline: string): string {
  const now = new Date();
  const deadlineDate = parseLocalDate(deadline);
  const daysUntil = Math.ceil(
    (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  const dateStr = deadlineDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (daysUntil === 0) return `${dateStr} (today)`;
  if (daysUntil === 1) return `${dateStr} (tomorrow)`;
  if (daysUntil < 0) return `${dateStr} (overdue)`;
  if (daysUntil <= 30) return `${dateStr} (${daysUntil} days)`;

  return dateStr;
}

/**
 * Format date for compact display in expanded content.
 * Shows month/day/year in short format.
 */
export function formatCompactDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Get stage color bar CSS variable.
 */
export function getStageColorVar(stage: string): string {
  const varMap: Record<string, string> = {
    pwd: "var(--stage-pwd)",
    recruitment: "var(--stage-recruitment)",
    eta9089: "var(--stage-eta9089)",
    i140: "var(--stage-i140)",
    closed: "var(--stage-closed)",
  };
  return varMap[stage] || "var(--stage-pwd)";
}

/**
 * Format case status for display (e.g., "eta9089" -> "ETA 9089", "i140" -> "I-140")
 */
export function formatCaseStatus(status: string): string {
  if (status === "eta9089") return "ETA 9089";
  if (status === "i140") return "I-140";
  if (status === "pwd") return "PWD";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
