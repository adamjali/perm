"use client";

import { use, useState, useEffect, useMemo, useCallback } from "react";
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
  CalendarCheck,
  CalendarX,
  AlertTriangle,
  Bookmark,
  Loader2,
  Check,
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
import { getStageIndex } from "@/components/cases/detail/next-up-section.utils";
import {
  CaseDetailTabs,
  TabPanel,
  type TabId,
} from "@/components/cases/detail/CaseDetailTabs";
import { OverviewTab } from "@/components/cases/detail/OverviewTab";
import { RecruitmentTab } from "@/components/cases/detail/RecruitmentTab";
import { ETA9089Tab } from "@/components/cases/detail/ETA9089Tab";
import { I140Tab } from "@/components/cases/detail/I140Tab";
import { DocumentsTab } from "@/components/cases/detail/DocumentsTab";
import { NotesTab } from "@/components/cases/detail/NotesTab";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
import { validateDocumentFile } from "@/lib/documents/validation";
import type { DocumentCategory } from "@/lib/documents";
import { useNavigationLoading } from "@/hooks/useNavigationLoading";
import { useDerivedDates } from "@/hooks/useDerivedDates";
import { usePageContextUpdater } from "@/lib/ai/page-context";
import { useIsMobile } from "@/lib/animations";
import { isRecruitmentComplete } from "@/lib/perm";
import { useJobDescriptionTemplates } from "@/hooks/useJobDescriptionTemplates";
import type { CaseDetailData } from "@/components/cases/detail/case-detail-types";
import { itemVariants, STAGE_ACCENT_COLORS } from "@/components/cases/detail/case-detail-utils";

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
      {/* Hero Header Skeleton */}
      <div className="bg-card border-b-[3px] border-border overflow-hidden -mt-6" style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
        <div className="h-1 bg-muted" />
        <div className="p-3 sm:px-8 sm:py-3.5 space-y-2.5">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2">
            <Skeleton variant="block" className="w-9 h-9" />
            <Skeleton variant="line" className="w-24 h-4" />
          </div>
          {/* Title + Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <Skeleton variant="line" className="w-64 h-7 mb-1.5" />
              <Skeleton variant="line" className="w-40 h-5" />
            </div>
            <div className="flex items-center gap-1.5">
              <Skeleton variant="block" className="w-[38px] h-[38px]" />
              <Skeleton variant="block" className="w-[38px] h-[38px]" />
              <Skeleton variant="block" className="w-24 h-[38px]" />
              <Skeleton variant="block" className="w-[38px] h-[38px]" />
            </div>
          </div>
          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton variant="line" className="w-24 h-6" />
            <Skeleton variant="line" className="w-20 h-6" />
            <Skeleton variant="line" className="w-28 h-6" />
          </div>
        </div>
        {/* Stage Bar */}
        <div className="flex border-t-[3px] border-black">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 py-2.5 px-2 border-r-[3px] border-black last:border-r-0">
              <Skeleton variant="line" className="w-full h-4 mx-auto max-w-[80px]" />
            </div>
          ))}
        </div>
      </div>

      {/* Tab Bar Skeleton */}
      <div className="folder-tab-bar">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="folder-tab" style={{ pointerEvents: "none" }}>
            <Skeleton variant="line" className="w-4 h-4" />
            <Skeleton variant="line" className="w-16 h-3.5 hidden sm:block" />
          </div>
        ))}
      </div>

      {/* Content Skeleton — manila folder body */}
      <div className="folder-body">
        <div className="folder-content space-y-6">
          {/* Next Up */}
          <Skeleton variant="block" className="h-20" />
          {/* 2-col layout */}
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            {/* Timeline sidebar */}
            <div className="space-y-4">
              <Skeleton variant="block" className="h-8" />
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton variant="block" className="w-8 h-8 shrink-0" />
                  <div className="flex-1">
                    <Skeleton variant="line" className="w-24 h-3.5 mb-1" />
                    <Skeleton variant="line" className="w-20 h-3" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-6">
              {/* PWD + Quick Stats */}
              <div className="grid gap-6 md:grid-cols-[1.8fr_1fr]">
                <Skeleton variant="block" className="h-48" />
                <Skeleton variant="block" className="h-48" />
              </div>
              {/* Job Desc */}
              <Skeleton variant="block" className="h-40" />
            </div>
          </div>
          {/* Gantt */}
          <Skeleton variant="block" className="h-32" />
        </div>
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
  caseData: CaseDetailData;
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

  // Gate filing window: only show when recruitment is actually complete (or ETA already filed)
  const recruitDone = isRecruitmentComplete(caseData);
  const etaFiled = !!caseData.eta9089FilingDate;
  const gatedFilingWindowOpens = (recruitDone || etaFiled) ? derivedDates.filingWindowOpens : undefined;
  const gatedFilingWindowCloses = (recruitDone || etaFiled) ? derivedDates.filingWindowCloses : undefined;

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

  // Handlers
  const editPath = `/cases/${caseId}/edit`;
  const isEditNavigating = isNavigating && targetPath === editPath;

  const handleEdit = () => {
    navigateTo(editPath);
  };

  const handleUpdateNotes = useCallback(async (updatedNotes: import("@/lib/forms/case-form-schema").NoteEntry[]) => {
    try {
      await updateMutation({ id: caseId, notes: updatedNotes });
    } catch (error) {
      handleOperationError(error, { userMessage: "Failed to save note changes. Please try again." });
    }
  }, [updateMutation, caseId]);

  // Document mutations
  const generateUploadUrlMutation = useMutation(api.documents.generateUploadUrl);
  const saveDocumentMutation = useMutation(api.documents.saveDocument);
  const removeDocumentMutation = useMutation(api.documents.removeDocument);

  const handleUploadDocument = useCallback(async (file: File, category?: DocumentCategory) => {
    // Client-side validation
    const validation = await validateDocumentFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    try {
      // 1. Get upload URL (server validates too)
      const uploadUrl = await generateUploadUrlMutation({
        caseId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
      });

      // 2. Upload file directly to Convex storage
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const json = (await response.json()) as { storageId?: string };
      if (!json.storageId) throw new Error("Missing storageId in upload response");
      const storageId = json.storageId;

      // 3. Save document metadata
      await saveDocumentMutation({
        caseId,
        storageId,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        fileSize: file.size,
        category,
      });

      toast.success("Document uploaded");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to upload document. Please try again.",
      });
    }
  }, [generateUploadUrlMutation, saveDocumentMutation, caseId]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    try {
      await removeDocumentMutation({ caseId, documentId });
      toast.success("Document deleted");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to delete document. Please try again.",
      });
    }
  }, [removeDocumentMutation, caseId]);

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

  // Job description templates
  const {
    templates: jobDescTemplates,
    loadTemplate: loadJobDescTemplate,
    hardDeleteTemplate: hardDeleteJobDescTemplate,
    updateTemplate: updateJobDescTemplate,
    saveAsNewTemplate: saveAsNewJobDescTemplate,
  } = useJobDescriptionTemplates();

  const handleJobDescSave = async (positionTitle: string, description: string, templateId?: string) => {
    try {
      await updateMutation({
        id: caseId,
        jobDescriptionPositionTitle: positionTitle,
        jobDescription: description,
        ...(templateId ? { jobDescriptionTemplateId: templateId as Id<"jobDescriptionTemplates"> } : {}),
      });
      toast.success("Job description updated");
    } catch (error) {
      handleOperationError(error, { userMessage: "Failed to update job description." });
    }
  };

  const handleJobDescClear = async () => {
    try {
      await clearJobDescriptionMutation({ id: caseId });
      toast.success("Job description cleared");
    } catch (error) {
      handleOperationError(error, { userMessage: "Failed to clear job description." });
    }
  };

  // Active tab state for manila folder tabs
  const [activeTab, setActiveTab] = useState<TabId>("overview");

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
      {/* CASE HERO HEADER — mockup-matching layout                       */}
      {/* ================================================================ */}
      <motion.div
        variants={headerVariants}
        className="bg-card border-b-[3px] border-black relative z-[2] overflow-hidden -mt-6"
        style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}
      >
        {/* Stage accent strip */}
        <div className="h-1" style={{ backgroundColor: stageColor }} />

        <div className="px-4 py-3 sm:px-10 sm:py-4 space-y-3">
          {/* Breadcrumb nav */}
          <nav className="flex items-center gap-2 mb-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigateTo("/cases")}
              className={cn(
                "shrink-0 h-9 w-9 border-[3px] border-border bg-card hover:!bg-[var(--primary)] hover:text-black hover:border-black hover:-translate-y-[1px] hover:shadow-hard-sm active:translate-y-0 active:shadow-none transition-all",
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
            <span className="font-mono text-[0.68rem] text-muted-foreground">Cases / Detail</span>
          </nav>

          {/* Row 1: Title + Actions */}
          <div className="flex items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-2">
                <h1 className="font-heading text-[1.35rem] sm:text-2xl font-bold leading-[1.15] truncate tracking-tight" title={caseData.employerName}>
                  {caseData.employerName}
                </h1>
                {isSample && (
                  <span className="shrink-0 inline-flex items-center px-2 py-0.5 text-[0.625rem] font-bold tracking-wider uppercase border-2 border-dashed border-muted-foreground/40 text-muted-foreground bg-muted">
                    SAMPLE
                  </span>
                )}
              </div>
              <p className="font-heading text-[0.85rem] text-muted-foreground font-medium mt-0.5" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={`${caseData.positionTitle}${caseData.beneficiaryIdentifier ? ` — ${caseData.beneficiaryIdentifier}` : ""}`}>
                {caseData.positionTitle}
                {caseData.beneficiaryIdentifier && (
                  <span className="font-mono text-[0.72rem] opacity-60"> — {caseData.beneficiaryIdentifier}</span>
                )}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleFavorite}
                disabled={isTogglingFavorite}
                className={cn(
                  "shrink-0 border-[3px] transition-all cursor-pointer",
                  "min-h-[38px] min-w-[38px] h-[38px] w-[38px]",
                  caseData.isFavorite
                    ? "border-amber-400 bg-amber-50 hover:bg-amber-200 active:bg-amber-300 dark:bg-amber-900/20 dark:border-amber-500 dark:hover:bg-amber-800/40 dark:active:bg-amber-800/50"
                    : "border-border bg-card hover:bg-amber-200 hover:border-amber-400 dark:hover:bg-amber-800/40 hover:-translate-y-[1px] hover:shadow-hard-sm active:translate-y-0 active:shadow-none"
                )}
                aria-label={caseData.isFavorite ? "Remove bookmark" : "Bookmark case"}
                aria-pressed={caseData.isFavorite}
              >
                {isTogglingFavorite ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Bookmark
                    className={cn(
                      "h-5 w-5",
                      caseData.isFavorite
                        ? "fill-amber-400 text-amber-500"
                        : "text-amber-400"
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
                  "shrink-0 border-[3px] transition-all cursor-pointer",
                  "min-h-[38px] min-w-[38px] h-[38px] w-[38px]",
                  caseData.calendarSyncEnabled && isGoogleConnected
                    ? "border-emerald-400 bg-emerald-50 hover:bg-emerald-200 active:bg-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-500 dark:hover:bg-emerald-800/40 dark:active:bg-emerald-800/50"
                    : caseData.calendarSyncEnabled && !isGoogleConnected
                      ? "border-amber-500 bg-amber-50 hover:bg-amber-200 active:bg-amber-300 dark:bg-amber-900/20 dark:hover:bg-amber-800/40 dark:active:bg-amber-800/50"
                      : "border-border bg-card hover:bg-red-200 hover:border-red-400 dark:hover:bg-red-800/40 hover:-translate-y-[1px] hover:shadow-hard-sm active:translate-y-0 active:shadow-none"
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
                  <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
                ) : caseData.calendarSyncEnabled && isGoogleConnected ? (
                  <CalendarCheck className="h-5 w-5 text-emerald-600" />
                ) : caseData.calendarSyncEnabled && !isGoogleConnected ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <CalendarX className="h-5 w-5 text-red-400" />
                )}
              </Button>

              {/* Edit Case — prominent green button like mockup */}
              <Button
                onClick={handleEdit}
                disabled={isAnyNavigating}
                className={cn(
                  "shrink-0 border-[3px] border-black bg-[var(--primary)] text-black font-heading font-bold text-xs",
                  "shadow-hard-sm hover:-translate-y-[1px] hover:shadow-hard hover:bg-[#4AE860] active:translate-y-0 active:shadow-hard-sm transition-all",
                  "min-h-[38px] gap-1.5"
                )}
              >
                {isEditNavigating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">Edit Case</span>
              </Button>

              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      "shrink-0 border-[3px] border-border bg-card",
                      "hover:!bg-[var(--primary)] hover:text-black hover:border-black hover:-translate-y-[1px] hover:shadow-hard-sm active:translate-y-0 active:shadow-none transition-all",
                      "min-h-[38px] min-w-[38px] h-[38px] w-[38px]"
                    )}
                    disabled={isUpdating || isAnyNavigating}
                  >
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52 will-change-transform border-[3px] border-border shadow-hard-sm rounded-none p-1" onCloseAutoFocus={(e) => e.preventDefault()}>
                  {isClosed ? (
                    <DropdownMenuItem onClick={handleReopen} disabled={isUpdating} className="min-h-[44px] font-heading font-bold text-sm rounded-none">
                      <RotateCcw className="h-4 w-4" />
                      Reopen Case
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handleArchive} disabled={isUpdating} className="min-h-[44px] font-heading font-bold text-sm rounded-none">
                      <Archive className="h-4 w-4" />
                      Archive Case
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator className="bg-border h-[2px]" />
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="min-h-[44px] font-heading font-bold text-sm rounded-none"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete Case
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Row 2: Badges */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {caseData.caseNumber && (
              <span className="font-mono text-[0.72rem] font-bold uppercase tracking-wide border-[3px] border-border px-3 py-1 leading-none truncate max-w-[200px]" title={caseData.caseNumber}>
                {caseData.caseNumber}
              </span>
            )}
            <CaseStageBadge stage={caseData.caseStatus} bordered />
            <ProgressStatusBadge status={caseData.progressStatus} />
            {isProfessionalOccupation && (
              <span className="inline-flex items-center border-2 border-border px-2 py-0.5 text-[0.65rem] font-mono font-bold uppercase tracking-wide gap-1">
                Professional
              </span>
            )}
          </div>
        </div>

        {/* Stage Bar — flat segments matching mockup */}
        {!isClosed && (
          <div
            className="flex border-t-[3px] border-black mt-3.5"
            role="progressbar"
            aria-valuenow={currentStage + 1}
            aria-valuemin={1}
            aria-valuemax={4}
            aria-label="PERM case progress"
          >
            {(["pwd", "recruitment", "eta9089", "i140"] as const).map((stage) => {
              const stageIdx = { pwd: 0, recruitment: 1, eta9089: 2, i140: 3 }[stage];
              const isDone = stageIdx < currentStage;
              const isActive = stageIdx === currentStage;
              const labels = { pwd: "PWD", recruitment: "Recruitment", eta9089: "ETA 9089", i140: "I-140" } as const;
              return (
                <div
                  key={stage}
                  className={cn(
                    "flex-1 py-2.5 px-2 text-center font-mono text-[0.7rem] font-bold uppercase tracking-wide flex items-center justify-center gap-1.5",
                    "border-r-[3px] border-black last:border-r-0",
                    isDone && "bg-card text-foreground",
                    isActive && "text-white",
                    !isDone && !isActive && "bg-muted text-muted-foreground"
                  )}
                  style={isActive ? { background: STAGE_ACCENT_COLORS[stage] } : undefined}
                  data-s={stage}
                >
                  {isDone ? (
                    <span className="w-[14px] h-[14px] rounded-full bg-emerald-600 dark:bg-emerald-500 flex items-center justify-center shrink-0">
                      <Check className="h-[9px] w-[9px] text-white" strokeWidth={3.5} />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "w-[9px] h-[9px] rounded-full border-2 shrink-0",
                        isActive && "bg-white border-white",
                        !isActive && "border-current"
                      )}
                    />
                  )}
                  {labels[stage]}
                </div>
              );
            })}
          </div>
        )}

      </motion.div>

      {/* ================================================================ */}
      {/* MANILA FOLDER TABS — organized case detail sections              */}
      {/* ================================================================ */}
      <motion.div variants={itemVariants}>
        <CaseDetailTabs activeTab={activeTab} onTabChange={setActiveTab}>
          <TabPanel id="overview" activeTab={activeTab}>
            <OverviewTab
              caseData={caseData}
              caseId={caseId}
              isMobile={isMobile}
              isOnTimeline={isOnTimeline}
              isUpdating={isUpdating}
              onToggleTimeline={handleToggleTimeline}
              jobDescProps={{
                templates: jobDescTemplates as import("@/components/job-description/JobDescriptionField").JobDescriptionTemplate[],
                onSave: handleJobDescSave,
                onClear: handleJobDescClear,
                onLoadTemplate: (t) => loadJobDescTemplate({ ...t, _id: t._id as Id<"jobDescriptionTemplates"> }),
                onDeleteTemplate: (id) => hardDeleteJobDescTemplate(id as Id<"jobDescriptionTemplates">),
                onUpdateTemplate: (id, name, desc) => updateJobDescTemplate(id as Id<"jobDescriptionTemplates">, name, desc),
                onSaveAsNewTemplate: saveAsNewJobDescTemplate,
              }}
            />
          </TabPanel>

          <TabPanel id="recruitment" activeTab={activeTab}>
            <RecruitmentTab caseData={caseData} />
          </TabPanel>

          <TabPanel id="eta9089" activeTab={activeTab}>
            <ETA9089Tab
              caseData={caseData}
              filingWindowOpens={gatedFilingWindowOpens}
              filingWindowCloses={gatedFilingWindowCloses}
            />
          </TabPanel>

          <TabPanel id="i140" activeTab={activeTab}>
            <I140Tab caseData={caseData} />
          </TabPanel>

          <TabPanel id="documents" activeTab={activeTab}>
            <DocumentsTab
              documents={caseData.documents || []}
              onUpload={handleUploadDocument}
              onDelete={handleDeleteDocument}
            />
          </TabPanel>

          <TabPanel id="notes" activeTab={activeTab}>
            <NotesTab notes={caseData.notes || []} onUpdateNotes={handleUpdateNotes} />
          </TabPanel>
        </CaseDetailTabs>
      </motion.div>

      {/* Delete Case — centered above footer */}
      <motion.div variants={itemVariants} className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          disabled={isDeleting}
          className="border-[3px] border-[#DC2626] text-[#DC2626] bg-white hover:bg-[#DC2626] hover:text-white font-mono text-xs font-bold uppercase tracking-wide transition-all gap-1.5 dark:bg-white dark:text-[#DC2626] dark:border-[#DC2626] dark:hover:bg-[#DC2626] dark:hover:text-white"
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          Delete Case
        </Button>
      </motion.div>

      {/* Footer Metadata */}
      <motion.div variants={itemVariants}>
        <div className="text-xs text-muted-foreground border-t border-border pt-4 flex flex-wrap items-center justify-center gap-4 font-mono">
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
        </div>
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
