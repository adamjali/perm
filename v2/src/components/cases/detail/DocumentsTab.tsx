"use client";

import { motion } from "motion/react";
import { FolderOpen, Upload, FileText } from "lucide-react";
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

function getFileIcon(_mimeType: string) {
  return FileText;
}

export function DocumentsTab({ documents }: DocumentsTabProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div
        variants={{
          hidden: { opacity: 0, y: 12 },
          visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
        }}
      >
        <div className="detail-card" style={{ overflow: "hidden" }}>
          <div className="detail-card-head ch-accent">
            <span className="flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5" />
              Documents
            </span>
            <Phase2UploadButton />
          </div>
          <div className="split-wrap">
            <div className="split-list">
              {documents.length > 0 ? (
                <div className="scroll-list">
                  {documents.map((doc) => {
                    const Icon = getFileIcon(doc.mimeType);
                    return (
                      <div key={doc.id} className="doc-row">
                        <div className="doc-icon">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="doc-info">
                          <div className="font-heading font-bold text-sm truncate">{doc.name}</div>
                          <div className="font-mono text-[0.68rem] text-muted-foreground">
                            {formatFileSize(doc.size)} &middot;{" "}
                            {new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </div>
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
              <div style={{ padding: "16px" }}>
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
            <div className="split-preview" />
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
