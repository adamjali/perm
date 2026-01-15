/**
 * DeleteConfirmDialog Component
 *
 * Confirmation dialog for deleting demo cases.
 * Uses neobrutalist styling with Trash2 icon in a red-tinted box.
 *
 */

"use client";

import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ============================================================================
// Types
// ============================================================================

interface DeleteConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when dialog should close */
  onClose: () => void;
  /** Name of the case to delete (for display) */
  caseName: string;
  /** Callback when deletion is confirmed */
  onConfirm: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * DeleteConfirmDialog - Confirmation dialog for deleting a demo case.
 *
 * Features:
 * - Trash icon in red-tinted bordered box
 * - Clear messaging with case name
 * - Cancel and Delete action buttons
 * - No close button to prevent accidental dismissal
 * - Neobrutalist styling (2px borders, hard shadows)
 */
export function DeleteConfirmDialog({
  isOpen,
  onClose,
  caseName,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader className="items-center text-center sm:text-center">
          {/* Icon in bordered box */}
          <div className="mx-auto mb-4 flex size-14 items-center justify-center border-2 border-destructive/30 bg-destructive/10">
            <Trash2 className="size-7 text-destructive" />
          </div>

          <DialogTitle>Delete Case</DialogTitle>

          <DialogDescription className="pt-2">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{caseName}</span>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="pt-4 sm:justify-center">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm}>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
