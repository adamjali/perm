"use client";

/**
 * A case card's own actions (favorite, keep dates open, reopen), each with
 * its busy flag and one way of reporting a failure.
 */

import { useState } from "react";
import { useMutation } from "convex/react";
import { formatCaseStatus, formatProgressStatus } from "@convex/lib/notificationHelpers";
import { toast } from "@/lib/toast";
import { handleOperationError } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

type Action = "favorite" | "pinned" | "reopening";

export function useCardMutations(caseId: Id<"cases">) {
  const toggleFavorite = useMutation(api.cases.toggleFavorite);
  const togglePinned = useMutation(api.cases.togglePinned);
  const reopenCase = useMutation(api.cases.reopenCase);
  const [busy, setBusy] = useState<Action | null>(null);

  async function run(action: Action, work: () => Promise<void>, userMessage: string) {
    setBusy(action);
    try {
      await work();
    } catch (error) {
      handleOperationError(error, { userMessage, context: { operation: action } });
    } finally {
      setBusy(null);
    }
  }

  return {
    busy,
    toggleFavorite: () =>
      run("favorite", async () => void (await toggleFavorite({ id: caseId })), "Couldn’t update the favorite. Try again."),
    togglePinned: () =>
      run("pinned", async () => void (await togglePinned({ id: caseId })), "Couldn’t update the case. Try again."),
    reopen: () =>
      run(
        "reopening",
        async () => {
          const result = await reopenCase({ id: caseId });
          toast.success(
            `Case reopened: ${formatCaseStatus(result.newCaseStatus)} (${formatProgressStatus(result.newProgressStatus)})`,
          );
        },
        "Couldn’t reopen the case. Try again.",
      ),
  };
}
