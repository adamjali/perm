"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { FolderOpen, Upload, Download, Trash2, FileText, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Phase2UploadButton } from "./phase2-placeholders";

interface DocumentEntry {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
}

interface DocumentsTabProps {
  documents: DocumentEntry[];
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
  if (mimeType.includes("word") || mimeType.includes("docx")) return "DOCX";
  if (mimeType.includes("excel") || mimeType.includes("xlsx") || mimeType.includes("spreadsheet")) return "XLSX";
  if (mimeType.includes("csv")) return "CSV";
  if (mimeType.includes("text")) return "TXT";
  return "FILE";
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

export function DocumentsTab({ documents }: DocumentsTabProps) {
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const isOpen = selectedIdx >= 0 && selectedIdx < documents.length;
  const selectedDoc = isOpen ? documents[selectedIdx] : null;

  function selectDoc(idx: number) {
    setSelectedIdx(idx);
  }

  function navDoc(dir: number) {
    const next = selectedIdx + dir;
    if (next >= 0 && next < documents.length) setSelectedIdx(next);
  }

  function closePreview() {
    setSelectedIdx(-1);
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <div className="detail-card no-hover" style={{ overflow: "hidden" }}>
          <div className="detail-card-head ch-accent">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Documents
            </span>
            <Phase2UploadButton />
          </div>
          <div className={`split-wrap${isOpen ? " preview-open" : ""}`}>
            <div className="split-list">
              {documents.length > 0 ? (
                <div className="scroll-list">
                  {documents.map((doc, i) => {
                    const typeLabel = getFileTypeLabel(doc.mimeType);
                    return (
                      <div
                        key={doc.id}
                        className={`doc-row${i === selectedIdx ? " selected" : ""}`}
                        onClick={() => selectDoc(i)}
                      >
                        <div className="doc-icon">{typeLabel}</div>
                        <div className="doc-info">
                          <div className="doc-name">{doc.name}</div>
                          <div className="doc-meta">
                            {typeLabel} &middot; {formatFileSize(doc.size)} &middot; {fmtDate(doc.uploadedAt)}
                          </div>
                        </div>
                        <div
                          className="flex-row doc-actions"
                          style={{ gap: 4, flexShrink: 0 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="icon-btn" title="Download" disabled>
                            <Download className="h-3.5 w-3.5" />
                          </button>
                          <button className="icon-btn" title="Delete" disabled style={{ color: "var(--destructive)" }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="detail-empty-state" style={{ padding: "32px 20px" }}>
                  <FolderOpen className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <div className="detail-empty-state-title">No documents</div>
                  <div className="detail-empty-state-desc">Documents for this case will appear here.</div>
                </div>
              )}
              {/* Drag & drop area */}
              <div style={{ padding: 16 }}>
                <button
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 font-heading font-bold text-sm text-muted-foreground"
                  style={{
                    border: "3px dashed var(--border)",
                    borderColor: "var(--muted-foreground)",
                    background: "transparent",
                    boxShadow: "none",
                    cursor: "default",
                    opacity: 0.6,
                  }}
                  disabled
                >
                  <Upload className="h-4 w-4" />
                  Drag files here or click to upload
                </button>
              </div>
            </div>
            <div className="split-preview">
              {selectedDoc && (() => {
                const typeLabel = getFileTypeLabel(selectedDoc.mimeType);
                return (
                  <div className="split-preview-inner">
                    {/* Nav */}
                    <div className="preview-nav">
                      <div className="preview-nav-btns">
                        <button
                          className="icon-btn"
                          onClick={() => navDoc(-1)}
                          disabled={selectedIdx <= 0}
                          title="Previous"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => navDoc(1)}
                          disabled={selectedIdx >= documents.length - 1}
                          title="Next"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button className="icon-btn" onClick={closePreview} title="Close">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* File type placeholder */}
                    <div
                      style={{
                        border: "3px solid var(--border)",
                        background: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 160,
                        marginBottom: 20,
                      }}
                    >
                      <div style={{ textAlign: "center", color: "var(--muted-foreground)" }}>
                        <FileText className="h-12 w-12 mx-auto" style={{ opacity: 0.3 }} />
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", marginTop: 8 }}>
                          {typeLabel} &middot; {formatFileSize(selectedDoc.size)}
                        </div>
                      </div>
                    </div>

                    {/* Title */}
                    <div className="preview-title">{selectedDoc.name}</div>

                    {/* Meta */}
                    <div className="preview-meta">
                      <span>Uploaded: {fmtDate(selectedDoc.uploadedAt)}</span>
                      <span>{typeLabel}</span>
                      <span>{formatFileSize(selectedDoc.size)}</span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                      <button className="icon-btn" style={{ width: "auto", padding: "4px 12px", gap: 6, display: "flex", alignItems: "center" }} disabled>
                        <Download className="h-3.5 w-3.5" /> Download
                      </button>
                      <button className="icon-btn" style={{ width: "auto", padding: "4px 12px", gap: 6, display: "flex", alignItems: "center", color: "var(--destructive)" }} disabled>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
