/**
 * Audit Logging Library
 *
 * This module provides helpers for comprehensive audit logging of database changes:
 * - Field-level change tracking
 * - User action logging (create/update/delete)
 * - Metadata capture (IP, user agent, source)
 * - PII redaction for sensitive fields
 *
 * All audit logs are append-only and stored in the auditLogs table.
 */

import { MutationCtx } from "../_generated/server";
import type { Id, TableNames } from "../_generated/dataModel";
import { getCurrentUserId } from "./auth";
import { loggers } from "./logging";

const log = loggers.audit;

/**
 * Fields that should be redacted in audit logs to protect sensitive data
 * These fields will show [REDACTED] instead of actual values
 */
const SENSITIVE_FIELDS = new Set([
  // OAuth tokens
  "googleAccessToken",
  "googleRefreshToken",
  "token",
  // Authentication secrets
  "password",
  "passwordHash",
  "secret",
  "apiKey",
  // PII that shouldn't be logged
  "employerFein", // Employer tax ID (like SSN)
  "ssn",
  "socialSecurityNumber",
  // Session tokens
  "sessionToken",
  "refreshToken",
  "accessToken",
]);

/**
 * Helper to serialize values for comparison, handling BigInt
 * Redacts sensitive fields to prevent PII exposure in logs
 */
function serializeValue(value: unknown, field?: string): string {
  // Redact sensitive fields
  if (field && SENSITIVE_FIELDS.has(field)) {
    if (value === null || value === undefined) {
      return "[EMPTY]";
    }
    return "[REDACTED]";
  }

  return JSON.stringify(value, (_, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
}

/**
 * Audit action types
 */
export type AuditAction = "create" | "update" | "delete";

/**
 * Field-level change descriptor
 * Values are serialized to strings for consistent schema typing
 */
export type FieldChange = {
  field: string;
  oldValue?: string;
  newValue?: string;
};

/**
 * Optional audit metadata
 */
export type AuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
  source?: "web" | "api" | "chatbot";
};

/**
 * Calculate field-level changes between two documents
 *
 * @param oldDoc - Previous document state (null for create)
 * @param newDoc - New document state (null for delete)
 * @returns Array of field changes
 */
export function calculateChanges(
  oldDoc: Record<string, unknown> | null,
  newDoc: Record<string, unknown> | null
): FieldChange[] {
  const changes: FieldChange[] = [];

  // Create: all new fields
  if (!oldDoc && newDoc) {
    for (const [field, value] of Object.entries(newDoc)) {
      // Skip internal Convex fields
      if (field.startsWith("_")) {
        continue;
      }
      changes.push({
        field,
        newValue: serializeValue(value, field),
      });
    }
    return changes;
  }

  // Delete: all old fields
  if (oldDoc && !newDoc) {
    for (const [field, value] of Object.entries(oldDoc)) {
      // Skip internal Convex fields
      if (field.startsWith("_")) {
        continue;
      }
      changes.push({
        field,
        oldValue: serializeValue(value, field),
      });
    }
    return changes;
  }

  // Update: only changed fields
  if (oldDoc && newDoc) {
    // Check all fields in new document
    for (const [field, newValue] of Object.entries(newDoc)) {
      // Skip internal Convex fields
      if (field.startsWith("_")) {
        continue;
      }

      const oldValue = oldDoc[field];
      const oldSerialized = serializeValue(oldValue, field);
      const newSerialized = serializeValue(newValue, field);

      // Deep comparison using custom serialization that handles BigInt
      if (oldSerialized !== newSerialized) {
        changes.push({
          field,
          oldValue: oldSerialized,
          newValue: newSerialized,
        });
      }
    }

    // Check for deleted fields (exist in old but not in new)
    for (const field of Object.keys(oldDoc)) {
      // Skip internal Convex fields
      if (field.startsWith("_")) {
        continue;
      }

      if (!(field in newDoc)) {
        changes.push({
          field,
          oldValue: serializeValue(oldDoc[field], field),
        });
      }
    }
  }

  return changes;
}

/**
 * Core audit logging function
 *
 * @param ctx - Mutation context
 * @param params - Audit log parameters
 */
export async function logAudit(
  ctx: MutationCtx,
  params: {
    tableName: string;
    documentId: Id<TableNames>;
    action: AuditAction;
    oldDoc?: Record<string, unknown> | null;
    newDoc?: Record<string, unknown> | null;
    metadata?: AuditMetadata;
  }
): Promise<void> {
  try {
    const userId = await getCurrentUserId(ctx);
    const changes = calculateChanges(params.oldDoc ?? null, params.newDoc ?? null);

    await ctx.db.insert("auditLogs", {
      userId: userId,
      tableName: params.tableName,
      documentId: params.documentId.toString(),
      action: params.action,
      changes: changes.length > 0 ? changes : undefined,
      metadata: params.metadata,
      timestamp: Date.now(),
    });
  } catch (error) {
    // Log the error but don't fail the main operation
    log.error('Failed to record audit entry', {
      error: error instanceof Error ? error.message : String(error),
      action: params.action,
      tableName: params.tableName,
      resourceId: params.documentId.toString(),
    });
    // Don't re-throw - audit failure shouldn't break the main operation
  }
}

/**
 * Log a document creation
 *
 * @param ctx - Mutation context
 * @param tableName - Name of the table
 * @param documentId - ID of created document
 * @param newDoc - Created document data
 * @param metadata - Optional audit metadata
 */
export async function logCreate(
  ctx: MutationCtx,
  tableName: string,
  documentId: Id<TableNames>,
  newDoc: Record<string, unknown>,
  metadata?: AuditMetadata
): Promise<void> {
  await logAudit(ctx, {
    tableName,
    documentId,
    action: "create",
    newDoc,
    metadata,
  });
}

/**
 * Log a document update
 *
 * @param ctx - Mutation context
 * @param tableName - Name of the table
 * @param documentId - ID of updated document
 * @param oldDoc - Previous document state
 * @param newDoc - New document state
 * @param metadata - Optional audit metadata
 */
export async function logUpdate(
  ctx: MutationCtx,
  tableName: string,
  documentId: Id<TableNames>,
  oldDoc: Record<string, unknown>,
  newDoc: Record<string, unknown>,
  metadata?: AuditMetadata
): Promise<void> {
  await logAudit(ctx, {
    tableName,
    documentId,
    action: "update",
    oldDoc,
    newDoc,
    metadata,
  });
}

/**
 * Log a document deletion
 *
 * @param ctx - Mutation context
 * @param tableName - Name of the table
 * @param documentId - ID of deleted document
 * @param oldDoc - Deleted document data
 * @param metadata - Optional audit metadata
 */
export async function logDelete(
  ctx: MutationCtx,
  tableName: string,
  documentId: Id<TableNames>,
  oldDoc: Record<string, unknown>,
  metadata?: AuditMetadata
): Promise<void> {
  await logAudit(ctx, {
    tableName,
    documentId,
    action: "delete",
    oldDoc,
    metadata,
  });
}
