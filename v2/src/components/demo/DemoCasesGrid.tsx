/**
 * DemoCasesGrid Component
 *
 * Responsive grid for demo case cards with neobrutalist add button
 * and empty state. AnimatePresence for enter/exit animations.
 */

"use client";

import { AnimatePresence, motion } from "motion/react";
import { Plus, FolderOpen } from "lucide-react";
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
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {cases.length} {cases.length === 1 ? "case" : "cases"}
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 border-3 border-border bg-primary px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-black shadow-hard transition-all duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-lg active:translate-x-0 active:translate-y-0 active:shadow-none"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Case
        </button>
      </div>

      {/* Grid or Empty State */}
      {cases.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center gap-4 border-3 border-dashed border-border bg-muted/30">
          <FolderOpen className="h-12 w-12 text-muted-foreground/40" />
          <div className="text-center">
            <p className="font-heading font-bold text-muted-foreground">
              No cases yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground/70">
              Click &quot;Add Case&quot; to create your first demo case
            </p>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 border-2 border-border bg-background px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Case
          </button>
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
