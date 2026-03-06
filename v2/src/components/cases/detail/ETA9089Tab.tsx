"use client";

import { motion } from "motion/react";
import { format, parseISO, differenceInDays } from "date-fns";
import { FileText, AlertTriangle, Clock } from "lucide-react";
import type { CaseDetailData } from "./case-detail-types";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

function fmt(d?: string | null) {
  if (!d) return "\u2014";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtShort(d?: string | null) {
  if (!d) return "\u2014";
  try { return format(parseISO(d), "MMM d"); } catch { return d; }
}

interface ETA9089TabProps {
  caseData: CaseDetailData;
  filingWindowOpens?: string;
  filingWindowCloses?: string;
}

export function ETA9089Tab({
  caseData,
  filingWindowOpens,
  filingWindowCloses,
}: ETA9089TabProps) {
  const rfiEntries = caseData.rfiEntries || [];

  // Filing window calc
  let windowDays = 0;
  let windowLabel = "";
  let windowPct = 0;
  let windowChip = "Not Available";
  let windowChipStyle: React.CSSProperties = { background: "var(--muted)", color: "var(--muted-foreground)" };

  if (filingWindowOpens && filingWindowCloses) {
    const total = differenceInDays(parseISO(filingWindowCloses), parseISO(filingWindowOpens));
    const now = new Date();
    const opensDate = parseISO(filingWindowOpens);
    const closesDate = parseISO(filingWindowCloses);

    if (now < opensDate) {
      windowDays = differenceInDays(opensDate, now);
      windowLabel = "until window opens";
      windowPct = 0;
      windowChip = "Upcoming";
      windowChipStyle = { background: "rgba(217,119,6,0.1)", color: "var(--stage-eta9089)" };
    } else if (now <= closesDate) {
      windowDays = differenceInDays(closesDate, now);
      windowLabel = "remaining in window";
      windowPct = total > 0 ? ((differenceInDays(now, opensDate) / total) * 100) : 0;
      windowChip = "Active";
      windowChipStyle = { background: "rgba(46,204,64,0.1)", color: "var(--primary)" };
    } else {
      windowDays = differenceInDays(now, closesDate);
      windowLabel = "past expiration";
      windowPct = 100;
      windowChip = "Expired";
      windowChipStyle = { background: "var(--destructive)", color: "#fff" };
    }
  }

  const isFiled = !!caseData.eta9089FilingDate;
  const isCertified = !!caseData.eta9089CertificationDate;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      {/* Filing Window Card */}
      {filingWindowOpens && filingWindowCloses && (
        <motion.div variants={itemVariants}>
          <div className="win-card">
            <div className="win-accent" style={{ background: "var(--stage-eta9089)" }} />
            <div className="win-inner">
              <div className="win-header">
                <span className="win-title">ETA 9089 Filing Window</span>
                <span className="win-chip" style={windowChipStyle}>{windowChip}</span>
              </div>
              <div className="win-hero">
                <div>
                  <span className="win-hero-num" style={{ color: "var(--stage-eta9089)" }}>{windowDays}</span>
                  <span className="win-hero-unit">days</span>
                </div>
                <div className="win-hero-label">{windowLabel}</div>
              </div>
              <div className="win-progress">
                <span className="win-date">{fmtShort(filingWindowOpens)}</span>
                <div className="win-bar">
                  <div className="win-bar-fill" style={{ width: `${windowPct}%`, background: "var(--stage-eta9089)" }} />
                </div>
                <span className="win-date">{fmtShort(filingWindowCloses)}</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ETA Form 9089 Card */}
      <motion.div variants={itemVariants}>
        <div className="detail-card">
          <div className="detail-card-head ch-eta">
            <span className="flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              ETA Form 9089
            </span>
            <span className="head-badge">
              {isCertified ? "Certified" : isFiled ? "Filed" : "Pending"}
            </span>
          </div>
          <div className="field-grid" style={{ padding: 0 }}>
            <div className="field-cell">
              <div className="fc-label">Filing Date</div>
              <div className={`fc-val mono ${!isFiled ? "dim" : ""}`}>{fmt(caseData.eta9089FilingDate)}</div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Case Number</div>
              <div className={`fc-val mono ${!caseData.eta9089CaseNumber ? "dim" : ""}`}>{caseData.eta9089CaseNumber || "\u2014"}</div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Audit Date</div>
              <div className={`fc-val mono ${!caseData.eta9089AuditDate ? "dim" : ""}`}>{fmt(caseData.eta9089AuditDate)}</div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Certification Date</div>
              <div className={`fc-val mono ${!isCertified ? "dim" : ""}`}>{fmt(caseData.eta9089CertificationDate)}</div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Expiration Date</div>
              <div className={`fc-val mono ${!caseData.eta9089ExpirationDate ? "dim" : ""}`}>
                {caseData.eta9089ExpirationDate ? (
                  <span style={{ color: "var(--stage-eta9089)" }}>{fmt(caseData.eta9089ExpirationDate)}</span>
                ) : "\u2014"}
              </div>
            </div>
            <div className="field-cell">
              <div className="fc-label">Filing Window</div>
              <div className="fc-val mono" style={{ fontSize: "0.8rem" }}>
                {filingWindowOpens && filingWindowCloses
                  ? `${fmtShort(filingWindowOpens)} \u2013 ${fmtShort(filingWindowCloses)}`
                  : "\u2014"}
              </div>
            </div>
          </div>
          {!isCertified && (
            <div className="detail-status-bar">
              <Clock className="h-4 w-4 shrink-0" style={{ color: "var(--stage-eta9089)" }} />
              <span>
                {isFiled
                  ? "ETA 9089 filed \u2014 awaiting DOL decision."
                  : "Awaiting filing \u2014 recruitment must be completed first."}
                {filingWindowOpens && !isFiled && (
                  <> Filing window opens <strong className="text-foreground">{fmt(filingWindowOpens)}</strong>.</>
                )}
              </span>
            </div>
          )}
        </div>
      </motion.div>

      {/* RFI Section */}
      <motion.div variants={itemVariants}>
        <div className="detail-card">
          <div className="detail-card-head ch-muted">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              RFI (Request for Information)
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", padding: "1px 8px", border: "2px solid var(--border)", background: "var(--muted)", color: "var(--muted-foreground)" }}>
              DOL Audit
            </span>
          </div>
          {rfiEntries.length > 0 ? (
            <div className="detail-card-body space-y-4">
              {rfiEntries.map((entry, i) => (
                <div key={i} className="border-2 border-border p-3">
                  <div className="font-mono text-xs font-bold mb-1">RFI #{i + 1}</div>
                  <div className="field-grid" style={{ padding: 0 }}>
                    <div className="field-cell">
                      <div className="fc-label">Received</div>
                      <div className="fc-val mono">{fmt(entry.receivedDate)}</div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Due</div>
                      <div className="fc-val mono">{fmt(entry.responseDueDate)}</div>
                    </div>
                    <div className="field-cell">
                      <div className="fc-label">Submitted</div>
                      <div className={`fc-val mono ${!entry.responseSubmittedDate ? "dim" : ""}`}>{fmt(entry.responseSubmittedDate)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="detail-card-body">
              <div className="detail-empty-state">
                <FileText className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                <div className="detail-empty-state-title">No RFI entries</div>
                <div className="detail-empty-state-desc">Entries will appear here if DOL issues a request during audit.</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
