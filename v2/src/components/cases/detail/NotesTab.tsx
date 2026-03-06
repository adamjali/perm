"use client";

import { motion } from "motion/react";
import { StickyNote, Clock, CheckCircle2, Trash2 } from "lucide-react";
import { Phase2NoteInput } from "./phase2-placeholders";
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
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="w-16 h-16 border-2 border-border bg-muted flex items-center justify-center">
          <StickyNote className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="font-heading font-semibold text-lg">No Notes</p>
          <p className="text-sm text-muted-foreground">
            Case notes will appear here. Add notes from the Edit Case page.
          </p>
        </div>
        <Phase2NoteInput />
      </div>
    );
  }

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
      variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
      className="space-y-3"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold text-base">
          {notes.length} Note{notes.length !== 1 ? "s" : ""}
        </h3>
        <Phase2NoteInput />
      </div>

      {sortedNotes.map((note) => {
        const StatusIcon = STATUS_ICONS[note.status] || Clock;
        const priorityStyle = note.priority
          ? PRIORITY_STYLES[note.priority] || ""
          : "";

        return (
          <motion.div
            key={note.id}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0 },
            }}
            className="border-2 border-border bg-card shadow-hard-sm p-4 space-y-2"
          >
            {/* Header: status + priority + category + date */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {note.status}
              </span>
              {note.priority && (
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wider border ${priorityStyle}`}
                >
                  {note.priority}
                </span>
              )}
              {note.category && (
                <span className="inline-flex items-center px-2 py-0.5 text-[0.625rem] font-mono uppercase tracking-wider border border-border bg-muted text-muted-foreground">
                  {NOTE_CATEGORY_LABELS[note.category as NoteCategory] ||
                    note.category}
                </span>
              )}
              <span className="ml-auto text-xs text-muted-foreground font-mono">
                {new Date(note.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>

            {/* Content */}
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {note.content}
            </p>

            {/* Due date */}
            {note.dueDate && (
              <p className="text-xs text-muted-foreground font-mono">
                Due: {note.dueDate}
              </p>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
