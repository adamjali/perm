"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Flag, Briefcase, CalendarMinus, CalendarPlus, FileText, ChevronDown, ArrowRight, Pencil, Copy, Check, Trash2, Loader2, FilePlus, Save } from "lucide-react";
import { ConvexError } from "convex/values";
import type { Id } from "@/../convex/_generated/dataModel";
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
import { itemVariants, tabContainerVariants, fmtISODate, fmtCurrency } from "./case-detail-utils";

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
  isOnTimeline: boolean;
  isUpdating: boolean;
  onToggleTimeline: () => void;
  onSaveRecruitmentText?: (text: string | null) => Promise<void>;
  jobDescProps?: JobDescEditProps;
}

export function OverviewTab({
  caseData,
  caseId,
  isMobile,
  isOnTimeline,
  isUpdating,
  onToggleTimeline,
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
      handleOperationError(error, { userMessage: "Failed to update job description." });
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
      handleOperationError(error, { userMessage: "Failed to clear job description." });
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
        handleOperationError(error, { userMessage: "Failed to save template." });
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
        handleOperationError(error, { userMessage: "Failed to save template." });
      }
      return;
    }
    setIsSavingTemplate(true);
    try {
      await jobDescProps.onUpdateTemplate(match._id, pendingTemplateUpdate.name, pendingTemplateUpdate.description);
      toast.success(`Template "${pendingTemplateUpdate.name}" updated`);
    } catch (error) {
      handleOperationError(error, { userMessage: "Failed to update template." });
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
      handleOperationError(error, { userMessage: "Failed to copy." });
    }
  }, [isEditingJobDesc, editDescription, caseData.jobDescription]);

  const hasJobDesc = !!(caseData.jobDescription || caseData.jobDescriptionPositionTitle);
  const showJobDescCard = hasJobDesc || !!jobDescProps;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={tabContainerVariants}
      className="space-y-6"
    >
      {/* Next Up — expandable with quick-edit */}
      {caseData.caseStatus !== "closed" && (() => {
        const nextAction = calculateNextAction(caseData);
        const nextDeadline = calculateNextDeadline(caseData);
        if (!nextAction) return null;
        const canExpand = isEditableAction(nextAction.action);
        const navigateUrl = isComplexAction(nextAction.action)
          ? buildEditSectionUrl(caseId, "recruitment")
          : null;
        return (
          <motion.div variants={itemVariants}>
            <div className="next-up-caution">
              {/* Caution tape — top */}
              <div className="hazard-strip-yellow" aria-hidden="true" />

              <div className="next-up">
                <div
                  className={cn("next-up-main", (canExpand || navigateUrl) && "cursor-pointer")}
                  onClick={
                    navigateUrl ? () => router.push(navigateUrl)
                    : canExpand ? () => setIsNextUpExpanded(v => !v)
                    : undefined
                  }
                >
                  <div className="next-up-icon">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="next-up-label">Next Up</div>
                    <h3>{nextAction.action}</h3>
                    <p>{nextAction.description}</p>
                  </div>
                  {canExpand && (
                    <motion.div
                      animate={{ rotate: isNextUpExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0"
                    >
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </motion.div>
                  )}
                  {navigateUrl && !canExpand && (
                    <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                </div>
                {nextDeadline && (() => {
                  const urgencyColor =
                    nextDeadline.daysUntil <= 14 ? "var(--destructive)"
                    : nextDeadline.daysUntil <= 30 ? "var(--stage-eta9089)"
                    : "var(--primary)";
                  return (
                    <div className="next-up-stat">
                      <div className="big" style={{ color: urgencyColor }}>{nextDeadline.daysUntil}</div>
                      <div className="label">{nextDeadline.label}</div>
                      <div className="date">{fmtISODate(nextDeadline.date)}</div>
                    </div>
                  );
                })()}
              </div>

              {/* Expanded quick-edit */}
              <AnimatePresence initial={false}>
                {isNextUpExpanded && canExpand && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    className="overflow-hidden border-t-[3px] border-black bg-card"
                  >
                    <div className="p-4">
                      <QuickEditFields
                        actionName={nextAction.action}
                        caseId={caseId}
                        caseData={caseData}
                        onComplete={() => setIsNextUpExpanded(false)}
                        onNavigateToForm={() => {}}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Caution tape — bottom */}
              <div className="hazard-strip-yellow" aria-hidden="true" />
            </div>
          </motion.div>
        );
      })()}

      {/* 2-Column Layout: Timeline Sidebar + Main (matching mockup) */}
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: Vertical Timeline */}
        {!isMobile && (
          <div className="space-y-6">
            <motion.div variants={itemVariants}>
              <VerticalTimeline caseData={caseData} />
            </motion.div>
          </div>
        )}

        {/* Main column */}
        <div className="space-y-6">
          {/* PWD + Quick Stats side by side (mockup: 1.8fr 1fr) */}
          <div className="grid gap-6 md:grid-cols-[1.8fr_1fr]">
            <motion.div variants={itemVariants}>
              <Link href={buildEditUrl(caseData._id, "pwdFilingDate")} className="detail-card-link" title="Edit in case form">
                <div className="detail-card">
                  <div className="detail-card-head ch-pwd">
                    <span className="flex items-center gap-1.5">
                      <Flag className="h-3.5 w-3.5" />
                      Prevailing Wage
                    </span>
                    {caseData.pwdDeterminationDate && (
                      <span className="head-badge">Complete</span>
                    )}
                  </div>
                  <div className="field-grid" style={{ padding: 0 }}>
                    <div className="field-cell">
                      <div className="fc-label">PWD Case #</div>
                      <div className={`fc-val fc-val-text mono ${!caseData.pwdCaseNumber ? "dim" : ""}`} title={caseData.pwdCaseNumber || undefined}>
                        {caseData.pwdCaseNumber || "\u2014"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Filed</div>
                      <div className={`fc-val mono ${!caseData.pwdFilingDate ? "dim" : ""}`}>
                        {fmtISODate(caseData.pwdFilingDate)}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Determined</div>
                      <div className={`fc-val mono ${!caseData.pwdDeterminationDate ? "dim" : ""}`}>
                        {fmtISODate(caseData.pwdDeterminationDate)}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Wage Level</div>
                      <div className={`fc-val ${!caseData.pwdWageLevel ? "dim" : ""}`}>
                        {caseData.pwdWageLevel || "\u2014"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">PWD Amount</div>
                      <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
                        {caseData.pwdWageAmount !== undefined
                          ? `${fmtCurrency(caseData.pwdWageAmount)} / yr`
                          : "\u2014"}
                      </div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Expires</div>
                      <div className={`fc-val mono ${!caseData.pwdExpirationDate ? "dim" : ""}`}>
                        {caseData.pwdExpirationDate ? (
                          <span style={{ color: "var(--stage-eta9089)" }}>
                            {fmtISODate(caseData.pwdExpirationDate)}
                          </span>
                        ) : "\u2014"}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>

            {!isMobile && (
              <motion.div variants={itemVariants}>
                <QuickStatsPanel caseData={caseData} />
              </motion.div>
            )}
          </div>

          {/* Job Description */}
          {showJobDescCard && (
            <motion.div variants={itemVariants}>
              <div className="detail-card">
                <div className="detail-card-head ch-yellow">
                  <span className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5" />
                    Job Description
                  </span>
                  <div className="flex items-center gap-1">
                    {(caseData.jobDescription || isEditingJobDesc) && (
                      <button
                        type="button"
                        onClick={handleCopyJobDesc}
                        className="icon-btn"
                        title="Copy to clipboard"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    {jobDescProps && !isEditingJobDesc && (
                      <button
                        type="button"
                        onClick={startEditJobDesc}
                        className="icon-btn"
                        title="Edit job description"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {isEditingJobDesc && jobDescProps ? (
                  /* Edit mode */
                  <div className="detail-card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
                        className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1"
                      >
                        Position Title
                      </label>
                      <input
                        id="jd-edit-title"
                        type="text"
                        value={editPositionTitle}
                        onChange={(e) => setEditPositionTitle(e.target.value)}
                        placeholder="e.g., Software Engineer"
                        maxLength={200}
                        className="w-full border-[3px] border-border bg-card px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label
                        htmlFor="jd-edit-desc"
                        className="block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="jd-edit-desc"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Enter job requirements..."
                        rows={8}
                        maxLength={10000}
                        className="w-full border-[3px] border-border bg-card px-3 py-2 text-sm resize-y focus:outline-none focus:border-primary"
                      />
                      <div className="text-right font-mono text-[10px] text-muted-foreground mt-1">
                        {editDescription.length.toLocaleString()} chars
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t-[3px] border-dashed border-border">
                      <div className="flex items-center gap-2">
                        {hasJobDesc && (
                          <button
                            type="button"
                            onClick={clearJobDesc}
                            disabled={isClearingJobDesc}
                            className="flex items-center gap-1 px-3 py-1.5 border-[3px] border-border text-[11px] font-mono font-bold uppercase tracking-wider text-destructive hover:bg-destructive hover:text-white hover:border-destructive hover:-translate-y-[1px] hover:shadow-hard-sm transition-all disabled:opacity-50"
                          >
                            <Trash2 className="h-3 w-3" />
                            {isClearingJobDesc ? "Clearing..." : "Clear"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleSaveAsTemplate}
                          disabled={isSavingTemplate || !editPositionTitle.trim() || !editDescription.trim()}
                          className={cn(
                            "flex items-center gap-1 px-3 py-1.5 border-[3px] text-[11px] font-mono font-bold uppercase tracking-wider hover:-translate-y-[1px] hover:shadow-hard-sm transition-all disabled:opacity-50",
                            isExistingTemplateName
                              ? "border-blue-500 hover:bg-blue-500 hover:text-white"
                              : "border-border hover:bg-[var(--primary)] hover:text-black hover:border-black dark:hover:border-white/50"
                          )}
                        >
                          {isSavingTemplate ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : isExistingTemplateName ? (
                            <Save className="h-3 w-3" />
                          ) : (
                            <FilePlus className="h-3 w-3" />
                          )}
                          {isSavingTemplate
                            ? (isExistingTemplateName ? "Updating..." : "Saving...")
                            : (isExistingTemplateName ? "Update Template" : "Save Template")}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelEditJobDesc}
                          disabled={isSavingJobDesc}
                          className="px-3 py-1.5 border-[3px] border-border text-[11px] font-mono font-bold uppercase tracking-wider hover:bg-muted hover:-translate-y-[1px] hover:shadow-hard-sm transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={saveJobDesc}
                          disabled={isSavingJobDesc || !editDescription.trim()}
                          className="px-3 py-1.5 border-[3px] border-black bg-primary text-primary-foreground text-[11px] font-mono font-bold uppercase tracking-wider shadow-hard-sm hover:-translate-y-[1px] hover:shadow-hard transition-all disabled:opacity-50"
                        >
                          {isSavingJobDesc ? (
                            <span className="flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              Saving...
                            </span>
                          ) : "Save"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Read-only mode */
                  <>
                    <div className="field-grid" style={{ padding: 0 }}>
                      <div className="field-cell">
                        <div className="fc-label">Position</div>
                        <div className={`fc-val fc-val-text ${!caseData.jobDescriptionPositionTitle ? "dim" : ""}`} title={caseData.jobDescriptionPositionTitle || undefined}>
                          {caseData.jobDescriptionPositionTitle || "\u2014"}
                        </div>
                      </div>
                      <div className="field-cell">
                        <div className="fc-label">SOC Code</div>
                        <div className={`fc-val mono ${!caseData.socCode ? "dim" : ""}`}>
                          {caseData.socCode || "\u2014"}
                        </div>
                      </div>
                      <div className="field-cell">
                        <div className="fc-label">Wage Offered</div>
                        <div className={`fc-val ${caseData.pwdWageAmount === undefined ? "dim" : ""}`}>
                          {caseData.pwdWageAmount !== undefined
                            ? `${fmtCurrency(caseData.pwdWageAmount)} / yr`
                            : "\u2014"}
                        </div>
                      </div>
                    </div>
                    {caseData.jobDescription ? (
                      <div className="detail-card-body" style={{ borderTop: "3px solid var(--border)" }}>
                        <div style={{ border: "3px solid var(--border)", background: "var(--card)", padding: 16 }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted-foreground)", marginBottom: 8 }}>Requirements</div>
                          <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: 6, padding: 0, margin: 0, maxHeight: 300, overflow: "hidden", position: "relative" }}>
                            {caseData.jobDescription.split("\n").filter(Boolean).slice(0, 20).map((line, i) => {
                              const text = line.replace(/^[-•*]\s*/, "");
                              return (
                                <li key={i} className="req-item">
                                  <span className="req-bullet">&gt;</span> {text.length > 500 ? text.slice(0, 500) + "..." : text}
                                </li>
                              );
                            })}
                            {caseData.jobDescription.split("\n").filter(Boolean).length > 20 && (
                              <li className="req-item" style={{ color: "var(--muted-foreground)", fontStyle: "italic" }}>...and more</li>
                            )}
                          </ul>
                        </div>
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
            </motion.div>
          )}

          {/* Recruitment Results — only after all recruitment is complete */}
          {onSaveRecruitmentText && isRecruitmentComplete(caseData) && (
            <motion.div variants={itemVariants}>
              <RecruitmentResultsCard
                caseData={caseData}
                onSaveCustomText={onSaveRecruitmentText}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Mobile-only: Timeline + QuickStats below main content */}
      {isMobile && (
        <div className="space-y-6">
          <motion.div variants={itemVariants}>
            <QuickStatsPanel caseData={caseData} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <VerticalTimeline caseData={caseData} />
          </motion.div>
        </div>
      )}

      {/* Case Timeline (Gantt) */}
      <motion.div variants={itemVariants}>
        <div className="gantt-wrap">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "12px 16px", borderBottom: "3px solid var(--border)", background: "var(--muted)" }}>
            <span className="flex items-center gap-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Case Timeline
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleTimeline}
              disabled={isUpdating}
              className="gap-1.5 border-[3px] border-border font-mono text-[0.68rem] font-bold uppercase tracking-wide shadow-[2px_2px_0_var(--border)] hover:-translate-y-[1px] hover:shadow-[3px_3px_0_var(--border)] transition-all"
            >
              {isOnTimeline ? (
                <>
                  <CalendarMinus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Remove</span>
                </>
              ) : (
                <>
                  <CalendarPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Add to Timeline</span>
                </>
              )}
            </Button>
          </div>
          <div style={{ overflowX: "auto", padding: "0" }}>
            <InlineCaseTimeline
              caseData={caseData}
              className="min-w-[600px] sm:min-w-0"
            />
          </div>
        </div>
      </motion.div>

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
              {isSavingTemplate ? "Updating..." : "Update Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
