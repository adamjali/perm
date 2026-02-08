/**
 * SortableCaseCard Component
 * Wrapper around CaseCard that makes it draggable using dnd-kit.
 *
 * Features:
 * - Drag via entire card surface
 * - Click-after-drag prevention (swallows click events that follow a drag)
 * - Smooth transform animations during reorder
 * - Visual placeholder (opacity reduced) while dragged item is in DragOverlay
 * - Neobrutalist styling preserved
 * - Supports selection mode (passes through selection props)
 */

import { useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CaseCard } from "./CaseCard";
import type { CaseCardData } from "../../../convex/lib/caseListTypes";

interface SortableCaseCardProps {
  case: CaseCardData;
  selectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  /**
   * Callback when delete is requested from 3-dot menu.
   * Parent should show confirmation dialog and handle the mutation.
   */
  onDeleteRequest?: (caseId: string, caseName: string) => void;
  /**
   * Callback when archive is requested from 3-dot menu.
   * Parent should show confirmation dialog and handle the mutation.
   */
  onArchiveRequest?: (caseId: string, caseName: string) => void;
}

export function SortableCaseCard({
  case: caseData,
  selectionMode = false,
  isSelected = false,
  onSelect,
  onDeleteRequest,
  onArchiveRequest,
}: SortableCaseCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: caseData._id });

  // Track whether a real dnd-kit drag occurred so we can swallow the
  // synthetic click event the browser fires after pointer-up.
  const didDragRef = useRef(false);

  // Sync the ref with dnd-kit's isDragging — this is the authoritative
  // signal that a drag actually activated (past the activation threshold).
  useEffect(() => {
    if (isDragging) {
      didDragRef.current = true;
    }
  }, [isDragging]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // The original stays in-place as a translucent placeholder while the
    // DragOverlay renders the dragged copy.
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`touch-manipulation ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      onPointerDown={() => {
        didDragRef.current = false;
      }}
      onClickCapture={(e) => {
        if (didDragRef.current) {
          e.stopPropagation();
          e.preventDefault();
          didDragRef.current = false;
        }
      }}
    >
      <CaseCard
        case={caseData}
        selectionMode={selectionMode}
        isSelected={isSelected}
        onSelect={onSelect}
        onDeleteRequest={onDeleteRequest}
        onArchiveRequest={onArchiveRequest}
      />
    </div>
  );
}
