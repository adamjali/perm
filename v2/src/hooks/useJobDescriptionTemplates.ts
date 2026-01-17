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

import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
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
  /** Delete a template */
  deleteTemplate: (id: Id<"jobDescriptionTemplates">) => Promise<void>;
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
  const templates = (templatesData ?? []) as JobDescriptionTemplate[];
  const isLoading = templatesData === undefined;

  // Mutations
  const createMutation = useMutation(api.jobDescriptionTemplates.create);
  const updateMutation = useMutation(api.jobDescriptionTemplates.update);
  const removeMutation = useMutation(api.jobDescriptionTemplates.remove);
  const recordUsageMutation = useMutation(api.jobDescriptionTemplates.recordUsage);

  // Load a template and record usage
  const loadTemplate = useCallback(
    async (template: JobDescriptionTemplate) => {
      await recordUsageMutation({ id: template._id });
      setLoadedTemplateId(template._id);
    },
    [recordUsageMutation]
  );

  // Save as new template
  const saveAsNewTemplate = useCallback(
    async (name: string, description: string) => {
      const id = await createMutation({ name, description });
      setLoadedTemplateId(id);
      return id;
    },
    [createMutation]
  );

  // Update existing template
  const updateTemplate = useCallback(
    async (id: Id<"jobDescriptionTemplates">, name: string, description: string) => {
      await updateMutation({ id, name, description });
    },
    [updateMutation]
  );

  // Delete template
  const deleteTemplate = useCallback(
    async (id: Id<"jobDescriptionTemplates">) => {
      await removeMutation({ id });
      // Clear loaded template if it was the deleted one
      if (loadedTemplateId === id) {
        setLoadedTemplateId(undefined);
      }
    },
    [removeMutation, loadedTemplateId]
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
    findTemplateByName,
  };
}

export default useJobDescriptionTemplates;
