"use client";

import { motion } from "motion/react";
import { ETA9089Section } from "./ETA9089Section";
import { RFIRFESection } from "./RFIRFESection";
import { isRecruitmentComplete } from "@/lib/perm";
import type { CaseDetailData } from "./case-detail-types";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

interface ETA9089TabProps {
  caseData: CaseDetailData;
  stageColor: string;
  filingWindowOpens?: string;
  filingWindowCloses?: string;
}

export function ETA9089Tab({
  caseData,
  stageColor,
  filingWindowOpens,
  filingWindowCloses,
}: ETA9089TabProps) {
  const rfiEntries = caseData.rfiEntries || [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <ETA9089Section
          data={{
            eta9089FilingDate: caseData.eta9089FilingDate,
            eta9089AuditDate: caseData.eta9089AuditDate,
            eta9089CertificationDate: caseData.eta9089CertificationDate,
            eta9089ExpirationDate: caseData.eta9089ExpirationDate,
            eta9089CaseNumber: caseData.eta9089CaseNumber,
          }}
          filingWindowOpensDate={filingWindowOpens}
          filingWindowClosesDate={filingWindowCloses}
          isRecruitmentComplete={isRecruitmentComplete(caseData)}
          defaultOpen={true}
          accentColor={caseData.caseStatus === "eta9089" ? stageColor : undefined}
        />
      </motion.div>

      {/* RFI entries only (ETA 9089 audit RFIs) */}
      {rfiEntries.length > 0 && (
        <motion.div variants={itemVariants}>
          <RFIRFESection
            rfiEntries={rfiEntries}
            rfeEntries={[]}
            defaultOpen={true}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
