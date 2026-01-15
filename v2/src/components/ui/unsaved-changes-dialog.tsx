/**
 * UnsavedChangesDialog Component
 *
 * A neobrutalist-styled confirmation dialog that warns users about unsaved changes
 * before navigating away from a form.
 *
 * Design:
 * - Neobrutalist styling with hard shadow and 2px black border
 * - Warning icon for visual emphasis
 * - "Stay" button (secondary) and "Leave" button (destructive)
 * - Accessible with proper ARIA attributes
 *
 * @example
 * <UnsavedChangesDialog
 *   open={shouldShowDialog}
 *   onStay={cancelNavigation}
 *   onLeave={confirmNavigation}
 * />
 *
 * Phase: 21+ (UI/UX Global)
 * Created: 2025-12-27
 */

"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface UnsavedChangesDialogProps {
  /**
   * Whether the dialog is open
   */
  open: boolean;

  /**
   * Called when user clicks "Stay" or closes dialog
   */
  onStay: () => void;

  /**
   * Called when user clicks "Leave" (confirms navigation)
   */
  onLeave: () => void;

  /**
   * Custom title (default: "Unsaved Changes")
   */
  title?: string;

  /**
   * Custom description (default: standard warning message)
   */
  description?: string;

  /**
   * Custom "Stay" button text (default: "Stay")
   */
  stayText?: string;

  /**
   * Custom "Leave" button text (default: "Leave")
   */
  leaveText?: string;
}

export function UnsavedChangesDialog({
  open,
  onStay,
  onLeave,
  title = "Unsaved Changes",
  description = "You have unsaved changes. Are you sure you want to leave? Your changes will be lost.",
  stayText = "Stay",
  leaveText = "Leave",
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onStay()}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md"
        aria-describedby="unsaved-changes-description"
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            {/* Warning Icon */}
            <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-950/30 border-2 border-black dark:border-white shadow-hard-sm">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <DialogTitle className="font-heading text-xl font-bold">
              {title}
            </DialogTitle>
          </div>
        </DialogHeader>

        <DialogDescription
          id="unsaved-changes-description"
          className="text-base text-muted-foreground py-2"
        >
          {description}
        </DialogDescription>

        <DialogFooter className="flex-row gap-3 sm:gap-3">
          {/* Stay Button (Secondary) */}
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={onStay}
            className="flex-1"
          >
            {stayText}
          </Button>

          {/* Leave Button (Destructive) */}
          <Button
            type="button"
            variant="destructive"
            size="lg"
            onClick={onLeave}
            className="flex-1"
          >
            {leaveText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
