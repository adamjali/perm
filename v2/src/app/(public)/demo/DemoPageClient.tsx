"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "@/lib/toast";
import { useDemoCases, initDemoCases, type DemoCase } from "@/lib/demo";
import {
  DemoBanner,
  StatsGrid,
  MiniCalendar,
  MiniTimeline,
  DemoCasesGrid,
  DemoCaseModal,
  DeleteConfirmDialog,
  DemoCTA,
} from "@/components/demo";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

interface CaseToDelete {
  id: string;
  name: string;
}

// ============================================================================
// Component
// ============================================================================

export function DemoPageClient() {
  const {
    cases,
    deleteCase,
    resetCases,
    addCase,
    updateCase,
    getCase,
    isInitialized,
    error,
    clearError,
  } = useDemoCases();

  // Modal state for case editing
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState<DemoCase | null>(null);

  // Delete confirmation state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<CaseToDelete | null>(null);

  // Scroll to top and initialize demo cases on first mount
  useEffect(() => {
    window.scrollTo(0, 0);
    initDemoCases();
  }, []);

  // Display storage errors to user via toast
  useEffect(() => {
    if (error) {
      const errorMessages: Record<string, string> = {
        quota_exceeded: "Storage quota exceeded. Try deleting some cases.",
        storage_unavailable: "Browser storage is unavailable.",
        parse_error: "Failed to read saved data.",
        unknown: "An unexpected error occurred.",
      };
      toast.error(errorMessages[error] || "Failed to save changes.");
      clearError();
    }
  }, [error, clearError]);

  // Handler for adding a new case
  const handleAdd = useCallback(() => {
    setCaseToEdit(null);
    setIsModalOpen(true);
  }, []);

  // Handler for editing a case
  const handleEdit = useCallback(
    (id: string) => {
      const foundCase = getCase(id);
      if (foundCase) {
        setCaseToEdit(foundCase);
        setIsModalOpen(true);
      }
    },
    [getCase]
  );

  // Handler for save (add or update)
  const handleSave = useCallback(
    (caseData: DemoCase) => {
      if (caseToEdit) {
        // Update existing case
        updateCase(caseData.id, caseData);
      } else {
        // Add new case - the hook generates id and timestamps
        addCase({
          beneficiaryName: caseData.beneficiaryName,
          employerName: caseData.employerName,
          status: caseData.status,
          progressStatus: caseData.progressStatus,
          isProfessionalOccupation: caseData.isProfessionalOccupation,
          isFavorite: caseData.isFavorite,
          pwdFilingDate: caseData.pwdFilingDate,
          pwdDeterminationDate: caseData.pwdDeterminationDate,
          pwdExpirationDate: caseData.pwdExpirationDate,
          sundayAdFirstDate: caseData.sundayAdFirstDate,
          sundayAdSecondDate: caseData.sundayAdSecondDate,
          jobOrderStartDate: caseData.jobOrderStartDate,
          jobOrderEndDate: caseData.jobOrderEndDate,
          noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
          noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
          recruitmentStartDate: caseData.recruitmentStartDate,
          recruitmentEndDate: caseData.recruitmentEndDate,
          additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
          eta9089FilingDate: caseData.eta9089FilingDate,
          eta9089CertificationDate: caseData.eta9089CertificationDate,
          eta9089ExpirationDate: caseData.eta9089ExpirationDate,
          i140FilingDate: caseData.i140FilingDate,
          i140ApprovalDate: caseData.i140ApprovalDate,
          rfiReceivedDate: caseData.rfiReceivedDate,
          rfiDueDate: caseData.rfiDueDate,
          rfiSubmittedDate: caseData.rfiSubmittedDate,
          rfeReceivedDate: caseData.rfeReceivedDate,
          rfeDueDate: caseData.rfeDueDate,
          rfeSubmittedDate: caseData.rfeSubmittedDate,
          notes: caseData.notes,
        });
      }
      setIsModalOpen(false);
      setCaseToEdit(null);
    },
    [caseToEdit, addCase, updateCase]
  );

  // Handler for initiating delete
  const handleDelete = useCallback(
    (id: string) => {
      const foundCase = getCase(id);
      if (foundCase) {
        setCaseToDelete({
          id: foundCase.id,
          name: `${foundCase.beneficiaryName} (${foundCase.employerName})`,
        });
        setIsDeleteOpen(true);
      }
    },
    [getCase]
  );

  // Handler for confirming delete
  const confirmDelete = useCallback(() => {
    if (caseToDelete) {
      deleteCase(caseToDelete.id);
      setCaseToDelete(null);
      setIsDeleteOpen(false);
    }
  }, [caseToDelete, deleteCase]);

  // Handler for closing modal
  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCaseToEdit(null);
  }, []);

  // Handler for closing delete dialog
  const handleCloseDelete = useCallback(() => {
    setIsDeleteOpen(false);
    setCaseToDelete(null);
  }, []);

  return (
    <div className="relative">
      {/* Demo mode banner */}
      <DemoBanner />

      {/* Main content container - pt-14 accounts for fixed demo banner (40px + spacing) */}
      <div className="mx-auto max-w-7xl px-4 py-8 pt-14 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl">
            PERM Tracker Demo
          </h1>
          <p className="mt-2 text-muted-foreground">
            Explore the full functionality with sample cases. All changes are
            saved locally in your browser.
          </p>
        </div>

        {/* Stats Grid */}
        {isInitialized && (
          <section className="mb-8" aria-labelledby="stats-heading">
            <h2 id="stats-heading" className="sr-only">
              Case Statistics
            </h2>
            <StatsGrid cases={cases} />
          </section>
        )}

        {/* Loading state */}
        {!isInitialized && (
          <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse border-2 border-border bg-card"
              />
            ))}
          </div>
        )}

        {/* Preview Grid - Calendar and Timeline */}
        {isInitialized && (
          <section className="mb-8" aria-labelledby="preview-heading">
            <h2
              id="preview-heading"
              className="mb-4 font-heading text-xl font-bold"
            >
              Overview
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {/* Mini Calendar */}
              <MiniCalendar cases={cases} />

              {/* Mini Timeline */}
              <MiniTimeline cases={cases} />
            </div>
          </section>
        )}

        {/* Loading state for preview grid */}
        {!isInitialized && (
          <section className="mb-8">
            <h2 className="mb-4 font-heading text-xl font-bold">Overview</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-80 animate-pulse border-2 border-border bg-card" />
              <div className="h-80 animate-pulse border-2 border-border bg-card" />
            </div>
          </section>
        )}

        {/* Cases Grid */}
        {isInitialized && (
          <section className="mb-8" aria-labelledby="cases-heading">
            <h2
              id="cases-heading"
              className="mb-4 font-heading text-xl font-bold"
            >
              Your Cases
            </h2>
            <DemoCasesGrid
              cases={cases}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
          </section>
        )}

        {/* Loading state for cases grid */}
        {!isInitialized && (
          <section className="mb-8">
            <h2 className="mb-4 font-heading text-xl font-bold">Your Cases</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse border-2 border-border bg-card"
                />
              ))}
            </div>
          </section>
        )}

        {/* Reset Button */}
        <div className="flex justify-center border-t border-border pt-8">
          <Button variant="outline" onClick={resetCases} className="gap-2">
            <RefreshCw className="size-4" />
            Reset Demo Data
          </Button>
        </div>
      </div>

      {/* CTA Section */}
      <DemoCTA />

      {/* Add/Edit Modal */}
      <DemoCaseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        caseToEdit={caseToEdit ?? undefined}
        onSave={handleSave}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteOpen}
        onClose={handleCloseDelete}
        caseName={caseToDelete?.name ?? ""}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
