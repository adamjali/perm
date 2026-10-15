"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowCircleRightIcon, ArrowRightIcon, BriefcaseIcon, CaretDownIcon, CheckIcon, CopyIcon, FilePlusIcon, FlagIcon, FloppyDiskIcon as Save, PencilIcon, TrashIcon as Trash2 } from "@phosphor-icons/react";
import { ConvexError } from "convex/values";
import type { Id } from "@convex/_generated/dataModel";
import { calculateNextAction, calculateNextDeadline } from "./next-up-section.utils";
import { QuickEditFields, isEditableAction, isComplexAction } from "./quick-edit";
import { InlineCaseTimeline } from "./InlineCaseTimeline";
import { QuickStatsPanel } from "./QuickStatsPanel";
import { VerticalTimeline } from "./VerticalTimeline";
import { RecruitmentResultsCard } from "./RecruitmentResultsCard";
import { isRecruitmentComplete } from "@/lib/perm";
import { TemplateSelector } from "@/components/job-description/TemplateSelector";
import type { JobDescriptionTemplate } from "@/components/job-description/JobDescriptionField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
import { buildEditUrl, buildEditSectionUrl } from "@/lib/cases/editDeepLinks";
import type { CaseDetailData } from "./case-detail-types";
import { fmtISODate, fmtCurrency } from "./case-detail-utils";
import { CharLimit } from "@/components/ui/char-limit";
import { JOB_DESCRIPTION_MAX_LENGTH } from "@/components/job-description/shared";

export interface JobDescEditProps {
  templates: JobDescriptionTemplate[];
  onSave: (positionTitle: string, description: string, templateId?: string) => Promise<void>;
  onClear: () => Promise<void>;
  onLoadTemplate: (template: JobDescriptionTemplate) => void;
  onDeleteTemplate: (id: string) => Promise<{ success: boolean; clearedReferences: number }>;
  onUpdateTemplate: (id: string, name: string, description: string) => Promise<void>;
  onSaveAsNewTemplate: (name: string, description: string) => Promise<unknown>;
}

interface OverviewTabProps {
  caseData: CaseDetailData;
  caseId: Id<"cases">;
  isMobile: boolean;
  onSaveRecruitmentText?: (text: string | null) => Promise<void>;
  jobDescProps?: JobDescEditProps;
}

export function OverviewTab({
  caseData,
  caseId,
  isMobile,
  onSaveRecruitmentText,
  jobDescProps,
}: OverviewTabProps) {
  const router = useRouter();
  const [isNextUpExpanded, setIsNextUpExpanded] = useState(false);

  // Job description edit state
  const [isEditingJobDesc, setIsEditingJobDesc] = useState(false);
  const [editPositionTitle, setEditPositionTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [isSavingJobDesc, setIsSavingJobDesc] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isClearingJobDesc, setIsClearingJobDesc] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const startEditJobDesc = useCallback(() => {
    setEditPositionTitle(caseData.jobDescriptionPositionTitle || "");
    setEditDescription(caseData.jobDescription || "");
    setSelectedTemplateId(undefined);
    setIsEditingJobDesc(true);
  }, [caseData.jobDescriptionPositionTitle, caseData.jobDescription]);

  const cancelEditJobDesc = useCallback(() => {
    setIsEditingJobDesc(false);
    setEditPositionTitle("");
    setEditDescription("");
    setSelectedTemplateId(undefined);
  }, []);

  const saveJobDesc = useCallback(async () => {
    if (!jobDescProps || !editDescription.trim()) return;
    setIsSavingJobDesc(true);
    try {
      await jobDescProps.onSave(editPositionTitle.trim(), editDescription.trim(), selectedTemplateId);
      setIsEditingJobDesc(false);
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t save the job description. Try again." });
    } finally {
      setIsSavingJobDesc(false);
    }
  }, [jobDescProps, editPositionTitle, editDescription, selectedTemplateId]);

  const clearJobDesc = useCallback(async () => {
    if (!jobDescProps) return;
    setIsClearingJobDesc(true);
    try {
      await jobDescProps.onClear();
      setIsEditingJobDesc(false);
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t clear the job description. Try again." });
    } finally {
      setIsClearingJobDesc(false);
    }
  }, [jobDescProps]);

  const handleLoadTemplate = useCallback((template: JobDescriptionTemplate) => {
    setEditPositionTitle(template.name);
    setEditDescription(template.description);
    setSelectedTemplateId(template._id);
    if (jobDescProps) {
      jobDescProps.onLoadTemplate(template);
    }
  }, [jobDescProps]);

  // Check if position title matches an existing template (case-insensitive)
  const matchingTemplate = useMemo(
    () => jobDescProps?.templates.find(
      (t) => t.name.toLowerCase() === editPositionTitle.trim().toLowerCase()
    ),
    [jobDescProps?.templates, editPositionTitle]
  );
  const isExistingTemplateName = !!matchingTemplate;

  const [pendingTemplateUpdate, setPendingTemplateUpdate] = useState<{ name: string; description: string } | null>(null);

  const handleSaveAsTemplate = useCallback(async () => {
    if (!jobDescProps || !editPositionTitle.trim() || !editDescription.trim()) return;
    setIsSavingTemplate(true);
    try {
      if (isExistingTemplateName && matchingTemplate) {
        // Name matches a known template — update directly
        await jobDescProps.onUpdateTemplate(matchingTemplate._id, editPositionTitle.trim(), editDescription.trim());
        toast.success(`Template "${editPositionTitle.trim()}" updated`);
      } else {
        // Create new
        await jobDescProps.onSaveAsNewTemplate(editPositionTitle.trim(), editDescription.trim());
        toast.success(`Template "${editPositionTitle.trim()}" saved`);
      }
    } catch (error) {
      // Check for server-side duplicate detection
      const msg = error instanceof ConvexError
        ? (typeof error.data === "string" ? error.data : "")
        : (error instanceof Error ? error.message : "");
      if (msg.startsWith("TEMPLATE_EXISTS:")) {
        setPendingTemplateUpdate({ name: editPositionTitle.trim(), description: editDescription.trim() });
      } else {
        handleOperationError(error, { userMessage: "Couldn’t save the template. Try again." });
      }
    } finally {
      setIsSavingTemplate(false);
    }
  }, [jobDescProps, editPositionTitle, editDescription, isExistingTemplateName, matchingTemplate]);

  const handleConfirmTemplateUpdate = useCallback(async () => {
    if (!pendingTemplateUpdate || !jobDescProps) return;
    const match = jobDescProps.templates.find(
      (t) => t.name.toLowerCase() === pendingTemplateUpdate.name.toLowerCase()
    );
    if (!match) {
      // Template may have been deleted — retry create
      setPendingTemplateUpdate(null);
      try {
        await jobDescProps.onSaveAsNewTemplate(pendingTemplateUpdate.name, pendingTemplateUpdate.description);
        toast.success(`Template "${pendingTemplateUpdate.name}" saved`);
      } catch (error) {
        handleOperationError(error, { userMessage: "Couldn’t save the template. Try again." });
      }
      return;
    }
    setIsSavingTemplate(true);
    try {
      await jobDescProps.onUpdateTemplate(match._id, pendingTemplateUpdate.name, pendingTemplateUpdate.description);
      toast.success(`Template "${pendingTemplateUpdate.name}" updated`);
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t update the template. Try again." });
    } finally {
      setIsSavingTemplate(false);
      setPendingTemplateUpdate(null);
    }
  }, [pendingTemplateUpdate, jobDescProps]);

  const handleCopyJobDesc = useCallback(async () => {
    const text = isEditingJobDesc ? editDescription : caseData.jobDescription;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      handleOperationError(error, { userMessage: "Couldn’t copy. Select the text and copy it yourself." });
    }
  }, [isEditingJobDesc, editDescription, caseData.jobDescription]);

  const hasJobDesc = !!(caseData.jobDescription || caseData.jobDescriptionPositionTitle);
  const showJobDescCard = hasJobDesc || !!jobDescProps;

  return (
    <div className="space-y-8">
      {/* Next Up — expandable with quick-edit */}
      {caseData.caseStatus !== "closed" && (() => {
        const nextAction = calculateNextAction(caseData);
        const nextDeadline = calculateNextDeadline(caseData);
        if (!nextAction) return null;
        const canExpand = isEditableAction(nextAction.action);
        const navigateUrl = isComplexAction(nextAction.action)
          ? buildEditSectionUrl(caseId, "recruitment")
          : null;
        const late = nextDeadline ? nextDeadline.daysUntil < 0 : false;
        const urgencyClass = !nextDeadline
          ? ""
          : nextDeadline.daysUntil <= 14
            ? "text-destructive"
            : nextDeadline.daysUntil <= 30
              ? "text-data-warn-ink"
              : "";
        const isInteractive = !!navigateUrl || canExpand;
        const mainContent = (
          <>
            <span className="next-up-icon" aria-hidden="true">
              <ArrowCircleRightIcon className="size-6" />
            </span>{" "}
            <span className="min-w-0 flex-1">
              <span className="next-up-label block">Next up</span>{" "}
              <h3>{nextAction.action}</h3>{" "}
              <p>{nextAction.description}</p>
            </span>{" "}
            {canExpand ? (
              <CaretDownIcon
                className={cn("size-5 shrink-0 text-muted-foreground transition-transform", isNextUpExpanded && "rotate-180")}
                aria-hidden="true"
              />
            ) : navigateUrl ? (
              <ArrowRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : null}
          </>
        );
        return (
          <section aria-label="Next up">
            <div className="next-up">
              {isInteractive ? (
                <button
                  type="button"
                  className="next-up-main w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={navigateUrl ? () => router.push(navigateUrl) : () => setIsNextUpExpanded((v) => !v)}
                  aria-expanded={canExpand ? isNextUpExpanded : undefined}
                >
                  {mainContent}
                </button>
              ) : (
                <div className="next-up-main">{mainContent}</div>
              )}
              {nextDeadline ? (
                <div className="next-up-stat">
                  <div className={cn("big", urgencyClass)}>{Math.abs(nextDeadline.daysUntil)}</div>
                  <div className="label">
                    {late
                      ? `${Math.abs(nextDeadline.daysUntil) === 1 ? "day" : "days"} late: ${nextDeadline.label}`
                      : `${nextDeadline.daysUntil === 1 ? "day" : "days"} until ${nextDeadline.label}`}
                  </div>
                  <div className="date">{fmtISODate(nextDeadline.date)}</div>
                </div>
              ) : null}
            </div>
            {isNextUpExpanded && canExpand ? (
              <div className="border border-t-0 border-border bg-card p-4">
                <QuickEditFields
                  actionName={nextAction.action}
                  caseId={caseId}
                  caseData={caseData}
                  onComplete={() => setIsNextUpExpanded(false)}
                  onNavigateToForm={() => {}}
                />
              </div>
            ) : null}
          </section>
        );
      })()}

      {/* 2-Column Layout: Timeline Sidebar + Main (matching mockup) */}
      <div className="grid [&>*]:min-w-0 grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: Vertical Timeline */}
        {!isMobile && (
          <div className="space-y-6">
            <div>
              <VerticalTimeline caseData={caseData} />
            </div>
          </div>
        )}

        {/* Main column */}
        <div className="space-y-6">
          {/* PWD + Quick Stats side by side (mockup: 1.8fr 1fr) */}
          <div className="grid [&>*]:min-w-0 grid-cols-1 gap-6 md:grid-cols-[1.8fr_1fr]">
            <div>
              <Link href={buildEditUrl(caseData._id, "pwdFilingDate")} className="detail-card-link" title="Edit in case form">
                <div className="detail-card">
                  <div className="detail-card-head ch-pwd">
                    <h2 className="flex items-center gap-1.5">
                      <FlagIcon className="h-3.5 w-3.5" />
                      Prevailing wage
                    </h2>
                    {caseData.pwdDeterminationDate && (
                      <span className="head-badge">Complete</span>
                    )}
                  </div>
                  <div className="field-grid">
                    <div className="field-cell">
                      <div className="fc-label">PWD Case #</div>
                      <div className={`fc-val fc-val-text mono ${!caseData.pwdCaseNumber ? "dim" : ""}`} title={caseData.pwdCaseNumber || undefined}>
                        {caseData.pwdCaseNumber || "-"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Filed</div>
                      <div className={`fc-val num ${!caseData.pwdFilingDate ? "dim" : ""}`}>
                        {fmtISODate(caseData.pwdFilingDate)}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Determined</div>
                      <div className={`fc-val num ${!caseData.pwdDeterminationDate ? "dim" : ""}`}>
                        {fmtISODate(caseData.pwdDeterminationDate)}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Wage level</div>
                      <div className={`fc-val ${!caseData.pwdWageLevel ? "dim" : ""}`}>
                        {caseData.pwdWageLevel || "-"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">PWD amount</div>
                      <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
                        {caseData.pwdWageAmount !== undefined
                          ? `${fmtCurrency(caseData.pwdWageAmount)} / yr`
                          : "-"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Expires</div>
                      <div className={`fc-val num ${!caseData.pwdExpirationDate ? "dim" : ""}`}>
                        {caseData.pwdExpirationDate ? (
                          <span className="text-data-warn-ink">
                            {fmtISODate(caseData.pwdExpirationDate)}
                          </span>
                        ) : "-"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </div>

            {!isMobile && (
              <div>
                <QuickStatsPanel caseData={caseData} />
              </div>
            )}
          </div>

          {/* Job Description */}
          {showJobDescCard && (
            <div>
              <div className="detail-card">
                <div className="detail-card-head ch-yellow">
                  <h2 className="flex items-center gap-1.5">
                    <BriefcaseIcon className="h-3.5 w-3.5" />
                    Job description
                  </h2>
                  <div className="flex items-center gap-1">
                    {(caseData.jobDescription || isEditingJobDesc) && (
                      <button
                        type="button"
                        onClick={handleCopyJobDesc}
                        className="icon-btn"
                        title="Copy to clipboard"
                      >
                        {isCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {jobDescProps && !isEditingJobDesc && (
                      <button
                        type="button"
                        onClick={startEditJobDesc}
                        className="icon-btn"
                        title="Edit job description"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditingJobDesc && jobDescProps ? (
                  /* Edit mode */
                  <div className="detail-card-body flex flex-col gap-3">
                    {/* Template selector */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <TemplateSelector
                        templates={jobDescProps.templates}
                        selectedTemplateId={selectedTemplateId}
                        onSelect={handleLoadTemplate}
                        onDelete={jobDescProps.onDeleteTemplate}
                        onUpdate={jobDescProps.onUpdateTemplate}
                      />
                    </div>

                    {/* Position title */}
                    <div>
                      <label
                        htmlFor="jd-edit-title"
                        className="block text-sm text-muted-foreground mb-1"
                      >
                        Position title
                      </label>
                      <CharLimit max={200}>
                        <input
                          id="jd-edit-title"
                          type="text"
                          value={editPositionTitle}
                          onChange={(e) => setEditPositionTitle(e.target.value)}
                          placeholder="e.g., Software Engineer"
                          className="w-full min-w-0 border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </CharLimit>
                    </div>

                    {/* Description */}
                    <div>
                      <label
                        htmlFor="jd-edit-desc"
                        className="block text-sm text-muted-foreground mb-1"
                      >
                        Description
                      </label>
                      <CharLimit max={JOB_DESCRIPTION_MAX_LENGTH}>
                        <textarea
                          id="jd-edit-desc"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Enter job requirements..."
                          rows={8}
                          className="w-full min-w-0 resize-y border border-input bg-card px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                      </CharLimit>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                      <div className="flex items-center gap-2">
                        {hasJobDesc ? (
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={clearJobDesc} loading={isClearingJobDesc} loadingText="Clearing...">
                            <Trash2 aria-hidden="true" />
                            Clear
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveAsTemplate}
                          disabled={!editPositionTitle.trim() || !editDescription.trim()}
                          loading={isSavingTemplate}
                          loadingText={isExistingTemplateName ? "Updating..." : "Saving..."}
                        >
                          {isExistingTemplateName ? <Save aria-hidden="true" /> : <FilePlusIcon aria-hidden="true" />}
                          {isExistingTemplateName ? "Update template" : "Save as template"}
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={cancelEditJobDesc} disabled={isSavingJobDesc}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={saveJobDesc} disabled={!editDescription.trim()} loading={isSavingJobDesc} loadingText="Saving...">
                          Save
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Read-only mode */
                  <>
                    <div className="field-grid">
                      <div className="field-cell">
                        <div className="fc-label">Position</div>
                        <div className={`fc-val fc-val-text ${!caseData.jobDescriptionPositionTitle ? "dim" : ""}`} title={caseData.jobDescriptionPositionTitle || undefined}>
                          {caseData.jobDescriptionPositionTitle || "-"}
                        </div>
                      </div>
                      <div className="field-cell">
                        <div className="fc-label">SOC code</div>
                        <div className={`fc-val mono ${!caseData.socCode ? "dim" : ""}`}>
                          {caseData.socCode || "-"}
                        </div>
                      </div>
                      <div className="field-cell">
                        <div className="fc-label">Wage offered</div>
                        <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
                          {caseData.pwdWageAmount !== undefined
                            ? `${fmtCurrency(caseData.pwdWageAmount)} / yr`
                            : "-"}
                        </div>
                      </div>
                    </div>
                    {caseData.jobDescription ? (
                      <div className="detail-card-body">
                        <p className="text-sm font-semibold">Requirements</p>
                        <ul className="mt-2 space-y-1.5">
                          {caseData.jobDescription.split("\n").filter(Boolean).slice(0, 20).map((line, i) => {
                            const text = line.replace(/^[-•*]\s*/, "");
                            return (
                              <li key={i} className="req-item">
                                <span className="req-bullet" aria-hidden="true">·</span> {text.length > 500 ? text.slice(0, 500) + "..." : text}
                              </li>
                            );
                          })}
                          {caseData.jobDescription.split("\n").filter(Boolean).length > 20 ? (
                            <li className="req-item text-muted-foreground">And more, in the edit form</li>
                          ) : null}
                        </ul>
                      </div>
                    ) : (
                      <div className="detail-card-body">
                        <div className="detail-empty-state">
                          <div className="detail-empty-state-title">No job description</div>
                          <div className="detail-empty-state-desc">
                            {jobDescProps ? "Click the edit button to add one." : "Add one via the edit form."}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Recruitment Results — only after all recruitment is complete */}
          {onSaveRecruitmentText && isRecruitmentComplete(caseData) && (
            <div>
              <RecruitmentResultsCard
                caseData={caseData}
                onSaveCustomText={onSaveRecruitmentText}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only: Timeline + QuickStats below main content */}
      {isMobile && (
        <div className="space-y-6">
          <div>
            <QuickStatsPanel caseData={caseData} />
          </div>
          <div>
            <VerticalTimeline caseData={caseData} />
          </div>
        </div>
      )}

      {/* Case Timeline (Gantt) */}
      <div>
        <div className="gantt-wrap">
          <div className="detail-card-head"><h2>Case timeline</h2></div>
          {/* The timeline scrolls its own months under a sticky stage column. */}
          <InlineCaseTimeline caseData={caseData} />
        </div>
      </div>

      {/* Confirmation dialog when server finds existing template */}
      <Dialog open={!!pendingTemplateUpdate} onOpenChange={(open) => { if (!open) setPendingTemplateUpdate(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Template already exists</DialogTitle>
            <DialogDescription>
              A template named &ldquo;{pendingTemplateUpdate?.name}&rdquo; already exists. Would you like to update it with the current content?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingTemplateUpdate(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmTemplateUpdate} disabled={isSavingTemplate}>
              {isSavingTemplate ? "Updating..." : "Update template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
