/**
 * Shared utilities, constants, and components for job description templates.
 *
 * This module centralizes common functionality used across JobDescriptionField,
 * JobDescriptionDetailView, TemplateManagementModal, and TemplateSelector.
 */

import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum character length for job descriptions */
export const JOB_DESCRIPTION_MAX_LENGTH = 10000;

/** Minimum height for touch-friendly interactive elements */
export const TOUCH_MIN_HEIGHT = "min-h-[44px]";

/** Minimum size for touch-friendly buttons/icons */
export const TOUCH_MIN_SIZE = "min-h-[44px] min-w-[44px]";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Job description template data structure.
 * Used for component props - uses string for _id for flexibility.
 */
export interface JobDescriptionTemplateData {
  _id: string;
  name: string;
  description: string;
  usageCount: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Copy text to clipboard with toast feedback.
 *
 * @param text - Text to copy
 * @returns Promise<boolean> - true if successful, false otherwise
 *
 * @example
 * ```ts
 * const success = await copyToClipboard(description);
 * if (success) setIsCopied(true);
 * ```
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
    return true;
  } catch {
    toast.error("Failed to copy");
    return false;
  }
}

/**
 * Format a timestamp for template display.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted date string (e.g., "Jan 15, 2024")
 *
 * @example
 * ```ts
 * const formatted = formatTemplateDate(template.updatedAt);
 * // Returns "Jan 15, 2024"
 * ```
 */
export function formatTemplateDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Find a template by name (case-insensitive).
 *
 * @param templates - Array of templates to search
 * @param name - Name to search for
 * @returns Matching template or undefined
 *
 * @example
 * ```ts
 * const template = findTemplateByName(templates, "Software Engineer");
 * ```
 */
export function findTemplateByName<T extends { name: string }>(
  templates: T[],
  name: string
): T | undefined {
  const nameLower = name.toLowerCase().trim();
  return templates.find((t) => t.name.toLowerCase() === nameLower);
}

/**
 * Check if a template name is already taken.
 *
 * @param templates - Array of templates to check against
 * @param name - Name to check
 * @param excludeId - Optional ID to exclude from check (for updates)
 * @returns true if name is taken (by a different template)
 *
 * @example
 * ```ts
 * // Check if name exists (for new templates)
 * if (isTemplateNameTaken(templates, newName)) {
 *   toast.error("Name already exists");
 * }
 *
 * // Check if name exists (for updates, excluding current)
 * if (isTemplateNameTaken(templates, newName, currentTemplate._id)) {
 *   toast.error("Name already exists");
 * }
 * ```
 */
export function isTemplateNameTaken<T extends { _id: string; name: string }>(
  templates: T[],
  name: string,
  excludeId?: string
): boolean {
  const nameLower = name.toLowerCase().trim();
  return templates.some(
    (t) => t.name.toLowerCase() === nameLower && t._id !== excludeId
  );
}

// ============================================================================
// SHARED COMPONENTS
// ============================================================================

interface TemplateStatusBadgeProps {
  /** Whether the template content has been modified */
  isModified: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Badge showing template modification status.
 * Shows "Modified" in amber when content changed, "From Template" in blue otherwise.
 */
export function TemplateStatusBadge({
  isModified,
  className,
}: TemplateStatusBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-0.5 rounded-full border",
        isModified
          ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400"
          : "bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400",
        className
      )}
    >
      {isModified ? "Modified" : "From Template"}
    </span>
  );
}

interface TemplateTypeBadgeProps {
  /** Whether this matches an existing template name */
  isExisting: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Badge showing whether the template name matches an existing template.
 * Shows "Existing" in blue for matches, "New" in emerald for new names.
 */
export function TemplateTypeBadge({
  isExisting,
  className,
}: TemplateTypeBadgeProps) {
  return (
    <span
      className={cn(
        "text-xs px-2 py-1 rounded border",
        isExisting
          ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-700 dark:text-blue-400"
          : "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400",
        className
      )}
    >
      {isExisting ? "Existing" : "New"}
    </span>
  );
}
