/**
 * Client-side document file validation.
 *
 * Defense-in-depth: validates extension, size, MIME type, and magic bytes
 * before uploading to Convex. Server-side validation in convex/documents.ts
 * provides the authoritative check.
 */

import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "./index";

/** Magic byte signatures for allowed file types. */
const MAGIC_SIGNATURES: Array<{
  mimePrefix: string;
  bytes: number[];
}> = [
  { mimePrefix: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mimePrefix: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mimePrefix: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  // TIFF: little-endian (II) or big-endian (MM)
  { mimePrefix: "image/tiff", bytes: [0x49, 0x49, 0x2a, 0x00] },
  { mimePrefix: "image/tiff", bytes: [0x4d, 0x4d, 0x00, 0x2a] },
  // DOCX/XLSX are ZIP-based (PK signature)
  {
    mimePrefix:
      "application/vnd.openxmlformats-officedocument",
    bytes: [0x50, 0x4b, 0x03, 0x04],
  },
  // Legacy DOC/XLS are OLE2 Compound Documents
  {
    mimePrefix: "application/msword",
    bytes: [0xd0, 0xcf, 0x11, 0xe0],
  },
  {
    mimePrefix: "application/vnd.ms-excel",
    bytes: [0xd0, 0xcf, 0x11, 0xe0],
  },
];

function matchesMagicBytes(
  fileBytes: Uint8Array,
  mimeType: string
): boolean {
  // Find all signatures that match this MIME type prefix
  const candidates = MAGIC_SIGNATURES.filter((sig) =>
    mimeType.startsWith(sig.mimePrefix)
  );

  // If no signatures defined for this type, allow (fallback to MIME check only)
  if (candidates.length === 0) return true;

  // Check if file bytes match any candidate signature
  return candidates.some((sig) =>
    sig.bytes.every((b, i) => fileBytes[i] === b)
  );
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a file before upload.
 * Checks extension, size, MIME type, and magic bytes.
 */
export async function validateDocumentFile(
  file: File
): Promise<ValidationResult> {
  // 1. Extension check
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_DOCUMENT_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `File type .${ext || "unknown"} is not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, JPG, PNG, TIFF.`,
    };
  }

  // 2. Size check
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is ${sizeMB} MB. Maximum allowed size is 20 MB.`,
    };
  }

  // 3. MIME type check
  if (file.type && !ALLOWED_DOCUMENT_CONTENT_TYPES.has(file.type)) {
    return {
      valid: false,
      error: `Content type ${file.type} is not allowed.`,
    };
  }

  // 4. Magic byte check (defense-in-depth)
  try {
    const buffer = await file.slice(0, 8).arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const declaredType = file.type || "application/octet-stream";
    if (!matchesMagicBytes(bytes, declaredType)) {
      return {
        valid: false,
        error: "File content does not match its declared type.",
      };
    }
  } catch {
    // If we can't read magic bytes, proceed with other checks
  }

  return { valid: true };
}
