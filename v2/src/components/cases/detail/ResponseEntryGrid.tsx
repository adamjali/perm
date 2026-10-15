"use client";

import { WarningIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { fmtISODate } from "./case-detail-utils";

interface ResponseEntry {
  receivedDate?: string;
  responseDueDate?: string;
  responseSubmittedDate?: string;
}

interface ResponseEntryGridProps {
  /** "RFI" or "RFE" */
  type: "RFI" | "RFE";
  /** Subtitle label: "DOL Audit" or "USCIS" */
  subtitle: string;
  entries: ResponseEntry[];
  /** Icon shown in empty state */
  emptyIcon: ReactNode;
  /** Description shown when no entries exist */
  emptyDescription: string;
}

/**
 * Shared RFI/RFE entry grid used by ETA9089Tab and I140Tab.
 * The two sections are structurally identical, differing only in labels and icons.
 */
const alertTriangleIcon = <WarningIcon className="h-3.5 w-3.5" weight="bold" aria-hidden="true" />;

export function ResponseEntryGrid({
  type,
  subtitle,
  entries,
  emptyIcon,
  emptyDescription,
}: ResponseEntryGridProps) {
  const fullLabel = type === "RFI" ? "RFI (Request for Information)" : "RFE (Request for Evidence)";

  return (
    <div>
      <div className="detail-card">
        <div className="detail-card-head ch-muted">
          <h2 className="flex items-center gap-1.5">
            {alertTriangleIcon}
            {fullLabel}
          </h2>{" "}
          <span className="head-badge border-2 px-2 py-0.5 bg-muted border-border">
            {subtitle}
          </span>
        </div>
        {entries.length > 0 ? (
          <div className="detail-card-body space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="bg-tint p-3 border-2 border-border">
                <div className="mb-1 text-sm font-semibold">{type} {i + 1}</div>
                <div className="field-grid">
                  <div className="field-cell">
                    <div className="fc-label">Received</div>
                    <div className="fc-val num">{fmtISODate(entry.receivedDate)}</div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Due</div>
                    <div className="fc-val num">{fmtISODate(entry.responseDueDate)}</div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Submitted</div>
                    <div className={`fc-val num ${!entry.responseSubmittedDate ? "dim" : ""}`}>{fmtISODate(entry.responseSubmittedDate)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="detail-card-body">
            <div className="detail-empty-state">
              <div className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50 flex items-center justify-center">
                {emptyIcon}
              </div>
              <div className="detail-empty-state-title">No {type} entries</div>
              <div className="detail-empty-state-desc">{emptyDescription}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
