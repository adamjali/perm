"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  Rocket,
  Loader2,
  Play,
  RefreshCw,
  Eye,
  MousePointerClick,
  ArrowDown,
  CalendarDays,
  BarChart3,
  LayoutGrid,
  Zap,
} from "lucide-react";
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
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";

// ============================================================================
// Types
// ============================================================================

interface CaseToDelete {
  id: string;
  name: string;
}

// ============================================================================
// Section Label
// ============================================================================

interface SectionLabelProps {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accentColor?: string;
}

function SectionLabel({ number, title, description, icon, accentColor = "var(--primary)" }: SectionLabelProps) {
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
        <p className="mt-0.5 text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Feature Callout — small inline tip cards
// ============================================================================

interface FeatureCalloutProps {
  icon: React.ReactNode;
  text: string;
}

function FeatureCallout({ icon, text }: FeatureCalloutProps) {
  return (
    <div className="flex items-center gap-2 border-2 border-border bg-muted/50 px-3 py-1.5">
      <span className="text-primary">{icon}</span>
      <span className="font-mono text-[11px] text-muted-foreground">{text}</span>
    </div>
  );
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

  const { isNavigating, navigateTo, targetPath } = useNavigationLoading();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [caseToEdit, setCaseToEdit] = useState<DemoCase | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<CaseToDelete | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
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
    [getCase]
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
    [caseToEdit, addCase, updateCase]
  );

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
    <div className="relative">
      <DemoBanner />

      {/* ================================================================ */}
      {/* HERO INTRO */}
      {/* ================================================================ */}
      <section className="relative overflow-hidden border-b-3 border-border bg-muted pt-14">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <ScrollReveal direction="up">
            <div className="text-center">
              <div className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                <Play className="h-3.5 w-3.5" />
                Interactive Demo
              </div>
              <h1 className="font-heading text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                See How PERM Tracker{" "}
                <span className="inline-block bg-primary px-[0.3em] py-[0.1em] text-black shadow-hard">
                  Works
                </span>
              </h1>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                This is a fully interactive sandbox with 5 sample cases at different PERM stages.
                Add cases, edit dates, and watch deadlines calculate automatically — exactly like the real product.
              </p>
            </div>
          </ScrollReveal>

          {/* What you can try */}
          <ScrollReveal direction="up" delay={0.1}>
            <div className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
              {[
                {
                  icon: <Eye className="h-5 w-5" />,
                  title: "Explore Cases",
                  desc: "5 sample cases across all PERM stages",
                  color: "var(--stage-pwd)",
                },
                {
                  icon: <MousePointerClick className="h-5 w-5" />,
                  title: "Edit & Add",
                  desc: "Change dates and see deadlines auto-calculate",
                  color: "var(--stage-recruitment)",
                },
                {
                  icon: <CalendarDays className="h-5 w-5" />,
                  title: "Calendar View",
                  desc: "See deadlines on this month's calendar",
                  color: "var(--stage-eta9089)",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="border-3 border-border bg-background p-4 text-center shadow-hard-sm"
                  style={{ borderTopWidth: "4px", borderTopColor: item.color }}
                >
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center text-foreground">
                    {item.icon}
                  </div>
                  <h3 className="font-heading text-sm font-bold">{item.title}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </ScrollReveal>

          {/* Scroll prompt */}
          <ScrollReveal direction="up" delay={0.2}>
            <div className="mt-10 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              <ArrowDown className="h-4 w-4 animate-bounce" />
              <span>Scroll to explore the demo</span>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ================================================================ */}
      {/* PRODUCT SCREENSHOTS */}
      {/* ================================================================ */}
      <section className="border-b-3 border-border bg-foreground py-12 sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <ScrollReveal direction="up">
            <p className="mb-8 text-center font-mono text-xs uppercase tracking-widest text-background/60">
              From the real product
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  src: "/images/screenshots/dashboard.png",
                  alt: "Dashboard with deadline hub showing overdue and upcoming deadlines",
                  label: "Deadline Hub",
                },
                {
                  src: "/images/screenshots/cases.png",
                  alt: "Case cards with filters, status badges, and progress indicators",
                  label: "Case Management",
                },
                {
                  src: "/images/screenshots/calendar.png",
                  alt: "Calendar with color-coded deadlines and AI chat assistant",
                  label: "Calendar + AI Chat",
                },
              ].map((screenshot) => (
                <div key={screenshot.label} className="group">
                  <div className="overflow-hidden border-3 border-background/20 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex items-center gap-1.5 bg-background/10 px-3 py-1.5">
                      <div className="h-2 w-2 bg-[#FF5F57]" />
                      <div className="h-2 w-2 bg-[#FFBD2E]" />
                      <div className="h-2 w-2 bg-[#28CA41]" />
                      <span className="ml-2 font-mono text-[9px] text-background/40">
                        {screenshot.label}
                      </span>
                    </div>
                    <Image
                      src={screenshot.src}
                      alt={screenshot.alt}
                      width={600}
                      height={400}
                      className="w-full"
                      sizes="(max-width: 768px) 100vw, 33vw"
                    />
                  </div>
                  <p className="mt-3 text-center font-mono text-xs uppercase tracking-widest text-background/50">
                    {screenshot.label}
                  </p>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* ================================================================ */}
      {/* INTERACTIVE DEMO */}
      {/* ================================================================ */}
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* Section 1: Stats */}
        {isInitialized && (
          <section className="mb-12" aria-labelledby="stats-heading">
            <ScrollReveal direction="up">
              <SectionLabel
                number="1"
                title="Deadline Hub"
                description="See your caseload summary instantly — total cases, active deadlines, due this week, and overdue items."
                icon={<Zap className="h-4 w-4" />}
                accentColor="var(--primary)"
              />
            </ScrollReveal>
            <h2 id="stats-heading" className="sr-only">Case Statistics</h2>
            <StatsGrid cases={cases} />
            {/* Inline tip */}
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
            <ScrollReveal direction="up">
              <SectionLabel
                number="2"
                title="Calendar & Progress"
                description="Color-coded deadline dots on the calendar. Progress bars show how far each case has advanced through the PERM process."
                icon={<CalendarDays className="h-4 w-4" />}
                accentColor="var(--stage-pwd)"
              />
            </ScrollReveal>
            <h2 id="preview-heading" className="sr-only">Overview</h2>
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
            <ScrollReveal direction="up">
              <SectionLabel
                number="3"
                title="Your Cases"
                description="Each card shows the beneficiary, employer, PERM stage, next deadline with urgency color, and progress status. Click Edit to change dates and see auto-cascade in action."
                icon={<LayoutGrid className="h-4 w-4" />}
                accentColor="var(--stage-recruitment)"
              />
            </ScrollReveal>
            <h2 id="cases-heading" className="sr-only">Cases</h2>
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
    </div>
  );
}
