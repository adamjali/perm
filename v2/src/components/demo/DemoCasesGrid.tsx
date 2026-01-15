/**
 * DemoCasesGrid Component
 *
 * Responsive grid layout for demo case cards.
 * Includes add button and empty state handling.
 *
 * Features:
 * - Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop
 * - Add Case button at top
 * - Empty state when no cases
 * - AnimatePresence for enter/exit animations
 *
 */

"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoCaseCard } from "./DemoCaseCard";
import type { DemoCase } from "@/lib/demo";

interface DemoCasesGridProps {
  cases: DemoCase[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export function DemoCasesGrid({ cases, onEdit, onDelete, onAdd }: DemoCasesGridProps) {
  return (
    <div>
      {/* Header with Add Button */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {cases.length} {cases.length === 1 ? "case" : "cases"}
        </p>
        <Button onClick={onAdd} size="sm" className="gap-1.5">
          <Plus className="size-4" />
          Add Case
        </Button>
      </div>

      {/* Grid or Empty State */}
      {cases.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 border-2 border-dashed border-muted-foreground/30 bg-muted/30">
          <FolderOpen className="size-12 text-muted-foreground/50" />
          <div className="text-center">
            <p className="font-heading font-semibold text-muted-foreground">
              No cases yet
            </p>
            <p className="text-sm text-muted-foreground/70">
              Click &quot;Add Case&quot; to create your first demo case
            </p>
          </div>
          <Button onClick={onAdd} variant="outline" size="sm" className="gap-1.5">
            <Plus className="size-4" />
            Add Case
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {cases.map((caseData) => (
              <motion.div
                key={caseData.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <DemoCaseCard
                  case={caseData}
                  onEdit={() => onEdit(caseData.id)}
                  onDelete={() => onDelete(caseData.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
