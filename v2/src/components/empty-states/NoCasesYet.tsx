/**
 * NoCasesYet Component
 *
 * Empty state for dashboard/cases list when user has no cases.
 * Wrapper around EmptyState with case-specific defaults.
 */

import { FolderOpen } from "lucide-react";
import { EmptyState } from "./EmptyState";

export interface NoCasesYetProps {
  onAddCase?: () => void;
}

export function NoCasesYet({ onAddCase }: NoCasesYetProps) {
  return (
    <EmptyState
      icon={FolderOpen}
      heading="No cases yet"
      description="Get started by adding your first PERM case. Track deadlines, manage documents, and stay organized."
      action={{
        label: "Add your first case",
        ...(onAddCase ? { onClick: onAddCase } : { href: "/cases/new" }),
      }}
      data-testid="no-cases-yet"
    />
  );
}
