"use client";

import { motion } from "motion/react";
import { MessageCircle, Send, Clock, CheckCircle2, Trash2 } from "lucide-react";
import {
  NOTE_CATEGORY_LABELS,
  type NoteEntry,
  type NoteCategory,
} from "@/lib/forms/case-form-schema";

interface NotesTabProps {
  notes: NoteEntry[];
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  medium: "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700",
  low: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700",
};

const STATUS_ICONS = {
  pending: Clock,
  done: CheckCircle2,
  deleted: Trash2,
} as const;

export function NotesTab({ notes }: NotesTabProps) {
  // Sort notes: pending first, then done, then deleted; within each group, newest first
  const statusOrder = { pending: 0, done: 1, deleted: 2 } as const;
  const sortedNotes = [...notes].sort((a, b) => {
    const aOrder = statusOrder[a.status] ?? 2;
    const bOrder = statusOrder[b.status] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

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
          <div className="detail-card-head ch-yellow" style={{ gap: "8px" }}>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Case Notes
            </span>
            <span
              className="font-mono text-[0.6rem] px-2 py-0.5"
              style={{
                background: "var(--card)",
                border: "2px solid var(--border)",
              }}
            >
              {notes.length}
            </span>
          </div>
          <div className="split-wrap">
            <div className="split-list">
              {notes.length > 0 ? (
                <div className="scroll-list">
                  {sortedNotes.map((note) => {
                    const StatusIcon = STATUS_ICONS[note.status] || Clock;
                    const priorityStyle = note.priority
                      ? PRIORITY_STYLES[note.priority] || ""
                      : "";

                    return (
                      <div key={note.id} className="note-entry">
                        <div className="flex items-start gap-2 mb-1">
                          <StatusIcon className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                              <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                                {note.status}
                              </span>
                              {note.priority && (
                                <span
                                  className={`inline-flex items-center px-1.5 py-0 text-[0.58rem] font-bold uppercase tracking-wider border ${priorityStyle}`}
                                >
                                  {note.priority}
                                </span>
                              )}
                              {note.category && (
                                <span className="inline-flex items-center px-1.5 py-0 text-[0.58rem] font-mono uppercase tracking-wider border border-border bg-muted text-muted-foreground">
                                  {NOTE_CATEGORY_LABELS[note.category as NoteCategory] ||
                                    note.category}
                                </span>
                              )}
                              <span className="ml-auto text-[0.65rem] text-muted-foreground font-mono">
                                {new Date(note.createdAt).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            </div>
                            <p className="text-[0.82rem] leading-relaxed whitespace-pre-wrap">
                              {note.content}
                            </p>
                            {note.dueDate && (
                              <p className="text-[0.68rem] text-muted-foreground font-mono mt-1">
                                Due: {note.dueDate}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="detail-empty-state" style={{ padding: "32px 20px" }}>
                  <MessageCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <div className="detail-empty-state-title">No notes</div>
                  <div className="detail-empty-state-desc">Case notes will appear here. Add notes from the Edit Case page.</div>
                </div>
              )}
            </div>
            <div className="split-preview" />
          </div>
          {/* Note input area (Phase 2 — disabled) */}
          <div className="note-input-area">
            <input
              type="text"
              className="note-input"
              placeholder="Add a case note..."
              disabled
              style={{ opacity: 0.5, cursor: "default" }}
            />
            <button
              className="flex items-center justify-center border-2 border-border bg-primary text-primary-foreground"
              style={{ width: "44px", height: "44px", cursor: "default", opacity: 0.5 }}
              disabled
              aria-label="Send"
            >
              <Send className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
