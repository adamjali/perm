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
import { AlertTriangle, ChevronDown, ChevronUp, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
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

  // Don't render if no alerts or still loading
  if (!alerts || alerts.length === 0) {
    return null;
  }

  const handleDismissOne = async (notificationId: Id<"notifications">) => {
    try {
      await dismissOne({ notificationId });
    } catch (error) {
      console.error("Failed to dismiss alert:", error);
    }
  };

  const handleDismissAll = async () => {
    try {
      await dismissAll({});
    } catch (error) {
      console.error("Failed to dismiss all alerts:", error);
    }
  };

  const showExpander = alerts.length > 1;
  const visibleAlerts = isExpanded ? alerts : alerts.slice(0, 1);

  return (
    <div
      className="mb-6 bg-amber-50 dark:bg-amber-950/50 border-2 border-black dark:border-amber-400/50 p-4 relative"
      style={{ boxShadow: "4px 4px 0px #000" }}
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          <h3 className="font-heading font-bold text-amber-900 dark:text-amber-100">
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
              className="text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 text-xs"
            >
              Dismiss All
            </Button>
          )}

          {showExpander && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-amber-700 dark:text-amber-300 p-1"
              aria-label={isExpanded ? "Collapse alerts" : "Expand alerts"}
            >
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
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
            className="flex items-center justify-between bg-white dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 p-3 rounded-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-amber-900 dark:text-amber-100 truncate">
                  {alert.beneficiaryIdentifier}
                </span>
                <span className="text-amber-700 dark:text-amber-300 text-sm">
                  at {alert.employerName}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-sm text-amber-600 dark:text-amber-400">
                <span className="inline-flex items-center px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-medium rounded-sm">
                  {formatClosureReason(alert.closureReason)}
                </span>
                <span className="text-xs text-amber-500 dark:text-amber-500">
                  {formatTimeAgo(alert.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 ml-2">
              {alert.caseId && (
                <Link
                  href={`/cases/${alert.caseId}`}
                  className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                  title="View case"
                >
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}
              <button
                onClick={() => handleDismissOne(alert.notificationId)}
                className="p-1.5 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
                title="Dismiss alert"
                aria-label={`Dismiss alert for ${alert.beneficiaryIdentifier}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Collapsed indicator */}
      {!isExpanded && alerts.length > 1 && (
        <button
          onClick={() => setIsExpanded(true)}
          className="mt-2 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline"
        >
          +{alerts.length - 1} more {alerts.length === 2 ? "case" : "cases"}
        </button>
      )}
    </div>
  );
}
