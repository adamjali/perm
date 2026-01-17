"use client";

import { useState, useCallback, useMemo } from "react";
import { FileText, Copy, Check, ChevronDown, Trash2, Pencil, Settings2, Save, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TemplateSelector } from "./TemplateSelector";
import { TemplateManagementModal } from "./TemplateManagementModal";
import { TemplateUpdateConfirmDialog } from "./TemplateUpdateConfirmDialog";
import type { JobDescriptionTemplate } from "./JobDescriptionField";

// ============================================================================
// TYPES
// ============================================================================

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_LENGTH = 10000;

export interface JobDescriptionDetailViewProps {
  /** Position title for the job description */
  positionTitle?: string;
  /** Job description text */
  description?: string;
  /** Callback to clear the job description */
  onClear?: () => Promise<void>;
  /** Callback to update the job description */
  onUpdate?: (positionTitle: string, description: string, templateId?: string) => Promise<void>;
  /** Available templates */
  templates?: JobDescriptionTemplate[];
  /** Callback when template is selected */
  onLoadTemplate?: (template: JobDescriptionTemplate) => void;
  /** Callback to delete a template */
  onDeleteTemplate?: (id: string) => Promise<{ success: boolean; clearedReferences: number }>;
  /** Callback to update a template */
  onUpdateTemplate?: (id: string, name: string, description: string) => Promise<void>;
  /** Callback when saving as new template (returns template ID) */
  onSaveAsNewTemplate?: (name: string, description: string) => Promise<unknown>;
  /** Maximum character count for description */
  maxLength?: number;
  /** Whether section starts expanded */
  defaultOpen?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * JobDescriptionDetailView Component
 *
 * Read-only display of job description on case detail page.
 * Features:
 * - Collapsible section matching CaseDetailSection style
 * - Copy to clipboard button
 * - Character count
 * - Empty state when no description
 *
 * @example
 * ```tsx
 * <JobDescriptionDetailView
 *   positionTitle={caseData.jobDescriptionPositionTitle}
 *   description={caseData.jobDescription}
 * />
 * ```
 */
export function JobDescriptionDetailView({
  positionTitle,
  description,
  onClear,
  onUpdate,
  templates = [],
  onLoadTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  onSaveAsNewTemplate,
  maxLength = DEFAULT_MAX_LENGTH,
  defaultOpen = true,
  className,
}: JobDescriptionDetailViewProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isCopied, setIsCopied] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [editPositionTitle, setEditPositionTitle] = useState(positionTitle || "");
  const [editDescription, setEditDescription] = useState(description || "");
  const [managementOpen, setManagementOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);

  // Track original content for "modified" indicator
  const [originalContent, setOriginalContent] = useState<{
    positionTitle: string;
    description: string;
  } | null>(null);

  const hasContent = description?.trim();
  const characterCount = description?.length ?? 0;
  const canEdit = !!onUpdate;
  const editCharacterCount = editDescription.length;
  const isOverLimit = editCharacterCount > maxLength;

  // Check if position title matches an existing template (case-insensitive)
  const matchingTemplate = useMemo(() =>
    templates.find((t) => t.name.toLowerCase() === editPositionTitle.trim().toLowerCase()),
    [templates, editPositionTitle]
  );
  const isExistingTemplateName = !!matchingTemplate;
  const canSaveTemplate = editPositionTitle.trim() && editDescription.trim() && !isOverLimit && !!onSaveAsNewTemplate;

  // Check if content has been modified since loading a template
  const isModifiedFromTemplate = selectedTemplateId && originalContent && (
    editPositionTitle !== originalContent.positionTitle ||
    editDescription !== originalContent.description
  );

  const loadedTemplate = templates.find((t) => t._id === selectedTemplateId);

  const handleClear = useCallback(async () => {
    if (!onClear) return;

    setIsClearing(true);
    try {
      await onClear();
      toast.success("Job description cleared");
    } catch {
      toast.error("Failed to clear job description");
    } finally {
      setIsClearing(false);
    }
  }, [onClear]);

  const handleStartEdit = useCallback(() => {
    setEditPositionTitle(positionTitle || "");
    setEditDescription(description || "");
    setSelectedTemplateId(undefined);
    setIsEditing(true);
  }, [positionTitle, description]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditPositionTitle(positionTitle || "");
    setEditDescription(description || "");
    setSelectedTemplateId(undefined);
  }, [positionTitle, description]);

  const handleSaveEdit = useCallback(async () => {
    if (!onUpdate) return;
    if (!editDescription.trim()) {
      toast.error("Description is required");
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(editPositionTitle.trim(), editDescription.trim(), selectedTemplateId);
      setIsEditing(false);
      toast.success("Job description updated");
    } catch {
      toast.error("Failed to update job description");
    } finally {
      setIsSaving(false);
    }
  }, [onUpdate, editPositionTitle, editDescription, selectedTemplateId]);

  const handleLoadTemplate = useCallback((template: JobDescriptionTemplate) => {
    setEditPositionTitle(template.name);
    setEditDescription(template.description);
    setSelectedTemplateId(template._id);
    setOriginalContent({
      positionTitle: template.name,
      description: template.description,
    });
    if (onLoadTemplate) {
      onLoadTemplate(template);
    }
    toast.success(`Loaded template: ${template.name}`);
  }, [onLoadTemplate]);

  // Handle save template button click
  const handleSaveTemplateClick = useCallback(async () => {
    if (!canSaveTemplate || isSavingTemplate) return;

    if (isExistingTemplateName) {
      // Show confirmation dialog for updating existing template
      setShowUpdateConfirm(true);
    } else {
      // Create new template directly
      setIsSavingTemplate(true);
      try {
        await onSaveAsNewTemplate!(editPositionTitle.trim(), editDescription);
        toast.success(`Template "${editPositionTitle.trim()}" created`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save template"
        );
      } finally {
        setIsSavingTemplate(false);
      }
    }
  }, [canSaveTemplate, isSavingTemplate, isExistingTemplateName, editPositionTitle, editDescription, onSaveAsNewTemplate]);

  // Handle confirming overwrite of existing template
  const handleConfirmOverwrite = useCallback(async () => {
    if (!matchingTemplate || !onUpdateTemplate) return;
    setIsSavingTemplate(true);
    try {
      await onUpdateTemplate(matchingTemplate._id, editPositionTitle.trim(), editDescription);
      setOriginalContent({ positionTitle: editPositionTitle.trim(), description: editDescription });
      toast.success(`Template "${editPositionTitle.trim()}" updated`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update template"
      );
      throw error; // Re-throw so dialog stays open
    } finally {
      setIsSavingTemplate(false);
    }
  }, [matchingTemplate, editPositionTitle, editDescription, onUpdateTemplate]);

  // Handle saving as new with a different name
  const handleSaveAsNewWithName = useCallback(
    async (newName: string) => {
      if (!onSaveAsNewTemplate) return;
      setIsSavingTemplate(true);
      try {
        await onSaveAsNewTemplate(newName, editDescription);
        // Update position title to match new template name
        setEditPositionTitle(newName);
        toast.success(`Template "${newName}" created`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save template"
        );
        throw error; // Re-throw so dialog stays open
      } finally {
        setIsSavingTemplate(false);
      }
    },
    [editDescription, onSaveAsNewTemplate]
  );

  const handleCopy = useCallback(async () => {
    // In edit mode, copy the edit description; otherwise copy the displayed description
    const textToCopy = isEditing ? editDescription : description;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [isEditing, editDescription, description]);

  // Don't render section if no description AND no templates to manage
  if (!hasContent && !positionTitle && templates.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card shadow-hard-sm",
        "transition-all duration-150 hover:shadow-hard hover:-translate-y-0.5",
        className
      )}
    >
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between p-3 sm:p-4 text-left",
          "hover:bg-muted/50 transition-colors rounded-t-lg",
          !isOpen && "rounded-b-lg",
          "min-h-[48px]"
        )}
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <h3 className="font-heading font-semibold text-base sm:text-lg">
            Job Description
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasContent && (
            <span className="text-xs text-muted-foreground">
              {characterCount.toLocaleString()} chars
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Content - animated collapse */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              type: "spring",
              visualDuration: 0.15,
              bounce: 0.1,
            }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              {isEditing ? (
                /* Edit Mode */
                <>
                  {/* Template selector row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <TemplateSelector
                      templates={templates}
                      selectedTemplateId={selectedTemplateId}
                      onSelect={handleLoadTemplate}
                      onDelete={onDeleteTemplate}
                      onUpdate={onUpdateTemplate}
                    />
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setManagementOpen(true)}
                            className="border-2 gap-1.5 min-h-[44px]"
                          >
                            <Settings2 className="h-5 w-5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Manage</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Manage templates</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Template indicator badge */}
                    {loadedTemplate && (
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full border",
                          isModifiedFromTemplate
                            ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400"
                            : "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400"
                        )}
                      >
                        {isModifiedFromTemplate ? "Modified" : "From Template"}
                      </span>
                    )}

                    {/* Copy button */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopy}
                            disabled={!editDescription}
                            className="gap-1.5 border-2 min-h-[44px] min-w-[44px]"
                          >
                            {isCopied ? (
                              <Check className="h-5 w-5 sm:h-4 sm:w-4 text-green-600" />
                            ) : (
                              <Copy className="h-5 w-5 sm:h-4 sm:w-4" />
                            )}
                            <span className="hidden sm:inline">Copy</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy description to clipboard</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Position title input */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-position-title">Position Title</Label>
                    <Input
                      id="edit-position-title"
                      value={editPositionTitle}
                      onChange={(e) => setEditPositionTitle(e.target.value)}
                      placeholder="e.g., Software Engineer"
                      className="border-2 min-h-[44px]"
                    />
                  </div>

                  {/* Description textarea */}
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Enter job description..."
                      className={cn(
                        "border-2 resize-y min-h-[120px] sm:min-h-[180px]",
                        isOverLimit && "border-destructive focus-visible:ring-destructive"
                      )}
                      style={{ minHeight: "min(180px, 35vh)" }}
                    />
                    <div className="flex items-center justify-between">
                      {isOverLimit && (
                        <p className="text-xs text-destructive">
                          Exceeds {maxLength.toLocaleString()} character limit
                        </p>
                      )}
                      <p className={cn(
                        "text-xs text-muted-foreground ml-auto",
                        isOverLimit && "text-destructive"
                      )}>
                        {editCharacterCount.toLocaleString()}/{maxLength.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Save template row - dynamic based on whether name exists */}
                  {onSaveAsNewTemplate && (
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                      {/* Single dynamic save button */}
                      <div
                        className={cn(
                          "rounded-md border-2 transition-colors",
                          isExistingTemplateName
                            ? "border-blue-500 dark:border-blue-400"
                            : "border-emerald-500 dark:border-emerald-400"
                        )}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleSaveTemplateClick}
                          disabled={!canSaveTemplate || isSavingTemplate}
                          className={cn(
                            "gap-1.5 rounded-[4px] min-h-[44px]",
                            isExistingTemplateName
                              ? "text-blue-700 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-900/30"
                              : "text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-900/30"
                          )}
                        >
                          {isExistingTemplateName ? (
                            <>
                              <Save className="h-5 w-5 sm:h-4 sm:w-4" />
                              <span className="text-sm">{isSavingTemplate ? "Updating..." : "Update Template"}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-5 w-5 sm:h-4 sm:w-4" />
                              <span className="text-sm">{isSavingTemplate ? "Saving..." : "Save Template"}</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Status indicator */}
                      {editPositionTitle.trim() && (
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded border hidden xs:inline-block",
                            isExistingTemplateName
                              ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400"
                              : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400"
                          )}
                        >
                          {isExistingTemplateName ? "Existing" : "New"}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Edit action buttons */}
                  <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCancelEdit}
                      disabled={isSaving}
                      className="border-2 min-h-[44px]"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveEdit}
                      disabled={isSaving || !editDescription.trim() || isOverLimit}
                      className="min-h-[44px]"
                    >
                      {isSaving ? "Saving..." : "Save to Case"}
                    </Button>
                  </div>
                </>
              ) : (
                /* View Mode */
                <>
                  {/* Position title */}
                  {positionTitle && (
                    <div className="space-y-1">
                      <dt className="text-sm font-medium text-muted-foreground">
                        Position Title
                      </dt>
                      <dd className="text-sm">{positionTitle}</dd>
                    </div>
                  )}

                  {/* Description with action buttons */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <dt className="text-sm font-medium text-muted-foreground">
                        Description
                      </dt>
                      <div className="flex items-center gap-1 flex-wrap">
                        {/* Manage Templates button - always visible */}
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setManagementOpen(true);
                                }}
                                className="h-9 sm:h-8 gap-1.5 text-xs min-w-[44px] px-2 sm:px-3"
                              >
                                <Settings2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                <span>Templates</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Manage job description templates</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        {canEdit && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit();
                                  }}
                                  className="h-9 sm:h-8 gap-1.5 text-xs min-w-[44px] px-2 sm:px-3"
                                >
                                  <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                  <span>Edit</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit job description</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {hasContent && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopy();
                                  }}
                                  className="h-9 sm:h-8 gap-1.5 text-xs min-w-[44px] px-2 sm:px-3"
                                >
                                  {isCopied ? (
                                    <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                  )}
                                  <span>Copy</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copy description to clipboard</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {onClear && hasContent && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleClear();
                                  }}
                                  disabled={isClearing}
                                  className="h-9 sm:h-8 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 min-w-[44px] px-2 sm:px-3"
                                >
                                  <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                                  <span>{isClearing ? "Clearing..." : "Clear"}</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Clear job description from this case</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                    {hasContent ? (
                      <dd className="text-sm whitespace-pre-wrap rounded-lg border-2 border-border bg-muted/30 p-3">
                        {description}
                      </dd>
                    ) : (
                      <dd className="text-sm text-muted-foreground italic">
                        No description provided
                      </dd>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Template Management Modal */}
      <TemplateManagementModal
        open={managementOpen}
        onOpenChange={setManagementOpen}
        templates={templates}
        onSelect={(template) => {
          handleLoadTemplate(template);
          setManagementOpen(false);
        }}
        onDelete={onDeleteTemplate}
        onUpdate={onUpdateTemplate}
      />

      {/* Template Update Confirmation Dialog */}
      <TemplateUpdateConfirmDialog
        open={showUpdateConfirm}
        onOpenChange={setShowUpdateConfirm}
        templateName={editPositionTitle.trim()}
        onConfirmOverwrite={handleConfirmOverwrite}
        onSaveAsNew={handleSaveAsNewWithName}
        existingTemplateNames={templates.map((t) => t.name)}
      />
    </div>
  );
}

export default JobDescriptionDetailView;
