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
import { TemplateSelector } from "./TemplateSelector";
import { TemplateSaveDialog } from "./TemplateSaveDialog";
import { toast } from "@/lib/toast";

// ============================================================================
// TYPES
// ============================================================================

export interface JobDescriptionTemplate {
  _id: string;
  name: string; // Position title used as template name
  description: string;
  createdAt: number;
  updatedAt: number;
  usageCount: number;
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
  /** Callback when template is loaded */
  onLoadTemplate: (template: JobDescriptionTemplate) => void;
  /** Callback when saving as new template */
  onSaveAsNewTemplate: (name: string, description: string) => Promise<void>;
  /** Callback when updating existing template */
  onUpdateTemplate: (id: string, name: string, description: string) => Promise<void>;
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
  onLoadTemplate,
  onSaveAsNewTemplate,
  onUpdateTemplate,
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
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<"new" | "update">("new");

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

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Auto-inherit position title when it changes and no custom title is set
  useEffect(() => {
    if (!positionTitle && inheritedPositionTitle) {
      onPositionTitleChange(inheritedPositionTitle);
    }
  }, [inheritedPositionTitle, positionTitle, onPositionTitleChange]);

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

  const handleLoadTemplate = useCallback(
    (template: JobDescriptionTemplate) => {
      onLoadTemplate(template);
      setOriginalContent({
        positionTitle: template.name,
        description: template.description,
      });
      toast.success(`Loaded template: ${template.name}`);
    },
    [onLoadTemplate]
  );

  const handleSaveAsNew = useCallback(() => {
    setSaveMode("new");
    setIsSaveDialogOpen(true);
  }, []);

  const handleUpdateTemplate = useCallback(() => {
    setSaveMode("update");
    setIsSaveDialogOpen(true);
  }, []);

  const handleSaveConfirm = useCallback(
    async (name: string, desc: string) => {
      try {
        if (saveMode === "new") {
          await onSaveAsNewTemplate(name, desc);
          toast.success(`Template "${name}" created`);
        } else if (loadedTemplateId) {
          await onUpdateTemplate(loadedTemplateId, name, desc);
          setOriginalContent({ positionTitle: name, description: desc });
          toast.success(`Template "${name}" updated`);
        }
        setIsSaveDialogOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to save template"
        );
      }
    },
    [saveMode, loadedTemplateId, onSaveAsNewTemplate, onUpdateTemplate]
  );

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
            <div className="px-4 pb-4 space-y-4">
              {/* Template selector row */}
              <div className="flex items-center gap-2 flex-wrap">
                <TemplateSelector
                  templates={templates}
                  selectedTemplateId={loadedTemplateId}
                  onSelect={handleLoadTemplate}
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
                        className="gap-1.5 border-2"
                      >
                        {isCopied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
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
                <Label htmlFor="job-desc-position" className="text-sm font-medium">
                  Position Title for Job Description
                </Label>
                <div className="relative">
                  <Input
                    id="job-desc-position"
                    value={positionTitle}
                    onChange={(e) => onPositionTitleChange(e.target.value)}
                    placeholder="e.g., Software Engineer"
                    disabled={isLoading}
                    className="border-2"
                  />
                  {positionTitle !== inheritedPositionTitle && positionTitle && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => onPositionTitleChange(inheritedPositionTitle)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Reset to inherited title</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Inherited from Position Title above. Edit if needed for the job description.
                </p>
              </div>

              {/* Description textarea */}
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
                  rows={8}
                  className={cn(
                    "border-2 resize-y min-h-[120px]",
                    isOverLimit && "border-destructive focus-visible:ring-destructive"
                  )}
                />
                {isOverLimit && (
                  <p className="text-xs text-destructive">
                    Description exceeds maximum length of {maxLength.toLocaleString()} characters
                  </p>
                )}
              </div>

              {/* Save options row */}
              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSaveAsNew}
                  disabled={!positionTitle.trim() || !description.trim() || isLoading}
                  className="gap-1.5 border-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Save as New Template
                </Button>

                {loadedTemplateId && isModified && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUpdateTemplate}
                    disabled={!positionTitle.trim() || !description.trim() || isLoading}
                    className="gap-1.5 border-2"
                  >
                    <Save className="h-4 w-4" />
                    Update Template
                  </Button>
                )}

                <span className="text-xs text-muted-foreground ml-auto">
                  Changes auto-save to case
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save dialog */}
      <TemplateSaveDialog
        open={isSaveDialogOpen}
        onOpenChange={setIsSaveDialogOpen}
        mode={saveMode}
        currentName={positionTitle}
        currentDescription={description}
        existingTemplateNames={templates.map((t) => t.name)}
        loadedTemplateName={loadedTemplate?.name}
        onSave={handleSaveConfirm}
      />
    </div>
  );
}

export default JobDescriptionField;
