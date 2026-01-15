/**
 * Add Case Page Loading State
 * Suspense fallback for the new case page.
 *
 * Shows skeleton placeholders for:
 * - Breadcrumb navigation (Cases > Add New Case)
 * - Page title with corner accent
 * - CaseForm skeleton with all sections
 * - Sticky footer with action buttons
 *
 * Phase: 22 (Case Forms)
 * Created: 2025-12-27
 */

import {
  BreadcrumbSkeleton,
  PageTitleSkeleton,
} from "@/components/skeletons";
import { CaseFormSkeleton } from "@/components/forms/CaseFormSkeleton";

export default function NewCaseLoading() {
  return (
    <div
      className="mx-auto max-w-4xl px-4 py-8 space-y-6"
      data-testid="new-case-loading"
    >
      {/* Breadcrumb skeleton: Cases > Add New Case */}
      <BreadcrumbSkeleton items={2} />

      {/* Title skeleton with corner accent */}
      <PageTitleSkeleton showAccent showDescription />

      {/* Case Form skeleton */}
      <CaseFormSkeleton />
    </div>
  );
}
