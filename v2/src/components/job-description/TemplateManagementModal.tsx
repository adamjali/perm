"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Trash2,
  FileText,
  Pencil,
  Copy,
  Check,
  X,
  ChevronRight,
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
  /** Callback when template is deleted */
  onDelete?: (id: string) => Promise<void>;
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

    // Check for duplicate names
    const isDuplicate = templates.some(
      (t) =>
        t._id !== selectedTemplate._id &&
        t.name.toLowerCase() === editName.toLowerCase()
    );
    if (isDuplicate) {
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
    } catch {
      toast.error("Failed to update template");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmId || !onDelete) return;

    setIsProcessing(true);
    try {
      await onDelete(deleteConfirmId);
      if (selectedTemplate?._id === deleteConfirmId) {
        setSelectedTemplate(null);
      }
      setDeleteConfirmId(null);
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!selectedTemplate) return;

    try {
      await navigator.clipboard.writeText(selectedTemplate.description);
      setIsCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleUseTemplate = () => {
    if (!selectedTemplate || !onSelect) return;
    onSelect(selectedTemplate);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-2 shadow-hard max-w-4xl h-[80vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b-2 border-border shrink-0">
            <DialogTitle className="font-heading text-xl">
              Manage Job Description Templates
            </DialogTitle>
            <DialogDescription>
              View, edit, and manage your saved job description templates.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-1 min-h-0">
            {/* Left panel - Template list */}
            <div className="w-1/3 border-r-2 border-border flex flex-col">
              {/* Search */}
              <div className="p-3 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="pl-8 border-2 text-sm"
                  />
                </div>
              </div>

              {/* Template list */}
              <ScrollArea className="flex-1">
                {sortedTemplates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mb-3" />
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
                          "w-full text-left p-3 rounded-lg transition-colors",
                          "hover:bg-muted/50",
                          selectedTemplate?._id === template._id &&
                            "bg-muted border-2 border-border"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{template.name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {template.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Used {template.usageCount}× • Updated {formatDate(template.updatedAt)}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right panel - Template detail/edit */}
            <div className="flex-1 flex flex-col">
              <AnimatePresence mode="wait">
                {selectedTemplate ? (
                  <motion.div
                    key={selectedTemplate._id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 flex flex-col"
                  >
                    {/* Detail header */}
                    <div className="p-4 border-b border-border flex items-center justify-between">
                      {editMode ? (
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="font-heading text-lg font-semibold border-2 max-w-sm"
                          placeholder="Template name"
                        />
                      ) : (
                        <h3 className="font-heading text-lg font-semibold">
                          {selectedTemplate.name}
                        </h3>
                      )}

                      <div className="flex items-center gap-2">
                        {editMode ? (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              disabled={isProcessing}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSaveEdit}
                              disabled={
                                isProcessing ||
                                !editName.trim() ||
                                !editDescription.trim()
                              }
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCopy}
                              className="gap-1.5"
                            >
                              {isCopied ? (
                                <Check className="h-4 w-4 text-green-600" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            {onUpdate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleStartEdit}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {onDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteConfirmId(selectedTemplate._id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Detail content */}
                    <ScrollArea className="flex-1 p-4">
                      {editMode ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                              rows={12}
                              className="border-2 resize-y"
                              placeholder="Job description..."
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground mb-2">
                              Description
                            </p>
                            <div className="rounded-lg border-2 border-border bg-muted/30 p-4">
                              <p className="text-sm whitespace-pre-wrap">
                                {selectedTemplate.description}
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Created</p>
                              <p>{formatDate(selectedTemplate.createdAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Last Updated</p>
                              <p>{formatDate(selectedTemplate.updatedAt)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Usage Count</p>
                              <p>{selectedTemplate.usageCount} times</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Characters</p>
                              <p>{selectedTemplate.description.length.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </ScrollArea>

                    {/* Action footer */}
                    {!editMode && onSelect && (
                      <div className="p-4 border-t border-border">
                        <Button onClick={handleUseTemplate} className="w-full gap-2">
                          <FileText className="h-4 w-4" />
                          Use This Template
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 flex flex-col items-center justify-center text-center p-8"
                  >
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium text-muted-foreground">
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
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent className="border-2">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the template.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-2">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default TemplateManagementModal;
