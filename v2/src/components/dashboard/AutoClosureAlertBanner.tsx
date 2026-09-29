"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here (2026-09-01) rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx for the incident.

/**
 * AutoClosureAlertBanner Component
 *
 * Displays a persistent alert banner at the top of the dashboard when
 * cases have been automatically closed due to expired deadlines.
 *
 * Features:
 * - Warning/amber color scheme for urgency
 * - Neobrutalist design with hard shadow and 2px black border
 * - Expandable list for multiple alerts
 * - Individual dismiss and "Dismiss All" buttons
 * - Link to view each closed case
 *
 * @see /convex/deadlineEnforcement.ts - Backend queries/mutations
 * @see /perm_flow.md - Business rules for deadline enforcement
 */

"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { ArrowSquareOutIcon, CaretDownIcon, CaretUpIcon, WarningIcon as AlertTriangle, XIcon } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { handleOperationError } from "@/lib/errors";
import { useAuthContext } from "@/lib/contexts/AuthContext";

/**
 * Format closure reason for display.
 */
function formatClosureReason(reason: string): string {
  switch (reason) {
    case "pwd_expired":
      return "PWD Expired";
    case "recruitment_window_missed":
      return "Recruitment Window Missed";
    case "filing_window_missed":
      return "Filing Window Missed";
    case "eta9089_expired":
      return "ETA 9089 Expired";
    default:
      return "Deadline Missed";
  }
}

/**
 * Format relative time for display.
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AutoClosureAlertBanner() {
  const { isSigningOut } = useAuthContext();
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch auto-closure alerts
  const alerts = useQuery(
    api.deadlineEnforcement.getAutoClosureAlerts,
    isSigningOut ? "skip" : undefined
  );

  // Mutations for dismissing alerts
  const dismissOne = useMutation(api.deadlineEnforcement.dismissAutoClosureAlert);
  const dismissAll = useMutation(api.deadlineEnforcement.dismissAllAutoClosureAlerts);

  // Don’t render if no alerts or still loading
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const handleDismissOne = async (notificationId: Id<"notifications">) => {
    try {
      await dismissOne({ notificationId });
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to dismiss alert",
        context: { operation: "dismissAutoClosureAlert" },
      });
    }
  };

  const handleDismissAll = async () => {
    try {
      await dismissAll({});
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to dismiss alerts",
        context: { operation: "dismissAllAutoClosureAlerts" },
      });
    }
  };

  const showExpander = alerts.length > 1;
  const visibleAlerts = isExpanded ? alerts : alerts.slice(0, 1);

  return (
    <div
      className="mb-6 bg-data-warn/15 border-2 border-data-warn p-4 relative"
      style={{ boxShadow: "var(--shadow-hard)" }}
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-data-warn-ink" />
          <h3 className="font-heading font-bold text-data-warn-ink">
            {alerts.length === 1
              ? "1 Case Auto-Closed"
              : `${alerts.length} Cases Auto-Closed`}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {alerts.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismissAll}
              className="text-data-warn-ink hover:text-data-warn-ink text-sm"
            >
              Dismiss all
            </Button>
          )}

          {showExpander && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-data-warn-ink p-1"
              aria-label={isExpanded ? "Collapse alerts" : "Expand alerts"}
            >
              {isExpanded ? (
                <CaretUpIcon className="w-4 h-4" />
              ) : (
                <CaretDownIcon className="w-4 h-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Alert list */}
      <ul className="space-y-2">
        {visibleAlerts.map((alert) => (
          <li
            key={alert.notificationId}
            className="flex items-center justify-between bg-background border-2 border-data-warn p-3"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-data-warn-ink truncate" title={alert.employerName}>
                  {alert.employerName}
                </span>{" "}
                <span className="text-data-warn-ink text-sm truncate" title={alert.positionTitle}>
                  - {alert.positionTitle}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-data-warn-ink">
                <span className="inline-flex items-center px-2 py-0.5 bg-data-warn/15 text-data-warn-ink text-sm font-medium rounded-sm">
                  {formatClosureReason(alert.closureReason)}
                </span>{" "}
                <span className="text-sm text-data-warn-ink">
                  {formatTimeAgo(alert.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2">
              {alert.caseId && (
                <Link
                  href={`/cases/${alert.caseId}`}
                  className="p-1.5 text-data-warn-ink hover:text-data-warn-ink transition-colors"
                  title="View case"
                >
                  <ArrowSquareOutIcon className="w-4 h-4" />
                </Link>
              )}
              <button
                onClick={() => handleDismissOne(alert.notificationId)}
                className="p-1.5 text-data-warn-ink hover:text-data-warn-ink transition-colors"
                title="Dismiss alert"
                aria-label={`Dismiss alert for ${alert.employerName} - ${alert.positionTitle}`}
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Collapsed indicator */}
      {!isExpanded && alerts.length > 1 && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-2 text-sm text-data-warn-ink hover:text-data-warn-ink underline"
        >
          +{alerts.length - 1} more {alerts.length === 2 ? "case" : "cases"}
        </button>
      )}
    </div>
  );
}
