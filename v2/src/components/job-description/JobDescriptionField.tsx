"use client";

import { useState } from "react";
import { CaretDownIcon, SparkleIcon } from "@phosphor-icons/react";

import type { Id } from "@convex/_generated/dataModel";
import { formatInt } from "@/lib/format";
import { socGroup } from "@/lib/socCode";
import { cn } from "@/lib/utils";
import { JobDescriptionEditor } from "./JobDescriptionEditor";

export type { JobDescriptionTemplate } from "@/hooks/useJobDescriptionTemplates";

export interface JobDescriptionFieldProps {
  /** The case's position title, which the description's title follows until it's edited. */
  inheritedPositionTitle: string;
  positionTitle: string;
  description: string;
  /** The case's SOC code, for the suggested description. */
  socCode?: string;
  templateId?: Id<"jobDescriptionTemplates">;
  onPositionTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTemplateChange: (id: Id<"jobDescriptionTemplates"> | undefined) => void;
  defaultExpanded?: boolean;
  className?: string;
}

/**
 * The case form's job description section: a heading that opens and folds, around the one editor
 * (`JobDescriptionEditor`), which the case page uses too. Folded, the heading says how long the text is, or,
 * on a case with a SOC code and no description yet, that a suggestion is waiting inside.
 */
export function JobDescriptionField({
  inheritedPositionTitle,
  positionTitle,
  description,
  socCode,
  templateId,
  onPositionTitleChange,
  onDescriptionChange,
  onTemplateChange,
  defaultExpanded = false,
  className,
}: JobDescriptionFieldProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const code = socGroup(socCode);
  const suggestionWaiting = Boolean(code) && !description.trim();
  return (
    <section className={cn("bg-tint", className)}>
      {/* The heading's button covers the header row, as on every form section */}
      <div className="relative flex min-h-12 items-center justify-between gap-4 p-4 hover:bg-muted/50 has-[:focus-visible]:bg-muted/50">
        <h2 className="font-heading text-lg font-bold">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            className="text-left after:absolute after:inset-0 focus-visible:outline-none"
          >
            Job description
          </button>
        </h2>
        <div className="flex shrink-0 items-center gap-3">
          {!isExpanded && suggestionWaiting ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <SparkleIcon className="size-4 text-primary-text" aria-hidden="true" />
              Suggested from {code}
            </span>
          ) : description ? (
            <span className="text-sm tabular-nums text-muted-foreground">{formatInt(description.length)} characters</span>
          ) : null}
          <CaretDownIcon className={cn("size-5 text-muted-foreground transition-transform", isExpanded && "rotate-180")} aria-hidden="true" />
        </div>
      </div>
      {isExpanded ? (
        <div className="border-t border-border p-4">
          <JobDescriptionEditor
            idPrefix="case-form-jd"
            inheritedPositionTitle={inheritedPositionTitle}
            positionTitle={positionTitle}
            description={description}
            socCode={socCode}
            templateId={templateId}
            onPositionTitleChange={onPositionTitleChange}
            onDescriptionChange={onDescriptionChange}
            onTemplateChange={onTemplateChange}
            clearable
          />
        </div>
      ) : null}
    </section>
  );
}
