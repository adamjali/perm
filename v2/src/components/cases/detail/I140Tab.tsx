"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Shield, Clock } from "lucide-react";
import { buildEditUrl, buildEditSectionUrl } from "@/lib/cases/editDeepLinks";
import type { CaseDetailData } from "./case-detail-types";
import { itemVariants, tabContainerVariants, fmtISODate, computeWindowStatus } from "./case-detail-utils";
import { WindowCard } from "./WindowCard";
import { ResponseEntryGrid } from "./ResponseEntryGrid";

interface I140TabProps {
  caseData: CaseDetailData;
}

export function I140Tab({ caseData }: I140TabProps) {
  const rfeEntries = caseData.rfeEntries || [];

  const isFiled = !!caseData.i140FilingDate;
  const isApproved = !!caseData.i140ApprovalDate;
  const isDenied = !!caseData.i140DenialDate;
  const statusLabel = isApproved ? "Approved" : isDenied ? "Denied" : isFiled ? "Filed" : "Pending";

  // I-140 filing window: from ETA 9089 certification to expiration
  const ws = computeWindowStatus(
    caseData.eta9089CertificationDate,
    caseData.eta9089ExpirationDate,
    { filed: isFiled || isApproved },
  );

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={tabContainerVariants}
      className="space-y-6"
    >
      {/* I-140 Filing Window Card */}
      {ws && (
        <WindowCard
          ws={ws}
          title="I-140 Filing Window"
          stageColor="var(--stage-i140)"
          startDate={caseData.eta9089CertificationDate}
          endDate={caseData.eta9089ExpirationDate}
        />
      )}

      {/* I-140 Petition Card */}
      <motion.div variants={itemVariants}>
        <Link href={buildEditUrl(caseData._id, "i140FilingDate")} className="detail-card-link" title="Edit in case form">
          <div className="detail-card">
            <div className="detail-card-head ch-i140">
              <span className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                I-140 Petition
              </span>
              <span className="head-badge">{statusLabel}</span>
            </div>

            {/* Filing Details */}
            <div className="detail-subhead">Filing Details</div>
            <div className="field-grid" style={{ padding: 0, borderTop: "2px solid var(--manila-dark)" }}>
              <div className="field-cell">
                <div className="fc-label">Category</div>
                <div className={`fc-val ${!caseData.i140Category ? "dim" : ""}`}>
                  {caseData.i140Category || "-"}
                </div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Filing Date</div>
                <div className={`fc-val mono ${!isFiled ? "dim" : ""}`}>{fmtISODate(caseData.i140FilingDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Premium Processing</div>
                <div className={`fc-val ${!caseData.i140PremiumProcessing ? "dim" : ""}`}>
                  {caseData.i140PremiumProcessing ? "Yes" : "No"}
                </div>
              </div>
            </div>

            {/* Receipt & Processing */}
            <div className="detail-subhead" style={{ borderTop: "3px solid var(--border)" }}>Receipt &amp; Processing</div>
            <div className="field-grid" style={{ padding: 0, borderTop: "2px solid var(--manila-dark)" }}>
              <div className="field-cell">
                <div className="fc-label">Receipt Date</div>
                <div className={`fc-val mono ${!caseData.i140ReceiptDate ? "dim" : ""}`}>{fmtISODate(caseData.i140ReceiptDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Receipt Number</div>
                <div className={`fc-val fc-val-text mono ${!caseData.i140ReceiptNumber ? "dim" : ""}`} title={caseData.i140ReceiptNumber || undefined}>
                  {caseData.i140ReceiptNumber || "-"}
                </div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Service Center</div>
                <div className={`fc-val fc-val-text mono ${!caseData.i140ServiceCenter ? "dim" : ""}`} title={caseData.i140ServiceCenter || undefined}>
                  {caseData.i140ServiceCenter || "-"}
                </div>
              </div>
            </div>

            {/* Outcome */}
            <div className="detail-subhead" style={{ borderTop: "3px solid var(--border)" }}>Outcome</div>
            <div className="field-grid" style={{ padding: 0, borderTop: "2px solid var(--manila-dark)" }}>
              <div className="field-cell">
                <div className="fc-label">Approval Date</div>
                <div className={`fc-val mono ${!isApproved ? "dim" : ""}`}>{fmtISODate(caseData.i140ApprovalDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Denial Date</div>
                <div className={`fc-val mono ${!isDenied ? "dim" : ""}`}>{fmtISODate(caseData.i140DenialDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Status</div>
                <div className="fc-val">
                  <span
                    className="font-mono text-[0.65rem] font-bold uppercase px-2 py-0.5 border-2 border-border"
                    style={
                      isApproved
                        ? { background: "var(--primary)", color: "var(--primary-foreground)" }
                        : isDenied
                          ? { background: "var(--destructive)", color: "#fff" }
                          : { background: "var(--muted)" }
                    }
                  >
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Summary */}
            {!isApproved && !isDenied && (
              <div className="detail-status-bar">
                <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--stage-i140)" }} />
                <span>
                  {isFiled
                    ? "I-140 filed. Awaiting USCIS decision."
                    : caseData.eta9089CertificationDate
                      ? "PERM certified. Ready to file I-140 with USCIS."
                      : "Awaiting PERM certification before I-140 can be filed with USCIS."}
                </span>
              </div>
            )}
          </div>
        </Link>
      </motion.div>

      {/* RFE Section */}
      <Link href={buildEditSectionUrl(caseData._id, "i140")} className="detail-card-link" title="Edit in case form">
        <ResponseEntryGrid
          type="RFE"
          subtitle="USCIS"
          entries={rfeEntries}
          emptyIcon={<Shield className="h-8 w-8" />}
          emptyDescription="Entries will appear here if USCIS issues a request during I-140 review."
        />
      </Link>
    </motion.div>
  );
}
