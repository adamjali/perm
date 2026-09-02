"use client";

// `convex/react` is a CLIENT-ONLY module: its hooks reach `React.createContext`,
// which exists only in React's client build. Declared here (2026-09-01) rather
// than inherited from whichever importer happened to cross a boundary first.
// Without it this module works until the chunk graph shifts, then fails with
// `TypeError: (0 , d.createContext) is not a function` naming webpack bootstrap
// and no source file. See components/layout/Footer.tsx for the incident.

/**
 * useJobDescriptionTemplates Hook
 *
 * Manages job description templates state and operations.
 * Provides loading, creating, updating, and deleting templates.
 *
 * @example
 * ```tsx
 * const {
 *   templates,
 *   isLoading,
 *   loadTemplate,
 *   saveAsNewTemplate,
 *   updateTemplate,
 *   deleteTemplate,
 * } = useJobDescriptionTemplates();
 * ```
 */

import { useState, useCallback, useMemo } from "react";
import { captureError } from "@/lib/sentry";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

// ============================================================================
// TYPES
// ============================================================================

export interface JobDescriptionTemplate {
  _id: Id<"jobDescriptionTemplates">;
  name: string;
  description: string;
  usageCount: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface UseJobDescriptionTemplatesReturn {
  /** List of all templates (sorted alphabetically) */
  templates: JobDescriptionTemplate[];
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Currently loaded template ID */
  loadedTemplateId: Id<"jobDescriptionTemplates"> | undefined;
  /** Set the loaded template ID (for tracking modifications) */
  setLoadedTemplateId: (id: Id<"jobDescriptionTemplates"> | undefined) => void;
  /** Load a template (increments usage count) */
  loadTemplate: (template: JobDescriptionTemplate) => Promise<void>;
  /** Save current content as a new template */
  saveAsNewTemplate: (name: string, description: string) => Promise<Id<"jobDescriptionTemplates">>;
  /** Update an existing template */
  updateTemplate: (id: Id<"jobDescriptionTemplates">, name: string, description: string) => Promise<void>;
  /** Soft delete a template (can be recovered) */
  deleteTemplate: (id: Id<"jobDescriptionTemplates">) => Promise<void>;
  /** Permanently delete a template and clear references from cases */
  hardDeleteTemplate: (id: Id<"jobDescriptionTemplates">) => Promise<{ success: boolean; clearedReferences: number }>;
  /** Find template by exact name match */
  findTemplateByName: (name: string) => JobDescriptionTemplate | undefined;
}

// ============================================================================
// HOOK
// ============================================================================

export function useJobDescriptionTemplates(): UseJobDescriptionTemplatesReturn {
  const [loadedTemplateId, setLoadedTemplateId] = useState<Id<"jobDescriptionTemplates"> | undefined>();

  // Query templates
  const templatesData = useQuery(api.jobDescriptionTemplates.list);
  const templates = useMemo(
    () => (templatesData ?? []) as JobDescriptionTemplate[],
    [templatesData]
  );
  const isLoading = templatesData === undefined;

  // Mutations
  const createMutation = useMutation(api.jobDescriptionTemplates.create);
  const updateMutation = useMutation(api.jobDescriptionTemplates.update);
  const removeMutation = useMutation(api.jobDescriptionTemplates.remove);
  const hardDeleteMutation = useMutation(api.jobDescriptionTemplates.hardDelete);
  const recordUsageMutation = useMutation(api.jobDescriptionTemplates.recordUsage);

  // Load a template and record usage
  const loadTemplate = useCallback(
    async (template: JobDescriptionTemplate) => {
      try {
        await recordUsageMutation({ id: template._id });
      } catch (error) {
        console.error("[useJobDescriptionTemplates] Failed to record usage:", error);
        captureError(error, { operation: 'recordTemplateUsage' });
        // Still set template ID - usage tracking is non-critical
      }
      setLoadedTemplateId(template._id);
    },
    [recordUsageMutation]
  );

  // Save as new template
  const saveAsNewTemplate = useCallback(
    async (name: string, description: string) => {
      try {
        const id = await createMutation({ name, description });
        setLoadedTemplateId(id);
        return id;
      } catch (error) {
        // TEMPLATE_EXISTS is an expected flow, not a real error — don't log to Sentry
        const msg = error instanceof ConvexError
          ? (typeof error.data === "string" ? error.data : "")
          : (error instanceof Error ? error.message : "");
        if (!msg.startsWith("TEMPLATE_EXISTS:")) {
          console.error("[useJobDescriptionTemplates] Failed to create template:", error);
          captureError(error, { operation: 'createTemplate' });
        }
        throw error; // Re-throw for caller to handle
      }
    },
    [createMutation]
  );

  // Update existing template
  const updateTemplate = useCallback(
    async (id: Id<"jobDescriptionTemplates">, name: string, description: string) => {
      try {
        await updateMutation({ id, name, description });
      } catch (error) {
        console.error("[useJobDescriptionTemplates] Failed to update template:", error);
        captureError(error, { operation: 'updateTemplate' });
        throw error; // Re-throw for caller to handle
      }
    },
    [updateMutation]
  );

  // Soft delete template
  const deleteTemplate = useCallback(
    async (id: Id<"jobDescriptionTemplates">) => {
      try {
        await removeMutation({ id });
        // Clear loaded template if it was the deleted one
        if (loadedTemplateId === id) {
          setLoadedTemplateId(undefined);
        }
      } catch (error) {
        console.error("[useJobDescriptionTemplates] Failed to delete template:", error);
        captureError(error, { operation: 'deleteTemplate' });
        throw error; // Re-throw for caller to handle
      }
    },
    [removeMutation, loadedTemplateId]
  );

  // Hard delete template (permanent, clears case references)
  const hardDeleteTemplate = useCallback(
    async (id: Id<"jobDescriptionTemplates">) => {
      try {
        const result = await hardDeleteMutation({ id });
        // Clear loaded template if it was the deleted one
        if (loadedTemplateId === id) {
          setLoadedTemplateId(undefined);
        }
        return result;
      } catch (error) {
        console.error("[useJobDescriptionTemplates] Failed to hard delete template:", error);
        captureError(error, { operation: 'hardDeleteTemplate' });
        throw error; // Re-throw for caller to handle
      }
    },
    [hardDeleteMutation, loadedTemplateId]
  );

  // Find template by exact name match (case-insensitive)
  const findTemplateByName = useCallback(
    (name: string) => {
      const nameLower = name.toLowerCase().trim();
      return templates.find((t) => t.name.toLowerCase() === nameLower);
    },
    [templates]
  );

  return {
    templates,
    isLoading,
    loadedTemplateId,
    setLoadedTemplateId,
    loadTemplate,
    saveAsNewTemplate,
    updateTemplate,
    deleteTemplate,
    hardDeleteTemplate,
    findTemplateByName,
  };
}

export default useJobDescriptionTemplates;
