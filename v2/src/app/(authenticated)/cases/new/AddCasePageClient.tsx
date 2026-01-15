
"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { useMutation, useConvex } from "convex/react";
import { toast } from "@/lib/toast";
import { ChevronRight } from "lucide-react";
import { api } from "../../../../../convex/_generated/api";
import { CaseForm } from "@/components/forms/CaseForm";
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
import type { Id } from "../../../../../convex/_generated/dataModel";

// ============================================================================
// COMPONENT
// ============================================================================

export function AddCasePageClient() {
  const router = useRouter();
  const convex = useConvex();

  // ============================================================================
  // STATE
  // ============================================================================

  const [pendingFormData, setPendingFormData] = useState<CaseFormData | null>(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicateCaseId, setDuplicateCaseId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showCheckFailedDialog, setShowCheckFailedDialog] = useState(false);

  // ============================================================================
  // CONVEX MUTATIONS
  // ============================================================================

  const createMutation = useMutation(api.cases.create);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  /**
   * Create the case (called after duplicate check passes or user confirms override)
   * @param formData - The form data to create the case with
   * @param duplicateOf - Optional: if creating despite duplicate warning, this is the existing case ID
   */
  const createCase = useCallback(
    async (formData: CaseFormData, duplicateOf?: Id<"cases">) => {
      setIsCreating(true);
      try {
        const caseId = await createMutation({
          ...formData,
          // Ensure all required Convex fields are present
          employerName: formData.employerName,
          beneficiaryIdentifier: formData.beneficiaryIdentifier,
          positionTitle: formData.positionTitle,
          caseStatus: formData.caseStatus,
          progressStatus: formData.progressStatus,
          // Track duplicate relationship if user chose to create anyway
          duplicateOf,
        });

        toast.success("Case created successfully");
        await router.push(`/cases/${caseId}`);
      } catch (error) {
        console.error("Failed to create case:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        if (errorMessage.includes("network") || errorMessage.includes("Network")) {
          toast.error("Network error. Please check your connection and try again.");
        } else if (errorMessage.includes("permission") || errorMessage.includes("Permission") || errorMessage.includes("unauthorized")) {
          toast.error("You don't have permission to create cases.");
        } else if (errorMessage.includes("validation") || errorMessage.includes("Validation")) {
          toast.error("Validation error. Please check your input and try again.");
        } else {
          toast.error("Failed to create case. Please try again.");
        }
      } finally {
        setIsCreating(false);
      }
    },
    [createMutation, router]
  );

  /**
   * Check for duplicates before creating the case.
   * In add mode, CaseForm passes the full form data (not just case ID).
   */
  const handleFormSuccess = useCallback(
    async (formDataOrId: CaseFormData | Id<"cases">) => {
      // In add mode, we receive CaseFormData (not Id<"cases">)
      // The CaseForm component passes formData for add mode, caseId for edit mode
      const formData = formDataOrId as CaseFormData;
      // Check for duplicate (same employer + beneficiary)
      try {
        const result = await convex.query(api.cases.checkDuplicates, {
          cases: [
            {
              employerName: formData.employerName,
              beneficiaryIdentifier: formData.beneficiaryIdentifier,
            },
          ],
        });

        if (result.duplicates.length > 0) {
          // Duplicate found - show warning dialog
          setPendingFormData(formData);
          setDuplicateCaseId(result.duplicates[0]!.existingCaseId);
          setShowDuplicateDialog(true);
        } else {
          // No duplicate - proceed with create
          await createCase(formData);
        }
      } catch (error) {
        console.error("Failed to check for duplicates:", error);
        // On error checking duplicates, warn user and ask for confirmation
        toast.warning("Could not verify if this case already exists");
        setPendingFormData(formData);
        setShowCheckFailedDialog(true);
      }
    },
    [convex, createCase]
  );

  /**
   * User confirmed to create anyway despite duplicate
   */
  const handleConfirmDuplicate = useCallback(async () => {
    if (!pendingFormData) return;

    setShowDuplicateDialog(false);
    // Pass the existing case ID so we can track the duplicate relationship
    await createCase(pendingFormData, duplicateCaseId as Id<"cases"> | undefined);
    setPendingFormData(null);
    setDuplicateCaseId(null);
  }, [pendingFormData, createCase, duplicateCaseId]);

  /**
   * User canceled duplicate creation
   */
  const handleCancelDuplicate = useCallback(() => {
    setShowDuplicateDialog(false);
    setPendingFormData(null);
    setDuplicateCaseId(null);
  }, []);

  /**
   * User confirmed to create despite duplicate check failure
   */
  const handleConfirmCheckFailed = useCallback(async () => {
    if (!pendingFormData) return;

    setShowCheckFailedDialog(false);
    await createCase(pendingFormData);
    setPendingFormData(null);
  }, [pendingFormData, createCase]);

  /**
   * User canceled creation after duplicate check failure
   */
  const handleCancelCheckFailed = useCallback(() => {
    setShowCheckFailedDialog(false);
    setPendingFormData(null);
  }, []);

  /**
   * Cancel form - navigate back to cases list
   */
  const handleCancel = useCallback(() => {
    router.push("/cases");
  }, [router]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          onClick={() => router.push("/cases")}
          className="hover:text-foreground transition-colors"
        >
          Cases
        </button>
        <ChevronRight className="size-4" />
        <span className="text-foreground font-medium">Add New Case</span>
      </nav>

      {/* Page Title with neobrutalist accent */}
      <div className="relative animate-fade-in">
        {/* Corner accent decoration */}
        <div className="absolute -top-2 -left-2 w-6 h-6 bg-primary border-2 border-foreground shadow-hard-sm" />
        <div className="pl-6">
          <h1 className="font-heading text-3xl font-bold tracking-tight">Add New Case</h1>
          <p className="text-muted-foreground mt-2">
            Enter case details below. All fields are optional except employer, beneficiary, and
            position.
          </p>
        </div>
      </div>

      {/* Case Form */}
      <CaseForm
        mode="add"
        onSuccess={handleFormSuccess}
        onCancel={handleCancel}
      />

      {/* Duplicate Warning Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Duplicate Case Detected</DialogTitle>
            <DialogDescription>
              A case already exists for{" "}
              <strong>{pendingFormData?.employerName}</strong> /{" "}
              <strong>{pendingFormData?.beneficiaryIdentifier}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Creating a duplicate case may cause confusion and data management issues.
              {duplicateCaseId && (
                <>
                  {" "}
                  You can{" "}
                  <button
                    onClick={() => router.push(`/cases/${duplicateCaseId}`)}
                    className="text-primary hover:underline font-medium"
                  >
                    view the existing case
                  </button>{" "}
                  or create a new one anyway.
                </>
              )}
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelDuplicate}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDuplicate}
              loading={isCreating}
              loadingText="Creating..."
              disabled={isCreating}
            >
              Create Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Check Failed Warning Dialog */}
      <Dialog open={showCheckFailedDialog} onOpenChange={setShowCheckFailedDialog}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Unable to Check for Duplicates</DialogTitle>
            <DialogDescription>
              We could not verify whether a case already exists for{" "}
              <strong>{pendingFormData?.employerName}</strong> /{" "}
              <strong>{pendingFormData?.beneficiaryIdentifier}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This could be due to a network issue. Proceeding may create a duplicate case
              if one already exists. Do you want to continue?
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelCheckFailed}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmCheckFailed}
              loading={isCreating}
              loadingText="Creating..."
              disabled={isCreating}
            >
              Create Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
