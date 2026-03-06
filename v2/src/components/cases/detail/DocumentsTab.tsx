"use client";

import { motion } from "motion/react";
import { FileText, Download, FolderOpen } from "lucide-react";
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

export function DocumentsTab({ documents }: DocumentsTabProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-16 h-16 border-2 border-border bg-muted flex items-center justify-center">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-heading font-semibold text-lg">No Documents</p>
          <p className="text-sm text-muted-foreground">
            Documents for this case will appear here.
          </p>
        </div>
        <Phase2UploadButton />
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-base">
          {documents.length} Document{documents.length !== 1 ? "s" : ""}
        </h3>
        <Phase2UploadButton />
      </div>

      {documents.map((doc) => (
        <motion.div
          key={doc.id}
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0 },
          }}
          className="flex items-center gap-3 p-3 border-2 border-border bg-card shadow-hard-sm hover:shadow-hard hover:-translate-y-0.5 transition-all duration-150"
        >
          <div className="w-10 h-10 border-2 border-border bg-muted flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-heading font-medium text-sm truncate">
              {doc.name}
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              {formatFileSize(doc.size)} &middot;{" "}
              {new Date(doc.uploadedAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 w-9 h-9 border-2 border-border bg-muted flex items-center justify-center hover:bg-primary hover:text-primary-foreground transition-colors"
            aria-label={`Download ${doc.name}`}
          >
            <Download className="h-4 w-4" />
          </a>
        </motion.div>
      ))}
    </motion.div>
  );
}
