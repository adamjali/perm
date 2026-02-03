"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { toast } from "@/lib/toast";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface UserDeleteConfirmModalProps {
  user: {
    userId: string;
    email: string;
    name: string;
    totalCases: number;
  };
  onClose: () => void;
}

export function UserDeleteConfirmModal({ user, onClose }: UserDeleteConfirmModalProps) {
  const [confirmEmail, setConfirmEmail] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteUser = useMutation(api.admin.deleteUserAdmin);

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDeleting) return;

    // Validation
    if (confirmEmail !== user.email) {
      toast.error("Email does not match");
      return;
    }

    setIsDeleting(true);

    try {
      await deleteUser({
        userId: user.userId as Id<"users">,
      });

      toast.success(`User ${user.email} deleted successfully`);
      onClose();
    } catch (error) {
      console.error("Failed to delete user:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const canDelete = confirmEmail === user.email;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-destructive">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-bold uppercase tracking-wide flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            Delete User
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. All user data will be permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleDelete} className="space-y-4">
          <div className="border-2 border-destructive bg-destructive/10 p-4 space-y-2">
            <p className="font-bold text-sm">This will permanently delete:</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>{user.totalCases} case{user.totalCases !== 1 ? "s" : ""}</li>
              <li>All notifications</li>
              <li>All conversations and messages</li>
              <li>All user settings and preferences</li>
              <li>The user account</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmEmail" className="text-sm font-bold uppercase tracking-wide">
              Type <span className="text-destructive">{user.email}</span> to confirm
            </label>
            <Input
              id="confirmEmail"
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="Enter email to confirm"
              autoComplete="off"
              className="border-destructive focus:ring-destructive"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!canDelete || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
