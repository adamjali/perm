/**
 * Job Description Templates
 *
 * CRUD operations for job description templates.
 * Templates are user-scoped and identified by position title (name).
 *
 * Features:
 * - List all templates for current user
 * - Create new templates (with duplicate name check)
 * - Update existing templates
 * - Delete templates (soft delete)
 * - Track usage count when templates are loaded
 *
 * @see /docs/API.md for API documentation
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getCurrentUserId, getCurrentUserIdOrNull, verifyOwnership } from "./lib/auth";
import { logCreate, logUpdate, logDelete } from "./lib/audit";

// ============================================================================
// QUERIES
// ============================================================================

/**
 * List all job description templates for the current user.
 * Returns templates sorted by name (alphabetically).
 * Excludes soft-deleted templates.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const templates = await ctx.db
      .query("jobDescriptionTemplates")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Sort by name alphabetically
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  },
});

/**
 * Get a single template by ID.
 * Returns null if not found or not owned by current user.
 */
export const get = query({
  args: { id: v.id("jobDescriptionTemplates") },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const template = await ctx.db.get(args.id);

    // Check ownership and soft delete
    if (!template || template.userId !== userId || template.deletedAt !== undefined) {
      return null;
    }

    return template;
  },
});

/**
 * Search templates by name (position title).
 * Useful for suggesting templates based on case position title.
 */
export const searchByName = query({
  args: { query: v.string() },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return [];

    const searchQuery = args.query.toLowerCase().trim();
    if (!searchQuery) return [];

    const templates = await ctx.db
      .query("jobDescriptionTemplates")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Filter by name containing the search query
    const matches = templates.filter((t) =>
      t.name.toLowerCase().includes(searchQuery)
    );

    // Sort by relevance (exact match first, then alphabetically)
    return matches.sort((a, b) => {
      const aExact = a.name.toLowerCase() === searchQuery;
      const bExact = b.name.toLowerCase() === searchQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.name.localeCompare(b.name);
    });
  },
});

/**
 * Find template by exact name match.
 * Used for auto-populating when case position title matches a template.
 */
export const findByExactName = query({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserIdOrNull(ctx);
    if (!userId) return null;

    const nameLower = args.name.toLowerCase().trim();
    if (!nameLower) return null;

    const templates = await ctx.db
      .query("jobDescriptionTemplates")
      .withIndex("by_user_and_name", (q) =>
        q.eq("userId", userId)
      )
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    // Case-insensitive exact match
    return templates.find((t) => t.name.toLowerCase() === nameLower) ?? null;
  },
});

// ============================================================================
// MUTATIONS
// ============================================================================

/**
 * Create a new job description template.
 * Validates that name (position title) is unique for this user.
 *
 * @throws {Error} If name is empty or already exists
 */
export const create = mutation({
  args: {
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getCurrentUserId(ctx);

    // Validate name
    const name = args.name.trim();
    if (!name) {
      throw new Error("Template name (position title) is required");
    }

    // Validate description
    const description = args.description.trim();
    if (!description) {
      throw new Error("Job description is required");
    }

    // Check for duplicate name (case-insensitive)
    const nameLower = name.toLowerCase();
    const existingTemplates = await ctx.db
      .query("jobDescriptionTemplates")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const duplicate = existingTemplates.find(
      (t) => t.name.toLowerCase() === nameLower
    );
    if (duplicate) {
      throw new Error(
        `A template with the name "${name}" already exists. Please choose a different name.`
      );
    }

    // Create template
    const now = Date.now();
    const templateId = await ctx.db.insert("jobDescriptionTemplates", {
      userId: userId,
      name,
      description,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    const newDoc = await ctx.db.get(templateId);
    if (newDoc) {
      await logCreate(ctx, "jobDescriptionTemplates", templateId, newDoc);
    }

    return templateId;
  },
});

/**
 * Update an existing job description template.
 * Validates that new name (if changed) doesn't conflict with existing templates.
 *
 * @throws {Error} If template not found, not owned, or name conflict
 */
export const update = mutation({
  args: {
    id: v.id("jobDescriptionTemplates"),
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) {
      throw new Error("Template not found");
    }
    await verifyOwnership(ctx, template, "template");

    if (template.deletedAt !== undefined) {
      throw new Error("Cannot update deleted template");
    }

    // Validate name
    const name = args.name.trim();
    if (!name) {
      throw new Error("Template name (position title) is required");
    }

    // Validate description
    const description = args.description.trim();
    if (!description) {
      throw new Error("Job description is required");
    }

    // Check for duplicate name (if name changed)
    if (name.toLowerCase() !== template.name.toLowerCase()) {
      const userId = template.userId;
      const existingTemplates = await ctx.db
        .query("jobDescriptionTemplates")
        .withIndex("by_user_id", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();

      const duplicate = existingTemplates.find(
        (t) => t._id !== args.id && t.name.toLowerCase() === name.toLowerCase()
      );
      if (duplicate) {
        throw new Error(
          `A template with the name "${name}" already exists. Please choose a different name.`
        );
      }
    }

    // Capture old state for audit
    const oldDoc = { ...template };

    // Update template
    const now = Date.now();
    await ctx.db.patch(args.id, {
      name,
      description,
      updatedAt: now,
    });

    // Audit log
    const newDoc = await ctx.db.get(args.id);
    if (newDoc) {
      await logUpdate(ctx, "jobDescriptionTemplates", args.id, oldDoc, newDoc);
    }

    return args.id;
  },
});

/**
 * Delete a job description template (soft delete).
 *
 * @throws {Error} If template not found or not owned
 */
export const remove = mutation({
  args: { id: v.id("jobDescriptionTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) {
      throw new Error("Template not found");
    }
    await verifyOwnership(ctx, template, "template");

    if (template.deletedAt !== undefined) {
      throw new Error("Template already deleted");
    }

    // Capture old state for audit
    const oldDoc = { ...template };

    // Soft delete
    const now = Date.now();
    await ctx.db.patch(args.id, {
      deletedAt: now,
      updatedAt: now,
    });

    // Audit log
    await logDelete(ctx, "jobDescriptionTemplates", args.id, oldDoc);

    return { success: true };
  },
});

/**
 * Permanently delete a job description template (hard delete).
 * Also clears the template reference from any cases that use it.
 * The job description content is preserved on cases - only the link is removed.
 *
 * @throws {Error} If template not found or not owned
 */
export const hardDelete = mutation({
  args: { id: v.id("jobDescriptionTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) {
      throw new Error("Template not found");
    }
    await verifyOwnership(ctx, template, "template");

    // Find all cases referencing this template
    const referencingCases = await ctx.db
      .query("cases")
      .withIndex("by_user_id", (q) => q.eq("userId", template.userId))
      .collect();

    // Filter to only cases with this template ID
    const casesWithTemplate = referencingCases.filter(
      (c) => c.jobDescriptionTemplateId === args.id
    );

    // Clear template references (preserves job description data)
    for (const caseDoc of casesWithTemplate) {
      await ctx.db.patch(caseDoc._id, {
        jobDescriptionTemplateId: undefined,
        updatedAt: Date.now(),
      });
    }

    // Audit log before deletion
    await logDelete(ctx, "jobDescriptionTemplates", args.id, template);

    // Hard delete the template
    await ctx.db.delete(args.id);

    return { success: true, clearedReferences: casesWithTemplate.length };
  },
});

/**
 * Increment usage count when a template is loaded.
 * Called when user selects a template to populate the job description field.
 */
export const recordUsage = mutation({
  args: { id: v.id("jobDescriptionTemplates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.id);
    if (!template) {
      throw new Error("Template not found");
    }
    await verifyOwnership(ctx, template, "template");

    if (template.deletedAt !== undefined) {
      throw new Error("Cannot record usage of deleted template");
    }

    const now = Date.now();
    await ctx.db.patch(args.id, {
      usageCount: template.usageCount + 1,
      lastUsedAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

// ============================================================================
// INTERNAL MUTATIONS (for chatbot and other server-side callers)
// ============================================================================

/**
 * Internal: Create template from chatbot.
 * Accepts userId directly instead of extracting from auth context.
 * Performs same validation as public create mutation.
 */
export const internalCreate = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const name = args.name.trim();
    const description = args.description.trim();

    if (!name || !description) {
      throw new Error("Name and description are required");
    }

    // Check for duplicate
    const existingTemplates = await ctx.db
      .query("jobDescriptionTemplates")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const duplicate = existingTemplates.find(
      (t) => t.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      throw new Error(`Template "${name}" already exists`);
    }

    const now = Date.now();
    const templateId = await ctx.db.insert("jobDescriptionTemplates", {
      userId: args.userId,
      name,
      description,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    return templateId;
  },
});
