"use client";

import * as React from "react";
import { useState, useCallback, useEffect } from "react";
import {
  ChevronDown,
  Copy,
  Check,
  FileText,
  Save,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateSelector } from "./TemplateSelector";
import { toast } from "@/lib/toast";

// ============================================================================
// TYPES
// ============================================================================

export interface JobDescriptionTemplate {
  _id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
  lastUsedAt?: number;
}

export interface JobDescriptionFieldProps {
  /** Current position title from form (inherited) */
  inheritedPositionTitle: string;
  /** Current job description position title (may differ from inherited) */
  positionTitle: string;
  /** Current job description text */
  description: string;
  /** Callback when position title changes */
  onPositionTitleChange: (value: string) => void;
  /** Callback when description changes */
  onDescriptionChange: (value: string) => void;
  /** Available templates */
  templates: JobDescriptionTemplate[];
  /** Currently loaded template ID (if any) */
  loadedTemplateId?: string;
  /** Callback to set the loaded template ID */
  setLoadedTemplateId?: (id: string | undefined) => void;
  /** Callback when template is loaded */
  onLoadTemplate: (template: JobDescriptionTemplate) => void;
  /** Callback when saving as new template */
  onSaveAsNewTemplate: (name: string, description: string) => Promise<void>;
  /** Callback when updating existing template */
  onUpdateTemplate: (id: string, name: string, description: string) => Promise<void>;
  /** Callback when permanently deleting a template */
  onDeleteTemplate?: (id: string) => Promise<{ success: boolean; clearedReferences: number }>;
  /** Whether the field is in a loading state */
  isLoading?: boolean;
  /** Maximum character count for description */
  maxLength?: number;
  /** Whether section starts expanded */
  defaultExpanded?: boolean;
  /** Additional className */
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_MAX_LENGTH = 10000;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * JobDescriptionField Component
 *
 * Expandable job description field with template support.
 * Features:
 * - Inherits position title from form (editable independently)
 * - Template loading via dropdown
 * - Save as new / Update template options
 * - Copy to clipboard
 * - Character count
 * - Modified indicator when changed after loading template
 *
 * @example
 * ```tsx
 * <JobDescriptionField
 *   inheritedPositionTitle={formData.positionTitle}
 *   positionTitle={jobDescPositionTitle}
 *   description={jobDescription}
 *   onPositionTitleChange={setJobDescPositionTitle}
 *   onDescriptionChange={setJobDescription}
 *   templates={templates}
 *   onLoadTemplate={handleLoadTemplate}
 *   onSaveAsNewTemplate={handleSaveNew}
 *   onUpdateTemplate={handleUpdate}
 * />
 * ```
 */
export function JobDescriptionField({
  inheritedPositionTitle,
  positionTitle,
  description,
  onPositionTitleChange,
  onDescriptionChange,
  templates,
  loadedTemplateId,
  setLoadedTemplateId,
  onLoadTemplate,
  onSaveAsNewTemplate,
  onUpdateTemplate,
  onDeleteTemplate,
  isLoading = false,
  maxLength = DEFAULT_MAX_LENGTH,
  defaultExpanded = false,
  className,
}: JobDescriptionFieldProps) {
  // ============================================================================
  // STATE
  // ============================================================================

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<{ name: string; description: string } | null>(null);

  // Track whether JD position title auto-follows the inherited position title.
  // Starts true when empty or matching inherited. Stops when user manually edits.
  // Re-enabled by clicking the reset button or clearing.
  const [isTrackingInherited, setIsTrackingInherited] = useState(
    !positionTitle || positionTitle === inheritedPositionTitle
  );

  // Track if content has been modified since loading a template
  const [originalContent, setOriginalContent] = useState<{
    positionTitle: string;
    description: string;
  } | null>(null);

  const isModified =
    loadedTemplateId &&
    originalContent &&
    (positionTitle !== originalContent.positionTitle ||
      description !== originalContent.description);

  const loadedTemplate = templates.find((t) => t._id === loadedTemplateId);
  const hasContent = positionTitle.trim() || description.trim();
  const characterCount = description.length;
  const isOverLimit = characterCount > maxLength;

  // Check if position title matches an existing template (case-insensitive)
  const matchingTemplate = templates.find(
    (t) => t.name.toLowerCase() === positionTitle.trim().toLowerCase()
  );
  const isExistingTemplateName = !!matchingTemplate;
  const canSaveTemplate = positionTitle.trim() && description.trim() && !isOverLimit;

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-sync JD position title from inherited when tracking is active
  useEffect(() => {
    if (isTrackingInherited) {
      onPositionTitleChange(inheritedPositionTitle);
    }
  }, [inheritedPositionTitle, isTrackingInherited, onPositionTitleChange]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleCopy = useCallback(async () => {
    if (!description) return;

    try {
      await navigator.clipboard.writeText(description);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [description]);

  const handleClear = useCallback(() => {
    onPositionTitleChange("");
    onDescriptionChange("");
    setOriginalContent(null);
    setIsTrackingInherited(true);
    if (setLoadedTemplateId) {
      setLoadedTemplateId(undefined);
    }
    toast.success("Job description cleared");
  }, [onPositionTitleChange, onDescriptionChange, setLoadedTemplateId]);

  const handleLoadTemplate = useCallback(
    (template: JobDescriptionTemplate) => {
      setIsTrackingInherited(false);
      onLoadTemplate(template);
      setOriginalContent({
        positionTitle: template.name,
        description: template.description,
      });
      toast.success(`Loaded template: ${template.name}`);
    },
    [onLoadTemplate]
  );

  // Handle save button click - either update existing or create new
  const handleSaveClick = useCallback(async () => {
    if (!canSaveTemplate || isSaving) return;

    if (isExistingTemplateName && matchingTemplate) {
      // Name matches a known template — update directly
      setIsSaving(true);
      try {
        await onUpdateTemplate(matchingTemplate._id, positionTitle.trim(), description);
        setOriginalContent({ positionTitle: positionTitle.trim(), description });
        toast.success(`Template "${positionTitle.trim()}" updated`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update template"
        );
      } finally {
        setIsSaving(false);
      }
    } else {
      // Attempt to create new template
      setIsSaving(true);
      try {
        await onSaveAsNewTemplate(positionTitle.trim(), description);
        toast.success(`Template "${positionTitle.trim()}" saved`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : "";
        if (msg.startsWith("TEMPLATE_EXISTS:")) {
          // Server found a duplicate the client didn't know about — ask to update
          setPendingUpdate({ name: positionTitle.trim(), description });
        } else {
          toast.error(msg || "Failed to save template");
        }
      } finally {
        setIsSaving(false);
      }
    }
  }, [canSaveTemplate, isSaving, isExistingTemplateName, matchingTemplate, positionTitle, description, onSaveAsNewTemplate, onUpdateTemplate]);

  // Handle confirming update after server reports duplicate
  const handleConfirmPendingUpdate = useCallback(async () => {
    if (!pendingUpdate) return;
    // Re-check templates for the matching ID
    const match = templates.find(
      (t) => t.name.toLowerCase() === pendingUpdate.name.toLowerCase()
    );
    if (!match) {
      // Template may have been deleted in the meantime — retry create
      setPendingUpdate(null);
      try {
        await onSaveAsNewTemplate(pendingUpdate.name, pendingUpdate.description);
        toast.success(`Template "${pendingUpdate.name}" saved`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save template");
      }
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateTemplate(match._id, pendingUpdate.name, pendingUpdate.description);
      setOriginalContent({ positionTitle: pendingUpdate.name, description: pendingUpdate.description });
      toast.success(`Template "${pendingUpdate.name}" updated`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update template");
    } finally {
      setIsSaving(false);
      setPendingUpdate(null);
    }
  }, [pendingUpdate, templates, onUpdateTemplate, onSaveAsNewTemplate]);


  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className={cn(
        "rounded-lg border-2 border-border bg-card",
        "transition-all duration-150",
        isExpanded && "shadow-hard-sm",
        !isExpanded && "hover:shadow-hard-sm hover:-translate-y-0.5",
        className
      )}
    >
      {/* Header - Clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "flex w-full items-center justify-between p-3 sm:p-4 text-left",
          "hover:bg-muted/50 transition-colors",
          "rounded-t-lg",
          !isExpanded && "rounded-b-lg",
          "min-h-[48px]"
        )}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <span className="font-heading font-semibold text-base sm:text-lg">
              Job Description
            </span>
            {/* Template indicator badge */}
            {loadedTemplate && (
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full border",
                  isModified
                    ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400"
                    : "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400"
                )}
              >
                {isModified ? "Modified" : "From Template"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Character count badge (when expanded or has content) */}
          {(isExpanded || hasContent) && (
            <span
              className={cn(
                "text-xs text-muted-foreground",
                isOverLimit && "text-destructive font-medium"
              )}
            >
              {characterCount.toLocaleString()}/{maxLength.toLocaleString()}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {/* Content - Animated expand/collapse */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0, overflow: "hidden" }}
            animate={{ height: "auto", opacity: 1, overflow: "visible" }}
            exit={{ height: 0, opacity: 0, overflow: "hidden" }}
            transition={{
              type: "spring",
              visualDuration: 0.15,
              bounce: 0.1,
              overflow: { delay: 0.15 },
            }}
          >
            <div className="px-4 pb-4 pt-1 space-y-4">
              {/* Template selector row */}
              <div className="flex items-center gap-2 flex-wrap">
                <TemplateSelector
                  templates={templates}
                  selectedTemplateId={loadedTemplateId}
                  onSelect={handleLoadTemplate}
                  onDelete={onDeleteTemplate}
                  onUpdate={onUpdateTemplate}
                  disabled={isLoading}
                />

                {/* Copy button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        disabled={!description || isLoading}
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

                {/* Clear button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleClear}
                        disabled={!hasContent || isLoading}
                        className="gap-1.5 border-2 text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
                      >
                        <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                        <span className="hidden sm:inline">Clear</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Clear job description</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Position title input */}
              <div className="space-y-2">
                <Label htmlFor="job-desc-position" className="text-sm font-medium">
                  Position Title for Job Description
                </Label>
                <div className="relative">
                  <Input
                    id="job-desc-position"
                    value={positionTitle}
                    onChange={(e) => {
                      setIsTrackingInherited(false);
                      onPositionTitleChange(e.target.value);
                    }}
                    placeholder="e.g., Software Engineer"
                    disabled={isLoading}
                    maxLength={200}
                    className="border-2 min-h-[44px]"
                  />
                  {positionTitle !== inheritedPositionTitle && positionTitle && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => {
                              setIsTrackingInherited(true);
                              onPositionTitleChange(inheritedPositionTitle);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
                          >
                            <RefreshCw className="h-5 w-5 sm:h-4 sm:w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Reset to inherited title</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isTrackingInherited
                    ? "Auto-syncing from Position Title above. Edit to set a custom title."
                    : "Custom title. Click the reset icon to re-sync with Position Title."}
                </p>
              </div>

              {/* Description textarea - fewer rows on mobile for better UX */}
              <div className="space-y-2">
                <Label htmlFor="job-description" className="text-sm font-medium">
                  Job Description
                </Label>
                <Textarea
                  id="job-description"
                  value={description}
                  onChange={(e) => onDescriptionChange(e.target.value)}
                  placeholder="Enter the job description for PERM postings..."
                  disabled={isLoading}
                  className={cn(
                    "border-2 resize-y min-h-[100px] sm:min-h-[120px]",
                    "rows-5 sm:rows-8", // Tailwind doesn't support rows directly, handled via style
                    isOverLimit && "border-destructive focus-visible:ring-destructive"
                  )}
                  style={{ minHeight: "min(120px, 30vh)" }} // Dynamic min height for mobile
                />
                {isOverLimit && (
                  <p className="text-xs text-destructive">
                    Description exceeds maximum length of {maxLength.toLocaleString()} characters
                  </p>
                )}
              </div>

              {/* Save template row - dynamic based on whether name exists */}
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
                    onClick={handleSaveClick}
                    disabled={!canSaveTemplate || isLoading || isSaving}
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
                        <span className="text-sm">{isSaving ? "Updating..." : "Update Template"}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5 sm:h-4 sm:w-4" />
                        <span className="text-sm">{isSaving ? "Saving..." : "Save Template"}</span>
                      </>
                    )}
                  </Button>
                </div>

                {/* Status indicator - hidden on very small screens to save space */}
                {positionTitle.trim() && (
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

                <span className="text-xs text-muted-foreground ml-auto hidden sm:inline">
                  Changes auto-save to case
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation dialog when server finds existing template */}
      <Dialog open={!!pendingUpdate} onOpenChange={(open) => { if (!open) setPendingUpdate(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Template already exists</DialogTitle>
            <DialogDescription>
              A template named &ldquo;{pendingUpdate?.name}&rdquo; already exists. Would you like to update it with the current content?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingUpdate(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPendingUpdate} disabled={isSaving}>
              {isSaving ? "Updating..." : "Update Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default JobDescriptionField;
