/**
 * Document management constants and types.
 *
 * Canonical source — frontend re-exports from src/lib/documents/.
 */

/** Allowed file extensions for document upload (OWASP whitelist). */
export const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "tiff",
  "tif",
]);

/** Allowed MIME types for document upload. */
export const ALLOWED_DOCUMENT_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/tiff",
]);

/** Maximum file size in bytes (20 MB). */
export const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;

/** Maximum number of documents per case. */
export const MAX_DOCUMENTS_PER_CASE = 50;

/** Maximum display name length for document filenames. */
export const MAX_DOCUMENT_NAME_LENGTH = 255;

/** PERM document categories. */
export const DOCUMENT_CATEGORIES = [
  "pwd",
  "recruitment",
  "eta9089",
  "i140",
  "general",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

/** Human-readable labels for document categories. */
export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  pwd: "PWD",
  recruitment: "Recruitment",
  eta9089: "ETA-9089",
  i140: "I-140",
  general: "General",
};
