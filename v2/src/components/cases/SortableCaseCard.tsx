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

import { useRef } from "react";
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

  // Track whether a drag occurred so we can swallow the subsequent click event.
  // After pointer-up following a drag, the browser fires a synthetic "click".
  // That click would propagate into CaseCard and toggle pin — we prevent that here.
  const didDragRef = useRef(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition ?? undefined,
    // When this item is being rendered in the DragOverlay, the original
    // stays in-place as a translucent placeholder so the user can see
    // where the item came from.
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
      onPointerMove={() => {
        // Any pointer movement while holding indicates drag intent.
        // The actual dnd-kit activation distance (8px) gates the real drag,
        // but we set this early so the click suppression is ready.
        didDragRef.current = true;
      }}
      onClickCapture={(e) => {
        // After a drag-and-release the browser fires a click event.
        // Swallow it so CaseCard's onClick (pin toggle) doesn't fire.
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
