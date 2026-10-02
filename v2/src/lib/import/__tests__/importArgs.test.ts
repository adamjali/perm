import { describe, it, expect } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { buildFullCasesJSON, type FullCaseData } from "@/lib/export/caseExport";
import { parseCaseImportFile } from "../caseImport";
import { toImportCaseArgs } from "../importArgs";

/**
 * An export read back through the import keeps every field, except the ones
 * the server works out again or that belong to the account it came from.
 */
const SERVER_WORKS_OUT = new Set([
  "_id",
  "recruitmentStartDate",
  "recruitmentEndDate",
  "filingWindowOpens",
  "filingWindowCloses",
  "recruitmentWindowCloses",
  "documents",
  "closureReason",
  "closedAt",
  "createdAt",
  "updatedAt",
]);

const FULL: FullCaseData = {
  _id: "case123" as Id<"cases">,
  _creationTime: 1,
  caseNumber: "C-1",
  internalCaseNumber: "INT-1",
  employerName: "Acme Corp",
  employerFein: "12-3456789",
  beneficiaryIdentifier: "A. B.",
  positionTitle: "Engineer",
  jobTitle: "Senior Engineer",
  socCode: "15-1252",
  socTitle: "Software Developers",
  jobOrderState: "CA",
  jobDescriptionPositionTitle: "Senior Engineer",
  jobDescription: "Design and build data pipelines.",
  caseStatus: "eta9089",
  progressStatus: "filed",
  progressStatusOverride: true,
  pwdFilingDate: "2025-09-02",
  pwdDeterminationDate: "2025-11-18",
  pwdExpirationDate: "2026-06-30",
  pwdCaseNumber: "P-100-25245-000001",
  pwdWageAmount: 128410,
  pwdWageLevel: "Level III",
  jobOrderStartDate: "2026-01-12",
  jobOrderEndDate: "2026-02-11",
  sundayAdFirstDate: "2026-01-18",
  sundayAdSecondDate: "2026-01-25",
  sundayAdNewspaper: "The Daily",
  additionalRecruitmentStartDate: "2026-01-15",
  additionalRecruitmentEndDate: "2026-02-10",
  additionalRecruitmentMethods: [{ method: "job_fair", date: "2026-02-01", description: "Campus fair" }],
  recruitmentNotes: "Two applicants, both rejected for lawful reasons.",
  recruitmentApplicantsCount: 2,
  recruitmentSummaryCustom: "Summary text.",
  isProfessionalOccupation: true,
  noticeOfFilingStartDate: "2026-01-12",
  noticeOfFilingEndDate: "2026-01-26",
  eta9089FilingDate: "2026-03-20",
  eta9089AuditDate: "2026-05-01",
  eta9089CertificationDate: "2026-08-01",
  eta9089ExpirationDate: "2027-01-27",
  eta9089CaseNumber: "G-100-26079-000001",
  rfiEntries: [
    { id: "rfi1", title: "RFI", receivedDate: "2026-09-08", responseDueDate: "2026-10-08", createdAt: 5 },
  ],
  rfeEntries: [],
  i140FilingDate: "2026-09-01",
  i140ReceiptDate: "2026-09-03",
  i140ReceiptNumber: "IOE0912345678",
  i140ApprovalDate: undefined,
  i140DenialDate: undefined,
  i140Category: "EB-2",
  i140PremiumProcessing: true,
  i140ServiceCenter: "Nebraska",
  priorityLevel: "high",
  isFavorite: true,
  isPinned: true,
  notes: [{ id: "n1", content: "Call the employer", createdAt: 7, status: "pending" }],
  tags: ["priority"],
  calendarSyncEnabled: true,
  showOnTimeline: true,
  documents: [],
  createdAt: 1,
  updatedAt: 2,
};

describe("an export read back through the import", () => {
  it("keeps every field the server doesn't work out again", async () => {
    const json = buildFullCasesJSON([FULL]);
    const exported = (JSON.parse(json) as { cases: Record<string, unknown>[] }).cases[0]!;
    const parsed = await parseCaseImportFile(new File([json], "perm-cases.json", { type: "application/json" }));
    expect(parsed.valid).toHaveLength(1);

    const args = toImportCaseArgs(parsed.valid[0] as Record<string, unknown>) as Record<string, unknown>;
    const lost = Object.keys(exported)
      .filter((k) => !SERVER_WORKS_OUT.has(k) && exported[k] !== undefined)
      .filter((k) => JSON.stringify(args[k]) !== JSON.stringify(exported[k]));
    expect(lost).toEqual([]);
  });
});
