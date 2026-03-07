import { mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getCurrentUserId, verifyOwnership } from "./lib/auth";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENTS_PER_CASE,
  MAX_DOCUMENT_NAME_LENGTH,
} from "./lib/documents";

/**
 * Step 1 of 2: Generate a short-lived upload URL for direct browser-to-storage upload.
 * Validates file metadata (extension, content type, size) before returning URL.
 * Client uploads to the returned URL, then calls saveDocument (step 2) with the storageId.
 */
export const generateUploadUrl = mutation({
  args: {
    caseId: v.id("cases"),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    await getCurrentUserId(ctx);
    const caseDoc = await ctx.db.get(args.caseId);
    await verifyOwnership(ctx, caseDoc, "case");
    if (!caseDoc) throw new ConvexError("Case not found");

    // Validate extension
    const ext = args.fileName.split(".").pop()?.toLowerCase();
    if (!ext || !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
      throw new ConvexError(`File type .${ext || "unknown"} is not allowed`);
    }

    // Validate content type
    if (!ALLOWED_DOCUMENT_CONTENT_TYPES.has(args.contentType)) {
      throw new ConvexError(
        `Content type ${args.contentType} is not allowed`
      );
    }

    // Validate size
    if (args.fileSize > MAX_DOCUMENT_SIZE_BYTES) {
      throw new ConvexError("File exceeds 20 MB limit");
    }

    // Check document count
    const existingDocs = caseDoc.documents || [];
    if (existingDocs.length >= MAX_DOCUMENTS_PER_CASE) {
      throw new ConvexError(
        `Maximum ${MAX_DOCUMENTS_PER_CASE} documents per case`
      );
    }

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Save document metadata after successful upload.
 * Retrieves the serving URL from the storage ID and adds the document to the case.
 */
export const saveDocument = mutation({
  args: {
    caseId: v.id("cases"),
    storageId: v.string(),
    fileName: v.string(),
    contentType: v.string(),
    fileSize: v.number(),
    category: v.optional(
      v.union(
        v.literal("pwd"),
        v.literal("recruitment"),
        v.literal("eta9089"),
        v.literal("i140"),
        v.literal("general")
      )
    ),
  },
  handler: async (ctx, args) => {
    await getCurrentUserId(ctx);
    const caseDoc = await ctx.db.get(args.caseId);
    await verifyOwnership(ctx, caseDoc, "case");
    if (!caseDoc) throw new ConvexError("Case not found");

    const url = await ctx.storage.getUrl(
      args.storageId as Id<"_storage">
    );
    if (!url) {
      throw new ConvexError("Failed to get storage URL");
    }

    const existing = caseDoc.documents || [];
    if (existing.length >= MAX_DOCUMENTS_PER_CASE) {
      throw new ConvexError(`Maximum ${MAX_DOCUMENTS_PER_CASE} documents per case`);
    }

    const docEntry = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: args.fileName.slice(0, MAX_DOCUMENT_NAME_LENGTH),
      url,
      storageId: args.storageId,
      mimeType: args.contentType,
      size: args.fileSize,
      uploadedAt: Date.now(),
      category: args.category,
    };

    await ctx.db.patch(args.caseId, {
      documents: [...existing, docEntry],
    });

    return docEntry.id;
  },
});

/**
 * Remove a document from a case and delete it from storage.
 */
export const removeDocument = mutation({
  args: {
    caseId: v.id("cases"),
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    await getCurrentUserId(ctx);
    const caseDoc = await ctx.db.get(args.caseId);
    await verifyOwnership(ctx, caseDoc, "case");
    if (!caseDoc) throw new ConvexError("Case not found");

    const docs = caseDoc.documents || [];
    const doc = docs.find((d) => d.id === args.documentId);
    if (!doc) {
      throw new ConvexError("Document not found");
    }

    // Delete from Convex file storage
    if (doc.storageId) {
      try {
        await ctx.storage.delete(doc.storageId as Id<"_storage">);
      } catch (error) {
        console.warn(`[removeDocument] Storage delete failed for ${doc.storageId}:`,
          error instanceof Error ? error.message : "unknown");
      }
    }

    // Remove from array
    await ctx.db.patch(args.caseId, {
      documents: docs.filter((d) => d.id !== args.documentId),
    });
  },
});
