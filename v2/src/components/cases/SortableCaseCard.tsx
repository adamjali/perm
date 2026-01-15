/**
 * SortableCaseCard Component
 * Wrapper around CaseCard that makes it draggable using dnd-kit.
 *
 * Features:
 * - Drag handle (entire card is draggable)
 * - Smooth animations during drag
 * - Visual feedback (lift + shadow)
 * - Neobrutalist styling preserved
 * - Supports selection mode (passes through selection props)
 */

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CaseCard } from "./CaseCard";
import type { CaseCardData } from "../../../convex/lib/caseListTypes";

interface SortableCaseCardProps {
  case: CaseCardData;
  index: number;
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
  index: _index,
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
    transition: _transition,
    isDragging,
  } = useSortable({ id: caseData._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? "none" : "transform 150ms ease-out",
    opacity: isDragging ? 0.9 : 1,
    zIndex: isDragging ? 1000 : 1,
    scale: isDragging ? 1.02 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
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
