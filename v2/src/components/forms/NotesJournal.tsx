"use client";

import * as React from "react";
import { useState, useCallback, useRef, useMemo } from "react";
import { PlusIcon, TrashIcon as Trash2 } from "@phosphor-icons/react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
// DateInput available for due date editing
// import { DateInput } from "@/components/forms/DateInput";
import { cn } from "@/lib/utils";
import { ToneBadge } from "@/components/ui/badge";
import { choiceVariants } from "@/components/ui/choice";
import type {
  NoteEntry,
  NotePriority,
  NoteCategory,
} from "@/lib/forms/case-form-schema";
import {
  NOTE_PRIORITIES,
  NOTE_CATEGORIES,
  NOTE_CATEGORY_LABELS,
  generateNoteId,
} from "@/lib/forms/case-form-schema";
import { CharLimit } from "@/components/ui/char-limit";
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from "@/lib/time";
import { NOTES_PER_CASE_MAX, liveNotes, notesLimitMessage } from "./notesLimit";

/** How many notes the journal lists before a show-more. */
const NOTES_SHOWN_STEP = 20;

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

/** A note's priority: its word, and the tone of its chip. */
const PRIORITY_CONFIG: Record<NotePriority, { label: string; tone: "bad" | "warn" | "flat" }> = {
  high: { label: "High", tone: "bad" },
  medium: { label: "Medium", tone: "warn" },
  low: { label: "Low", tone: "flat" },
};

/** The journal's quick filters, each with the count it shows. */
const NOTE_FILTERS: ReadonlyArray<{ id: FilterOption; label: string; count: "total" | "highPriority" | "pending" | "done" }> = [
  { id: "all", label: "All", count: "total" },
  { id: "highPriority", label: "High priority", count: "highPriority" },
  { id: "pending", label: "Pending", count: "pending" },
  { id: "done", label: "Done", count: "done" },
];

/** The note controls' small native selects, at the 44px floor. */
const NOTE_SELECT = "h-11 border border-input bg-card px-3 text-sm";

// ============================================================================
// HELPERS
// ============================================================================

// generateNoteId imported from @/lib/forms/case-form-schema

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
  if (diff < MS_PER_MINUTE) {
    relative = "Just now";
  } else if (diff < MS_PER_HOUR) {
    const mins = Math.floor(diff / MS_PER_MINUTE);
    relative = `${mins}m ago`;
  } else if (diff < MS_PER_DAY) {
    const hours = Math.floor(diff / MS_PER_HOUR);
    relative = `${hours}h ago`;
  } else if (diff < 604800000) {
    const days = Math.floor(diff / MS_PER_DAY);
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
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  // Filter toggle available for future UI expansion
  const [_showFilters, _setShowFilters] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  // A case can hold 200 notes; the list shows NOTES_SHOWN_STEP at a time and
  // says how many there are. A new filter or sort starts again from the top.
  const listKey = `${filterBy}|${sortBy}`;
  const [shown, setShown] = useState<{ key: string; n: number }>({ key: listKey, n: NOTES_SHOWN_STEP });
  const shownCount = Math.min(shown.key === listKey ? shown.n : NOTES_SHOWN_STEP, processedNotes.length);

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
    const live = liveNotes(notes);
    if (!content || live.length >= NOTES_PER_CASE_MAX) return;

    const newNote: NoteEntry = {
      id: generateNoteId(),
      content,
      createdAt: Date.now(),
      status: "pending",
      priority: newNotePriority,
      category: newNoteCategory,
    };

    onChange([...live, newNote]);
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

  /** Delete a note: it leaves the list (see liveNotes). */
  const handleDelete = useCallback(
    (noteId: string) => {
      onChange(liveNotes(notes).filter((note) => note.id !== noteId));
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

  /**
   * Start editing a note inline
   */
  const handleStartEdit = useCallback((note: NoteEntry) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
    // Focus the textarea after render
    setTimeout(() => editTextareaRef.current?.focus(), 0);
  }, []);

  /**
   * Save edited note content
   */
  const handleSaveEdit = useCallback(() => {
    if (!editingNoteId) return;
    const trimmed = editingContent.trim();
    if (!trimmed) return; // Don’t save empty notes
    onChange(
      notes.map((note) =>
        note.id === editingNoteId ? { ...note, content: trimmed } : note
      )
    );
    setEditingNoteId(null);
    setEditingContent("");
  }, [editingNoteId, editingContent, notes, onChange]);

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditingContent("");
  }, []);

  /**
   * Handle keyboard shortcuts in edit textarea
   */
  const handleEditKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleSaveEdit();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        handleCancelEdit();
      }
    },
    [handleSaveEdit, handleCancelEdit]
  );

  return (
    <div className={cn("space-y-4", className)}>
      {/* ========== ADD NEW NOTE INPUT ========== */}
      <div className="space-y-3">
        <div className="relative">
          <CharLimit max={5000}>
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
              className="border border-border"
            />
          </CharLimit>
        </div>

        {/* Add Note button - visible with text */}
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleAddNote}
            disabled={!newNoteContent.trim() || liveNotes(notes).length >= NOTES_PER_CASE_MAX}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Add note
          </Button>
          <span className="text-sm text-muted-foreground">
            {shortcutKey}+Enter
          </span>
        </div>
        {notesLimitMessage(liveNotes(notes).length) && (
          <p className="text-sm font-semibold text-foreground" role="status">
            {notesLimitMessage(liveNotes(notes).length)}
          </p>
        )}

        {/* New note options (priority, category) */}
          {showNewNoteOptions && (
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Priority
                <select
                  value={newNotePriority}
                  onChange={(e) => setNewNotePriority(e.target.value as NotePriority)}
                  className={NOTE_SELECT}
                >
                  {NOTE_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_CONFIG[p].label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                Category
                <select
                  value={newNoteCategory}
                  onChange={(e) => setNewNoteCategory(e.target.value as NoteCategory)}
                  className={NOTE_SELECT}
                >
                  {NOTE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {NOTE_CATEGORY_LABELS[c]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
      </div>

      {/* ========== FILTER & SORT CONTROLS ========== */}
      {notes.filter((n) => n.status !== "deleted").length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          {/* Quick filters: the shared choice look */}
          <div className="flex flex-wrap items-center gap-2">
            {NOTE_FILTERS.filter((f) => f.id !== "highPriority" || counts.highPriority > 0).map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filterBy === f.id}
                onClick={() => setFilterBy(f.id)}
                className={choiceVariants({ on: filterBy === f.id, className: "px-3" })}
              >
                {f.label}
                <span className="text-muted-foreground tabular-nums"> {counts[f.count]}</span>
              </button>
            ))}
          </div>

          {/* Sort dropdown */}
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Sort
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className={NOTE_SELECT}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="priority">By priority</option>
            </select>
          </label>
        </div>
      )}

      {/* ========== NOTES LIST ========== */}
      {processedNotes.length > 0 && (
        <div className="space-y-3">
          <>
            {processedNotes.slice(0, shownCount).map((note) => {
              const timestamp = formatTimestamp(note.createdAt);
              const priorityConfig = PRIORITY_CONFIG[note.priority || "medium"];
              const isEditing = editingNoteId === note.id;

              return (
                <div
                  key={note.id}
                  className={cn(
                    "group border border-border p-3",
                    note.priority === "high" && note.status !== "done" && "border-l-2 border-l-destructive",
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
                        <ToneBadge tone={priorityConfig.tone}>{priorityConfig.label}</ToneBadge>{" "}
                        <span className="text-sm text-muted-foreground">
                          {NOTE_CATEGORY_LABELS[note.category || "other"]}
                        </span>
                      </div>

                      {/* Note content — click to edit */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <CharLimit max={5000}>
                            <Textarea
                              ref={editTextareaRef}
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              onKeyDown={handleEditKeyDown}
                              rows={4}
                              className="text-sm"
                            />
                          </CharLimit>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="outline" onClick={handleSaveEdit} disabled={!editingContent.trim()}>
                              Save
                            </Button>
                            <Button type="button" variant="ghost" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {shortcutKey}+Enter to save. Esc to cancel.
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p
                          className={cn(
                            "-mx-1 cursor-pointer whitespace-pre-wrap break-words px-1 text-sm hover:bg-muted/50",
                            "line-clamp-4",
                            note.status === "done" &&
                              "line-through text-muted-foreground"
                          )}
                          title="Click to edit"
                          onClick={() => handleStartEdit(note)}
                        >
                          {note.content}
                        </p>
                      )}

                      {/* Timestamp row */}
                      <p className="text-sm text-muted-foreground">
                        <span title={timestamp.full}>{timestamp.full}</span>, {timestamp.relative}
                      </p>
                    </div>

                    {/* Delete button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(note.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive-text md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                      aria-label="Delete note"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </>
          {processedNotes.length > shownCount && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {shownCount} of {processedNotes.length} notes.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShown({ key: listKey, n: shownCount + NOTES_SHOWN_STEP })}
              >
                Show {Math.min(NOTES_SHOWN_STEP, processedNotes.length - shownCount)} more
              </Button>
            </div>
          )}
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
