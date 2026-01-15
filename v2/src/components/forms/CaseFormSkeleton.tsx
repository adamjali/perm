/**
 * CaseFormSkeleton Component
 *
 * Reusable skeleton loading state for the CaseForm component.
 * Used by both Add Case and Edit Case pages.
 *
 * Structure matches CaseForm.tsx:
 * - Basic Info section (not collapsible)
 * - PWD section (collapsible)
 * - Recruitment section (collapsible)
 * - ETA 9089 section (collapsible)
 * - I-140 section (collapsible)
 * - Notes section (collapsible)
 * - Sticky footer
 *
 * Design System:
 * - Neobrutalist aesthetic (hard shadows, 2px borders)
 * - Staggered animations (50ms increments)
 * - Dark mode support via CSS variables
 *
 * Phase: 22 (Case Forms)
 * Created: 2025-12-27
 */

import {
  FormSectionSkeleton,
  FieldSkeleton,
  ToggleSkeleton,
  StickyFooterSkeleton,
} from "@/components/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================================================
// TYPES
// ============================================================================

export interface CaseFormSkeletonProps {
  /** Whether to show the sticky footer */
  showFooter?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * CaseFormSkeleton
 * Complete form skeleton matching CaseForm structure.
 *
 * @example
 * // In a loading.tsx file
 * export default function Loading() {
 *   return (
 *     <div className="...">
 *       <CaseFormSkeleton />
 *     </div>
 *   );
 * }
 */
export function CaseFormSkeleton({ showFooter = true }: CaseFormSkeletonProps) {
  return (
    <div className="space-y-8 pb-24 animate-fade-in">
      {/* ========== BASIC INFO SECTION ========== */}
      {/* Not in a CollapsibleSection - always visible */}
      <div className="animate-slide-up" style={{ animationDelay: "50ms" }}>
        <div className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <Skeleton variant="circle" className="h-6 w-6" />
            <Skeleton variant="line" className="h-7 w-40" />
          </div>

          {/* Fields grid: 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Employer Name */}
            <FieldSkeleton labelWidth="w-28" />
            {/* Beneficiary ID */}
            <FieldSkeleton labelWidth="w-32" />
            {/* Position Title */}
            <FieldSkeleton labelWidth="w-28" />
            {/* Case Number */}
            <FieldSkeleton labelWidth="w-24" />
            {/* Case Status */}
            <FieldSkeleton labelWidth="w-24" />
            {/* Progress Status */}
            <FieldSkeleton labelWidth="w-32" />
          </div>
        </div>
      </div>

      {/* ========== PWD SECTION ========== */}
      <div className="animate-slide-up" style={{ animationDelay: "100ms" }}>
        <FormSectionSkeleton
          titleWidth="w-64"
          inputCount={6}
          columns={2}
        />
      </div>

      {/* ========== RECRUITMENT SECTION ========== */}
      <div className="animate-slide-up" style={{ animationDelay: "150ms" }}>
        <FormSectionSkeleton titleWidth="w-28" columns={2}>
          {/* Custom content for complex recruitment section */}
          <div className="space-y-6">
            {/* Sunday Ads row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-36" />
              <FieldSkeleton labelWidth="w-40" />
            </div>

            {/* Newspaper */}
            <FieldSkeleton labelWidth="w-24" />

            {/* Job Order dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-32" />
              <FieldSkeleton labelWidth="w-28" />
            </div>

            {/* Notice of Filing dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-40" />
              <FieldSkeleton labelWidth="w-36" />
            </div>

            {/* Professional occupation checkbox */}
            <div className="flex items-center gap-3">
              <Skeleton variant="block" className="h-5 w-5 rounded" />
              <Skeleton variant="line" className="h-4 w-48" />
            </div>

            {/* Applicants count */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-36" />
              <FieldSkeleton labelWidth="w-20" />
            </div>
          </div>
        </FormSectionSkeleton>
      </div>

      {/* ========== ETA 9089 SECTION ========== */}
      <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
        <FormSectionSkeleton titleWidth="w-48" columns={2}>
          <div className="space-y-6">
            {/* Filing window indicator placeholder */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Skeleton variant="circle" className="h-4 w-4" />
                <Skeleton variant="line" className="h-4 w-48" />
              </div>
            </div>

            {/* Date fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-24" />
              <FieldSkeleton labelWidth="w-24" />
              <FieldSkeleton labelWidth="w-32" />
              <FieldSkeleton labelWidth="w-32" />
            </div>

            {/* Case number */}
            <FieldSkeleton labelWidth="w-28" />

            {/* RFI entries placeholder */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <Skeleton variant="line" className="h-5 w-32" />
                <Skeleton variant="block" className="h-9 w-24" />
              </div>
              <div className="text-center py-4">
                <Skeleton variant="line" className="h-4 w-40 mx-auto" />
              </div>
            </div>
          </div>
        </FormSectionSkeleton>
      </div>

      {/* ========== I-140 SECTION ========== */}
      <div className="animate-slide-up" style={{ animationDelay: "250ms" }}>
        <FormSectionSkeleton titleWidth="w-44" columns={2}>
          <div className="space-y-6">
            {/* Filing window indicator placeholder */}
            <div className="rounded-md border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <Skeleton variant="circle" className="h-4 w-4" />
                <Skeleton variant="line" className="h-4 w-52" />
              </div>
            </div>

            {/* Date fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-24" />
              <FieldSkeleton labelWidth="w-28" />
              <FieldSkeleton labelWidth="w-28" />
              <FieldSkeleton labelWidth="w-24" />
            </div>

            {/* Receipt number and category */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-32" />
              <FieldSkeleton labelWidth="w-28" />
            </div>

            {/* Service center and premium processing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldSkeleton labelWidth="w-28" />
              <div className="flex items-center gap-3 pt-6">
                <Skeleton variant="block" className="h-5 w-5 rounded" />
                <Skeleton variant="line" className="h-4 w-36" />
              </div>
            </div>

            {/* RFE entries placeholder */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <Skeleton variant="line" className="h-5 w-32" />
                <Skeleton variant="block" className="h-9 w-24" />
              </div>
              <div className="text-center py-4">
                <Skeleton variant="line" className="h-4 w-40 mx-auto" />
              </div>
            </div>
          </div>
        </FormSectionSkeleton>
      </div>

      {/* ========== NOTES SECTION ========== */}
      <div className="animate-slide-up" style={{ animationDelay: "300ms" }}>
        <FormSectionSkeleton titleWidth="w-36">
          <div className="space-y-6">
            {/* Notes journal placeholder */}
            <div>
              <Skeleton variant="line" className="h-4 w-16 mb-2" />
              <Skeleton variant="block" className="h-32" />
            </div>

            {/* Settings toggles */}
            <div className="pt-4 border-t-2 border-border space-y-4">
              <ToggleSkeleton labelWidth="w-28" />
              <ToggleSkeleton labelWidth="w-20" />
            </div>
          </div>
        </FormSectionSkeleton>
      </div>

      {/* ========== STICKY FOOTER ========== */}
      {showFooter && (
        <div className="animate-slide-up" style={{ animationDelay: "350ms" }}>
          <StickyFooterSkeleton />
        </div>
      )}
    </div>
  );
}
