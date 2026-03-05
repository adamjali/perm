"use client";

import { use, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { motion } from "motion/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
  ArrowLeft,
  MoreVertical,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
  CalendarPlus,
  CalendarMinus,
  CalendarCheck,
  CalendarX,
  AlertTriangle,
  Star,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CaseStageBadge } from "@/components/status/case-stage-badge";
import { ProgressStatusBadge } from "@/components/status/progress-status-badge";
import { PWDSection } from "@/components/cases/detail/PWDSection";
import { RecruitmentSection } from "@/components/cases/detail/RecruitmentSection";
import { RecruitmentResultsSection } from "@/components/cases/detail/RecruitmentResultsSection";
import { ETA9089Section } from "@/components/cases/detail/ETA9089Section";
import { I140Section } from "@/components/cases/detail/I140Section";
import { RFIRFESection } from "@/components/cases/detail/RFIRFESection";
import { JobDescriptionDetailView } from "@/components/job-description";
import { InlineCaseTimeline } from "@/components/cases/detail/InlineCaseTimeline";
import { WindowsDisplay } from "@/components/cases/detail/WindowsDisplay";
import { NextUpSection } from "@/components/cases/detail/NextUpSection";
import { StageProgressIndicator } from "@/components/cases/detail/next-up-section.components";
import { getStageIndex } from "@/components/cases/detail/next-up-section.utils";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useDerivedDates } from "@/hooks/useDerivedDates";
import { useJobDescriptionTemplates } from "@/hooks/useJobDescriptionTemplates";
import { usePageContextUpdater } from "@/lib/ai/page-context";
import { useIsMobile } from "@/lib/animations";
import { isRecruitmentComplete, type ProgressStatus } from "@/lib/perm";

// ============================================================================
// ANIMATION VARIANTS
// ============================================================================

/**
 * Container animation variants for staggered children entry
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
} as const;

/**
 * Item animation variants for individual sections
 */
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring" as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

/**
 * Header animation variants - slide in from left
 */
const headerVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 28,
    },
  },
};

// ============================================================================
// STAGE COLORS
// ============================================================================

const STAGE_ACCENT_COLORS: Record<string, string> = {
  pwd: "var(--stage-pwd)",
  recruitment: "var(--stage-recruitment)",
  eta9089: "var(--stage-eta9089)",
  i140: "var(--stage-i140)",
  closed: "var(--stage-closed)",
};

// ============================================================================
// TYPES
// ============================================================================

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

function CaseDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton variant="block" className="w-10 h-10" />
          <div>
            <Skeleton variant="line" className="w-64 h-7 mb-2" />
            <Skeleton variant="line" className="w-40 h-5" />
          </div>
        </div>
        <Skeleton variant="block" className="w-10 h-10" />
      </div>

      {/* Status Bar Skeleton */}
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton variant="line" className="w-20 h-6" />
        <Skeleton variant="line" className="w-28 h-6" />
        <Skeleton variant="line" className="w-48 h-5" />
      </div>

      {/* Timeline Skeleton */}
      <Skeleton variant="block" className="h-32" />

      {/* Sections Grid Skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton variant="block" className="h-48" />
        <Skeleton variant="block" className="h-40" />
        <Skeleton variant="block" className="h-56" />
        <Skeleton variant="block" className="h-48" />
        <Skeleton variant="block" className="h-40" />
        <Skeleton variant="block" className="h-48" />
      </div>
    </div>
  );
}

// ============================================================================
// NOT FOUND STATE
// ============================================================================

function NotFoundState() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
      <div className="text-center space-y-2">
        <h2 className="font-heading text-2xl font-bold">Case Not Found</h2>
        <p className="text-muted-foreground">
          The case you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
      </div>
      <Button onClick={() => router.push("/cases")} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Cases
      </Button>
    </div>
  );
}

// ============================================================================
// DELETE CONFIRMATION DIALOG
// ============================================================================

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isLoading: boolean;
  caseName: string;
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  caseName,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Case</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{caseName}&quot;? This action cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Deleting..." : "Delete Case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// MAIN CASE DETAIL COMPONENT
// ============================================================================

interface CaseDetailProps {
  caseId: Id<"cases">;
  caseData: NonNullable<ReturnType<typeof useQuery<typeof api.cases.get>>>;
}

function CaseDetail({ caseId, caseData }: CaseDetailProps) {
  const router = useRouter();
  const { isNavigating, isAnyNavigating, targetPath, navigateTo } = useNavigationLoading();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // On mobile (<768px), only first section is open by default
  const isMobile = useIsMobile();

  // Get user profile to check Google Calendar connection status
  const userProfile = useQuery(api.users.currentUserProfile);
  const isGoogleConnected = userProfile?.googleCalendarConnected ?? false;

  // Mutations
  const removeMutation = useMutation(api.cases.remove);
  const updateMutation = useMutation(api.cases.update);
  const reopenCaseMutation = useMutation(api.cases.reopenCase);
  const toggleFavoriteMutation = useMutation(api.cases.toggleFavorite);
  const toggleCalendarSyncMutation = useMutation(api.cases.toggleCalendarSync);
  const addToTimelineMutation = useMutation(api.timeline.addCaseToTimeline);
  const removeFromTimelineMutation = useMutation(api.timeline.removeCaseFromTimeline);
  const clearJobDescriptionMutation = useMutation(api.cases.clearJobDescription);

  // Job description templates
  const {
    templates: jobDescTemplates,
    loadTemplate: loadJobDescTemplate,
    hardDeleteTemplate: hardDeleteJobDescTemplate,
    updateTemplate: updateJobDescTemplate,
    saveAsNewTemplate: saveJobDescAsNewTemplate,
  } = useJobDescriptionTemplates();

  // Toggle loading states
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);
  const [isTogglingCalendarSync, setIsTogglingCalendarSync] = useState(false);

  // Check if case is on timeline
  const timelinePrefs = useQuery(api.timeline.getPreferences);
  const isOnTimeline = useMemo(() => {
    if (!timelinePrefs) return true; // Default to true while loading
    if (timelinePrefs.selectedCaseIds === null || timelinePrefs.selectedCaseIds === undefined) {
      // null/undefined means all active cases are on timeline
      return caseData.caseStatus !== "closed";
    }
    return timelinePrefs.selectedCaseIds.includes(caseId);
  }, [timelinePrefs, caseId, caseData.caseStatus]);

  // Get derived dates with fallback calculation (fixes filing window showing "-")
  const derivedDates = useDerivedDates(caseData);

  // Update page context for chat AI awareness
  const { setPageData } = usePageContextUpdater();
  useEffect(() => {
    setPageData({
      currentCaseId: caseId,
      currentCaseData: {
        employerName: caseData.employerName,
        beneficiaryIdentifier: caseData.beneficiaryIdentifier,
        caseStatus: caseData.caseStatus,
        progressStatus: caseData.progressStatus,
      },
    });
  }, [caseId, caseData, setPageData]);

  // Calculate next deadline for status bar
  const nextDeadline = useMemo(() => {
    const today = new Date().toISOString().split("T")[0] as string;
    const deadlines: Array<{ label: string; date: string; daysUntil: number }> = [];

    // PWD Expiration
    if (caseData.pwdExpirationDate && !caseData.eta9089FilingDate) {
      const daysUntil = Math.floor(
        (new Date(caseData.pwdExpirationDate).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      deadlines.push({
        label: "PWD Expires",
        date: caseData.pwdExpirationDate,
        daysUntil,
      });
    }

    // ETA 9089 Expiration / I-140 Filing Deadline
    if (
      caseData.eta9089ExpirationDate &&
      caseData.eta9089CertificationDate &&
      !caseData.i140FilingDate
    ) {
      const daysUntil = Math.floor(
        (new Date(caseData.eta9089ExpirationDate).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      deadlines.push({
        label: "I-140 Filing Deadline",
        date: caseData.eta9089ExpirationDate,
        daysUntil,
      });
    }

    // Active RFI
    const activeRfi = (caseData.rfiEntries ?? []).find(
      (e) => e.receivedDate && !e.responseSubmittedDate
    );
    if (activeRfi?.responseDueDate) {
      const daysUntil = Math.floor(
        (new Date(activeRfi.responseDueDate).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      deadlines.push({
        label: "RFI Response Due",
        date: activeRfi.responseDueDate,
        daysUntil,
      });
    }

    // Active RFE
    const activeRfe = (caseData.rfeEntries ?? []).find(
      (e) => e.receivedDate && !e.responseSubmittedDate
    );
    if (activeRfe?.responseDueDate) {
      const daysUntil = Math.floor(
        (new Date(activeRfe.responseDueDate).getTime() - new Date(today).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      deadlines.push({
        label: "RFE Response Due",
        date: activeRfe.responseDueDate,
        daysUntil,
      });
    }

    // Return earliest deadline
    if (deadlines.length === 0) return null;
    return deadlines.sort((a, b) => a.daysUntil - b.daysUntil)[0];
  }, [caseData]);

  // Handlers
  const editPath = `/cases/${caseId}/edit`;
  const isEditNavigating = isNavigating && targetPath === editPath;

  const handleEdit = () => {
    navigateTo(editPath);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await removeMutation({ id: caseId });
      router.push("/cases");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to delete case. Please try again.",
      });
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    setIsUpdating(true);
    try {
      await updateMutation({ id: caseId, caseStatus: "closed" });
      toast.success("Case archived successfully");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to archive case. Please try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReopen = async () => {
    setIsUpdating(true);
    try {
      const result = await reopenCaseMutation({ id: caseId });
      // Format status for display (e.g., "eta9089" -> "ETA 9089", "i140" -> "I-140")
      const formatStatus = (status: string) => {
        if (status === "eta9089") return "ETA 9089";
        if (status === "i140") return "I-140";
        if (status === "pwd") return "PWD";
        return status.charAt(0).toUpperCase() + status.slice(1);
      };
      toast.success(`Case reopened as ${formatStatus(result.newCaseStatus)} - ${result.newProgressStatus.replace(/_/g, " ")}`);
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to reopen case. Please try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleTimeline = async () => {
    setIsUpdating(true);
    try {
      if (isOnTimeline) {
        await removeFromTimelineMutation({ caseId });
        toast.success("Case removed from timeline");
      } else {
        await addToTimelineMutation({ caseId });
        toast.success("Case added to timeline");
      }
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to update timeline. Please try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (isTogglingFavorite) return;
    setIsTogglingFavorite(true);
    try {
      await toggleFavoriteMutation({ id: caseId });
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to update favorite status. Please try again.",
      });
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleToggleCalendarSync = async () => {
    if (isTogglingCalendarSync) return;

    // Check if Google Calendar is connected before enabling sync
    if (!caseData.calendarSyncEnabled && !isGoogleConnected) {
      toast.error("Connect Google Calendar first", {
        description: "Go to Settings to connect your Google Calendar account.",
        action: {
          label: "Go to Settings",
          onClick: () => router.push("/settings?tab=calendar-sync"),
        },
      });
      return;
    }

    setIsTogglingCalendarSync(true);
    try {
      await toggleCalendarSyncMutation({ id: caseId });
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to update calendar sync. Please try again.",
      });
    } finally {
      setIsTogglingCalendarSync(false);
    }
  };

  const isClosed = caseData.caseStatus === "closed";
  const caseName = `${caseData.employerName} - ${caseData.positionTitle}`;
  const stageColor = STAGE_ACCENT_COLORS[caseData.caseStatus] ?? "var(--stage-closed)";
  const isProfessionalOccupation = caseData.isProfessionalOccupation;
  const isSample = caseData.isSample;
  const currentStage = getStageIndex(caseData.caseStatus);

  return (
    <motion.div
      variants={containerVariants}
      initial={false}
      animate="visible"
      className="space-y-6"
    >
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        caseName={caseName}
      />

      {/* ================================================================ */}
      {/* CASE HERO HEADER — stage accent, title, badges, stage progress  */}
      {/* ================================================================ */}
      <motion.div
        variants={headerVariants}
        className="border-2 border-border bg-card shadow-hard overflow-hidden"
      >
        {/* Stage accent strip */}
        <div className="h-1" style={{ backgroundColor: stageColor }} />

        <div className="p-4 sm:p-6 space-y-4">
          {/* Row 1: Back + Title + Actions */}
          <div className="flex items-start justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateTo("/cases")}
                className={cn(
                  "shrink-0 border-2 border-border",
                  "hover:bg-muted hover:-translate-y-0.5 hover:shadow-hard transition-all",
                  "min-h-[44px] min-w-[44px]",
                  isNavigating && "opacity-70 pointer-events-none"
                )}
                disabled={isAnyNavigating}
              >
                {isNavigating ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <ArrowLeft className="h-5 w-5" />
                )}
                <span className="sr-only">Back to cases</span>
              </Button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h1 className="font-heading text-xl sm:text-2xl font-bold leading-tight truncate">
                    {caseData.employerName}
                  </h1>
                  {isSample && (
                    <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-[0.625rem] font-bold tracking-wider uppercase border-2 border-dashed border-muted-foreground/40 text-muted-foreground bg-muted">
                      SAMPLE
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm sm:text-base truncate">
                  {caseData.positionTitle}
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleFavorite}
                disabled={isTogglingFavorite}
                className={cn(
                  "shrink-0 border-2 transition-all cursor-pointer",
                  "min-h-[44px] min-w-[44px]",
                  caseData.isFavorite
                    ? "border-yellow-500 bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-900/20 dark:hover:bg-yellow-900/30"
                    : "border-border hover:bg-muted hover:-translate-y-0.5 hover:shadow-hard"
                )}
                aria-label={caseData.isFavorite ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={caseData.isFavorite}
              >
                {isTogglingFavorite ? (
                  <Loader2 className="h-5 w-5 animate-spin text-yellow-600" />
                ) : (
                  <Star
                    className={cn(
                      "h-5 w-5",
                      caseData.isFavorite
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-muted-foreground"
                    )}
                  />
                )}
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleCalendarSync}
                disabled={isTogglingCalendarSync}
                className={cn(
                  "shrink-0 border-2 transition-all cursor-pointer",
                  "min-h-[44px] min-w-[44px]",
                  caseData.calendarSyncEnabled && isGoogleConnected
                    ? "border-[#228B22] bg-[#228B22]/10 hover:bg-[#228B22]/20 dark:bg-[#228B22]/20 dark:hover:bg-[#228B22]/30"
                    : caseData.calendarSyncEnabled && !isGoogleConnected
                      ? "border-amber-500 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/30"
                      : "border-border hover:bg-muted hover:-translate-y-0.5 hover:shadow-hard"
                )}
                title={
                  caseData.calendarSyncEnabled && isGoogleConnected
                    ? "Calendar sync enabled"
                    : caseData.calendarSyncEnabled && !isGoogleConnected
                      ? "Calendar not connected - click to go to settings"
                      : "Calendar sync disabled"
                }
                aria-label={caseData.calendarSyncEnabled ? "Disable calendar sync" : "Enable calendar sync"}
                aria-pressed={caseData.calendarSyncEnabled}
              >
                {isTogglingCalendarSync ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[#228B22]" />
                ) : caseData.calendarSyncEnabled && isGoogleConnected ? (
                  <CalendarCheck className="h-5 w-5 fill-[#228B22] text-[#228B22]" />
                ) : caseData.calendarSyncEnabled && !isGoogleConnected ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CalendarX className="h-5 w-5 text-muted-foreground" />
                )}
              </Button>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "shrink-0 border-2 border-border",
                      "hover:bg-muted hover:-translate-y-0.5 hover:shadow-hard transition-all",
                      "min-h-[44px] min-w-[44px]"
                    )}
                    disabled={isUpdating || isAnyNavigating}
                  >
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 will-change-transform" onCloseAutoFocus={(e) => e.preventDefault()}>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      handleEdit();
                    }}
                    disabled={isAnyNavigating}
                    className="min-h-[44px]"
                  >
                    {isEditNavigating ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pencil className="h-4 w-4" />
                    )}
                    Edit Case
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleToggleTimeline} disabled={isUpdating} className="min-h-[44px]">
                    {isOnTimeline ? (
                      <>
                        <CalendarMinus className="h-4 w-4" />
                        Remove from Timeline
                      </>
                    ) : (
                      <>
                        <CalendarPlus className="h-4 w-4" />
                        Add to Timeline
                      </>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isClosed ? (
                    <DropdownMenuItem onClick={handleReopen} disabled={isUpdating} className="min-h-[44px]">
                      <RotateCcw className="h-4 w-4" />
                      Reopen Case
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handleArchive} disabled={isUpdating} className="min-h-[44px]">
                      <Archive className="h-4 w-4" />
                      Archive Case
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="min-h-[44px]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Case
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: Case identifiers + Status badges + Deadline */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {caseData.caseNumber && (
              <span className="font-mono text-xs sm:text-sm text-muted-foreground border border-border px-2 py-0.5">
                {caseData.caseNumber}
              </span>
            )}
            {caseData.beneficiaryIdentifier && (
              <span className="text-xs sm:text-sm text-muted-foreground">
                Worker: <span className="font-medium text-foreground">{caseData.beneficiaryIdentifier}</span>
              </span>
            )}
            <CaseStageBadge stage={caseData.caseStatus} bordered />
            <ProgressStatusBadge status={caseData.progressStatus as ProgressStatus} />
            {isProfessionalOccupation && (
              <span className="inline-flex items-center border border-border bg-muted px-2.5 py-0.5 text-xs font-medium">
                Professional
              </span>
            )}
            {nextDeadline && (
              <span
                className={cn(
                  "text-xs sm:text-sm ml-auto",
                  nextDeadline.daysUntil <= 7
                    ? "text-red-600 font-semibold"
                    : nextDeadline.daysUntil <= 30
                      ? "text-orange-600 font-medium"
                      : "text-muted-foreground"
                )}
              >
                {nextDeadline.label}:{" "}
                {nextDeadline.daysUntil < 0
                  ? `${Math.abs(nextDeadline.daysUntil)}d overdue`
                  : nextDeadline.daysUntil === 0
                    ? "Today"
                    : `${nextDeadline.daysUntil}d`}
              </span>
            )}
          </div>

          {/* Row 3: Stage Progress Indicator */}
          {!isClosed && (
            <div className="pt-3 border-t border-border/50">
              <StageProgressIndicator currentStage={currentStage} />
            </div>
          )}
        </div>
      </motion.div>

      {/* ================================================================ */}
      {/* NEXT UP — action + deadline (stage progress hidden here now)    */}
      {/* ================================================================ */}
      <motion.div variants={itemVariants}>
        <NextUpSection
          caseId={caseId}
          showStageProgress={false}
          caseData={{
            caseStatus: caseData.caseStatus,
            progressStatus: caseData.progressStatus as ProgressStatus,
            pwdFilingDate: caseData.pwdFilingDate,
            pwdDeterminationDate: caseData.pwdDeterminationDate,
            pwdExpirationDate: caseData.pwdExpirationDate,
            jobOrderStartDate: caseData.jobOrderStartDate,
            jobOrderEndDate: caseData.jobOrderEndDate,
            sundayAdFirstDate: caseData.sundayAdFirstDate,
            sundayAdSecondDate: caseData.sundayAdSecondDate,
            noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
            noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
            eta9089FilingDate: caseData.eta9089FilingDate,
            eta9089CertificationDate: caseData.eta9089CertificationDate,
            eta9089ExpirationDate: caseData.eta9089ExpirationDate,
            i140FilingDate: caseData.i140FilingDate,
            i140ApprovalDate: caseData.i140ApprovalDate,
            i140DenialDate: caseData.i140DenialDate,
            rfiEntries: caseData.rfiEntries,
            rfeEntries: caseData.rfeEntries,
            isProfessionalOccupation,
            additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
          }}
        />
      </motion.div>

      {/* Recruitment & Filing Windows */}
      <motion.div variants={itemVariants}>
        <WindowsDisplay caseData={caseData} />
      </motion.div>

      {/* ================================================================ */}
      {/* CASE TIMELINE — moved up for at-a-glance visibility              */}
      {/* ================================================================ */}
      <motion.div
        variants={itemVariants}
        className="border-2 border-border bg-card p-3 sm:p-4 shadow-hard-sm hover:shadow-hard hover:-translate-y-0.5 transition-all duration-150 overflow-visible"
      >
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="font-heading font-semibold text-base sm:text-lg">Case Timeline</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleTimeline}
            disabled={isUpdating}
            className="gap-2 min-h-[36px] sm:min-h-[40px]"
          >
            {isOnTimeline ? (
              <>
                <CalendarMinus className="h-4 w-4" />
                <span className="hidden sm:inline">Remove from Timeline</span>
              </>
            ) : (
              <>
                <CalendarPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Add to Timeline</span>
              </>
            )}
          </Button>
        </div>
        <div className="relative overflow-visible">
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card to-transparent pointer-events-none z-10 sm:hidden" aria-hidden="true" />
          <div className="overflow-x-auto overscroll-x-none overflow-y-visible -mx-3 px-3 sm:mx-0 sm:px-0 scroll-smooth touch-pan-x">
            <InlineCaseTimeline caseData={caseData} className="min-w-[500px] sm:min-w-0" />
          </div>
        </div>
      </motion.div>

      {/* ================================================================ */}
      {/* DETAIL SECTIONS — with stage accent on active section            */}
      {/* ================================================================ */}
      <motion.div
        variants={itemVariants}
        className="grid gap-4 sm:gap-6 lg:grid-cols-2"
      >
        {/* PWD Section */}
        <PWDSection
          data={{
            pwdFilingDate: caseData.pwdFilingDate,
            pwdDeterminationDate: caseData.pwdDeterminationDate,
            pwdExpirationDate: caseData.pwdExpirationDate,
            pwdCaseNumber: caseData.pwdCaseNumber,
            pwdWageAmount:
              caseData.pwdWageAmount !== undefined
                ? Number(caseData.pwdWageAmount)
                : undefined,
            pwdWageLevel: caseData.pwdWageLevel,
          }}
          defaultOpen={!isMobile}
          accentColor={caseData.caseStatus === "pwd" ? stageColor : undefined}
        />

        {/* ETA 9089 Section */}
        <ETA9089Section
          data={{
            eta9089FilingDate: caseData.eta9089FilingDate,
            eta9089AuditDate: caseData.eta9089AuditDate,
            eta9089CertificationDate: caseData.eta9089CertificationDate,
            eta9089ExpirationDate: caseData.eta9089ExpirationDate,
            eta9089CaseNumber: caseData.eta9089CaseNumber,
          }}
          filingWindowOpensDate={derivedDates.filingWindowOpens}
          filingWindowClosesDate={derivedDates.filingWindowCloses}
          isRecruitmentComplete={isRecruitmentComplete(caseData)}
          defaultOpen={!isMobile}
          accentColor={caseData.caseStatus === "eta9089" ? stageColor : undefined}
        />

        {/* Recruitment Section - Full Width */}
        <div className="lg:col-span-2">
          <RecruitmentSection
            data={{
              jobOrderStartDate: caseData.jobOrderStartDate,
              jobOrderEndDate: caseData.jobOrderEndDate,
              jobOrderState: caseData.jobOrderState,
              sundayAdFirstDate: caseData.sundayAdFirstDate,
              sundayAdSecondDate: caseData.sundayAdSecondDate,
              sundayAdNewspaper: caseData.sundayAdNewspaper,
              noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
              noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
              additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
              recruitmentApplicantsCount:
                caseData.recruitmentApplicantsCount !== undefined
                  ? Number(caseData.recruitmentApplicantsCount)
                  : undefined,
              recruitmentNotes: caseData.recruitmentNotes,
            }}
            defaultOpen={!isMobile}
            accentColor={caseData.caseStatus === "recruitment" ? stageColor : undefined}
          />
        </div>

        {/* Recruitment Results Section - Full Width */}
        <div className="lg:col-span-2">
          <RecruitmentResultsSection
            data={{
              employerName: caseData.employerName,
              noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
              noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
              jobOrderStartDate: caseData.jobOrderStartDate,
              jobOrderEndDate: caseData.jobOrderEndDate,
              jobOrderState: caseData.jobOrderState,
              sundayAdFirstDate: caseData.sundayAdFirstDate,
              sundayAdSecondDate: caseData.sundayAdSecondDate,
              sundayAdNewspaper: caseData.sundayAdNewspaper,
              additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
              additionalRecruitmentStartDate: caseData.additionalRecruitmentStartDate,
              additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate,
              isProfessionalOccupation,
              pwdExpirationDate: caseData.pwdExpirationDate,
              recruitmentApplicantsCount:
                caseData.recruitmentApplicantsCount !== undefined
                  ? Number(caseData.recruitmentApplicantsCount)
                  : undefined,
              recruitmentNotes: caseData.recruitmentNotes,
              recruitmentSummaryCustom: caseData.recruitmentSummaryCustom,
            }}
            defaultOpen={!isMobile}
            readOnly={true}
            accentColor={caseData.caseStatus === "recruitment" ? stageColor : undefined}
          />
        </div>

        {/* I-140 Section */}
        <I140Section
          data={{
            i140FilingDate: caseData.i140FilingDate,
            i140ReceiptDate: caseData.i140ReceiptDate,
            i140ReceiptNumber: caseData.i140ReceiptNumber,
            i140ApprovalDate: caseData.i140ApprovalDate,
            i140DenialDate: caseData.i140DenialDate,
            i140Category: caseData.i140Category,
            i140PremiumProcessing: caseData.i140PremiumProcessing,
            i140ServiceCenter: caseData.i140ServiceCenter,
          }}
          eta9089CertificationDate={caseData.eta9089CertificationDate}
          eta9089ExpirationDate={caseData.eta9089ExpirationDate}
          defaultOpen={!isMobile}
          accentColor={caseData.caseStatus === "i140" ? stageColor : undefined}
        />

        {/* RFI/RFE Section */}
        <RFIRFESection
          rfiEntries={caseData.rfiEntries}
          rfeEntries={caseData.rfeEntries}
          defaultOpen={!isMobile}
        />

        {/* Job Description Section - Full Width */}
        {(caseData.jobDescription || caseData.jobDescriptionPositionTitle) && (
          <div className="lg:col-span-2">
            <JobDescriptionDetailView
              positionTitle={caseData.jobDescriptionPositionTitle}
              description={caseData.jobDescription}
              onClear={async () => {
                await clearJobDescriptionMutation({ id: caseId });
              }}
              onUpdate={async (positionTitle, description, templateId) => {
                await updateMutation({
                  id: caseId,
                  jobDescriptionPositionTitle: positionTitle,
                  jobDescription: description,
                  jobDescriptionTemplateId: templateId as Id<"jobDescriptionTemplates"> | undefined,
                });
              }}
              templates={jobDescTemplates.map((t) => ({
                _id: t._id,
                name: t.name,
                description: t.description,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                usageCount: t.usageCount,
              }))}
              onLoadTemplate={async (template) => {
                await loadJobDescTemplate({
                  _id: template._id as Id<"jobDescriptionTemplates">,
                  name: template.name,
                  description: template.description,
                  createdAt: template.createdAt,
                  updatedAt: template.updatedAt,
                  usageCount: template.usageCount,
                });
              }}
              onDeleteTemplate={(id) => hardDeleteJobDescTemplate(id as Id<"jobDescriptionTemplates">)}
              onUpdateTemplate={(id, name, desc) => updateJobDescTemplate(id as Id<"jobDescriptionTemplates">, name, desc)}
              onSaveAsNewTemplate={saveJobDescAsNewTemplate}
              defaultOpen={!isMobile}
            />
          </div>
        )}
      </motion.div>

      {/* Edit Case */}
      <motion.div variants={itemVariants} className="pt-4 flex justify-center">
        <Button
          onClick={handleEdit}
          disabled={isAnyNavigating}
          size="lg"
        >
          {isEditNavigating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pencil className="h-4 w-4" />
          )}
          Edit Case
        </Button>
      </motion.div>

      {/* Footer Metadata */}
      <motion.div
        variants={itemVariants}
        className="text-xs text-muted-foreground border-t border-border pt-4 flex flex-wrap gap-4 font-mono"
      >
        <span>
          Created:{" "}
          {new Date(caseData.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
        <span>
          Updated:{" "}
          {new Date(caseData.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export function CaseDetailPageClient({ params }: CaseDetailPageProps) {
  // React 19 pattern for async params
  const resolvedParams = use(params);
  const caseId = resolvedParams.id as Id<"cases">;

  // Fetch case data
  const caseData = useQuery(api.cases.get, { id: caseId });

  // Loading state
  if (caseData === undefined) {
    return <CaseDetailSkeleton />;
  }

  // Not found state
  if (caseData === null) {
    return <NotFoundState />;
  }

  // Main content
  return <CaseDetail caseId={caseId} caseData={caseData} />;
}
