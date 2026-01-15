/**
 * BulkActions Component
 * Bulk action buttons for the notifications page header.
 *
 * Actions:
 * - Mark All Read: Mark all notifications as read
 * - Delete All Read: Delete all read notifications
 *
 * Phase: 24 (Notifications)
 * Created: 2025-12-31
 */

"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthContext } from "@/lib/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/lib/toast";
import { CheckCheck, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BulkActionsProps {
  /** Optional className for styling */
  className?: string;
}

export default function BulkActions({ className }: BulkActionsProps) {
  const { isSigningOut } = useAuthContext();

  // State
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isDeletingRead, setIsDeletingRead] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Query for stats to know if there are any notifications
  const stats = useQuery(
    api.notifications.getNotificationStats,
    isSigningOut ? "skip" : undefined
  );

  // Mutations
  const markAllAsRead = useMutation(api.notifications.markAllAsRead);
  const deleteAllRead = useMutation(api.notifications.deleteAllRead);

  // Handlers
  const handleMarkAllRead = async () => {
    if (isMarkingAllRead || !stats?.unread) return;

    setIsMarkingAllRead(true);
    try {
      const result = await markAllAsRead({});
      if (result.count > 0) {
        toast.success(`Marked ${result.count} notification${result.count !== 1 ? "s" : ""} as read`);
      } else {
        toast.info("No unread notifications to mark");
      }
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark all as read");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const handleDeleteAllRead = async () => {
    setConfirmDeleteOpen(false);
    setIsDeletingRead(true);
    try {
      const result = await deleteAllRead({});
      if (result.count > 0) {
        toast.success(`Deleted ${result.count} notification${result.count !== 1 ? "s" : ""}`);
      } else {
        toast.info("No read notifications to delete");
      }
    } catch (error) {
      console.error("Failed to delete read notifications:", error);
      toast.error("Failed to delete notifications");
    } finally {
      setIsDeletingRead(false);
    }
  };

  // Calculate counts
  const unreadCount = stats?.unread ?? 0;
  const readCount = (stats?.total ?? 0) - unreadCount;

  return (
    <>
      <div className={cn("flex items-center gap-3", className)}>
        {/* Mark All Read Button */}
        <Button
          variant="outline"
          size="default"
          onClick={handleMarkAllRead}
          disabled={isMarkingAllRead || unreadCount === 0}
          loading={isMarkingAllRead}
          loadingText="Marking..."
          className="font-heading uppercase tracking-wide"
        >
          <CheckCheck className="size-4 mr-2" />
          Mark All Read
          {unreadCount > 0 && (
            <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
              {unreadCount}
            </span>
          )}
        </Button>

        {/* Delete All Read Button */}
        <Button
          variant="outline"
          size="default"
          onClick={() => setConfirmDeleteOpen(true)}
          disabled={isDeletingRead || readCount === 0}
          loading={isDeletingRead}
          loadingText="Deleting..."
          className="font-heading uppercase tracking-wide text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4 mr-2" />
          Delete Read
          {readCount > 0 && (
            <span className="ml-2 text-xs bg-muted px-1.5 py-0.5 rounded">
              {readCount}
            </span>
          )}
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              Delete Read Notifications
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete all {readCount} read notification
              {readCount !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAllRead}
              loading={isDeletingRead}
              loadingText="Deleting..."
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
