"use client";

import { motion } from "motion/react";
import { parseISO, differenceInDays } from "date-fns";
import { Shield, AlertTriangle, Clock } from "lucide-react";
import type { CaseDetailData } from "./case-detail-types";
import { itemVariants, fmtISODate, fmtISOShort } from "./case-detail-utils";

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
  let windowDays = 0;
  let windowLabel = "";
  let windowPct = 0;
  let windowChip = "Not Available";
  let windowChipStyle: React.CSSProperties = { background: "var(--muted)", color: "var(--muted-foreground)" };
  const hasWindow = !!caseData.eta9089CertificationDate && !!caseData.eta9089ExpirationDate;

  if (hasWindow) {
    const certDate = parseISO(caseData.eta9089CertificationDate!);
    const expDate = parseISO(caseData.eta9089ExpirationDate!);
    const now = new Date();
    const total = differenceInDays(expDate, certDate);

    if (isFiled || isApproved) {
      windowDays = 0;
      windowLabel = "I-140 filed";
      windowPct = 100;
      windowChip = "Filed";
      windowChipStyle = { background: "var(--primary)", color: "#000" };
    } else if (now <= expDate) {
      windowDays = differenceInDays(expDate, now);
      windowLabel = "to file I-140";
      windowPct = total > 0 ? ((differenceInDays(now, certDate) / total) * 100) : 0;
      windowChip = "Active";
      windowChipStyle = { background: "var(--primary)", color: "#000" };
    } else {
      windowDays = differenceInDays(now, expDate);
      windowLabel = "past expiration";
      windowPct = 100;
      windowChip = "Expired";
      windowChipStyle = { background: "var(--destructive)", color: "#fff" };
    }
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* I-140 Filing Window Card */}
      {hasWindow && (
        <motion.div variants={itemVariants}>
          <div className="win-card">
            <div className="win-accent" style={{ background: "var(--stage-i140)" }} />
            <div className="win-inner">
              <div className="win-header">
                <span className="win-title">I-140 Filing Window</span>
                <span className="win-chip" style={windowChipStyle}>{windowChip}</span>
              </div>
              <div className="win-hero">
                <div>
                  <span className="win-hero-num" style={{ color: "var(--stage-i140)" }}>{windowDays}</span>
                  <span className="win-hero-unit">days</span>
                </div>
                <div className="win-hero-label">{windowLabel}</div>
              </div>
              <div className="win-progress">
                <span className="win-date">{fmtISOShort(caseData.eta9089CertificationDate)}</span>
                <div className="win-bar">
                  <div className="win-bar-fill" style={{ width: `${windowPct}%`, background: "var(--stage-i140)" }} />
                </div>
                <span className="win-date">{fmtISOShort(caseData.eta9089ExpirationDate)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* I-140 Petition Card */}
      <motion.div variants={itemVariants}>
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
                {caseData.i140Category || "\u2014"}
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
                {caseData.i140ReceiptNumber || "\u2014"}
              </div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Service Center</div>
              <div className={`fc-val fc-val-text mono ${!caseData.i140ServiceCenter ? "dim" : ""}`} title={caseData.i140ServiceCenter || undefined}>
                {caseData.i140ServiceCenter || "\u2014"}
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
                  ? "I-140 filed \u2014 awaiting USCIS decision."
                  : caseData.eta9089CertificationDate
                    ? "PERM certified \u2014 ready to file I-140 with USCIS."
                    : "Awaiting PERM certification before I-140 can be filed with USCIS."}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* RFE Section */}
      <motion.div variants={itemVariants}>
        <div className="detail-card">
          <div className="detail-card-head ch-muted">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              RFE (Request for Evidence)
            </span>
            <span className="font-mono text-[0.6rem] font-bold uppercase px-2 py-0.5 border-2 border-border bg-muted text-muted-foreground">
              USCIS
            </span>
          </div>
          {rfeEntries.length > 0 ? (
            <div className="detail-card-body space-y-4">
              {rfeEntries.map((entry, i) => (
                <div key={i} className="border-2 border-border p-3">
                  <div className="font-mono text-xs font-bold mb-1">RFE #{i + 1}</div>
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
                <Shield className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                <div className="detail-empty-state-title">No RFE entries</div>
                <div className="detail-empty-state-desc">Entries will appear here if USCIS issues a request during I-140 review.</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
