"use client";

import { useState } from "react";
import { FloppyDiskIcon as Save, SparkleIcon, WarningIcon as AlertTriangle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { captureError } from "@/lib/sentry";

// ============================================================================
// TYPES
// ============================================================================

export interface TemplateUpdateConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Name of the template being overwritten */
  templateName: string;
  /** Callback when user confirms the overwrite */
  onConfirmOverwrite: () => Promise<void>;
  /** Callback when user wants to save as new with different name */
  onSaveAsNew: (newName: string) => Promise<void>;
  /** Existing template names for duplicate checking */
  existingTemplateNames: string[];
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TemplateUpdateConfirmDialog Component
 *
 * Confirmation dialog shown when user tries to save a template
 * with a name that already exists.
 *
 * Features:
 * - Option to overwrite existing template
 * - Option to save as new with different name
 * - Inline name editing with duplicate validation
 */
export function TemplateUpdateConfirmDialog({
  open,
  onOpenChange,
  templateName,
  onConfirmOverwrite,
  onSaveAsNew,
  existingTemplateNames,
}: TemplateUpdateConfirmDialogProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNewNameInput, setShowNewNameInput] = useState(false);
  const [newName, setNewName] = useState("");

  // Check for duplicate names
  const isDuplicate = existingTemplateNames.some(
    (n) => n.toLowerCase() === newName.trim().toLowerCase()
  );
  const canSaveAsNew = newName.trim() && !isDuplicate;

  const handleOverwrite = async () => {
    setIsProcessing(true);
    try {
      await onConfirmOverwrite();
      onOpenChange(false);
    } catch (error) {
      console.error("[TemplateUpdateConfirmDialog] Overwrite failed:", error);
      captureError(error);
      // Don’t close dialog on error - let user retry or cancel
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAsNew = async () => {
    if (!canSaveAsNew) return;
    setIsProcessing(true);
    try {
      await onSaveAsNew(newName.trim());
      onOpenChange(false);
      setShowNewNameInput(false);
      setNewName("");
    } catch (error) {
      console.error("[TemplateUpdateConfirmDialog] Save as new failed:", error);
      captureError(error);
      // Don’t close dialog on error - let user retry or cancel
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setShowNewNameInput(false);
    setNewName("");
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="sm:max-w-[440px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-data-warn-ink" aria-hidden="true" />
            Template already exists
          </AlertDialogTitle>
          <AlertDialogDescription className="pt-2">
            A template named <span className="font-semibold text-foreground">&ldquo;{templateName}&rdquo;</span> already exists.
            Would you like to update it or save as a new template?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!showNewNameInput ? (
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {/* Overwrite Option */}
            <Button
              onClick={handleOverwrite}
              disabled={isProcessing}
              className="w-full"
            >
              <Save className="size-4" aria-hidden="true" />
              {isProcessing ? "Updating..." : "Update existing template"}
            </Button>

            {/* Save as New Option */}
            <Button
              variant="outline"
              onClick={() => {
                setShowNewNameInput(true);
                setNewName(templateName + " (Copy)");
              }}
              disabled={isProcessing}
              className="w-full gap-2 border"
            >
              <SparkleIcon className="h-4 w-4" />
              Save as New Template
            </Button>

            {/* Cancel */}
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isProcessing}
              className="w-full"
            >
              Cancel
            </Button>
          </AlertDialogFooter>
        ) : (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="new-template-name">New template name</Label>
              <Input
                id="new-template-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Software Engineer (v2)"
                className={cn(
                  "border",
                  isDuplicate && "border-destructive focus-visible:ring-destructive"
                )}
                autoFocus
              />
              {isDuplicate && (
                <p className="text-sm text-destructive">
                  This name is also taken. Try a different name.
                </p>
              )}
            </div>

            <AlertDialogFooter className="flex-row gap-2 sm:flex-row">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNewNameInput(false);
                  setNewName("");
                }}
                disabled={isProcessing}
                className="flex-1 border"
              >
                Back
              </Button>
              <Button
                onClick={handleSaveAsNew}
                disabled={!canSaveAsNew || isProcessing}
                className="flex-1"
              >
                <SparkleIcon className="size-4" aria-hidden="true" />
                {isProcessing ? "Saving..." : "Save"}
              </Button>
            </AlertDialogFooter>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
