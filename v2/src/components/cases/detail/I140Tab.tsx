"use client";

import { motion } from "motion/react";
import { I140Section } from "./I140Section";
import { RFIRFESection } from "./RFIRFESection";
import type { CaseDetailData } from "./case-detail-types";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

interface I140TabProps {
  caseData: CaseDetailData;
  stageColor: string;
}

export function I140Tab({ caseData, stageColor }: I140TabProps) {
  const rfeEntries = caseData.rfeEntries ?? [];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <I140Section
          data={{
            i140FilingDate: caseData.i140FilingDate,
            i140ReceiptDate: caseData.i140ReceiptDate,
            i140ReceiptNumber: caseData.i140ReceiptNumber,
            i140ApprovalDate: caseData.i140ApprovalDate,
            i140DenialDate: caseData.i140DenialDate,
            i140Category: caseData.i140Category,
            i140PremiumProcessing: caseData.i140PremiumProcessing,
            i140ServiceCenter: caseData.i140ServiceCenter,
          }}
          eta9089CertificationDate={caseData.eta9089CertificationDate}
          eta9089ExpirationDate={caseData.eta9089ExpirationDate}
          defaultOpen={true}
          accentColor={caseData.caseStatus === "i140" ? stageColor : undefined}
        />
      </motion.div>

      {/* RFE entries only (I-140 RFEs) */}
      {rfeEntries.length > 0 && (
        <motion.div variants={itemVariants}>
          <RFIRFESection
            rfiEntries={[]}
            rfeEntries={rfeEntries}
            defaultOpen={true}
          />
        </motion.div>
      )}
    </motion.div>
  );
}
