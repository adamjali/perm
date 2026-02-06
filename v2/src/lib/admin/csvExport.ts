/**
 * CSV Export Utilities
 *
 * Functions for exporting user data to CSV format with proper escaping.
 */

import type { UserSummary } from "./types";

/**
 * Escape a CSV field value.
 * Wraps in quotes if contains comma, quote, or newline.
 * Doubles internal quotes.
 */
function escapeCsvField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);

  // If contains comma, quote, or newline, wrap in quotes and escape internal quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Format timestamp to ISO date string
 */
function formatTimestamp(timestamp: number | null): string {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString();
}

/**
 * Export user summaries to CSV string
 */
export function exportUsersToCSV(users: UserSummary[]): string {
  // CSV headers
  const headers = [
    "User ID",
    "Email",
    "Name",
    "Email Verified",
    "Verification Method",
    "Auth Providers",
    "Account Created",
    "Last Login",
    "Total Logins",
    "Total Cases",
    "Active Cases",
    "Deleted Cases",
    "Last Case Update",
    "User Type",
    "Firm Name",
    "Account Status",
    "Deleted At",
    "Terms Accepted",
    "Terms Version",
    "Last Activity",
  ];

  // Build CSV rows
  const rows = users.map((user) => [
    escapeCsvField(user.userId),
    escapeCsvField(user.email),
    escapeCsvField(user.name),
    escapeCsvField(user.emailVerified),
    escapeCsvField(user.verificationMethod),
    escapeCsvField(user.authProviders.join("; ")),
    escapeCsvField(formatTimestamp(user.accountCreated)),
    escapeCsvField(formatTimestamp(user.lastLoginTime)),
    escapeCsvField(user.totalLogins),
    escapeCsvField(user.totalCases),
    escapeCsvField(user.activeCases),
    escapeCsvField(user.deletedCases),
    escapeCsvField(formatTimestamp(user.lastCaseUpdate)),
    escapeCsvField(user.userType),
    escapeCsvField(user.firmName),
    escapeCsvField(user.accountStatus),
    escapeCsvField(formatTimestamp(user.deletedAt)),
    escapeCsvField(formatTimestamp(user.termsAccepted)),
    escapeCsvField(user.termsVersion),
    escapeCsvField(formatTimestamp(user.lastActivity)),
  ]);

  // Combine headers and rows
  return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
}

/**
 * Download CSV content as a file
 */
export function downloadCSV(csvContent: string, filename: string): void {
  // Create blob
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  // Create download link
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up
  URL.revokeObjectURL(url);
}
