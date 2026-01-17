"use client";

import { useState, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateSaveDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Save mode: new template or update existing */
  mode: "new" | "update";
  /** Current position title (template name) */
  currentName: string;
  /** Current description */
  currentDescription: string;
  /** Existing template names (for duplicate checking) */
  existingTemplateNames: string[];
  /** Name of the loaded template (for update mode) */
  loadedTemplateName?: string;
  /** Callback when save is confirmed */
  onSave: (name: string, description: string) => Promise<void>;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TemplateSaveDialog Component
 *
 * Dialog for saving job description templates.
 * Handles both "Save as New" and "Update Template" modes.
 * Features:
 * - Duplicate name detection with warning
 * - Pre-fills current values
 * - Validates required fields
 *
 * @example
 * ```tsx
 * <TemplateSaveDialog
 *   open={isSaveDialogOpen}
 *   onOpenChange={setIsSaveDialogOpen}
 *   mode="new"
 *   currentName={positionTitle}
 *   currentDescription={description}
 *   existingTemplateNames={templates.map(t => t.name)}
 *   onSave={handleSave}
 * />
 * ```
 */
export function TemplateSaveDialog({
  open,
  onOpenChange,
  mode,
  currentName,
  currentDescription,
  existingTemplateNames,
  loadedTemplateName,
  onSave,
}: TemplateSaveDialogProps) {
  const [name, setName] = useState(currentName);
  const [isSaving, setIsSaving] = useState(false);

  // Reset name when dialog opens
  useEffect(() => {
    if (open) {
      setName(currentName);
    }
  }, [open, currentName]);

  // Check for duplicate names (excluding current template in update mode)
  const isDuplicate =
    mode === "new"
      ? existingTemplateNames.some(
          (n) => n.toLowerCase() === name.toLowerCase()
        )
      : existingTemplateNames.some(
          (n) =>
            n.toLowerCase() === name.toLowerCase() &&
            n.toLowerCase() !== loadedTemplateName?.toLowerCase()
        );

  const canSave = name.trim() && currentDescription.trim() && !isDuplicate;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    try {
      await onSave(name.trim(), currentDescription);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-2 shadow-hard sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {mode === "new" ? "Save as New Template" : "Update Template"}
          </DialogTitle>
          <DialogDescription>
            {mode === "new"
              ? "Save the current job description as a reusable template."
              : `Update the "${loadedTemplateName}" template with current content.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name (Position Title)</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Software Engineer"
              className={cn(
                "border-2",
                isDuplicate && "border-destructive focus-visible:ring-destructive"
              )}
              autoFocus
            />
            {isDuplicate && (
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-sm">
                  A template with this name already exists. Please choose a different name.
                </p>
              </div>
            )}
            {!name.trim() && (
              <p className="text-sm text-muted-foreground">
                Position title is required for the template name.
              </p>
            )}
          </div>

          <div className="rounded-lg border-2 border-border bg-muted/30 p-3">
            <p className="text-sm text-muted-foreground mb-1">Description Preview</p>
            <p className="text-sm line-clamp-3">
              {currentDescription || (
                <span className="italic text-muted-foreground">No description</span>
              )}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-2"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="gap-2"
          >
            {isSaving ? "Saving..." : mode === "new" ? "Create Template" : "Update Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TemplateSaveDialog;
