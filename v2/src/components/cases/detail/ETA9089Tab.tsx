"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { FileText, Clock } from "lucide-react";
import { isRecruitmentComplete } from "@/lib/perm";
import { buildEditUrl, buildEditSectionUrl } from "@/lib/cases/editDeepLinks";
import type { CaseDetailData } from "./case-detail-types";
import { itemVariants, tabContainerVariants, fmtISODate, fmtISOShort, computeWindowStatus } from "./case-detail-utils";
import { WindowCard } from "./WindowCard";
import { ResponseEntryGrid } from "./ResponseEntryGrid";

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

  // Filing window only shown if recruitment is complete (or ETA already filed)
  const recruitDone = isRecruitmentComplete(caseData);
  const isFiled = !!caseData.eta9089FilingDate;
  const showFilingWindow = (recruitDone || isFiled) && !!filingWindowOpens && !!filingWindowCloses;

  // Filing window calc
  const ws = showFilingWindow
    ? computeWindowStatus(filingWindowOpens, filingWindowCloses)
    : null;

  const isCertified = !!caseData.eta9089CertificationDate;

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={tabContainerVariants}
      className="space-y-6"
    >
      {/* Filing Window Card — only shown when recruitment is complete or ETA already filed */}
      {ws && (
        <WindowCard
          ws={ws}
          title="ETA 9089 Filing Window"
          stageColor="var(--stage-eta9089)"
          startDate={filingWindowOpens}
          endDate={filingWindowCloses}
        />
      )}

      {/* ETA Form 9089 Card */}
      <motion.div variants={itemVariants}>
        <Link href={buildEditUrl(caseData._id, "eta9089FilingDate")} className="detail-card-link" title="Edit in case form">
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
                <div className={`fc-val mono ${!isFiled ? "dim" : ""}`}>{fmtISODate(caseData.eta9089FilingDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Case Number</div>
                <div className={`fc-val fc-val-text mono ${!caseData.eta9089CaseNumber ? "dim" : ""}`} title={caseData.eta9089CaseNumber || undefined}>{caseData.eta9089CaseNumber || "\u2014"}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Audit Date</div>
                <div className={`fc-val mono ${!caseData.eta9089AuditDate ? "dim" : ""}`}>{fmtISODate(caseData.eta9089AuditDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Certification Date</div>
                <div className={`fc-val mono ${!isCertified ? "dim" : ""}`}>{fmtISODate(caseData.eta9089CertificationDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Expiration Date</div>
                <div className={`fc-val mono ${!caseData.eta9089ExpirationDate ? "dim" : ""}`}>
                  {caseData.eta9089ExpirationDate ? (
                    <span style={{ color: "var(--stage-eta9089)" }}>{fmtISODate(caseData.eta9089ExpirationDate)}</span>
                  ) : "\u2014"}
                </div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Filing Window</div>
                <div className="fc-val mono" style={{ fontSize: "0.8rem" }}>
                  {filingWindowOpens && filingWindowCloses
                    ? `${fmtISOShort(filingWindowOpens)} \u2013 ${fmtISOShort(filingWindowCloses)}`
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
                    <> Filing window opens <strong className="text-foreground">{fmtISODate(filingWindowOpens)}</strong>.</>
                  )}
                </span>
              </div>
            )}
          </div>
        </Link>
      </motion.div>

      {/* RFI Section */}
      <Link href={buildEditSectionUrl(caseData._id, "eta9089")} className="detail-card-link" title="Edit in case form">
        <ResponseEntryGrid
          type="RFI"
          subtitle="DOL Audit"
          entries={rfiEntries}
          emptyIcon={<FileText className="h-8 w-8" />}
          emptyDescription="Entries will appear here if DOL issues a request during audit."
        />
      </Link>
    </motion.div>
  );
}
