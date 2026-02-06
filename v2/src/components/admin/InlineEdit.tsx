"use client";

import { useState, useEffect } from "react";
import { Check, X } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Id } from "../../../convex/_generated/dataModel";

export type EditableField = "name" | "userType";

export function InlineEdit({
  value,
  field,
  userId,
  onSave,
}: {
  value: string;
  field: EditableField;
  userId: Id<"users">;
  onSave: (userId: Id<"users">, field: EditableField, value: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  // Sync external value changes (real-time updates from Convex)
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  const handleSave = async () => {
    if (editValue === value) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(userId, field, editValue);
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save inline edit:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save");
      setEditValue(value);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  };

  if (!isEditing) {
    return (
      <button
        onClick={() => setIsEditing(true)}
        className="w-full text-left px-1 py-0.5 -mx-1 hover:bg-primary/10 hover:outline hover:outline-2 hover:outline-primary/30 transition-all cursor-text rounded-sm truncate block max-w-[180px]"
        title="Click to edit"
      >
        {field === "userType" ? value.replace(/_/g, " ") : value || "(empty)"}
      </button>
    );
  }

  if (field === "userType") {
    return (
      <div className="flex items-center gap-1">
        <select
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
          disabled={isSaving}
          className="h-8 border-2 border-primary bg-background px-2 text-sm outline-none"
        >
          <option value="individual">individual</option>
          <option value="firm_admin">firm admin</option>
          <option value="firm_member">firm member</option>
        </select>
        <button onClick={handleSave} disabled={isSaving} className="text-green-600 hover:text-green-800 p-0.5">
          <Check className="size-3.5" />
        </button>
        <button onClick={handleCancel} disabled={isSaving} className="text-red-500 hover:text-red-700 p-0.5">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        disabled={isSaving}
        className="h-8 w-full border-2 border-primary bg-background px-2 text-sm outline-none"
      />
      <button onClick={handleSave} disabled={isSaving} className="text-green-600 hover:text-green-800 p-0.5 flex-shrink-0">
        <Check className="size-3.5" />
      </button>
      <button onClick={handleCancel} disabled={isSaving} className="text-red-500 hover:text-red-700 p-0.5 flex-shrink-0">
        <X className="size-3.5" />
      </button>
    </div>
  );
}
