"use client";

import { useState, useRef, useCallback, useEffect, useMemo, type CSSProperties } from "react";
import { motion } from "motion/react";
import { MessageCircle, Send, Trash2, ChevronLeft, ChevronRight, X, Pencil, Flag, Tag, CalendarDays, CheckCircle } from "lucide-react";
import {
  NOTE_CATEGORY_LABELS,
  NOTE_PRIORITIES,
  NOTE_CATEGORIES,
  generateNoteId,
  type NoteEntry,
  type NoteCategory,
  type NotePriority,
} from "@/lib/forms/case-form-schema";

interface NotesTabProps {
  notes: NoteEntry[];
  onUpdateNotes?: (notes: NoteEntry[]) => void | Promise<void>;
}

const ITEMS_PER_PAGE = 10;

import { itemVariants, tabContainerVariants, fmtTimestamp } from "./case-detail-utils";

const PRIORITY_LABELS: Record<NotePriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const BADGE_BASE_STYLE: CSSProperties = {
  fontFamily: "var(--font-mono)",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  border: "3px solid",
  display: "inline-flex",
  alignItems: "center",
  lineHeight: 1,
  whiteSpace: "nowrap",
};

function PriorityBadge({ priority }: { priority: NotePriority }) {
  return (
    <span className={`b-priority-${priority}`} style={BADGE_BASE_STYLE}>
      {priority}
    </span>
  );
}

function CategoryBadge({ category }: { category: NoteCategory }) {
  return (
    <span className="b-category" style={BADGE_BASE_STYLE}>
      {NOTE_CATEGORY_LABELS[category] || category}
    </span>
  );
}

export function NotesTab({ notes, onUpdateNotes }: NotesTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [page, setPage] = useState(0);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // New note input state
  const [newContent, setNewContent] = useState("");
  const [newPriority, setNewPriority] = useState<NotePriority>("medium");
  const [newCategory, setNewCategory] = useState<NoteCategory>("other");
  const [newDueDate, setNewDueDate] = useState("");
  const [showOptions, setShowOptions] = useState(false);
  const [filterCategory, setFilterCategory] = useState<NoteCategory | "all">("all");
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);

  const isMac = typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("mac");
  const shortcutKey = isMac ? "Cmd" : "Ctrl";

  // Filter out deleted notes, then sort: pending first, then done; within each group, newest first
  const visibleNotes = useMemo(() => {
    const statusOrder = { pending: 0, done: 1, deleted: 2 } as const;
    return [...notes]
      .filter((n) => n.status !== "deleted")
      .filter((n) => filterCategory === "all" || n.category === filterCategory)
      .sort((a, b) => {
        const aOrder = statusOrder[a.status] ?? 2;
        const bOrder = statusOrder[b.status] ?? 2;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [notes, filterCategory]);

  const totalPages = Math.ceil(visibleNotes.length / ITEMS_PER_PAGE);
  const pagedNotes = visibleNotes.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);

  const selectedNote = selectedId ? visibleNotes.find((n) => n.id === selectedId) || null : null;
  const isOpen = selectedNote !== null;

  // Auto-advance page when selected note is on a different page
  useEffect(() => {
    if (selectedId) {
      const idx = visibleNotes.findIndex((n) => n.id === selectedId);
      if (idx >= 0) {
        const notePage = Math.floor(idx / ITEMS_PER_PAGE);
        if (notePage !== page) setPage(notePage);
      }
    }
  }, [selectedId, visibleNotes, page]);

  // Reset page if it's out of bounds after delete
  useEffect(() => {
    if (page > 0 && page >= totalPages) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  function navNote(dir: number) {
    const idx = visibleNotes.findIndex((n) => n.id === selectedId);
    if (idx < 0) return;
    const next = idx + dir;
    const target = visibleNotes[next];
    if (next >= 0 && target) {
      setSelectedId(target.id);
      setIsEditing(false);
    }
  }

  function closePreview() {
    setSelectedId(null);
    setIsEditing(false);
  }

  const startEdit = useCallback(() => {
    if (!selectedNote || !onUpdateNotes) return;
    setEditingContent(selectedNote.content);
    setIsEditing(true);
    setTimeout(() => editTextareaRef.current?.focus(), 0);
  }, [selectedNote, onUpdateNotes]);

  const saveEdit = useCallback(async () => {
    if (!selectedNote || !onUpdateNotes) return;
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    try {
      await onUpdateNotes(
        notes.map((n) => n.id === selectedNote.id ? { ...n, content: trimmed } : n)
      );
      setIsEditing(false);
    } catch {
      // Parent handler (handleUpdateNotes) already calls handleOperationError
    }
  }, [selectedNote, editingContent, notes, onUpdateNotes]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingContent("");
  }, []);

  const deleteNote = useCallback(async (noteId: string) => {
    if (!onUpdateNotes) return;
    try {
      await onUpdateNotes(
        notes.map((n) => n.id === noteId ? { ...n, status: "deleted" as const } : n)
      );
      if (selectedId === noteId) {
        setSelectedId(null);
        setIsEditing(false);
      }
    } catch {
      // Parent handler already calls handleOperationError
    }
  }, [notes, onUpdateNotes, selectedId]);

  const toggleDone = useCallback(async (noteId: string) => {
    if (!onUpdateNotes) return;
    try {
      await onUpdateNotes(
        notes.map((n) => n.id === noteId ? { ...n, status: n.status === "done" ? "pending" as const : "done" as const } : n)
      );
    } catch {
      // Parent handler already calls handleOperationError
    }
  }, [notes, onUpdateNotes]);

  // Add new note
  const handleAddNote = useCallback(async () => {
    if (!onUpdateNotes) return;
    const content = newContent.trim();
    if (!content || notes.length >= 200) return;

    const newNote: NoteEntry = {
      id: generateNoteId(),
      content,
      createdAt: Date.now(),
      status: "pending",
      priority: newPriority,
      category: newCategory,
      ...(newDueDate ? { dueDate: newDueDate } : {}),
    };

    try {
      await onUpdateNotes([...notes, newNote]);
      setNewContent("");
      setNewDueDate("");
      setShowOptions(false);
      newTextareaRef.current?.focus();
    } catch {
      // Parent handler already calls handleOperationError
    }
  }, [onUpdateNotes, newContent, newPriority, newCategory, newDueDate, notes]);

  const handleNewNoteKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleAddNote();
      }
    },
    [handleAddNote]
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={tabContainerVariants}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <div className="detail-card" style={{ overflow: "hidden" }}>
          <div className="detail-card-head ch-yellow" style={{ gap: 8 }}>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Case Notes
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value as NoteCategory | "all"); setPage(0); }}
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
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{NOTE_CATEGORY_LABELS[c]}</option>
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
                {visibleNotes.length}
              </span>
            </div>
          </div>
          <div className={`split-wrap${isOpen ? " preview-open" : ""}`}>
            <div className="split-list">
              {pagedNotes.length > 0 ? (
                <div className="scroll-list">
                  {pagedNotes.map((note) => {
                    const isDone = note.status === "done";
                    const isSelected = note.id === selectedId;
                    return (
                      <div
                        key={note.id}
                        className={`note${isDone ? " note-done" : ""}${isSelected ? " selected" : ""}`}
                        onClick={() => { setSelectedId(note.id); setIsEditing(false); }}
                      >
                        <div className="note-top">
                          <div className="note-badges">
                            {note.priority && <PriorityBadge priority={note.priority} />}
                            {note.category && <CategoryBadge category={note.category} />}
                          </div>
                          <div className="note-actions" onClick={(e) => e.stopPropagation()}>
                            <span className="note-when">{fmtTimestamp(note.createdAt)}</span>
                            <button
                              className="icon-btn icon-btn-danger"
                              title="Delete note"
                              disabled={!onUpdateNotes}
                              style={{ color: "var(--destructive)", padding: 4, opacity: onUpdateNotes ? 1 : 0.5 }}
                              onClick={() => deleteNote(note.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="note-body" title={note.content}>{note.content}</div>
                        {note.dueDate && <div className="note-due">Due: {note.dueDate}</div>}
                      </div>
                    );
                  })}
                </div>
              ) : visibleNotes.length === 0 ? (
                <div className="detail-empty-state" style={{ padding: "32px 20px" }}>
                  <MessageCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <div className="detail-empty-state-title">No notes</div>
                  <div className="detail-empty-state-desc">Add a note below to get started.</div>
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
            </div>
            <div className="split-preview">
              {selectedNote && (
                <div className="split-preview-inner">
                  {/* Nav */}
                  <div className="preview-nav">
                    <div className="preview-nav-btns">
                      <button className="icon-btn" onClick={() => navNote(-1)} disabled={visibleNotes.findIndex((n) => n.id === selectedId) <= 0} title="Previous">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button className="icon-btn" onClick={() => navNote(1)} disabled={visibleNotes.findIndex((n) => n.id === selectedId) >= visibleNotes.length - 1} title="Next">
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button className="icon-btn" onClick={closePreview} title="Close">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Meta badges */}
                  <div className="preview-meta">
                    {selectedNote.priority && <PriorityBadge priority={selectedNote.priority} />}
                    {selectedNote.category && <CategoryBadge category={selectedNote.category} />}
                    <span>
                      {selectedNote.status === "done" ? (
                        <span style={{ color: "var(--primary)", fontWeight: 700 }}>Complete</span>
                      ) : (
                        <span style={{ color: "var(--stage-eta9089)", fontWeight: 700 }}>Pending</span>
                      )}
                    </span>
                  </div>

                  {/* Created date */}
                  <div className="preview-date" style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", marginBottom: 16 }}>
                    Created: {fmtTimestamp(selectedNote.createdAt)}
                  </div>

                  {/* Body */}
                  {isEditing ? (
                    <div style={{ marginBottom: 12 }}>
                      <textarea
                        ref={editTextareaRef}
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveEdit(); }
                          if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                        }}
                        maxLength={5000}
                        rows={6}
                        style={{
                          width: "100%",
                          fontSize: "0.95rem",
                          lineHeight: 1.7,
                          padding: "8px 12px",
                          border: "3px solid var(--primary)",
                          background: "var(--background)",
                          color: "var(--foreground)",
                          resize: "vertical",
                          fontFamily: "inherit",
                        }}
                      />
                      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                        <button
                          className="icon-btn"
                          style={{ width: "auto", padding: "4px 12px", background: "var(--primary)", color: "var(--primary-foreground)", fontWeight: 700 }}
                          onClick={saveEdit}
                          disabled={!editingContent.trim()}
                        >
                          Save
                        </button>
                        <button className="icon-btn" style={{ width: "auto", padding: "4px 12px" }} onClick={cancelEdit}>
                          Cancel
                        </button>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
                          {shortcutKey}+Enter to save · Esc to cancel
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div
                      className="preview-body max-h-[400px] overflow-y-auto"
                      style={{ fontSize: "1rem", lineHeight: 1.7, cursor: onUpdateNotes ? "pointer" : "default" }}
                      title={onUpdateNotes ? "Click to edit" : undefined}
                      onClick={onUpdateNotes ? startEdit : undefined}
                    >
                      {selectedNote.content}
                    </div>
                  )}

                  {/* Due date box */}
                  {selectedNote.dueDate && (
                    <div style={{ marginTop: 16, padding: "12px 16px", border: "3px solid var(--border)", background: "var(--muted)" }}>
                      <span className="preview-date" style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", textTransform: "uppercase" }}>Due Date</span>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedNote.dueDate}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 24, flexWrap: "wrap" }}>
                    <button
                      className="icon-btn"
                      style={{ width: "auto", padding: "4px 12px", gap: 6, display: "flex", alignItems: "center" }}
                      disabled={!onUpdateNotes}
                      onClick={() => toggleDone(selectedNote.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      {selectedNote.status === "done" ? "Mark Pending" : "Mark Done"}
                    </button>
                    <button
                      className="icon-btn"
                      style={{ width: "auto", padding: "4px 12px", gap: 6, display: "flex", alignItems: "center" }}
                      disabled={!onUpdateNotes}
                      onClick={startEdit}
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button
                      className="icon-btn icon-btn-danger"
                      style={{ width: "auto", padding: "4px 12px", gap: 6, display: "flex", alignItems: "center", color: "var(--destructive)" }}
                      disabled={!onUpdateNotes}
                      onClick={() => deleteNote(selectedNote.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Note input area */}
          {onUpdateNotes ? (
            <div className="note-input-area">
              <div className="note-input-combo">
                <textarea
                  ref={newTextareaRef}
                  className="note-input"
                  placeholder={`Add a case note... (${shortcutKey}+Enter)`}
                  value={newContent}
                  onChange={(e) => {
                    setNewContent(e.target.value);
                    if (e.target.value && !showOptions) setShowOptions(true);
                  }}
                  onKeyDown={handleNewNoteKeyDown}
                  maxLength={5000}
                  rows={2}
                  style={{
                    resize: "none",
                    minHeight: 44,
                    fontFamily: "inherit",
                    fontSize: "0.85rem",
                  }}
                />
                <button
                  className="note-send-btn"
                  disabled={!newContent.trim() || notes.length >= 200}
                  onClick={handleAddNote}
                  aria-label="Add note"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>

              {/* Priority, Category, Due Date selectors */}
              {showOptions && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    padding: "8px 12px",
                    borderTop: "2px solid var(--border)",
                    background: "var(--muted)",
                    alignItems: "center",
                  }}
                >
                  {/* Priority */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Flag className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value as NotePriority)}
                      style={{
                        height: 26,
                        minWidth: 0, // see the date input below
                        padding: "0 6px",
                        border: "2px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {NOTE_PRIORITIES.map((p) => (
                        <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Category */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Tag className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value as NoteCategory)}
                      style={{
                        height: 26,
                        padding: "0 6px",
                        border: "2px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                      }}
                    >
                      {NOTE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{NOTE_CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  </div>

                  {/* Due Date */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <CalendarDays className="h-3 w-3" style={{ color: "var(--muted-foreground)" }} />
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      style={{
                        height: 26,
                        // A flex item defaults to `min-width: auto`, so it will
                        // not shrink below its intrinsic width. WebKit's
                        // intrinsic width for a date control is wider than
                        // Blink's, so without this the field overflows this row
                        // on iPhone while measuring correctly on a desktop.
                        minWidth: 0,
                        padding: "0 6px",
                        border: "2px solid var(--border)",
                        background: "var(--background)",
                        color: "var(--foreground)",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                      }}
                    />
                    {newDueDate && (
                      <button
                        onClick={() => setNewDueDate("")}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--muted-foreground)",
                          padding: 2,
                          display: "flex",
                        }}
                        title="Clear due date"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {notes.length >= 190 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "var(--muted-foreground)" }}>
                      {200 - notes.length} notes remaining
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="note-input-area">
              <div className="note-input-combo">
                <input
                  type="text"
                  className="note-input"
                  placeholder="Add a case note..."
                  disabled
                  style={{ opacity: 0.5, cursor: "default" }}
                />
                <button
                  className="note-send-btn"
                  disabled
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
