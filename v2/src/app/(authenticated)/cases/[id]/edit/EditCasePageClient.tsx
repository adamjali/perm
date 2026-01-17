"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { toast } from "@/lib/toast";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { api } from "../../../../../../convex/_generated/api";
import type { Id, Doc } from "../../../../../../convex/_generated/dataModel";
import { CaseForm } from "@/components/forms/CaseForm";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CaseFormData } from "@/lib/forms/case-form-schema";

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Loading skeleton matching form layout
 */
function EditPageSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6" data-testid="edit-page-skeleton">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton variant="line" className="h-4 w-16" />
        <Skeleton variant="circle" className="h-4 w-4" />
        <Skeleton variant="line" className="h-4 w-32" />
      </div>

      {/* Title skeleton with spinning accent */}
      <div className="relative">
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary border-2 border-foreground bounce-spin" />
        <div className="pl-6 space-y-2">
          <Skeleton variant="line" className="h-8 w-3/4" />
          <Skeleton variant="line" className="h-4 w-1/2" />
        </div>
      </div>

      {/* Form sections skeleton */}
      <div className="space-y-6">
        {/* Basic Info Section */}
        <div className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton variant="circle" className="h-5 w-5" />
            <Skeleton variant="line" className="h-6 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-24" />
              <Skeleton variant="block" className="h-11" />
            </div>
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-28" />
              <Skeleton variant="block" className="h-11" />
            </div>
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-20" />
              <Skeleton variant="block" className="h-11" />
            </div>
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-24" />
              <Skeleton variant="block" className="h-11" />
            </div>
          </div>
        </div>

        {/* PWD Section */}
        <div className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton variant="circle" className="h-5 w-5" />
            <Skeleton variant="line" className="h-6 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-20" />
              <Skeleton variant="block" className="h-11" />
            </div>
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-28" />
              <Skeleton variant="block" className="h-11" />
            </div>
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-24" />
              <Skeleton variant="block" className="h-11" />
            </div>
            <div className="space-y-2">
              <Skeleton variant="line" className="h-4 w-20" />
              <Skeleton variant="block" className="h-11" />
            </div>
          </div>
        </div>

        {/* Recruitment Section */}
        <div className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton variant="circle" className="h-5 w-5" />
            <Skeleton variant="line" className="h-6 w-28" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton variant="block" className="h-11" />
            <Skeleton variant="block" className="h-11" />
            <Skeleton variant="block" className="h-11" />
            <Skeleton variant="block" className="h-11" />
          </div>
        </div>

        {/* ETA 9089 Section */}
        <div className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton variant="circle" className="h-5 w-5" />
            <Skeleton variant="line" className="h-6 w-36" />
          </div>
          <Skeleton variant="block" className="h-32" />
        </div>

        {/* I-140 Section */}
        <div className="rounded-lg border-2 border-border bg-card p-6 shadow-hard-sm">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton variant="circle" className="h-5 w-5" />
            <Skeleton variant="line" className="h-6 w-32" />
          </div>
          <Skeleton variant="block" className="h-32" />
        </div>
      </div>

      {/* Sticky footer skeleton */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 border-t-4 border-border p-4">
        <div className="flex justify-end gap-4 max-w-4xl mx-auto">
          <Skeleton variant="block" className="h-11 w-24" />
          <Skeleton variant="block" className="h-11 w-28" />
        </div>
      </div>
    </div>
  );
}

/**
 * Not found state component
 */
function NotFoundState() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold">Case not found</h1>
          <p className="text-muted-foreground text-lg">
            The case you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
          </p>
        </div>
        <Link
          href="/cases"
          className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Back to Cases
        </Link>
      </div>
    </div>
  );
}

/**
 * Breadcrumb component
 */
function Breadcrumb({ caseData }: { caseData: Doc<"cases"> }) {
  const router = useRouter();

  return (
    <nav className="flex items-center gap-2 text-sm text-muted-foreground">
      <button
        onClick={() => router.push("/cases")}
        className="hover:text-foreground transition-colors"
      >
        Cases
      </button>
      <ChevronRight className="size-4" />
      <button
        onClick={() => router.push(`/cases/${caseData._id}`)}
        className="hover:text-foreground transition-colors"
      >
        {caseData.employerName} - {caseData.positionTitle}
      </button>
      <ChevronRight className="size-4" />
      <span className="text-foreground font-medium">Edit</span>
    </nav>
  );
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export function EditCasePageClient() {
  const params = useParams();
  const router = useRouter();
  const convex = useConvex();
  const caseId = params.id as string;

  // ============================================================================
  // STATE
  // ============================================================================

  const [pendingFormData, setPendingFormData] = useState<CaseFormData | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateCaseId, setDuplicateCaseId] = useState<string | null>(null);
  const [duplicateCaseInfo, setDuplicateCaseInfo] = useState<{
    positionTitle?: string;
    caseStatus?: string;
  } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const caseData = useQuery(api.cases.get, { id: caseId as Id<"cases"> });
  const updateMutation = useMutation(api.cases.update);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * Perform the actual update mutation.
   *
   * NOTE: This is called by handleFormSuccess which receives formData from CaseForm.
   * The useCaseFormSubmit hook in CaseForm validates but does NOT call the mutation
   * for add mode - it passes formData to onSuccess for the page to handle.
   * For edit mode, useCaseFormSubmit calls mutation internally, then passes caseId.
   *
   * However, this edit page uses a hybrid approach:
   * - We pass handleFormSuccess which expects formData for duplicate checking
   * - For normal edits without duplicate conflict, we call performUpdate
   * - For duplicate resolution, we call performUpdate with markAsDuplicate=true
   *
   * IMPORTANT: CaseForm's useCaseFormSubmit handles mutation in edit mode internally,
   * so this performUpdate is used for the duplicate resolution flow only when a
   * duplicate is detected and the user confirms they want to proceed.
   */
  const performUpdate = useCallback(
    async (formData: CaseFormData, markAsDuplicate?: boolean) => {
      setIsUpdating(true);
      try {
        const convexData = formData;

        await updateMutation({
          id: caseId as Id<"cases">,
          ...convexData,
          // If updating despite duplicate warning, mark as duplicate of the existing case
          ...(markAsDuplicate && duplicateCaseId
            ? {
                duplicateOf: duplicateCaseId as Id<"cases">,
                markedAsDuplicateAt: Date.now(),
              }
            : {}),
        });

        toast.success("Case updated successfully");
        await router.push(`/cases/${caseId}`);
      } catch (error) {
        console.error("Failed to update case:", error);
        toast.error("Failed to update case. Please try again.");
      } finally {
        setIsUpdating(false);
      }
    },
    [updateMutation, caseId, router, duplicateCaseId]
  );

  /**
   * Success handler passed to CaseForm.
   *
   * In edit mode, useCaseFormSubmit calls the mutation internally then passes
   * the caseId to this handler. However, this page needs formData to check for
   * duplicates BEFORE the mutation happens.
   *
   * CURRENT BEHAVIOR: The mutation happens in useCaseFormSubmit first, then
   * this handler is called. Duplicate checking here is a post-update verification.
   *
   * @param formDataOrId - Either CaseFormData (add mode) or Id<"cases"> (edit mode)
   */
  const handleFormSuccess = useCallback(
    async (formDataOrId: CaseFormData | Id<"cases">) => {
      // In edit mode, useCaseFormSubmit passes caseId after mutation.
      // Navigation happens here - duplicate checking already happened in mutation.
      if (typeof formDataOrId === "string") {
        // Edit mode: mutation already done by useCaseFormSubmit, just navigate
        await router.push(`/cases/${formDataOrId}`);
        return;
      }

      // Add mode path (shouldn't reach here for edit page, but type-safe handling)
      const formData = formDataOrId;
      // Check if employer or beneficiary changed (these are what define duplicates)
      const employerChanged = caseData && formData.employerName.toLowerCase().trim() !== caseData.employerName.toLowerCase().trim();
      const beneficiaryChanged = caseData && formData.beneficiaryIdentifier?.toLowerCase().trim() !== caseData.beneficiaryIdentifier?.toLowerCase().trim();

      // Only check for duplicates if employer or beneficiary changed
      if (employerChanged || beneficiaryChanged) {
        try {
          const result = await convex.query(api.cases.checkDuplicates, {
            cases: [
              {
                employerName: formData.employerName,
                beneficiaryIdentifier: formData.beneficiaryIdentifier,
              },
            ],
            // Exclude current case from duplicate check
            excludeCaseId: caseId as Id<"cases">,
          });

          if (result.duplicates.length > 0) {
            // Duplicate found - show warning dialog
            const duplicate = result.duplicates[0]!;
            setPendingFormData(formData);
            setDuplicateCaseId(duplicate.existingCaseId);
            setDuplicateCaseInfo({
              positionTitle: duplicate.existingPositionTitle,
              caseStatus: duplicate.existingCaseStatus,
            });
            setShowDuplicateDialog(true);
            return;
          }
        } catch (error) {
          console.error("Failed to check for duplicates:", error);
          // On error, warn but allow update to proceed
          toast.warning("Could not verify duplicates, proceeding with update");
        }
      }

      // No duplicate or no change to key fields - proceed with update
      await performUpdate(formData);
    },
    [convex, caseData, caseId, performUpdate, router]
  );

  /**
   * User confirmed to update anyway despite duplicate
   */
  const handleConfirmDuplicate = useCallback(async () => {
    if (!pendingFormData) return;

    setShowDuplicateDialog(false);
    // Mark as duplicate of the existing case
    await performUpdate(pendingFormData, true);
    setPendingFormData(null);
    setDuplicateCaseId(null);
    setDuplicateCaseInfo(null);
  }, [pendingFormData, performUpdate]);

  /**
   * User canceled duplicate update
   */
  const handleCancelDuplicate = useCallback(() => {
    setShowDuplicateDialog(false);
    setPendingFormData(null);
    setDuplicateCaseId(null);
    setDuplicateCaseInfo(null);
  }, []);

  /**
   * Cancel handler - navigate back to case detail page
   */
  const handleCancel = useCallback(async () => {
    await router.push(`/cases/${caseId}`);
  }, [router, caseId]);

  // ============================================================================
  // RENDER
  // ============================================================================

  // Loading state
  if (caseData === undefined) {
    return <EditPageSkeleton />;
  }

  // Not found state
  if (caseData === null) {
    return <NotFoundState />;
  }

  // Convert Convex case data to form data (handle BigInt conversion)
  const formData = {
    ...caseData,
    recruitmentApplicantsCount: Number(caseData.recruitmentApplicantsCount || 0),
    pwdWageAmount: caseData.pwdWageAmount !== undefined ? Number(caseData.pwdWageAmount) : undefined,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb caseData={caseData} />

      {/* Page Title with neobrutalist accent */}
      <div className="relative animate-fade-in">
        {/* Corner accent decoration */}
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary border-2 border-foreground shadow-hard-sm" />
        <div className="pl-6">
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Edit Case: {caseData.employerName} - {caseData.positionTitle}
          </h1>
          <p className="text-muted-foreground mt-2">
            Update case details below. All changes will be saved to your account.
          </p>
        </div>
      </div>

      {/* Case Form */}
      <CaseForm
        mode="edit"
        caseId={caseId as Id<"cases">}
        initialData={formData}
        onSuccess={handleFormSuccess}
        onCancel={handleCancel}
      />

      {/* Duplicate Warning Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Duplicate Case Detected</DialogTitle>
            <DialogDescription>
              Changing the employer/beneficiary would make this case a duplicate of an existing case.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              A case already exists for{" "}
              <strong>{pendingFormData?.employerName}</strong> /{" "}
              <strong>{pendingFormData?.beneficiaryIdentifier}</strong>
              {duplicateCaseInfo?.positionTitle && (
                <> ({duplicateCaseInfo.positionTitle})</>
              )}
              .
            </p>
            {duplicateCaseId && (
              <p className="text-sm text-muted-foreground">
                You can{" "}
                <button
                  onClick={() => router.push(`/cases/${duplicateCaseId}`)}
                  className="text-primary hover:underline font-medium"
                >
                  view the existing case
                </button>{" "}
                or update this one anyway (it will be marked as a duplicate).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDuplicate}
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDuplicate}
              loading={isUpdating}
              loadingText="Updating..."
              disabled={isUpdating}
            >
              Update Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
