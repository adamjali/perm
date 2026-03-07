"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { itemVariants, fmtISODate } from "./case-detail-utils";

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
export function ResponseEntryGrid({
  type,
  subtitle,
  entries,
  emptyIcon,
  emptyDescription,
}: ResponseEntryGridProps) {
  const fullLabel = type === "RFI" ? "RFI (Request for Information)" : "RFE (Request for Evidence)";

  return (
    <motion.div variants={itemVariants}>
      <div className="detail-card">
        <div className="detail-card-head ch-muted">
          <span className="flex items-center gap-1.5">
            {type === "RFI" ? (
              <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            ) : (
              <svg className="h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
            )}
            {fullLabel}
          </span>
          <span className="font-mono text-[0.6rem] font-bold uppercase px-2 py-0.5 border-2 border-border bg-muted text-muted-foreground">
            {subtitle}
          </span>
        </div>
        {entries.length > 0 ? (
          <div className="detail-card-body space-y-4">
            {entries.map((entry, i) => (
              <div key={i} className="border-2 border-border p-3">
                <div className="font-mono text-xs font-bold mb-1">{type} #{i + 1}</div>
                <div className="field-grid" style={{ padding: 0 }}>
                  <div className="field-cell">
                    <div className="fc-label">Received</div>
                    <div className="fc-val mono">{fmtISODate(entry.receivedDate)}</div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Due</div>
                    <div className="fc-val mono">{fmtISODate(entry.responseDueDate)}</div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Submitted</div>
                    <div className={`fc-val mono ${!entry.responseSubmittedDate ? "dim" : ""}`}>{fmtISODate(entry.responseSubmittedDate)}</div>
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
    </motion.div>
  );
}
