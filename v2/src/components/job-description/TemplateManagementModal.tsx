"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Trash2,
  FileText,
  Pencil,
  Copy,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/lib/toast";
import type { JobDescriptionTemplate } from "./JobDescriptionField";
import { formatTemplateDate, copyToClipboard, isTemplateNameTaken } from "./shared";

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateManagementModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Available templates */
  templates: JobDescriptionTemplate[];
  /** Callback when template is selected for use */
  onSelect?: (template: JobDescriptionTemplate) => void;
  /** Callback when template is permanently deleted */
  onDelete?: (id: string) => Promise<{ success: boolean; clearedReferences: number }>;
  /** Callback when template is updated */
  onUpdate?: (id: string, name: string, description: string) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TemplateManagementModal Component
 *
 * Full management interface for job description templates.
 * Features:
 * - Search/filter templates
 * - View, edit, delete templates
 * - Copy description to clipboard
 * - Select template for use
 *
 * @example
 * ```tsx
 * <TemplateManagementModal
 *   open={managementOpen}
 *   onOpenChange={setManagementOpen}
 *   templates={templates}
 *   onSelect={handleSelect}
 *   onDelete={handleDelete}
 *   onUpdate={handleUpdate}
 * />
 * ```
 */
export function TemplateManagementModal({
  open,
  onOpenChange,
  templates,
  onSelect,
  onDelete,
  onUpdate,
}: TemplateManagementModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<JobDescriptionTemplate | null>(
    null
  );
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Mobile view state - on mobile, show either list or detail, not both
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Sort templates alphabetically
  const sortedTemplates = useMemo(
    () => [...filteredTemplates].sort((a, b) => a.name.localeCompare(b.name)),
    [filteredTemplates]
  );

  // Handlers
  const handleSelectTemplate = (template: JobDescriptionTemplate) => {
    setSelectedTemplate(template);
    setEditMode(false);
    // On mobile, switch to detail view when selecting
    if (isMobile) {
      setMobileView("detail");
    }
  };

  const handleBackToList = () => {
    setMobileView("list");
  };

  const handleStartEdit = () => {
    if (!selectedTemplate) return;
    setEditName(selectedTemplate.name);
    setEditDescription(selectedTemplate.description);
    setEditMode(true);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditName("");
    setEditDescription("");
  };

  const handleSaveEdit = async () => {
    if (!selectedTemplate || !onUpdate) return;
    if (!editName.trim() || !editDescription.trim()) return;

    // Check for duplicate names using shared utility
    if (isTemplateNameTaken(templates, editName.trim(), selectedTemplate._id)) {
      toast.error("A template with this name already exists");
      return;
    }

    setIsProcessing(true);
    try {
      await onUpdate(selectedTemplate._id, editName.trim(), editDescription.trim());
      setSelectedTemplate({
        ...selectedTemplate,
        name: editName.trim(),
        description: editDescription.trim(),
      });
      setEditMode(false);
      toast.success("Template updated");
    } catch (error) {
      console.error("[TemplateManagementModal] Update failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update template");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId || !onDelete) return;

    setIsProcessing(true);
    try {
      const result = await onDelete(deleteConfirmId);
      if (selectedTemplate?._id === deleteConfirmId) {
        setSelectedTemplate(null);
        // On mobile, go back to list view when selected template is deleted
        if (isMobile) {
          setMobileView("list");
        }
      }
      setDeleteConfirmId(null);
      if (result.clearedReferences > 0) {
        toast.success(
          `Template deleted. Removed reference from ${result.clearedReferences} case${result.clearedReferences === 1 ? "" : "s"}.`
        );
      } else {
        toast.success("Template permanently deleted");
      }
    } catch (error) {
      console.error("[TemplateManagementModal] Delete failed:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete template");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!selectedTemplate) return;

    const success = await copyToClipboard(selectedTemplate.description);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate || !onSelect) return;
    onSelect(selectedTemplate);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-2 shadow-hard !max-w-[98vw] sm:!max-w-[96vw] md:!max-w-[94vw] lg:!max-w-[1400px] xl:!max-w-[1600px] w-[98vw] sm:w-[96vw] md:w-[94vw] h-[92vh] sm:h-[88vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b-2 border-border shrink-0">
            {/* Mobile: Show back button when in detail view */}
            {isMobile && mobileView === "detail" && selectedTemplate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBackToList}
                className="w-fit -ml-2 mb-2 gap-1.5 min-h-[44px]"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Templates
              </Button>
            )}
            <DialogTitle className="font-heading text-lg sm:text-xl">
              {isMobile && mobileView === "detail" && selectedTemplate
                ? selectedTemplate.name
                : "Manage Job Description Templates"}
            </DialogTitle>
            {(!isMobile || mobileView === "list") && (
              <DialogDescription>
                View, edit, and manage your saved job description templates.
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
            {/* Left panel - Template list (hidden on mobile when viewing detail) */}
            <div
              className={cn(
                "sm:w-[380px] md:w-[420px] lg:w-[480px] shrink-0 border-b-2 sm:border-b-0 sm:border-r-2 border-border flex flex-col overflow-hidden",
                isMobile && mobileView === "detail" && "hidden"
              )}
            >
              {/* Search */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 border-2 text-sm min-h-[44px]"
                  />
                </div>
              </div>

              {/* Template list */}
              <ScrollArea className="flex-1">
                {sortedTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center">
                    <FileText className="h-10 sm:h-12 w-10 sm:w-12 text-muted-foreground mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? "No templates match your search"
                        : "No templates yet"}
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    {sortedTemplates.map((template) => (
                      <button
                        key={template._id}
                        onClick={() => handleSelectTemplate(template)}
                        className={cn(
                          "w-full text-left p-3 sm:p-3 rounded-lg transition-colors",
                          "hover:bg-muted/50 active:bg-muted/70",
                          "min-h-[64px]", // Touch-friendly minimum height
                          selectedTemplate?._id === template._id &&
                            "bg-muted border-2 border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                          <span className="font-medium truncate flex-1 min-w-0">{template.name}</span>
                          <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Used {template.usageCount}× • Updated {formatTemplateDate(template.updatedAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right panel - Template detail/edit (hidden on mobile when showing list) */}
            <div
              className={cn(
                "flex-1 flex flex-col min-w-0 overflow-hidden",
                isMobile && mobileView === "list" && "hidden"
              )}
            >
              <AnimatePresence mode="wait">
                {selectedTemplate ? (
                  <motion.div
                    key={selectedTemplate._id}
                    initial={{ opacity: 0, x: isMobile ? 0 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: isMobile ? 0 : -20 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex flex-col"
                  >
                    {/* Detail header - hidden on mobile since title is in DialogHeader */}
                    <div className={cn(
                      "p-3 sm:p-4 border-b border-border flex items-center justify-between gap-2",
                      isMobile && "hidden sm:flex"
                    )}>
                      {editMode ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="font-heading text-base sm:text-lg font-semibold border-2 flex-1 min-w-0 max-w-sm min-h-[44px]"
                          placeholder="Template name"
                        />
                      ) : (
                        <h3 className="font-heading text-base sm:text-lg font-semibold truncate">
                          {selectedTemplate.name}
                        </h3>
                      )}

                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {editMode ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={isProcessing}
                              className="min-h-[44px] min-w-[44px]"
                            >
                              <X className="h-5 w-5 sm:h-4 sm:w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={
                                isProcessing ||
                                !editName.trim() ||
                                !editDescription.trim()
                              }
                              className="min-h-[44px] min-w-[44px]"
                            >
                              <Check className="h-5 w-5 sm:h-4 sm:w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopy}
                              className="gap-1.5 min-h-[44px] min-w-[44px]"
                            >
                              {isCopied ? (
                                <Check className="h-5 w-5 sm:h-4 sm:w-4 text-green-600" />
                              ) : (
                                <Copy className="h-5 w-5 sm:h-4 sm:w-4" />
                              )}
                            </Button>
                            {onUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleStartEdit}
                                className="min-h-[44px] min-w-[44px]"
                              >
                                <Pencil className="h-5 w-5 sm:h-4 sm:w-4" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirmId(selectedTemplate._id)}
                                className="text-destructive hover:text-destructive min-h-[44px] min-w-[44px]"
                              >
                                <Trash2 className="h-5 w-5 sm:h-4 sm:w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Mobile action bar when viewing detail */}
                    {isMobile && !editMode && (
                      <div className="p-3 border-b border-border flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCopy}
                          className="gap-1.5 min-h-[44px]"
                        >
                          {isCopied ? (
                            <Check className="h-5 w-5 text-green-600" />
                          ) : (
                            <Copy className="h-5 w-5" />
                          )}
                          <span className="text-sm">Copy</span>
                        </Button>
                        {onUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleStartEdit}
                            className="gap-1.5 min-h-[44px]"
                          >
                            <Pencil className="h-5 w-5" />
                            <span className="text-sm">Edit</span>
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirmId(selectedTemplate._id)}
                            className="text-destructive hover:text-destructive gap-1.5 min-h-[44px]"
                          >
                            <Trash2 className="h-5 w-5" />
                            <span className="text-sm">Delete</span>
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Mobile edit header when editing */}
                    {isMobile && editMode && (
                      <div className="p-3 border-b border-border space-y-3">
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="font-heading text-base font-semibold border-2 min-h-[44px]"
                          placeholder="Template name"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                            disabled={isProcessing}
                            className="min-h-[44px] border-2"
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={
                              isProcessing ||
                              !editName.trim() ||
                              !editDescription.trim()
                            }
                            className="min-h-[44px]"
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Detail content */}
                    <ScrollArea className="flex-1 p-3 sm:p-4">
                      {editMode ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={isMobile ? 8 : 12}
                              className="border-2 resize-y min-h-[120px]"
                              placeholder="Job description..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Metadata row - compact */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-b border-border pb-3">
                            <span>Created {formatTemplateDate(selectedTemplate.createdAt)}</span>
                            <span>Updated {formatTemplateDate(selectedTemplate.updatedAt)}</span>
                            <span>Used {selectedTemplate.usageCount} times</span>
                            <span>{selectedTemplate.description.length.toLocaleString()} chars</span>
                          </div>

                          {/* Description - takes remaining space */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-muted-foreground mb-2">
                              Description
                            </p>
                            <div className="rounded-lg border-2 border-border bg-muted/30 p-3 sm:p-4 overflow-auto">
                              <p className="text-sm whitespace-pre-wrap break-words">
                                {selectedTemplate.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </ScrollArea>

                    {/* Action footer */}
                    {!editMode && onSelect && (
                      <div className="p-3 sm:p-4 border-t border-border">
                        <Button onClick={handleUseTemplate} className="w-full gap-2 min-h-[48px]">
                          <FileText className="h-5 w-5 sm:h-4 sm:w-4" />
                          Use This Template
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "flex-1 flex flex-col items-center justify-center text-center p-6 sm:p-8",
                      isMobile && "hidden" // On mobile, we show list by default
                    )}
                  >
                    <FileText className="h-12 sm:h-16 w-12 sm:w-16 text-muted-foreground mb-4" />
                    <p className="text-base sm:text-lg font-medium text-muted-foreground">
                      Select a template
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a template from the list to view or edit
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteConfirmId}
        onOpenChange={(open: boolean) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent className="border-2">
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Template?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                This action cannot be undone. The template will be permanently removed from the database.
              </span>
              <span className="block text-amber-600 dark:text-amber-400">
                Any cases using this template will retain their job description content, but the template link will be removed.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isProcessing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isProcessing ? "Deleting..." : "Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TemplateManagementModal;
