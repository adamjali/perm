/**
 * CaseListView Component
 *
 * Container for list view with auto-grouping based on sort field.
 * Renders grouped cases under sticky group headings.
 *
 * @module components/cases/CaseListView
 */

"use client";

import { useMemo } from "react";
import { formatCaseStatus } from "@convex/lib/notificationHelpers";
import { CaseListRow } from "./CaseListRow";
import type { CaseCardData } from "@convex/lib/caseListTypes";
import type { CaseListSortField } from "@convex/lib/caseListTypes";

export interface CaseListViewProps {
  /** Cases to display */
  cases: CaseCardData[];
  /** Current sort field (determines grouping) */
  sortBy: CaseListSortField;
  /** Whether selection mode is active */
  selectionMode: boolean;
  /** Set of selected case IDs */
  selectedCaseIds: Set<string>;
  /** Selection callback */
  onSelect: (id: string) => void;
}

// ============================================================================
// Types
// ============================================================================

interface CaseGroup {
  key: string;
  label: string;
  cases: CaseCardData[];
}

// ============================================================================
// Grouping Logic
// ============================================================================

function groupCases(
  cases: CaseCardData[],
  sortBy: CaseListSortField
): CaseGroup[] {
  if (cases.length === 0) return [];

  // Determine grouping strategy based on sort field
  switch (sortBy) {
    case "employer":
      return groupByEmployer(cases);
    case "deadline":
      return groupByDeadline(cases);
    case "status":
      return groupByStatus(cases);
    case "favorites":
      return groupByFavorites(cases);
    default:
      // For other sorts (updated, pwdFiled, etc.), show flat list
      return [{ key: "all", label: "", cases }];
  }
}

function groupByEmployer(cases: CaseCardData[]): CaseGroup[] {
  const groups = new Map<string, CaseCardData[]>();

  for (const c of cases) {
    const firstLetter = c.employerName.charAt(0).toUpperCase();
    const key = /[A-Z]/.test(firstLetter) ? firstLetter : "#";
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(c);
  }

  // Sort alphabetically
  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });

  return sortedKeys.map((key) => ({
    key,
    label: key,
    cases: groups.get(key)!,
  }));
}

type DeadlineGroupKey =
  | "overdue"
  | "today"
  | "this_week"
  | "this_month"
  | "later"
  | "no_deadline";

function groupByDeadline(cases: CaseCardData[]): CaseGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (7 - today.getDay()));
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const groups: Record<DeadlineGroupKey, CaseCardData[]> = {
    overdue: [],
    today: [],
    this_week: [],
    this_month: [],
    later: [],
    no_deadline: [],
  };

  for (const c of cases) {
    if (!c.nextDeadline) {
      groups.no_deadline.push(c);
      continue;
    }

    const deadline = new Date(`${c.nextDeadline}T12:00:00`);
    const deadlineDate = new Date(
      deadline.getFullYear(),
      deadline.getMonth(),
      deadline.getDate()
    );

    if (deadlineDate < today) {
      groups.overdue.push(c);
    } else if (deadlineDate.getTime() === today.getTime()) {
      groups.today.push(c);
    } else if (deadlineDate <= endOfWeek) {
      groups.this_week.push(c);
    } else if (deadlineDate <= endOfMonth) {
      groups.this_month.push(c);
    } else {
      groups.later.push(c);
    }
  }

  const groupOrder: Array<{ key: DeadlineGroupKey; label: string }> = [
    { key: "overdue", label: "Overdue" },
    { key: "today", label: "Today" },
    { key: "this_week", label: "This week" },
    { key: "this_month", label: "This month" },
    { key: "later", label: "Later" },
    { key: "no_deadline", label: "No deadline" },
  ];

  return groupOrder
    .filter(({ key }) => groups[key].length > 0)
    .map(({ key, label }) => ({
      key,
      label,
      cases: groups[key],
    }));
}

function groupByStatus(cases: CaseCardData[]): CaseGroup[] {
  const statusOrder = ["pwd", "recruitment", "eta9089", "i140", "closed"];

  const groups = new Map<string, CaseCardData[]>();

  for (const c of cases) {
    const status = c.caseStatus;
    if (!groups.has(status)) {
      groups.set(status, []);
    }
    groups.get(status)!.push(c);
  }

  return statusOrder
    .filter((status) => groups.has(status))
    .map((status) => ({
      key: status,
      label: formatCaseStatus(status),
      cases: groups.get(status)!,
    }));
}

function groupByFavorites(cases: CaseCardData[]): CaseGroup[] {
  const favorites = cases.filter((c) => c.isFavorite);
  const others = cases.filter((c) => !c.isFavorite);

  const result: CaseGroup[] = [];
  if (favorites.length > 0) {
    result.push({ key: "favorites", label: "Favorites", cases: favorites });
  }
  if (others.length > 0) {
    result.push({ key: "others", label: "Others", cases: others });
  }
  return result;
}

// ============================================================================
// Component
// ============================================================================

export function CaseListView({
  cases,
  sortBy,
  selectionMode,
  selectedCaseIds,
  onSelect,
}: CaseListViewProps) {
  const groups = useMemo(() => groupCases(cases, sortBy), [cases, sortBy]);

  return (
    <div className="border-x border-t border-border bg-card">
      {groups.map((group) => (
        <div key={group.key}>
          {/* Group header - only show if there’s a label */}
          {group.label && (
            <div className="sticky top-0 z-20 border-b border-border bg-muted px-4 py-2">
              <h3 className="text-sm font-semibold">
                {group.label}{" "}
                <span className="font-normal text-muted-foreground">{group.cases.length}</span>
              </h3>
            </div>
          )}

          {group.cases.map((caseData) => (
            <CaseListRow
              key={caseData._id}
              caseData={caseData}
              isSelected={selectedCaseIds.has(caseData._id)}
              onSelect={onSelect}
              selectionMode={selectionMode}
            />
          ))}
        </div>
      ))}

      {cases.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          No cases to display
        </div>
      )}
    </div>
  );
}
