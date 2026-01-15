"use client";

import * as React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import { cn } from "@/lib/utils";
import type { CaseStatus, ProgressStatus } from "@/lib/perm";

export interface CaseForSelection {
  _id: string;
  employerName: string;
  positionTitle: string;
  caseStatus: CaseStatus;
  progressStatus: ProgressStatus;
  createdAt: number;
}

export interface CaseSelectionItemProps {
  case: CaseForSelection;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

/**
 * CaseSelectionItem - A single selectable case row in the case selection modal.
 *
 * Features:
 * - Checkbox on left for selection
 * - Employer name + position title (truncated if long)
 * - Status badge on right
 * - Neobrutalist hover effect with background lightening
 */
export function CaseSelectionItem({
  case: caseData,
  isSelected,
  onToggle,
}: CaseSelectionItemProps) {
  const handleClick = () => {
    onToggle(caseData._id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle(caseData._id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 border-b border-border/50 cursor-pointer transition-all duration-150",
        "hover:bg-accent/10 hover:-translate-y-[1px]",
        isSelected && "bg-primary/5"
      )}
      data-testid={`case-selection-item-${caseData._id}`}
    >
      {/* Checkbox */}
      <Checkbox
        checked={isSelected}
        onCheckedChange={() => onToggle(caseData._id)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Select ${caseData.employerName}`}
        className="shrink-0"
      />

      {/* Case Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate" title={caseData.employerName}>
          {caseData.employerName}
        </p>
        <p
          className="text-xs text-muted-foreground truncate"
          title={caseData.positionTitle}
        >
          {caseData.positionTitle}
        </p>
      </div>

      {/* Status Badge */}
      <CaseStageBadge stage={caseData.caseStatus} className="shrink-0" />
    </div>
  );
}
