"use client";

import { formatCaseStatus, formatProgressStatus } from "@convex/lib/notificationHelpers";
import { use, useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import Link from "next/link";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ArchiveIcon, ArrowCounterClockwiseIcon, ArrowLeftIcon, CalendarBlankIcon, CalendarCheckIcon, CalendarSlashIcon, ChartBarHorizontalIcon, DotsThreeVerticalIcon, PencilSimpleIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { AppBreadcrumb } from "../../components/AppBreadcrumb";
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
import { normaliseCaseNumber } from "@/lib/caseNumberShape";
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
import { NotLegalAdviceNotice } from "@/components/legal/NotLegalAdviceNotice";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
import { validateDocumentFile } from "@/lib/documents/validation";
import { useDerivedDates } from "@/hooks/useDerivedDates";
import { usePageContextUpdater } from "@/lib/ai/page-context";
import { useIsMobile } from "@/hooks/useIsMobile";
import { isRecruitmentComplete } from "@/lib/perm";
import { useJobDescriptionTemplates } from "@/hooks/useJobDescriptionTemplates";
import type { CaseDetailData } from "@/components/cases/detail/case-detail-types";
import { STAGE_VISUALS } from "@/components/status/stage-visuals";
import { formatCompactDate } from "@/components/cases/case-card.utils";
import { caseWriteErrorMessage } from "@/lib/caseWriteErrors";
import {
  MAX_DOCUMENTS_PER_CASE,
  MAX_DOCUMENT_NAME_LENGTH,
  DOCUMENT_CAP_MESSAGE,
  type DocumentCategory,
} from "@/lib/documents";

// ============================================================================
// TYPES
// ============================================================================

interface CaseDetailPageProps {
  params: Promise<{ id: string }>;
}

// ============================================================================
// LOADING SKELETON
// ============================================================================

export function CaseDetailSkeleton() {
  return (
    <div className="space-y-8" aria-busy={true}>
      <div className="space-y-4">
        <Skeleton variant="line" className="h-5 w-40" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton variant="line" className="h-9 w-72 max-w-full" />
            <Skeleton variant="line" className="mt-2 h-5 w-56" />
          </div>
          <div className="flex items-center gap-1">
            <Skeleton variant="block" className="size-11" />
            <Skeleton variant="block" className="size-11" />
            <Skeleton variant="block" className="h-11 w-32" />
            <Skeleton variant="block" className="size-11" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton variant="line" className="h-7 w-40" />
          <Skeleton variant="line" className="h-7 w-24" />
          <Skeleton variant="line" className="h-7 w-28" />
        </div>
        <div className="max-w-md">
          <Skeleton variant="line" className="h-5 w-48" />
          <Skeleton variant="block" className="mt-2 h-1.5" />
        </div>
      </div>
      <div className="flex gap-2 border-b border-border pb-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} variant="line" className="h-7 w-24" />
        ))}
      </div>
      <Skeleton variant="block" className="h-24" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <Skeleton variant="block" className="h-96" />
        <div className="space-y-6">
          <Skeleton variant="block" className="h-48" />
          <Skeleton variant="block" className="h-40" />
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
        <h2 className="font-heading text-2xl font-bold">Case not found</h2>{" "}
        <p className="text-muted-foreground">
          The case you&apos;re looking for doesn&apos;t exist or has been deleted.
        </p>
      </div>
      <Button onClick={() => router.push("/cases")} className="gap-2">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to cases
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
          <DialogTitle>Delete case</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete &quot;{caseName}&quot;? This action can’t be
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
            {isLoading ? "Deleting..." : "Delete case"}
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

  const handleUpdateNotes = useCallback(async (updatedNotes: import("@/lib/forms/case-form-schema").NoteEntry[]) => {
    try {
      await updateMutation({ id: caseId, notes: updatedNotes });
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t save the note. Try again." });
    }
  }, [updateMutation, caseId]);

  const handleSaveRecruitmentText = useCallback(async (text: string | null) => {
    try {
      await updateMutation({ id: caseId, recruitmentSummaryCustom: text });
      toast.success(text ? "Recruitment summary saved" : "Reverted to auto-generated text");
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t save the recruitment summary. Try again." });
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
    // The server refuses the 51st document; say so before uploading anything.
    if ((caseData.documents?.length ?? 0) >= MAX_DOCUMENTS_PER_CASE) {
      toast.error(DOCUMENT_CAP_MESSAGE);
      return;
    }

    try {
      // 1. Get upload URL (server validates too)
      const uploadUrl = await generateUploadUrlMutation({
        caseId,
        fileName: file.name,
        contentType: file.type,
        fileSize: file.size,
      });

      // 2. Upload file directly to Convex storage
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
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
        contentType: file.type,
        fileSize: file.size,
        category,
      });

      // The server keeps the first 255 characters of a name; say so when it did.
      toast.success(
        file.name.length > MAX_DOCUMENT_NAME_LENGTH
          ? `Document uploaded. Its name was shortened to ${MAX_DOCUMENT_NAME_LENGTH} characters, the most a document name holds.`
          : "Document uploaded"
      );
    } catch (error) {
      handleOperationError(error, {
        userMessage: caseWriteErrorMessage(error, "Couldn’t upload the document. Try again."),
      });
    }
  }, [generateUploadUrlMutation, saveDocumentMutation, caseId, caseData.documents?.length]);

  const handleDeleteDocument = useCallback(async (documentId: string) => {
    try {
      await removeDocumentMutation({ caseId, documentId });
      toast.success("Document deleted");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t delete the document. Try again.",
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
        userMessage: "Couldn’t delete the case. Try again.",
      });
      setIsDeleting(false);
    }
  };

  const handleArchive = async () => {
    setIsUpdating(true);
    try {
      await updateMutation({ id: caseId, caseStatus: "closed" });
      toast.success("Case archived");
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t archive the case. Try again.",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReopen = async () => {
    setIsUpdating(true);
    try {
      const result = await reopenCaseMutation({ id: caseId });
      toast.success(`Case reopened: ${formatCaseStatus(result.newCaseStatus)} (${formatProgressStatus(result.newProgressStatus)})`);
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Couldn’t reopen the case. Try again.",
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
        userMessage: "Couldn’t update the timeline. Try again.",
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
        userMessage: "Couldn’t update the favorite. Try again.",
      });
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const handleToggleCalendarSync = async () => {
    if (isTogglingCalendarSync) return;

    // Sync is on but Google isn't connected: the fix is in Settings, which is
    // what the button says it does in this state.
    if (caseData.calendarSyncEnabled && !isGoogleConnected) {
      router.push("/settings?tab=calendar-sync");
      return;
    }

    // Check if Google Calendar is connected before enabling sync
    if (!caseData.calendarSyncEnabled && !isGoogleConnected) {
      toast.error("Connect Google Calendar first", {
        description: "Go to Settings to connect your Google Calendar account.",
        action: {
          label: "Go to settings",
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
        userMessage: "Couldn’t update calendar sync. Try again.",
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
      handleOperationError(error, { userMessage: "Couldn’t save the job description. Try again." });
    }
  };

  const handleJobDescClear = async () => {
    try {
      await clearJobDescriptionMutation({ id: caseId });
      toast.success("Job description cleared");
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t clear the job description. Try again." });
    }
  };

  // Which detail tab is open
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const isClosed = caseData.caseStatus === "closed";
  const caseName = `${caseData.employerName} - ${caseData.positionTitle}`;
  const isProfessionalOccupation = caseData.isProfessionalOccupation;
  const isSample = caseData.isSample;
  const currentStage = getStageIndex(caseData.caseStatus);

  return (
    <div className="space-y-8">
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        caseName={caseName}
      />

      <header className="space-y-4">
        <AppBreadcrumb steps={[{ href: "/cases", label: "Cases" }]} current={caseData.employerName} />

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-3xl font-bold leading-[1.1] [overflow-wrap:anywhere] sm:text-4xl">
              {caseData.employerName}
            </h1>{" "}
            <p className="mt-1 text-base text-muted-foreground [overflow-wrap:anywhere]">
              {[caseData.positionTitle, caseData.beneficiaryIdentifier].filter(Boolean).join(", ")}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleFavorite}
              disabled={isTogglingFavorite}
              aria-label={caseData.isFavorite ? "Remove from favorites" : "Add to favorites"}
              aria-pressed={caseData.isFavorite}
              title={caseData.isFavorite ? "Favorite" : "Add to favorites"}
            >
              <StarIcon weight={caseData.isFavorite ? "fill" : "regular"} className={cn("size-5", caseData.isFavorite && "text-data-warn-ink")} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleToggleCalendarSync}
              disabled={isTogglingCalendarSync}
              title={
                caseData.calendarSyncEnabled && isGoogleConnected
                  ? "Synced to Google Calendar"
                  : caseData.calendarSyncEnabled
                    ? "Calendar not connected: open settings to connect it"
                    : "Not synced to Google Calendar"
              }
              aria-label={
                caseData.calendarSyncEnabled && !isGoogleConnected
                  ? "Calendar not connected: open settings"
                  : caseData.calendarSyncEnabled
                    ? "Stop syncing to Google Calendar"
                    : "Sync to Google Calendar"
              }
              aria-pressed={caseData.calendarSyncEnabled && isGoogleConnected}
            >
              {caseData.calendarSyncEnabled && isGoogleConnected ? (
                <CalendarCheckIcon className="size-5 text-primary-text" />
              ) : caseData.calendarSyncEnabled ? (
                <CalendarSlashIcon className="size-5 text-data-warn-ink" />
              ) : (
                <CalendarBlankIcon className="size-5 text-muted-foreground" />
              )}
            </Button>
            <Link href={editPath} className={buttonVariants({ className: "ml-1" })}>
              <PencilSimpleIcon aria-hidden="true" />
              Edit case
            </Link>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" disabled={isUpdating} aria-label="More actions">
                  <DotsThreeVerticalIcon className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
                <DropdownMenuItem onSelect={handleToggleTimeline} disabled={isUpdating}>
                  <ChartBarHorizontalIcon className="size-4" />
                  {isOnTimeline ? "Remove from timeline" : "Show on timeline"}
                </DropdownMenuItem>
                {isClosed ? (
                  <DropdownMenuItem onSelect={handleReopen} disabled={isUpdating}>
                    <ArrowCounterClockwiseIcon className="size-4" />
                    Reopen case
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onSelect={handleArchive} disabled={isUpdating}>
                    <ArchiveIcon className="size-4" />
                    Archive case
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteDialogOpen(true)}>
                  <TrashIcon className="size-4" />
                  Delete case
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {caseData.caseNumber ? (
            normaliseCaseNumber(caseData.caseNumber) ? (
              /* A well-formed DOL case number links to its live federal
                 record on the public lookup page, in a new tab so the
                 working context stays put. */
              <a
                href={`/perm-case-status?case=${encodeURIComponent(normaliseCaseNumber(caseData.caseNumber)!)}`}
                target="_blank"
                rel="noopener"
                title={`${caseData.caseNumber}: check DOL's live status`}
                className="link max-w-[220px] truncate font-mono text-sm"
              >
                {caseData.caseNumber}
              </a>
            ) : (
              <span className="max-w-[200px] truncate font-mono text-sm" title={caseData.caseNumber}>
                {caseData.caseNumber}
              </span>
            )
          ) : null}
          <CaseStageBadge stage={caseData.caseStatus} />
          <ProgressStatusBadge status={caseData.progressStatus} />
          {isProfessionalOccupation ? (
            <Badge className="font-normal" title="Professional occupation: the extra recruitment steps apply">
              Professional
            </Badge>
          ) : null}
          {isSample ? (
            <Badge className="border-dashed font-normal" title="Sample case. Delete it anytime">
              Sample
            </Badge>
          ) : null}
        </div>

        {!isClosed ? <StageProgress index={currentStage} /> : null}
      </header>

      <CaseDetailTabs activeTab={activeTab} onTabChange={setActiveTab}>
        <TabPanel id="overview" activeTab={activeTab}>
          <OverviewTab
            caseData={caseData}
            caseId={caseId}
            isMobile={isMobile}
            onSaveRecruitmentText={handleSaveRecruitmentText}
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
          <ETA9089Tab caseData={caseData} filingWindowOpens={gatedFilingWindowOpens} filingWindowCloses={gatedFilingWindowCloses} />
        </TabPanel>
        <TabPanel id="i140" activeTab={activeTab}>
          <I140Tab caseData={caseData} />
        </TabPanel>
        <TabPanel id="documents" activeTab={activeTab}>
          <DocumentsTab documents={caseData.documents || []} onUpload={handleUploadDocument} onDelete={handleDeleteDocument} />
        </TabPanel>
        <TabPanel id="notes" activeTab={activeTab}>
          <NotesTab notes={caseData.notes || []} onUpdateNotes={handleUpdateNotes} />
        </TabPanel>
      </CaseDetailTabs>

      <footer className="space-y-3 border-t border-border pt-4">
        <NotLegalAdviceNotice variant="deadline" className="border-t-0 pt-0" />
        <p className="text-sm text-muted-foreground">
          Created {formatCompactDate(new Date(caseData.createdAt).toISOString())} · Updated{" "}
          {formatCompactDate(new Date(caseData.updatedAt).toISOString())}
        </p>
      </footer>
    </div>
  );
}

/** Where the case is in the four stages: "Stage 2 of 4: Recruitment" over a thin bar. */
function StageProgress({ index }: { index: number }) {
  const stages = ["pwd", "recruitment", "eta9089", "i140"] as const;
  const stage = stages[Math.min(Math.max(index, 0), stages.length - 1)]!;
  return (
    <div className="max-w-md">
      <p className="text-sm">
        <span className="font-semibold">
          Stage {index + 1} of {stages.length}:
        </span>{" "}
        {formatCaseStatus(stage)}
      </p>
      <div
        role="progressbar"
        aria-label="PERM case progress"
        aria-valuemin={1}
        aria-valuemax={stages.length}
        aria-valuenow={index + 1}
        className="mt-2 grid h-1.5 grid-cols-4 gap-1"
      >
        {stages.map((st, i) => (
          <span key={st} className={cn(i <= index ? STAGE_VISUALS[stage].fill : "bg-muted")} />
        ))}
      </div>
    </div>
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
