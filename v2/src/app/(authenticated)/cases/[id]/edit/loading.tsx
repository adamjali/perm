/**
 * Case Edit Page Loading State
 * Suspense fallback for case edit page.
 *
 * Shows skeleton placeholders for:
 * - Breadcrumb navigation (Cases > [Case Name] > Edit)
 * - Page title with corner accent
 * - CaseForm skeleton with all sections
 * - Sticky footer with action buttons
 *
 * Phase: 22 (Case Form)
 * Created: 2025-12-26
 * Updated: 2025-12-27 - Use shared skeleton components (DRY)
 */

import {
  BreadcrumbSkeleton,
  PageTitleSkeleton,
} from "@/components/skeletons";
import { CaseFormSkeleton } from "@/components/forms/CaseFormSkeleton";

export default function CaseEditLoading() {
  return (
    <div
      className="mx-auto max-w-4xl px-4 py-8 space-y-6"
      data-testid="edit-page-loading"
    >
      {/* Breadcrumb skeleton: Cases > [Case Name] > Edit */}
      <BreadcrumbSkeleton items={3} />

      {/* Title skeleton with corner accent */}
      <PageTitleSkeleton showAccent showDescription />

      {/* Case Form skeleton */}
      <CaseFormSkeleton />
    </div>
  );
}
