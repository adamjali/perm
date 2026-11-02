"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx.

/**
 * useJobDescriptionTemplates: the account's saved job description templates and what can be done with them.
 * The job description editor (components/job-description/JobDescriptionEditor.tsx) is its one caller; the
 * case's own record of which template it used lives on the case (`jobDescriptionTemplateId`).
 */

import { useCallback, useMemo } from "react";
import { captureError } from "@/lib/sentry";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

/** A saved job description template, as the list query returns it: the one template type the app uses. */
export type JobDescriptionTemplate = Pick<
  Doc<"jobDescriptionTemplates">,
  "_id" | "name" | "description" | "usageCount" | "lastUsedAt" | "createdAt" | "updatedAt"
>;

export interface UseJobDescriptionTemplatesReturn {
  /** List of all templates (sorted alphabetically) */
  templates: JobDescriptionTemplate[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Record that a template was loaded into a case (its usage count) */
  loadTemplate: (template: JobDescriptionTemplate) => Promise<void>;
  /** Save text as a new template */
  saveAsNewTemplate: (name: string, description: string) => Promise<Id<"jobDescriptionTemplates">>;
  /** Update an existing template */
  updateTemplate: (id: Id<"jobDescriptionTemplates">, name: string, description: string) => Promise<void>;
  /** Permanently delete a template and clear references from cases */
  hardDeleteTemplate: (id: Id<"jobDescriptionTemplates">) => Promise<{ success: boolean; clearedReferences: number }>;
}

export function useJobDescriptionTemplates(): UseJobDescriptionTemplatesReturn {
  const templatesData = useQuery(api.jobDescriptionTemplates.list);
  const templates = useMemo(() => (templatesData ?? []) as JobDescriptionTemplate[], [templatesData]);
  const isLoading = templatesData === undefined;

  const createMutation = useMutation(api.jobDescriptionTemplates.create);
  const updateMutation = useMutation(api.jobDescriptionTemplates.update);
  const hardDeleteMutation = useMutation(api.jobDescriptionTemplates.hardDelete);
  const recordUsageMutation = useMutation(api.jobDescriptionTemplates.recordUsage);

  // Usage is bookkeeping: a failure is reported and never stops the template loading.
  const loadTemplate = useCallback(
    async (template: JobDescriptionTemplate) => {
      try {
        await recordUsageMutation({ id: template._id });
      } catch (error) {
        console.error("[useJobDescriptionTemplates] Failed to record usage:", error);
        captureError(error, { operation: "recordTemplateUsage" });
      }
    },
    [recordUsageMutation],
  );

  const saveAsNewTemplate = useCallback(
    async (name: string, description: string) => {
      try {
        return await createMutation({ name, description });
      } catch (error) {
        // TEMPLATE_EXISTS is the editor asking to update instead, not a fault: it isn't reported.
        const data = error instanceof ConvexError ? error.data : null;
        if (!(typeof data === "string" && data.startsWith("TEMPLATE_EXISTS:"))) {
          console.error("[useJobDescriptionTemplates] Failed to create template:", error);
          captureError(error, { operation: "createTemplate" });
        }
        throw error;
      }
    },
    [createMutation],
  );

  const updateTemplate = useCallback(
    async (id: Id<"jobDescriptionTemplates">, name: string, description: string) => {
      try {
        await updateMutation({ id, name, description });
      } catch (error) {
        // A name already taken is the person's to fix, said in the error's own sentence.
        if (!(error instanceof ConvexError)) {
          console.error("[useJobDescriptionTemplates] Failed to update template:", error);
          captureError(error, { operation: "updateTemplate" });
        }
        throw error;
      }
    },
    [updateMutation],
  );

  const hardDeleteTemplate = useCallback(
    async (id: Id<"jobDescriptionTemplates">) => {
      try {
        return await hardDeleteMutation({ id });
      } catch (error) {
        console.error("[useJobDescriptionTemplates] Failed to hard delete template:", error);
        captureError(error, { operation: "hardDeleteTemplate" });
        throw error;
      }
    },
    [hardDeleteMutation],
  );

  return { templates, isLoading, loadTemplate, saveAsNewTemplate, updateTemplate, hardDeleteTemplate };
}
