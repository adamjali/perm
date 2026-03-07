/**
 * Phase 2 Placeholder Components
 *
 * These components are visual placeholders for features that require
 * backend changes (new mutations, file upload support, etc.).
 *
 * PHASE_2_REPLACE: All components in this file should be replaced with
 * real implementations when Phase 2 is built.
 *
 * - Phase2UploadButton -> Real document upload with Convex file storage
 * - Phase2NoteInput -> Real note add/edit with cases.update mutation
 */

"use client";

import { useEffect } from "react";
import { Upload, Plus } from "lucide-react";

// PHASE_2_REPLACE: Replace with real document upload component using Convex file storage
export function Phase2UploadButton() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[PHASE_2] Phase2UploadButton rendered — replace with real upload in Phase 2"
      );
    }
  }, []);

  return (
    <button
      disabled
      className="flex items-center gap-2 px-3 py-1.5 text-[0.7rem] font-mono font-bold uppercase tracking-wider border-[3px] border-black bg-card text-foreground cursor-not-allowed opacity-70 shadow-hard-sm"
      title="Document upload coming soon"
    >
      <Upload className="h-3.5 w-3.5" />
      Upload
    </button>
  );
}

// PHASE_2_REPLACE: Replace with real note add/edit component using cases.update mutation
export function Phase2NoteInput() {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[PHASE_2] Phase2NoteInput rendered — replace with real note input in Phase 2"
      );
    }
  }, []);

  return (
    <button
      disabled
      className="flex items-center gap-2 px-3 py-1.5 text-[0.7rem] font-mono font-bold uppercase tracking-wider border-[3px] border-black bg-card text-foreground cursor-not-allowed opacity-70 shadow-hard-sm"
      title="Add notes from the Edit Case page"
    >
      <Plus className="h-3.5 w-3.5" />
      Add Note
    </button>
  );
}
