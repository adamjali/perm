"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowsOutIcon, CaretLeftIcon, CaretRightIcon, CircleNotchIcon, DownloadIcon, FileTextIcon, FileXlsIcon, FolderOpenIcon, ImageIcon as ImageIcon, TrashIcon as Trash2, UploadIcon, XIcon } from "@phosphor-icons/react";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/documents";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtTimestamp } from "./case-detail-utils";
import type { CaseDetailData } from "./case-detail-types";

type DocumentEntry = NonNullable<CaseDetailData["documents"]>[number];

interface DocumentsTabProps {
  documents: DocumentEntry[];
  /** Uploads one file; resolves to null when it's saved, or the reason it wasn't. */
  onUpload?: (file: File, category?: DocumentCategory) => Promise<string | null>;
  onDelete?: (documentId: string) => Promise<void>;
}

const ITEMS_PER_PAGE = 10;

/** A select at the controls' height (44px), the input's own outline. */
const SELECT = "h-11 border border-input bg-card px-2 text-sm font-semibold text-foreground disabled:opacity-60";

/** A file chosen and waiting to go up, with its category and, after a failed try, why. */
interface PendingFile {
  key: string;
  file: File;
  category: DocumentCategory;
  error?: string;
}

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
    return <FileXlsIcon className="h-5 w-5" />;
  return <FileTextIcon className="h-5 w-5" />;
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
            border: "1px solid var(--border)",
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
            <ArrowsOutIcon className="h-3.5 w-3.5" />
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
          border: "1px solid var(--border)",
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
            <ArrowsOutIcon className="h-3.5 w-3.5" />
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
        border: "1px solid var(--border)",
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
            fontSize: "0.875rem",
            marginTop: 8,
          }}
        >
          {typeLabel} &middot; {formatFileSize(doc.size)}
        </div>
        <div
          style={{
            fontSize: "0.875rem",
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
            <CaretLeftIcon className="h-3.5 w-3.5" />
          </button>
          <button
            className="icon-btn"
            onClick={() => onNav(1)}
            disabled={!hasNext}
            title="Next"
          >
            <CaretRightIcon className="h-3.5 w-3.5" />
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
            <DownloadIcon className="h-3.5 w-3.5" /> Download
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
            <XIcon className="h-3.5 w-3.5" />
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
          <div style={{ textAlign: "center", color: "var(--muted-foreground)", padding: 40 }}>
            {getFileIcon(doc.mimeType)}
            <div style={{ marginTop: 12, fontSize: "0.875rem" }}>Preview not available. Download to view.</div>
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
  const [pending, setPending] = useState<PendingFile[]>([]);
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

  // Chosen or dropped files wait in a list (each with a category) until
  // "Upload" sends them, one at a time. A file that fails stays, with the
  // reason beside it, so it can be sent again without picking it again.
  const handleFileStage = useCallback(
    (files: FileList | File[] | null | undefined) => {
      if (!onUpload || !files) return;
      const added = Array.from(files).map((file, i) => ({
        key: `${Date.now()}-${i}-${file.name}`,
        file,
        category: "general" as DocumentCategory,
      }));
      if (added.length) setPending((now) => [...now, ...added]);
    },
    [onUpload]
  );

  const handleConfirmUpload = useCallback(async () => {
    if (!onUpload || pending.length === 0 || isUploading) return;
    setIsUploading(true);
    try {
      for (const item of pending) {
        const reason = await onUpload(item.file, item.category);
        setPending((now) =>
          reason === null ? now.filter((p) => p.key !== item.key) : now.map((p) => (p.key === item.key ? { ...p, error: reason } : p)),
        );
      }
    } finally {
      setIsUploading(false);
    }
  }, [onUpload, pending, isUploading]);

  const removePending = useCallback((key: string) => {
    setPending((now) => now.filter((p) => p.key !== key));
  }, []);

  const setPendingCategoryFor = useCallback((key: string, category: DocumentCategory) => {
    setPending((now) => now.map((p) => (p.key === key ? { ...p, category } : p)));
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileStage(e.target.files);
      e.target.value = "";
    },
    [handleFileStage]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFileStage(e.dataTransfer.files);
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
      setConfirmDeleteId(null);
      if (selectedId === confirmDeleteId) setSelectedId(null);
      if (fullscreenId === confirmDeleteId) setFullscreenId(null);
    } catch {
      // Parent handler (handleDeleteDocument) already calls handleOperationError
      setConfirmDeleteId(null);
    }
  }, [onDelete, confirmDeleteId, selectedId, fullscreenId]);

  const fullscreenIdx = fullscreenDoc ? documents.findIndex((d) => d.id === fullscreenDoc.id) : -1;

  return (
    <div className="space-y-6">
      <div>
        <div className="detail-card" style={{ overflow: "hidden" }}>
          <div className="detail-card-head" style={{ gap: 8 }}>
            <h2 className="flex items-center gap-1.5">
              <FolderOpenIcon className="h-3.5 w-3.5" />
              Documents
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="documents-filter">Show</label>
              <select
                id="documents-filter"
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value as DocumentCategory | "all"); setPage(0); }}
                className={SELECT}
              >
                <option value="all">All ({documents.length})</option>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>
                ))}
              </select>{" "}
              {onUpload && (
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  <UploadIcon className="size-4" aria-hidden="true" />
                  Add files
                </Button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ACCEPT_STRING}
                onChange={handleInputChange}
                className="hidden"
              />
            </div>
          </div>

          {/* Files waiting to go up: outside the split view, so a phone sees them with the preview open. */}
          {pending.length > 0 && (
            <div className="space-y-2 border-b-2 border-border bg-muted p-3">
              <ul className="space-y-2">
                {pending.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-center gap-2">
                    <FileTextIcon className="size-4 shrink-0" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold" title={p.file.name}>
                      {p.file.name}
                    </span>{" "}
                    <label className="sr-only" htmlFor={`cat-${p.key}`}>Category for {p.file.name}</label>
                    <select
                      id={`cat-${p.key}`}
                      value={p.category}
                      onChange={(e) => setPendingCategoryFor(p.key, e.target.value as DocumentCategory)}
                      className={SELECT}
                      disabled={isUploading}
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {DOCUMENT_CATEGORY_LABELS[c]}
                        </option>
                      ))}
                    </select>{" "}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePending(p.key)}
                      disabled={isUploading}
                      aria-label={`Remove ${p.file.name}`}
                    >
                      <XIcon className="size-4" aria-hidden="true" />
                    </Button>
                    {p.error ? (
                      <p role="alert" className="basis-full text-sm font-semibold text-destructive">
                        {p.error}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>{" "}
              <Button type="button" onClick={handleConfirmUpload} disabled={isUploading}>
                {isUploading ? <CircleNotchIcon className="size-4 animate-spin" aria-hidden="true" /> : <UploadIcon className="size-4" aria-hidden="true" />}
                {isUploading ? "Uploading" : pending.length === 1 ? "Upload 1 file" : `Upload ${pending.length} files`}
              </Button>
            </div>
          )}

          <div className={`split-wrap${isOpen ? " preview-open" : ""}`}>
            <div className="split-list">
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
                            <DownloadIcon className="h-3.5 w-3.5" />
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
                  <FolderOpenIcon className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
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
                    <CaretLeftIcon className="h-3 w-3" />
                  </button>
                  <span>{page + 1} / {totalPages}</span>
                  <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
                    <CaretRightIcon className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Drag & drop area: more files can be added while some wait. */}
              {onUpload && (
                <div className="p-4">
                  <button
                    type="button"
                    className={`flex min-h-12 w-full items-center justify-center gap-2 border-2 border-dashed px-4 py-3 font-heading text-sm font-bold transition-colors ${
                      isDragOver ? "border-primary-text bg-primary/10 text-foreground" : "border-input text-soft hover:border-foreground hover:text-foreground"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    disabled={isUploading}
                  >
                    <UploadIcon className="size-4" aria-hidden="true" />
                    {isDragOver ? "Drop to add them" : "Drag files here, or click to choose"}
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
                        <CaretLeftIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        className="icon-btn"
                        onClick={() => navDoc(1)}
                        disabled={documents.findIndex((d) => d.id === selectedId) >= documents.length - 1}
                        title="Next"
                      >
                        <CaretRightIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      className="icon-btn"
                      onClick={closePreview}
                      title="Close"
                    >
                      <XIcon className="h-3.5 w-3.5" />
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
                    <span>Uploaded: {fmtTimestamp(selectedDoc.uploadedAt)}</span>{" "}
                    <span>{getFileTypeLabel(selectedDoc.mimeType)}</span>{" "}
                    <span>{formatFileSize(selectedDoc.size)}</span>
                    {selectedDoc.category && (
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: "0.875rem",
                          padding: "2px 6px",
                          border: "1px solid var(--border)",
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
                        <ArrowsOutIcon className="h-3.5 w-3.5" /> Full screen
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
                      <DownloadIcon className="h-3.5 w-3.5" /> Download
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
      </div>

      {/* Delete confirmation: a real dialog (focus kept inside, Escape closes). */}
      <AlertDialog open={confirmDeleteId !== null} onOpenChange={(open) => (open ? null : setConfirmDeleteId(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this document?</AlertDialogTitle>
            <AlertDialogDescription>It&apos;s deleted for good; it can&apos;t be brought back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </div>
  );
}
