"use client";

import { useState } from "react";
import { AlertTriangle, Save, Sparkles } from "lucide-react";
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
      <AlertDialogContent className="border-2 shadow-hard sm:max-w-[440px]">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2 border-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <AlertDialogTitle className="font-heading text-lg">
              Template Already Exists
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pt-2">
            A template named <span className="font-semibold text-foreground">"{templateName}"</span> already exists.
            Would you like to update it or save as a new template?
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!showNewNameInput ? (
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {/* Overwrite Option */}
            <Button
              onClick={handleOverwrite}
              disabled={isProcessing}
              className={cn(
                "w-full gap-2 border-2",
                "bg-blue-600 hover:bg-blue-700 text-white border-blue-700",
                "dark:bg-blue-600 dark:hover:bg-blue-700 dark:border-blue-500"
              )}
            >
              <Save className="h-4 w-4" />
              {isProcessing ? "Updating..." : "Update Existing Template"}
            </Button>

            {/* Save as New Option */}
            <Button
              variant="outline"
              onClick={() => {
                setShowNewNameInput(true);
                setNewName(templateName + " (Copy)");
              }}
              disabled={isProcessing}
              className="w-full gap-2 border-2"
            >
              <Sparkles className="h-4 w-4" />
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
              <Label htmlFor="new-template-name">New Template Name</Label>
              <Input
                id="new-template-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Software Engineer (v2)"
                className={cn(
                  "border-2",
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
                className="flex-1 border-2"
              >
                Back
              </Button>
              <Button
                onClick={handleSaveAsNew}
                disabled={!canSaveAsNew || isProcessing}
                className={cn(
                  "flex-1 gap-2 border-2",
                  "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700",
                  "dark:bg-emerald-600 dark:hover:bg-emerald-700 dark:border-emerald-500"
                )}
              >
                <Sparkles className="h-4 w-4" />
                {isProcessing ? "Saving..." : "Save"}
              </Button>
            </AlertDialogFooter>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default TemplateUpdateConfirmDialog;
