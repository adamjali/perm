"use client";

import Link from "next/link";
import { ClockIcon, FileTextIcon } from "@phosphor-icons/react";
import { denialReviewDeadline, denialReviewStep, isRecruitmentComplete } from "@/lib/perm";
import { buildEditUrl, buildEditSectionUrl } from "@/lib/cases/editDeepLinks";
import type { CaseDetailData } from "./case-detail-types";
import { fmtISODate, fmtISOShort, computeWindowStatus } from "./case-detail-utils";
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
  // A certification after a denial is a reversal, and the certification counts.
  const denialStep = denialReviewStep(caseData);
  const reviewDue = denialReviewDeadline(caseData);
  const isDenied = !!denialStep;

  return (
    <div className="space-y-6">
      {/* Filing Window Card — only shown when recruitment is complete or ETA already filed */}
      {ws && (
        <WindowCard
          ws={ws}
          title="ETA 9089 filing window"
          stageColor="var(--stage-eta9089)"
          startDate={filingWindowOpens}
          endDate={filingWindowCloses}
        />
      )}

      {/* ETA Form 9089 Card */}
      <div>
        <Link href={buildEditUrl(caseData._id, "eta9089FilingDate")} className="detail-card-link" title="Edit in case form">
          <div className="detail-card">
            <div className="detail-card-head ch-eta">
              <h2 className="flex items-center gap-1.5">
                <FileTextIcon className="h-3.5 w-3.5" />
                ETA Form 9089
              </h2>{" "}
              <span className="head-badge">
                {isCertified ? "Certified" : isDenied ? "Denied" : isFiled ? "Filed" : "Pending"}
              </span>
            </div>
            <div className="field-grid">
              <div className="field-cell">
                <div className="fc-label">Filing date</div>
                <div className={`fc-val num ${!isFiled ? "dim" : ""}`}>{fmtISODate(caseData.eta9089FilingDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Case number</div>
                <div className={`fc-val fc-val-text mono ${!caseData.eta9089CaseNumber ? "dim" : ""}`} title={caseData.eta9089CaseNumber || undefined}>{caseData.eta9089CaseNumber || "-"}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Audit date</div>
                <div className={`fc-val num ${!caseData.eta9089AuditDate ? "dim" : ""}`}>{fmtISODate(caseData.eta9089AuditDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Certification date</div>
                <div className={`fc-val num ${!isCertified ? "dim" : ""}`}>{fmtISODate(caseData.eta9089CertificationDate)}</div>
              </div>
              <div className="field-cell">
                <div className="fc-label">Expiration date</div>
                <div className={`fc-val num ${!caseData.eta9089ExpirationDate ? "dim" : ""}`}>
                  {caseData.eta9089ExpirationDate ? (
                    <span style={{ color: "var(--data-warn-ink)" }}>{fmtISODate(caseData.eta9089ExpirationDate)}</span>
                  ) : "-"}
                </div>
              </div>
              {caseData.eta9089DenialDate ? (
                <>
                  <div className="field-cell">
                    <div className="fc-label">Denial date</div>
                    <div className="fc-val num">{fmtISODate(caseData.eta9089DenialDate)}</div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Reconsideration requested</div>
                    <div className={`fc-val num ${!caseData.eta9089ReconsiderationDate ? "dim" : ""}`}>{fmtISODate(caseData.eta9089ReconsiderationDate)}</div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">Reconsideration denied</div>
                    <div className={`fc-val num ${!caseData.eta9089ReconsiderationDeniedDate ? "dim" : ""}`}>{fmtISODate(caseData.eta9089ReconsiderationDeniedDate)}</div>
                  </div>
                  <div className="field-cell">
                    <div className="fc-label">BALCA review requested</div>
                    <div className={`fc-val num ${!caseData.eta9089BalcaRequestDate ? "dim" : ""}`}>{fmtISODate(caseData.eta9089BalcaRequestDate)}</div>
                  </div>
                </>
              ) : null}
              <div className="field-cell">
                <div className="fc-label">Filing window</div>
                <div className="fc-val num" style={{ fontSize: "0.875rem" }}>
                  {filingWindowOpens && filingWindowCloses
                    ? `${fmtISOShort(filingWindowOpens)} to ${fmtISOShort(filingWindowCloses)}`
                    : "-"}
                </div>
              </div>
            </div>
            {!isCertified && (
              <div className="detail-status-bar">
                <ClockIcon className="h-4 w-4 shrink-0" style={{ color: "var(--stage-eta9089-ink)" }} />
                <span>
                  {reviewDue ? (
                    <>
                      {reviewDue.kind === "review" ? "ETA 9089 denied. Reconsideration or BALCA review is due " : "Reconsideration upheld the denial. BALCA review is due "}
                      <strong className="text-foreground">{fmtISODate(reviewDue.date)}</strong>, 30 days after the {reviewDue.kind === "review" ? "denial" : "notice"}.
                    </>
                  ) : denialStep === "reconsidering"
                    ? "ETA 9089 denied. Reconsideration requested; awaiting the Certifying Officer."
                    : denialStep === "at-balca"
                      ? "ETA 9089 denied. BALCA review requested; awaiting BALCA."
                      : isFiled
                        ? "ETA 9089 filed. Awaiting DOL decision."
                        : "Awaiting filing. Recruitment must be completed first."}
                  {filingWindowOpens && !isFiled && (
                    <> Filing window opens <strong className="text-foreground">{fmtISODate(filingWindowOpens)}</strong>.</>
                  )}
                </span>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* RFI Section */}
      <Link href={buildEditSectionUrl(caseData._id, "eta9089")} className="detail-card-link" title="Edit in case form">
        <ResponseEntryGrid
          type="RFI"
          subtitle="DOL Audit"
          entries={rfiEntries}
          emptyIcon={<FileTextIcon className="h-8 w-8" />}
          emptyDescription="Entries will appear here if DOL issues a request during audit."
        />
      </Link>
    </div>
  );
}
