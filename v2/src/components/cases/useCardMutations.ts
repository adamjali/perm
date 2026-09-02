"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here (2026-09-01) rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx for the incident.

/**
 * useCardMutations Hook
 * Handles all mutation operations for CaseCard component with consistent error handling.
 */

import { useMutation } from "convex/react";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { formatCaseStatus } from "./case-card.utils";
import type { CaseStatus } from "@/lib/perm";

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
      handleOperationError(error, {
        userMessage: "Failed to update favorite status. Please try again.",
        context: { operation: "toggleFavorite" },
      });
    } finally {
      setTogglingFavorite(false);
    }
  };

  const handlePinnedToggle = async (): Promise<void> => {
    setTogglingPinned(true);
    try {
      await togglePinnedMutation({ id: caseId });
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to update pin status. Please try again.",
        context: { operation: "togglePinned" },
      });
    } finally {
      setTogglingPinned(false);
    }
  };

  const handleReopen = async (e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    setReopening(true);
    try {
      const result = await reopenCaseMutation({ id: caseId });
      const statusLabel = formatCaseStatus(result.newCaseStatus as CaseStatus);
      const progressLabel = result.newProgressStatus.replace(/_/g, " ");
      toast.success(`Case reopened as ${statusLabel} - ${progressLabel}`);
    } catch (error) {
      handleOperationError(error, {
        userMessage: "Failed to reopen case. Please try again.",
        context: { operation: "reopenCase" },
      });
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
