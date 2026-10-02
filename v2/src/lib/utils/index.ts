import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Helper to format time unit with pluralization
 */
function formatTimeUnit(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/**
 * Format a timestamp as relative time (e.g., "just now", "2 minutes ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatTimeUnit(minutes, "minute");

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatTimeUnit(hours, "hour");

  const days = Math.floor(hours / 24);
  return formatTimeUnit(days, "day");
}
