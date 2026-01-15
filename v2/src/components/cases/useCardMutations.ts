/**
 * useCardMutations Hook
 * Handles all mutation operations for CaseCard component with consistent error handling.
 */

import { useMutation } from "convex/react";
import { toast } from "@/lib/toast";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatCaseStatus } from "./case-card.utils";

interface UseCardMutationsParams {
  caseId: Id<"cases">;
  setTogglingFavorite: (toggling: boolean) => void;
  setTogglingPinned: (toggling: boolean) => void;
  setReopening: (reopening: boolean) => void;
}

interface UseCardMutationsReturn {
  handleFavoriteToggle: (e: React.MouseEvent) => Promise<void>;
  handlePinnedToggle: () => Promise<void>;
  handleReopen: (e: React.MouseEvent) => Promise<void>;
}

/**
 * Hook to manage CaseCard mutations with consistent error handling patterns.
 */
export function useCardMutations({
  caseId,
  setTogglingFavorite,
  setTogglingPinned,
  setReopening,
}: UseCardMutationsParams): UseCardMutationsReturn {
  const toggleFavoriteMutation = useMutation(api.cases.toggleFavorite);
  const togglePinnedMutation = useMutation(api.cases.togglePinned);
  const reopenCaseMutation = useMutation(api.cases.reopenCase);

  const handleFavoriteToggle = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    setTogglingFavorite(true);
    try {
      await toggleFavoriteMutation({ id: caseId });
    } catch (error) {
      console.error("Failed to toggle favorite:", error);
      toast.error("Failed to update favorite status. Please try again.");
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handlePinnedToggle = async (): Promise<void> => {
    setTogglingPinned(true);
    try {
      await togglePinnedMutation({ id: caseId });
    } catch (error) {
      console.error("Failed to toggle pin:", error);
      toast.error("Failed to update pin status. Please try again.");
    } finally {
      setTogglingPinned(false);
    }
  };

  const handleReopen = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    setReopening(true);
    try {
      const result = await reopenCaseMutation({ id: caseId });
      const statusLabel = formatCaseStatus(result.newCaseStatus);
      const progressLabel = result.newProgressStatus.replace(/_/g, " ");
      toast.success(`Case reopened as ${statusLabel} - ${progressLabel}`);
    } catch (error) {
      console.error("Failed to reopen case:", error);
      toast.error("Failed to reopen case. Please try again.");
    } finally {
      setReopening(false);
    }
  };

  return {
    handleFavoriteToggle,
    handlePinnedToggle,
    handleReopen,
  };
}
