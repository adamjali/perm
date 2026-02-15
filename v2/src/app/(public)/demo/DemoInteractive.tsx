"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Zap,
  CalendarDays,
  BarChart3,
  LayoutGrid,
  MousePointerClick,
  RefreshCw,
  Rocket,
  Loader2,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { useDemoCases, initDemoCases, type DemoCase } from "@/lib/demo";
import {
  StatsGrid,
  MiniCalendar,
  MiniTimeline,
  DemoCasesGrid,
  DemoCaseModal,
  DeleteConfirmDialog,
  DemoCTA,
} from "@/components/demo";
import { FadeIn } from "@/components/ui/fade-in";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

interface CaseToDelete {
  id: string;
  name: string;
}

interface SectionLabelProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor?: string;
}

function SectionLabel({
  number,
  title,
  description,
  icon,
  accentColor = "var(--primary)",
}: SectionLabelProps) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center border-3 border-border font-heading text-lg font-black shadow-hard-sm"
        style={{ backgroundColor: accentColor, color: "#000" }}
      >
        {number}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">{icon}</span>
          <h2 className="font-heading text-xl font-bold tracking-tight">
            {title}
          </h2>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FeatureCallout({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="flex items-center gap-2 border-2 border-border bg-muted/50 px-3 py-1.5">
      <span className="text-primary">{icon}</span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {text}
      </span>
    </div>
  );
}

/**
 * Interactive demo sections — stats, calendar, cases grid, modals.
 * Split from static content (hero, tour, screenshots) which is server-rendered in page.tsx.
 */
export function DemoInteractive() {
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

  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState<DemoCase | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<CaseToDelete | null>(null);

  useEffect(() => {
    initDemoCases();
  }, []);

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

  const handleAdd = useCallback(() => {
    setCaseToEdit(null);
    setIsModalOpen(true);
  }, []);

  const handleEdit = useCallback(
    (id: string) => {
      const foundCase = getCase(id);
      if (foundCase) {
        setCaseToEdit(foundCase);
        setIsModalOpen(true);
      }
    },
    [getCase],
  );

  const handleSave = useCallback(
    (caseData: DemoCase) => {
      if (caseToEdit) {
        updateCase(caseData.id, caseData);
      } else {
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
    [caseToEdit, addCase, updateCase],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const foundCase = getCase(id);
      if (foundCase) {
        setCaseToDelete({
          id: foundCase.id,
          name: `${foundCase.employerName} — ${foundCase.beneficiaryName}`,
        });
        setIsDeleteOpen(true);
      }
    },
    [getCase],
  );

  const confirmDelete = useCallback(() => {
    if (caseToDelete) {
      deleteCase(caseToDelete.id);
      setCaseToDelete(null);
      setIsDeleteOpen(false);
    }
  }, [caseToDelete, deleteCase]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setCaseToEdit(null);
  }, []);

  const handleCloseDelete = useCallback(() => {
    setIsDeleteOpen(false);
    setCaseToDelete(null);
  }, []);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Section 1: Stats */}
        {isInitialized && (
          <section className="mb-12" aria-labelledby="stats-heading">
            <FadeIn direction="up">
              <SectionLabel
                number="1"
                title="Deadline Hub"
                description="See your caseload summary instantly — total cases, active deadlines, due this week, and overdue items."
                icon={<Zap className="h-4 w-4" />}
                accentColor="var(--primary)"
              />
            </FadeIn>
            <h2 id="stats-heading" className="sr-only">
              Case Statistics
            </h2>
            <StatsGrid cases={cases} />
            <div className="mt-4 flex flex-wrap gap-2">
              <FeatureCallout
                icon={<Zap className="h-3 w-3" />}
                text="Stats update live as you add or edit cases"
              />
            </div>
          </section>
        )}

        {/* Loading state */}
        {!isInitialized && (
          <div className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse border-3 border-border bg-muted"
              />
            ))}
          </div>
        )}

        {/* Section 2: Calendar & Timeline */}
        {isInitialized && (
          <section className="mb-12" aria-labelledby="preview-heading">
            <FadeIn direction="up">
              <SectionLabel
                number="2"
                title="Calendar & Progress"
                description="Color-coded deadline dots on the calendar. Progress bars show how far each case has advanced through the PERM process."
                icon={<CalendarDays className="h-4 w-4" />}
                accentColor="var(--stage-pwd)"
              />
            </FadeIn>
            <h2 id="preview-heading" className="sr-only">
              Overview
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <MiniCalendar cases={cases} />
              <MiniTimeline cases={cases} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <FeatureCallout
                icon={<CalendarDays className="h-3 w-3" />}
                text="In the real app, deadlines sync to Google Calendar"
              />
              <FeatureCallout
                icon={<BarChart3 className="h-3 w-3" />}
                text="Progress tracks across PWD → Recruitment → ETA 9089 → I-140"
              />
            </div>
          </section>
        )}

        {/* Loading state for preview grid */}
        {!isInitialized && (
          <section className="mb-12">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="h-80 animate-pulse border-3 border-border bg-muted" />
              <div className="h-80 animate-pulse border-3 border-border bg-muted" />
            </div>
          </section>
        )}

        {/* Section 3: Cases */}
        {isInitialized && (
          <section className="mb-12" aria-labelledby="cases-heading">
            <FadeIn direction="up">
              <SectionLabel
                number="3"
                title="Your Cases"
                description="Each card shows the employer, beneficiary, PERM stage, next deadline with urgency color, and progress status. Click Edit to change dates and see auto-cascade in action."
                icon={<LayoutGrid className="h-4 w-4" />}
                accentColor="var(--stage-recruitment)"
              />
            </FadeIn>
            <h2 id="cases-heading" className="sr-only">
              Cases
            </h2>
            <DemoCasesGrid
              cases={cases}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAdd={handleAdd}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <FeatureCallout
                icon={<MousePointerClick className="h-3 w-3" />}
                text="Try editing a case — change a date and watch downstream deadlines update"
              />
            </div>
          </section>
        )}

        {/* Loading state for cases grid */}
        {!isInitialized && (
          <section className="mb-12">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-48 animate-pulse border-3 border-border bg-muted"
                />
              ))}
            </div>
          </section>
        )}

        {/* Reset + Inline CTA */}
        <div className="flex flex-col items-center gap-6 border-t-3 border-border pt-10">
          <button
            type="button"
            onClick={resetCases}
            className="inline-flex items-center gap-2 border-2 border-border bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reset Demo Data
          </button>

          <div className="text-center">
            <p className="font-heading text-xl font-black sm:text-2xl">
              Ready to track your{" "}
              <span className="inline-block bg-primary px-2 py-0.5 text-black shadow-hard-sm">
                real
              </span>{" "}
              cases?
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Free forever. No credit card required.
            </p>
          </div>

          <button
            type="button"
            className="inline-flex h-14 items-center gap-2 border-3 border-border bg-primary px-8 font-heading text-base font-bold uppercase tracking-[0.05em] text-black shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            onClick={() => navigateTo("/signup")}
            disabled={isNavigating}
          >
            {isNavigating && targetPath === "/signup" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Rocket className="h-5 w-5" />
            )}
            Start Tracking Cases Free
          </button>
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
    </>
  );
}
