"use client";

import * as React from "react";
import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Plus,
  Trash2,
  SortAsc,
  Flag,
  Tag,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
// DateInput available for due date editing
// import { DateInput } from "@/components/forms/DateInput";
import { cn } from "@/lib/utils";
import type {
  NoteEntry,
  NotePriority,
  NoteCategory,
} from "@/lib/forms/case-form-schema";
import {
  NOTE_PRIORITIES,
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
} from "@/lib/forms/case-form-schema";

// ============================================================================
// TYPES
// ============================================================================

export interface NotesJournalProps {
  /**
   * Array of note entries
   */
  notes: NoteEntry[];

  /**
   * Callback when notes array changes
   */
  onChange: (notes: NoteEntry[]) => void;

  /**
   * Optional className for container
   */
  className?: string;
}

type SortOption = "newest" | "oldest" | "priority";
type FilterOption = "all" | "highPriority" | "pending" | "done";

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIORITY_CONFIG: Record<
  NotePriority,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  high: {
    label: "High",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    borderColor: "border-red-400 dark:border-red-700",
  },
  medium: {
    label: "Medium",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    borderColor: "border-amber-400 dark:border-amber-700",
  },
  low: {
    label: "Low",
    color: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    borderColor: "border-gray-400 dark:border-gray-600",
  },
};

const CATEGORY_CONFIG: Record<
  NoteCategory,
  { label: string; color: string; bgColor: string }
> = {
  "follow-up": {
    label: "Follow-up",
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
  },
  document: {
    label: "Document",
    color: "text-purple-700 dark:text-purple-400",
    bgColor: "bg-purple-100 dark:bg-purple-900/30",
  },
  client: {
    label: "Client",
    color: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
  },
  internal: {
    label: "Internal",
    color: "text-gray-700 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
  },
  deadline: {
    label: "Deadline",
    color: "text-red-700 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
  },
  other: {
    label: "Other",
    color: "text-slate-700 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generate a unique ID for a new note
 */
function generateNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Format timestamp for display - full date + relative badge
 */
function formatTimestamp(timestamp: number): { full: string; relative: string } {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - timestamp;

  // Full format: "Dec 26, 2025 at 2:30 PM"
  const full = format(date, "MMM d, yyyy 'at' h:mm a");

  // Relative format
  let relative: string;
  if (diff < 60000) {
    relative = "Just now";
  } else if (diff < 3600000) {
    const mins = Math.floor(diff / 60000);
    relative = `${mins}m ago`;
  } else if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    relative = `${hours}h ago`;
  } else if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    relative = `${days}d ago`;
  } else {
    relative = format(date, "MMM d");
  }

  return { full, relative };
}

/**
 * Sort notes based on option
 */
function sortNotes(notes: NoteEntry[], sortBy: SortOption): NoteEntry[] {
  const sorted = [...notes];

  switch (sortBy) {
    case "newest":
      return sorted.sort((a, b) => b.createdAt - a.createdAt);
    case "oldest":
      return sorted.sort((a, b) => a.createdAt - b.createdAt);
    case "priority": {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return sorted.sort(
        (a, b) =>
          priorityOrder[a.priority || "medium"] - priorityOrder[b.priority || "medium"]
      );
    }
    default:
      return sorted;
  }
}

/**
 * Filter notes based on option
 */
function filterNotes(notes: NoteEntry[], filterBy: FilterOption): NoteEntry[] {
  switch (filterBy) {
    case "all":
      return notes;
    case "highPriority":
      return notes.filter((note) => note.priority === "high");
    case "pending":
      return notes.filter((note) => note.status === "pending");
    case "done":
      return notes.filter((note) => note.status === "done");
    default:
      return notes;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * NotesJournal Component
 *
 * A full-featured journal-style notes component for case forms.
 *
 * Features:
 * - Add new note with Cmd+Enter shortcut
 * - Priority selector (High/Medium/Low with color badges)
 * - Category dropdown (Follow-up, Document, Client, Internal, Deadline, Other)
 * - Optional due date with overdue indicator
 * - Full timestamp display + relative badge
 * - Checkbox to mark done (strikethrough + dimmed)
 * - Delete button per entry
 * - Filter by: All, Overdue, High Priority, Pending, Done
 * - Sort by: Newest, Oldest, Priority, Due Date
 * - Neobrutalist design with hard shadows and animations
 *
 * @example
 * ```tsx
 * <NotesJournal
 *   notes={formData.notes}
 *   onChange={(notes) => setFormData({ ...formData, notes })}
 * />
 * ```
 */
export function NotesJournal({
  notes,
  onChange,
  className,
}: NotesJournalProps) {
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNotePriority, setNewNotePriority] = useState<NotePriority>("medium");
  const [newNoteCategory, setNewNoteCategory] = useState<NoteCategory>("other");
  const [showNewNoteOptions, setShowNewNoteOptions] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  // Filter toggle available for future UI expansion
  const [_showFilters, _setShowFilters] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Detect OS for keyboard shortcut display
  const isMac = typeof window !== 'undefined' && navigator.platform.toLowerCase().includes('mac');
  const shortcutKey = isMac ? 'Cmd' : 'Ctrl';

  // Filter out deleted notes, then apply user filters and sorting
  const processedNotes = useMemo(() => {
    let result = notes.filter((note) => note.status !== "deleted");
    result = filterNotes(result, filterBy);
    result = sortNotes(result, sortBy);
    return result;
  }, [notes, filterBy, sortBy]);

  // Count high priority, pending, and done for badges
  const counts = useMemo(() => {
    const activeNotes = notes.filter((n) => n.status !== "deleted");

    return {
      total: activeNotes.length,
      highPriority: activeNotes.filter((n) => n.priority === "high").length,
      pending: activeNotes.filter((n) => n.status === "pending").length,
      done: activeNotes.filter((n) => n.status === "done").length,
    };
  }, [notes]);

  /**
   * Add a new note (auto-timestamped)
   */
  const handleAddNote = useCallback(() => {
    const content = newNoteContent.trim();
    if (!content) return;

    const newNote: NoteEntry = {
      id: generateNoteId(),
      content,
      createdAt: Date.now(),
      status: "pending",
      priority: newNotePriority,
      category: newNoteCategory,
    };

    onChange([...notes, newNote]);
    setNewNoteContent("");
    setShowNewNoteOptions(false);

    // Keep focus on textarea for quick entry
    textareaRef.current?.focus();
  }, [newNoteContent, newNotePriority, newNoteCategory, notes, onChange]);

  /**
   * Toggle note done status
   */
  const handleToggleDone = useCallback(
    (noteId: string) => {
      onChange(
        notes.map((note) =>
          note.id === noteId
            ? {
                ...note,
                status: note.status === "done" ? "pending" : "done",
              }
            : note
        )
      );
    },
    [notes, onChange]
  );

  /**
   * Delete a note (soft delete - set status to 'deleted')
   */
  const handleDelete = useCallback(
    (noteId: string) => {
      onChange(
        notes.map((note) =>
          note.id === noteId ? { ...note, status: "deleted" as const } : note
        )
      );
    },
    [notes, onChange]
  );

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter or Ctrl+Enter to add note
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleAddNote();
      }
    },
    [handleAddNote]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* ========== ADD NEW NOTE INPUT ========== */}
      <div className="space-y-3">
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={newNoteContent}
            onChange={(e) => {
              setNewNoteContent(e.target.value);
              if (e.target.value && !showNewNoteOptions) {
                setShowNewNoteOptions(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={`Add a note... (${shortcutKey}+Enter to save)`}
            rows={3}
            className="border-2 border-border shadow-[3px_3px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.05)]"
          />
        </div>

        {/* Add Note button - visible with text */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={handleAddNote}
            disabled={!newNoteContent.trim()}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Note
          </Button>
          <span className="text-xs text-muted-foreground">
            {shortcutKey}+Enter
          </span>
        </div>

        {/* New note options (priority, category) */}
        <AnimatePresence>
          {showNewNoteOptions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap items-center gap-3 overflow-hidden"
            >
              {/* Priority selector */}
              <div className="flex items-center gap-1.5">
                <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={newNotePriority}
                  onChange={(e) => setNewNotePriority(e.target.value as NotePriority)}
                  className="h-7 rounded border-2 border-border bg-background px-2 text-xs font-medium"
                >
                  {NOTE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_CONFIG[p].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category selector */}
              <div className="flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value as NoteCategory)}
                  className="h-7 rounded border-2 border-border bg-background px-2 text-xs font-medium"
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {NOTE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========== FILTER & SORT CONTROLS ========== */}
      {notes.filter((n) => n.status !== "deleted").length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          {/* Quick filter buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFilterBy("all")}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium transition-colors border-2",
                filterBy === "all"
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background text-muted-foreground border-border hover:border-muted-foreground"
              )}
            >
              All ({counts.total})
            </button>
            {counts.highPriority > 0 && (
              <button
                type="button"
                onClick={() => setFilterBy("highPriority")}
                className={cn(
                  "px-2 py-1 rounded text-xs font-medium transition-colors border-2",
                  filterBy === "highPriority"
                    ? "bg-amber-600 text-white border-amber-600"
                    : "bg-amber-50 text-amber-700 border-amber-300 hover:border-amber-500 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
                )}
              >
                High Priority ({counts.highPriority})
              </button>
            )}
            <button
              type="button"
              onClick={() => setFilterBy("pending")}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium transition-colors border-2",
                filterBy === "pending"
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-background text-muted-foreground border-border hover:border-muted-foreground"
              )}
            >
              Pending ({counts.pending})
            </button>
            <button
              type="button"
              onClick={() => setFilterBy("done")}
              className={cn(
                "px-2 py-1 rounded text-xs font-medium transition-colors border-2",
                filterBy === "done"
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-background text-muted-foreground border-border hover:border-muted-foreground"
              )}
            >
              Done ({counts.done})
            </button>
          </div>

          {/* Sort dropdown */}
          <div className="flex items-center gap-1.5">
            <SortAsc className="h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-7 rounded border-2 border-border bg-background px-2 text-xs font-medium"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority">By priority</option>
            </select>
          </div>
        </div>
      )}

      {/* ========== NOTES LIST ========== */}
      {processedNotes.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {processedNotes.map((note) => {
              const timestamp = formatTimestamp(note.createdAt);
              const priorityConfig = PRIORITY_CONFIG[note.priority || "medium"];
              const categoryConfig = CATEGORY_CONFIG[note.category || "other"];

              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "group rounded-lg border-2 p-3 transition-all duration-150",
                    "shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.05)]",
                    "hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.15)] hover:-translate-y-0.5",
                    note.status === "done"
                      ? "bg-muted/50 opacity-60 border-muted"
                      : "bg-background border-border hover:border-muted-foreground/50",
                    // High priority static highlight (no animation)
                    note.priority === "high" &&
                      note.status !== "done" &&
                      "ring-2 ring-red-400/50"
                  )}
                >
                  <div className="flex items-start gap-3">
                    {/* Done checkbox */}
                    <Checkbox
                      checked={note.status === "done"}
                      onCheckedChange={() => handleToggleDone(note.id)}
                      className="mt-0.5 shrink-0"
                      aria-label={
                        note.status === "done" ? "Mark as pending" : "Mark as done"
                      }
                    />

                    {/* Note content area */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Badges row */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Priority badge */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
                            priorityConfig.bgColor,
                            priorityConfig.color
                          )}
                        >
                          <Flag className="h-2.5 w-2.5" />
                          {priorityConfig.label}
                        </span>

                        {/* Category badge */}
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                            categoryConfig.bgColor,
                            categoryConfig.color
                          )}
                        >
                          {categoryConfig.label}
                        </span>
                      </div>

                      {/* Note content */}
                      <p
                        className={cn(
                          "text-sm whitespace-pre-wrap break-words",
                          note.status === "done" &&
                            "line-through text-muted-foreground"
                        )}
                      >
                        {note.content}
                      </p>

                      {/* Timestamp row */}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span title={timestamp.full}>{timestamp.full}</span>
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">
                          {timestamp.relative}
                        </span>
                      </div>
                    </div>

                    {/* Delete button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(note.id)}
                      className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      aria-label="Delete note"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ========== EMPTY STATE ========== */}
      {processedNotes.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {filterBy !== "all" ? (
            <div className="space-y-2">
              <p className="text-sm">No notes match this filter</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFilterBy("all")}
              >
                Show all notes
              </Button>
            </div>
          ) : (
            <p className="text-sm">No notes yet</p>
          )}
        </div>
      )}
    </div>
  );
}
