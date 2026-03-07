"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "motion/react";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
  Image as ImageIcon,
  FileSpreadsheet,
  Maximize2,
} from "lucide-react";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/documents";
import { itemVariants, fmtTimestamp } from "./case-detail-utils";

interface DocumentEntry {
  id: string;
  name: string;
  url: string;
  storageId?: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  category?: DocumentCategory;
}

interface DocumentsTabProps {
  documents: DocumentEntry[];
  onUpload?: (file: File, category?: DocumentCategory) => Promise<void>;
  onDelete?: (documentId: string) => Promise<void>;
}

const ITEMS_PER_PAGE = 10;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileTypeLabel(mimeType: string): string {
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("png")) return "PNG";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "JPG";
  if (mimeType.includes("tiff") || mimeType.includes("tif")) return "TIFF";
  if (mimeType.includes("word") || mimeType.includes("docx")) return "DOCX";
  if (mimeType.includes("excel") || mimeType.includes("xlsx") || mimeType.includes("spreadsheet")) return "XLSX";
  if (mimeType.includes("csv")) return "CSV";
  if (mimeType.includes("text")) return "TXT";
  return "FILE";
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return <ImageIcon className="h-5 w-5" />;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || mimeType.includes("xlsx"))
    return <FileSpreadsheet className="h-5 w-5" />;
  return <FileText className="h-5 w-5" />;
}

const ACCEPT_STRING = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.tiff,.tif";

function canPreview(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.startsWith("image/");
}

function DocumentPreview({ doc, onFullscreen }: { doc: DocumentEntry; onFullscreen?: () => void }) {
  if (doc.mimeType === "application/pdf") {
    return (
      <div style={{ position: "relative" }}>
        <iframe
          src={doc.url}
          title={doc.name}
          style={{
            width: "100%",
            height: 300,
            border: "3px solid var(--border)",
            background: "var(--background)",
          }}
        />
        {onFullscreen && (
          <button
            className="icon-btn"
            onClick={onFullscreen}
            title="Full screen"
            style={{ position: "absolute", top: 8, right: 8 }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  if (doc.mimeType.startsWith("image/")) {
    return (
      <div
        style={{
          position: "relative",
          border: "3px solid var(--border)",
          background: "var(--muted)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          maxHeight: 300,
          overflow: "hidden",
          cursor: onFullscreen ? "pointer" : "default",
        }}
        onClick={onFullscreen}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doc.url}
          alt={doc.name}
          style={{
            maxWidth: "100%",
            maxHeight: 300,
            objectFit: "contain",
          }}
        />
        {onFullscreen && (
          <button
            className="icon-btn"
            title="Full screen"
            style={{ position: "absolute", top: 8, right: 8 }}
            onClick={(e) => { e.stopPropagation(); onFullscreen(); }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Fallback for non-previewable files
  const typeLabel = getFileTypeLabel(doc.mimeType);
  return (
    <div
      style={{
        border: "3px solid var(--border)",
        background: "var(--muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 160,
      }}
    >
      <div style={{ textAlign: "center", color: "var(--muted-foreground)" }}>
        {getFileIcon(doc.mimeType)}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            marginTop: 8,
          }}
        >
          {typeLabel} &middot; {formatFileSize(doc.size)}
        </div>
        <div
          style={{
            fontSize: "0.7rem",
            marginTop: 4,
            opacity: 0.7,
          }}
        >
          Download to view
        </div>
      </div>
    </div>
  );
}

function FullscreenViewer({
  doc,
  onClose,
  onNav,
  hasPrev,
  hasNext,
  onDelete,
}: {
  doc: DocumentEntry;
  onClose: () => void;
  onNav: (dir: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
  onDelete?: (id: string) => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNav(-1);
      if (e.key === "ArrowRight" && hasNext) onNav(1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onNav, hasPrev, hasNext]);

  return (
    <div className="doc-fullscreen-overlay" onClick={onClose}>
      <div className="doc-fullscreen-header" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="icon-btn"
            onClick={() => onNav(-1)}
            disabled={!hasPrev}
            title="Previous"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            className="icon-btn"
            onClick={() => onNav(1)}
            disabled={!hasNext}
            title="Next"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="doc-fullscreen-name">{doc.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <a
            href={doc.url}
            download={doc.name}
            target="_blank"
            rel="noopener noreferrer"
            className="icon-btn"
            style={{ width: "auto", padding: "4px 10px", gap: 6, display: "flex", alignItems: "center", textDecoration: "none" }}
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
          {onDelete && (
            <button
              className="icon-btn icon-btn-danger"
              style={{ width: "auto", padding: "4px 10px", gap: 6, display: "flex", alignItems: "center", color: "var(--destructive)" }}
              onClick={() => { onDelete(doc.id); onClose(); }}
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          )}
          <button className="icon-btn" onClick={onClose} title="Close (Esc)">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="doc-fullscreen-body" onClick={(e) => e.stopPropagation()}>
        {doc.mimeType === "application/pdf" ? (
          <iframe src={doc.url} title={doc.name} style={{ width: "100%", height: "100%", border: "none", background: "#fff" }} />
        ) : doc.mimeType.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.url} alt={doc.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ textAlign: "center", color: "#999", padding: 40 }}>
            {getFileIcon(doc.mimeType)}
            <div style={{ marginTop: 12, fontSize: "0.9rem" }}>Preview not available. Download to view.</div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentsTab({
  documents,
  onUpload,
  onDelete,
}: DocumentsTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCategory, setPendingCategory] = useState<DocumentCategory>("general");
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | "all">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = filterCategory === "all"
    ? documents
    : documents.filter((d) => d.category === filterCategory);

  const selectedDoc = selectedId ? documents.find((d) => d.id === selectedId) || null : null;
  const fullscreenDoc = fullscreenId ? documents.find((d) => d.id === fullscreenId) || null : null;
  const isOpen = selectedDoc !== null;

  const totalPages = Math.ceil(filteredDocs.length / ITEMS_PER_PAGE);
  const pagedDocs = filteredDocs.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  // Auto-advance page when selected doc is on a different page
  useEffect(() => {
    if (selectedId) {
      const idx = documents.findIndex((d) => d.id === selectedId);
      if (idx >= 0) {
        const docPage = Math.floor(idx / ITEMS_PER_PAGE);
        if (docPage !== page) setPage(docPage);
      }
    }
  }, [selectedId, documents, page]);

  function closePreview() {
    setSelectedId(null);
  }

  function navDoc(dir: number) {
    const idx = documents.findIndex((d) => d.id === selectedId);
    if (idx < 0) return;
    const next = idx + dir;
    const target = documents[next];
    if (next >= 0 && target) setSelectedId(target.id);
  }

  function navFullscreen(dir: number) {
    const idx = documents.findIndex((d) => d.id === fullscreenId);
    if (idx < 0) return;
    const next = idx + dir;
    const target = documents[next];
    if (next >= 0 && target) setFullscreenId(target.id);
  }

  // File selection stages to pending (category picker) instead of immediate upload
  const handleFileStage = useCallback(
    (file: File) => {
      if (!onUpload) return;
      setPendingFile(file);
      setPendingCategory("general");
    },
    [onUpload]
  );

  const handleConfirmUpload = useCallback(async () => {
    if (!onUpload || !pendingFile || isUploading) return;
    setIsUploading(true);
    try {
      await onUpload(pendingFile, pendingCategory);
    } catch {
      // Error handled by onUpload (handleUploadDocument)
    } finally {
      setIsUploading(false);
      setPendingFile(null);
    }
  }, [onUpload, pendingFile, pendingCategory, isUploading]);

  const handleCancelUpload = useCallback(() => {
    setPendingFile(null);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileStage(file);
      e.target.value = "";
    },
    [handleFileStage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileStage(file);
    },
    [handleFileStage]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!onDelete || !confirmDeleteId) return;
    try {
      await onDelete(confirmDeleteId);
    } finally {
      setConfirmDeleteId(null);
      if (selectedId === confirmDeleteId) setSelectedId(null);
      if (fullscreenId === confirmDeleteId) setFullscreenId(null);
    }
  }, [onDelete, confirmDeleteId, selectedId, fullscreenId]);

  const fullscreenIdx = fullscreenDoc ? documents.findIndex((d) => d.id === fullscreenDoc.id) : -1;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <div className="detail-card no-hover" style={{ overflow: "hidden" }}>
          <div className="detail-card-head ch-dark" style={{ gap: 8 }}>
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Documents
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value as DocumentCategory | "all"); setPage(0); }}
                style={{
                  height: 24,
                  padding: "0 6px",
                  border: "2px solid var(--foreground)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                <option value="all">All</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.6rem",
                  background: "var(--card)",
                  border: "2px solid var(--foreground)",
                  padding: "1px 8px",
                  color: "var(--foreground)",
                }}
              >
                {filteredDocs.length}
              </span>

              {/* Upload button */}
              {onUpload && (
                <button
                  className="flex items-center gap-2 font-mono font-bold uppercase tracking-wider border-[3px] border-current bg-card text-foreground shadow-hard-sm"
                  style={{
                    fontSize: "0.7rem",
                    padding: "3px 10px",
                    cursor: isUploading ? "wait" : "pointer",
                    opacity: isUploading ? 0.7 : 1,
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || !!pendingFile}
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {isUploading ? "Uploading..." : "Upload"}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_STRING}
                onChange={handleInputChange}
                style={{ display: "none" }}
              />
            </div>
          </div>

          <div className={`split-wrap${isOpen ? " preview-open" : ""}`}>
            <div className="split-list">
              {/* Pending upload bar */}
              {pendingFile && (
                <div className="pending-upload-bar">
                  <FileText className="h-4 w-4" style={{ flexShrink: 0 }} />
                  <div className="pending-upload-name">{pendingFile.name}</div>
                  <select
                    value={pendingCategory}
                    onChange={(e) => setPendingCategory(e.target.value as DocumentCategory)}
                    style={{
                      height: 26,
                      padding: "0 6px",
                      border: "2px solid var(--foreground)",
                      background: "var(--card)",
                      color: "var(--foreground)",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.6rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}
                    disabled={isUploading}
                  >
                    {DOCUMENT_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {DOCUMENT_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  <button
                    className="icon-btn"
                    style={{
                      width: "auto",
                      padding: "3px 10px",
                      fontWeight: 700,
                      fontSize: "0.65rem",
                      fontFamily: "var(--font-mono)",
                      background: "var(--primary)",
                      color: "var(--primary-foreground)",
                      textTransform: "uppercase",
                    }}
                    onClick={handleConfirmUpload}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Upload"
                    )}
                  </button>
                  {!isUploading && (
                    <button
                      className="icon-btn"
                      style={{ width: 26, height: 26, padding: 0 }}
                      onClick={handleCancelUpload}
                      title="Cancel"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}

              {pagedDocs.length > 0 ? (
                <div className="scroll-list">
                  {pagedDocs.map((doc) => {
                    const typeLabel = getFileTypeLabel(doc.mimeType);
                    const catLabel = doc.category
                      ? DOCUMENT_CATEGORY_LABELS[doc.category]
                      : null;
                    return (
                      <div
                        key={doc.id}
                        className={`doc-row${doc.id === selectedId ? " selected" : ""}`}
                        onClick={() => setSelectedId(doc.id)}
                      >
                        <div className="doc-icon">{typeLabel}</div>
                        <div className="doc-info">
                          <div className="doc-name" title={doc.name}>
                            {doc.name}
                          </div>
                          <div className="doc-meta">
                            {typeLabel}
                            {catLabel && <> &middot; {catLabel}</>}
                            {" "}&middot; {formatFileSize(doc.size)} &middot;{" "}
                            {fmtTimestamp(doc.uploadedAt)}
                          </div>
                        </div>
                        <div
                          className="flex-row doc-actions"
                          style={{ gap: 4, flexShrink: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <a
                            href={doc.url}
                            download={doc.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-btn"
                            title="Download"
                            style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>
                          {onDelete && (
                            <button
                              className="icon-btn icon-btn-danger"
                              title="Delete"
                              style={{ color: "var(--destructive)" }}
                              onClick={() => setConfirmDeleteId(doc.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : documents.length === 0 ? (
                <div
                  className="detail-empty-state"
                  style={{ padding: "32px 20px" }}
                >
                  <FolderOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <div className="detail-empty-state-title">No documents</div>
                  <div className="detail-empty-state-desc">
                    {onUpload
                      ? "Upload documents using the button above or drag files below."
                      : "Documents for this case will appear here."}
                  </div>
                </div>
              ) : null}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="pagination-bar">
                  <button onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span>{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Drag & drop area */}
              {onUpload && !pendingFile && (
                <div style={{ padding: 16 }}>
                  <button
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 font-heading font-bold text-sm"
                    style={{
                      border: isDragOver
                        ? "3px dashed var(--primary)"
                        : "3px dashed var(--muted-foreground)",
                      borderColor: isDragOver ? "var(--primary)" : undefined,
                      background: isDragOver
                        ? "var(--primary-light, rgba(46,204,64,0.08))"
                        : "transparent",
                      boxShadow: "none",
                      cursor: isUploading ? "wait" : "pointer",
                      opacity: isUploading ? 0.6 : 1,
                      color: isDragOver
                        ? "var(--primary)"
                        : "var(--muted-foreground)",
                      transition: "all 0.15s ease",
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    disabled={isUploading}
                  >
                    <Upload className="h-4 w-4" />
                    {isDragOver
                      ? "Drop file to upload"
                      : "Drag files here or click to upload"}
                  </button>
                </div>
              )}
            </div>
            <div className="split-preview">
              {selectedDoc && (
                <div className="split-preview-inner">
                  {/* Nav */}
                  <div className="preview-nav">
                    <div className="preview-nav-btns">
                      <button
                        className="icon-btn"
                        onClick={() => navDoc(-1)}
                        disabled={documents.findIndex((d) => d.id === selectedId) <= 0}
                        title="Previous"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => navDoc(1)}
                        disabled={documents.findIndex((d) => d.id === selectedId) >= documents.length - 1}
                        title="Next"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={closePreview}
                      title="Close"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* File preview */}
                  <div style={{ marginBottom: 20 }}>
                    <DocumentPreview
                      doc={selectedDoc}
                      onFullscreen={canPreview(selectedDoc.mimeType) ? () => setFullscreenId(selectedDoc.id) : undefined}
                    />
                  </div>

                  {/* Title */}
                  <div className="preview-title" title={selectedDoc.name}>
                    {selectedDoc.name}
                  </div>

                  {/* Meta */}
                  <div className="preview-meta">
                    <span>Uploaded: {fmtTimestamp(selectedDoc.uploadedAt)}</span>
                    <span>{getFileTypeLabel(selectedDoc.mimeType)}</span>
                    <span>{formatFileSize(selectedDoc.size)}</span>
                    {selectedDoc.category && (
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontWeight: 700,
                          textTransform: "uppercase",
                          fontSize: "0.62rem",
                          padding: "2px 6px",
                          border: "2px solid var(--border)",
                          background: "var(--muted)",
                        }}
                      >
                        {DOCUMENT_CATEGORY_LABELS[
                          selectedDoc.category as DocumentCategory
                        ] || selectedDoc.category}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
                    {canPreview(selectedDoc.mimeType) && (
                      <button
                        className="icon-btn"
                        style={{
                          width: "auto",
                          padding: "4px 12px",
                          gap: 6,
                          display: "flex",
                          alignItems: "center",
                        }}
                        onClick={() => setFullscreenId(selectedDoc.id)}
                      >
                        <Maximize2 className="h-3.5 w-3.5" /> Full Screen
                      </button>
                    )}
                    <a
                      href={selectedDoc.url}
                      download={selectedDoc.name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="icon-btn"
                      style={{
                        width: "auto",
                        padding: "4px 12px",
                        gap: 6,
                        display: "flex",
                        alignItems: "center",
                        textDecoration: "none",
                      }}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </a>
                    {onDelete && (
                      <button
                        className="icon-btn icon-btn-danger"
                        style={{
                          width: "auto",
                          padding: "4px 12px",
                          gap: 6,
                          display: "flex",
                          alignItems: "center",
                          color: "var(--destructive)",
                        }}
                        onClick={() => setConfirmDeleteId(selectedDoc.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Delete confirmation dialog */}
      {confirmDeleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            style={{
              background: "var(--card)",
              border: "3px solid var(--foreground)",
              padding: 24,
              maxWidth: 400,
              width: "90%",
              boxShadow: "6px 6px 0px var(--foreground)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontWeight: 700,
                fontSize: "1.1rem",
                marginBottom: 8,
              }}
            >
              Delete Document
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--muted-foreground)",
                marginBottom: 20,
              }}
            >
              This will permanently delete the document. This action cannot be
              undone.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                className="icon-btn"
                style={{ width: "auto", padding: "6px 16px", fontWeight: 700 }}
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="icon-btn"
                style={{
                  width: "auto",
                  padding: "6px 16px",
                  fontWeight: 700,
                  background: "var(--destructive)",
                  color: "#fff",
                  border: "2px solid var(--destructive)",
                }}
                onClick={handleConfirmDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen viewer */}
      {fullscreenDoc && (
        <FullscreenViewer
          doc={fullscreenDoc}
          onClose={() => setFullscreenId(null)}
          onNav={navFullscreen}
          hasPrev={fullscreenIdx > 0}
          hasNext={fullscreenIdx < documents.length - 1}
          onDelete={onDelete ? (id) => setConfirmDeleteId(id) : undefined}
        />
      )}
    </motion.div>
  );
}
