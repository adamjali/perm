"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "motion/react";
import { MessageCircle, Send, Trash2, ChevronLeft, ChevronRight, X, Pencil } from "lucide-react";
import {
  NOTE_CATEGORY_LABELS,
  type NoteEntry,
  type NoteCategory,
} from "@/lib/forms/case-form-schema";

interface NotesTabProps {
  notes: NoteEntry[];
  onUpdateNotes?: (notes: NoteEntry[]) => void;
}

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

function fmtDate(d: string | number): string {
  return new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls = `b-priority-${priority}`;
  return (
    <span
      className={cls}
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        border: "3px solid",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {priority}
    </span>
  );
}

function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className="b-category"
      style={{
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        border: "3px solid #000",
        display: "inline-flex",
        alignItems: "center",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      {NOTE_CATEGORY_LABELS[category as NoteCategory] || category}
    </span>
  );
}

export function NotesTab({ notes, onUpdateNotes }: NotesTabProps) {
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [editingContent, setEditingContent] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Sort notes: pending first, then done, then deleted; within each group, newest first
  const statusOrder = { pending: 0, done: 1, deleted: 2 } as const;
  const sortedNotes = [...notes].sort((a, b) => {
    const aOrder = statusOrder[a.status] ?? 2;
    const bOrder = statusOrder[b.status] ?? 2;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const isOpen = selectedIdx >= 0 && selectedIdx < sortedNotes.length;
  const selectedNote = isOpen ? sortedNotes[selectedIdx] : null;

  function navNote(dir: number) {
    const next = selectedIdx + dir;
    if (next >= 0 && next < sortedNotes.length) {
      setSelectedIdx(next);
      setIsEditing(false);
    }
  }

  function closePreview() {
    setSelectedIdx(-1);
    setIsEditing(false);
  }

  const startEdit = useCallback(() => {
    if (!selectedNote || !onUpdateNotes) return;
    setEditingContent(selectedNote.content);
    setIsEditing(true);
    setTimeout(() => editTextareaRef.current?.focus(), 0);
  }, [selectedNote, onUpdateNotes]);

  const saveEdit = useCallback(() => {
    if (!selectedNote || !onUpdateNotes) return;
    const trimmed = editingContent.trim();
    if (!trimmed) return;
    onUpdateNotes(
      notes.map((n) => n.id === selectedNote.id ? { ...n, content: trimmed } : n)
    );
    setIsEditing(false);
  }, [selectedNote, editingContent, notes, onUpdateNotes]);

  const cancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditingContent("");
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    if (!onUpdateNotes) return;
    onUpdateNotes(
      notes.map((n) => n.id === noteId ? { ...n, status: "deleted" as const } : n)
    );
    setSelectedIdx(-1);
    setIsEditing(false);
  }, [notes, onUpdateNotes]);

  const toggleDone = useCallback((noteId: string) => {
    if (!onUpdateNotes) return;
    onUpdateNotes(
      notes.map((n) => n.id === noteId ? { ...n, status: n.status === "done" ? "pending" as const : "done" as const } : n)
    );
  }, [notes, onUpdateNotes]);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <div className="detail-card no-hover" style={{ overflow: "hidden" }}>
          <div className="detail-card-head ch-yellow" style={{ gap: 8 }}>
            <span className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" />
              Case Notes
            </span>
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
              {notes.length}
            </span>
          </div>
          <div className={`split-wrap${isOpen ? " preview-open" : ""}`}>
            <div className="split-list">
              {sortedNotes.length > 0 ? (
                <div className="scroll-list">
                  {sortedNotes.map((note, i) => {
                    const isDone = note.status === "done";
                    const isSelected = i === selectedIdx;
                    return (
                      <div
                        key={note.id}
                        className={`note${isDone ? " note-done" : ""}${isSelected ? " selected" : ""}`}
                        onClick={() => setSelectedIdx(i)}
                      >
                        <div className="note-top">
                          <div className="note-badges">
                            {note.priority && <PriorityBadge priority={note.priority} />}
                            {note.category && <CategoryBadge category={note.category} />}
                          </div>
                          <div className="note-actions" onClick={(e) => e.stopPropagation()}>
                            <span className="note-when">{fmtDate(note.createdAt)}</span>
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
              ) : (
                <div className="detail-empty-state" style={{ padding: "32px 20px" }}>
                  <MessageCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                  <div className="detail-empty-state-title">No notes</div>
                  <div className="detail-empty-state-desc">Case notes will appear here. Add notes from the Edit Case page.</div>
                </div>
              )}
            </div>
            <div className="split-preview">
              {selectedNote && (
                <div className="split-preview-inner">
                  {/* Nav */}
                  <div className="preview-nav">
                    <div className="preview-nav-btns">
                      <button className="icon-btn" onClick={() => navNote(-1)} disabled={selectedIdx <= 0} title="Previous">
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button className="icon-btn" onClick={() => navNote(1)} disabled={selectedIdx >= sortedNotes.length - 1} title="Next">
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
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--muted-foreground)", marginBottom: 16 }}>
                    Created: {fmtDate(selectedNote.createdAt)}
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
                          {typeof navigator !== "undefined" && navigator.platform?.toLowerCase().includes("mac") ? "Cmd" : "Ctrl"}+Enter to save · Esc to cancel
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
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.62rem", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Due Date</span>
                      <div style={{ fontWeight: 700, marginTop: 4 }}>{selectedNote.dueDate}</div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
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
              style={{ width: 44, height: 44, cursor: "default", opacity: 0.5 }}
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
