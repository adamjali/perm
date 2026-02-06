/**
 * NoCasesYet Component
 *
 * Empty state for dashboard/cases list when user has no cases.
 * Features FolderOpenSVG illustration with encouraging copy.
 */

import { EmptyState } from "./EmptyState";
import { FolderOpenSVG } from "@/components/illustrations";

export interface NoCasesYetProps {
  onAddCase?: () => void;
}

export function NoCasesYet({ onAddCase }: NoCasesYetProps) {
  return (
    <EmptyState
      illustration={<FolderOpenSVG size={140} className="text-foreground" />}
      heading="No cases yet"
      description="Get started by adding your first PERM case. Track deadlines, manage documents, and stay organized."
      bgImage="/images/empty-states/empty-folder.jpg"
      accentColor="var(--primary)"
      action={{
        label: "Add your first case",
        ...(onAddCase ? { onClick: onAddCase } : { href: "/cases/new" }),
      }}
      data-testid="no-cases-yet"
    />
  );
}
