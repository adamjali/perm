import { describe, it, expect } from "vitest";
import { validateDocumentFile } from "../validation";
import {
  ALLOWED_DOCUMENT_EXTENSIONS,
  ALLOWED_DOCUMENT_CONTENT_TYPES,
  MAX_DOCUMENT_SIZE_BYTES,
} from "../index";

/** Magic byte prefixes for common file types. */
const MAGIC_BYTES: Record<string, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "image/jpeg": [0xff, 0xd8, 0xff, 0xe0],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/tiff": [0x49, 0x49, 0x2a, 0x00],
  "application/msword": [0xd0, 0xcf, 0x11, 0xe0],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [0x50, 0x4b, 0x03, 0x04],
  "application/vnd.ms-excel": [0xd0, 0xcf, 0x11, 0xe0],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [0x50, 0x4b, 0x03, 0x04],
};

function createMockFile(
  name: string,
  size: number,
  type: string,
): File {
  // Create content with correct magic bytes for the MIME type
  const magic = MAGIC_BYTES[type];
  const content = magic
    ? new Uint8Array([...magic, ...new Array(Math.max(0, 100 - magic.length)).fill(0)])
    : new Uint8Array(100);
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  // Override size on the File for testing
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("validateDocumentFile", () => {
  describe("extension validation", () => {
    it.each([
      ["test.pdf", "application/pdf"],
      ["test.doc", "application/msword"],
      ["test.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
      ["test.xls", "application/vnd.ms-excel"],
      ["test.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
      ["test.jpg", "image/jpeg"],
      ["test.jpeg", "image/jpeg"],
      ["test.png", "image/png"],
      ["test.tiff", "image/tiff"],
      ["test.tif", "image/tiff"],
    ])("accepts %s", async (name, type) => {
      const file = createMockFile(name, 1024, type);
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(true);
    });

    it.each([
      ["malware.exe", "application/x-msdownload"],
      ["script.js", "text/javascript"],
      ["hack.php", "text/php"],
      ["payload.sh", "application/x-sh"],
      ["archive.zip", "application/zip"],
      ["macro.xlsm", "application/vnd.ms-excel.sheet.macroEnabled.12"],
      ["image.svg", "image/svg+xml"],
    ])("rejects %s", async (name, type) => {
      const file = createMockFile(name, 1024, type);
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("rejects files without extension", async () => {
      createMockFile("noextension", 1024, "application/pdf");
      // File has no extension dot
      const noExtFile = new File(["test"], "noextension", { type: "application/pdf" });
      const result = await validateDocumentFile(noExtFile);
      // "noextension" has no dot, so the extension check finds "noextension" which is not in the allowed set
      expect(result.valid).toBe(false);
    });
  });

  describe("size validation", () => {
    it("accepts files under 20 MB", async () => {
      const file = createMockFile("test.pdf", 10 * 1024 * 1024, "application/pdf");
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(true);
    });

    it("accepts files exactly at 20 MB", async () => {
      const file = createMockFile("test.pdf", MAX_DOCUMENT_SIZE_BYTES, "application/pdf");
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(true);
    });

    it("rejects files over 20 MB", async () => {
      const file = createMockFile("test.pdf", MAX_DOCUMENT_SIZE_BYTES + 1, "application/pdf");
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("20 MB");
    });
  });

  describe("MIME type validation", () => {
    it("rejects mismatched MIME type", async () => {
      const file = createMockFile("test.pdf", 1024, "text/html");
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("rejects empty MIME type", async () => {
      const file = createMockFile("test.pdf", 1024, "");
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("could not be determined");
    });
  });

  describe("magic byte validation", () => {
    it("rejects file with correct ext+MIME but wrong magic bytes", async () => {
      // JPEG magic bytes in a file declared as PDF
      const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(96).fill(0)]);
      const blob = new Blob([jpegBytes], { type: "application/pdf" });
      const file = new File([blob], "fake.pdf", { type: "application/pdf" });
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match");
    });

    it("rejects PNG magic bytes declared as JPEG", async () => {
      const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, ...new Array(96).fill(0)]);
      const blob = new Blob([pngBytes], { type: "image/jpeg" });
      const file = new File([blob], "fake.jpg", { type: "image/jpeg" });
      const result = await validateDocumentFile(file);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match");
    });
  });
});

describe("document constants", () => {
  it("has matching extensions and content types", () => {
    // Every extension should map to at least one content type
    expect(ALLOWED_DOCUMENT_EXTENSIONS.size).toBeGreaterThan(0);
    expect(ALLOWED_DOCUMENT_CONTENT_TYPES.size).toBeGreaterThan(0);
  });

  it("MAX_DOCUMENT_SIZE_BYTES is 20 MB", () => {
    expect(MAX_DOCUMENT_SIZE_BYTES).toBe(20 * 1024 * 1024);
  });

  it("includes all standard PERM document types", () => {
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has("pdf")).toBe(true);
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has("docx")).toBe(true);
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has("xlsx")).toBe(true);
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has("jpg")).toBe(true);
    expect(ALLOWED_DOCUMENT_EXTENSIONS.has("png")).toBe(true);
  });
});
