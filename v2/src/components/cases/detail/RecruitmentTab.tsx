"use client";

import { motion } from "motion/react";
import { RecruitmentSection } from "./RecruitmentSection";
import { RecruitmentResultsSection } from "./RecruitmentResultsSection";
import type { CaseDetailData } from "./case-detail-types";

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

interface RecruitmentTabProps {
  caseData: CaseDetailData;
  stageColor: string;
}

export function RecruitmentTab({ caseData, stageColor }: RecruitmentTabProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <RecruitmentSection
          data={{
            jobOrderStartDate: caseData.jobOrderStartDate,
            jobOrderEndDate: caseData.jobOrderEndDate,
            jobOrderState: caseData.jobOrderState,
            sundayAdFirstDate: caseData.sundayAdFirstDate,
            sundayAdSecondDate: caseData.sundayAdSecondDate,
            sundayAdNewspaper: caseData.sundayAdNewspaper,
            noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
            noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
            additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
            recruitmentApplicantsCount:
              caseData.recruitmentApplicantsCount !== undefined
                ? Number(caseData.recruitmentApplicantsCount)
                : undefined,
            recruitmentNotes: caseData.recruitmentNotes,
          }}
          defaultOpen={true}
          accentColor={caseData.caseStatus === "recruitment" ? stageColor : undefined}
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <RecruitmentResultsSection
          data={{
            employerName: caseData.employerName,
            noticeOfFilingStartDate: caseData.noticeOfFilingStartDate,
            noticeOfFilingEndDate: caseData.noticeOfFilingEndDate,
            jobOrderStartDate: caseData.jobOrderStartDate,
            jobOrderEndDate: caseData.jobOrderEndDate,
            jobOrderState: caseData.jobOrderState,
            sundayAdFirstDate: caseData.sundayAdFirstDate,
            sundayAdSecondDate: caseData.sundayAdSecondDate,
            sundayAdNewspaper: caseData.sundayAdNewspaper,
            additionalRecruitmentMethods: caseData.additionalRecruitmentMethods,
            additionalRecruitmentStartDate: caseData.additionalRecruitmentStartDate,
            additionalRecruitmentEndDate: caseData.additionalRecruitmentEndDate,
            isProfessionalOccupation: caseData.isProfessionalOccupation,
            pwdExpirationDate: caseData.pwdExpirationDate,
            recruitmentApplicantsCount:
              caseData.recruitmentApplicantsCount !== undefined
                ? Number(caseData.recruitmentApplicantsCount)
                : undefined,
            recruitmentNotes: caseData.recruitmentNotes,
            recruitmentSummaryCustom: caseData.recruitmentSummaryCustom,
          }}
          defaultOpen={true}
          readOnly={true}
          accentColor={caseData.caseStatus === "recruitment" ? stageColor : undefined}
        />
      </motion.div>
    </motion.div>
  );
}
