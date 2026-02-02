"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Zap } from "lucide-react";
import { toast } from "@/lib/toast";

const DELETE_CONFIRMATION_TEXT = "DELETE";

export interface DeleteNowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteNowDialog({
  open,
  onOpenChange,
}: DeleteNowDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const immediateDelete = useAction(api.users.immediateAccountDeletion);
  const { signOut } = useAuthActions();
  const { beginSignOut, cancelSignOut } = useAuthContext();
  const router = useRouter();

  const isConfirmed = confirmation === DELETE_CONFIRMATION_TEXT && acknowledged;

  const handleConfirm = async () => {
    if (!isConfirmed) return;

    setIsDeleting(true);
    try {
      beginSignOut();
      await immediateDelete({});
      toast.success("Your account has been permanently deleted.");
      try {
        await signOut();
      } catch {
        // Sign out may fail since account is deleted
      }
      router.push("/login");
    } catch (error) {
      cancelSignOut();
      console.error("Failed to delete account immediately:", error);
      const message =
        error instanceof Error ? error.message : "Failed to delete account";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setConfirmation("");
      setAcknowledged(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Zap className="w-5 h-5" />
            Delete Account Now
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-muted-foreground text-sm space-y-3 pt-2">
              {/* Danger callout */}
              <div
                className="flex items-start gap-2 p-3 bg-destructive/10 border-2 border-destructive/30"
                style={{ boxShadow: "2px 2px 0px rgba(239, 68, 68, 0.3)" }}
              >
                <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-destructive font-bold text-sm">
                  This will permanently delete your account and all data RIGHT
                  NOW. This cannot be undone.
                </p>
              </div>
              <p>The following will be permanently deleted immediately:</p>
              <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                <li>All your PERM cases and related data</li>
                <li>Notification preferences and history</li>
                <li>Calendar sync settings</li>
                <li>Your user profile</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Checkbox acknowledgment */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <Checkbox
              checked={acknowledged}
              onCheckedChange={(checked) => setAcknowledged(checked === true)}
              aria-label="I understand this is immediate and irreversible"
              className="mt-0.5"
            />
            <span className="text-sm text-muted-foreground leading-tight">
              I understand this is immediate and irreversible
            </span>
          </label>

          {/* Text confirmation */}
          <div>
            <p className="text-sm font-medium mb-2">
              Type{" "}
              <span className="font-mono bg-muted px-1.5 py-0.5 border border-border">
                {DELETE_CONFIRMATION_TEXT}
              </span>{" "}
              to confirm:
            </p>
            <Input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={`Type ${DELETE_CONFIRMATION_TEXT} to confirm`}
              className={
                confirmation === DELETE_CONFIRMATION_TEXT
                  ? "border-destructive focus:ring-destructive"
                  : ""
              }
              autoComplete="off"
              data-testid="delete-now-confirmation-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmed || isDeleting}
            loading={isDeleting}
            loadingText="Deleting..."
          >
            <Zap className="w-4 h-4 mr-2" />
            Delete Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
