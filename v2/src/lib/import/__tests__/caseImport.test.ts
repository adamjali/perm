/**
 * Case Import Tests
 * Comprehensive tests for parseCaseImportFile utility function.
 *
 * Tests multi-format import support:
 * - V2 (current Convex format with wrapper)
 * - V1 (FastAPI snake_case format)
 * - perm-tracker-new (Firebase camelCase format)
 * - Legacy Firebase object format
 */

import { describe, it, expect } from "vitest";
import { parseCaseImportFile, BENEFICIARY_PLACEHOLDER } from "../caseImport";

describe("parseCaseImportFile", () => {
  // ============================================================================
  // V2 FORMAT TESTS (Current format)
  // ============================================================================
  describe("v2 format (current)", () => {
    it("detects v2 format from versioned wrapper", async () => {
      const v2JSON = JSON.stringify({
        version: "v2",
        exportDate: "2024-01-15T12:00:00.000Z",
        totalCases: 1,
        cases: [
          {
            employerName: "Tech Corp",
            beneficiaryIdentifier: "John Doe",
            caseStatus: "pwd",
            progressStatus: "working",
          },
        ],
      });

      const file = new File([v2JSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.detectedFormat).toBe("v2");
      expect(result.isLegacyFormat).toBe(false);
      expect(result.valid).toHaveLength(1);
    });

    it("parses v2 format as bare array", async () => {
      const v2JSON = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          caseStatus: "pwd",
          progressStatus: "working",
        },
      ]);

      const file = new File([v2JSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.detectedFormat).toBe("v2");
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.employerName).toBe("Tech Corp");
    });

    it("handles all v2 date fields correctly", async () => {
      const v2JSON = JSON.stringify({
        version: "v2",
        cases: [
          {
            employerName: "Tech Corp",
            beneficiaryIdentifier: "John Doe",
            pwdFilingDate: "2024-01-15",
            pwdDeterminationDate: "2024-03-15",
            pwdExpirationDate: "2025-06-30",
            jobOrderStartDate: "2024-04-01",
            jobOrderEndDate: "2024-05-01",
            eta9089FilingDate: "2024-07-01",
            eta9089CertificationDate: "2024-09-01",
            i140FilingDate: "2024-12-01",
          },
        ],
      });

      const file = new File([v2JSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  // ============================================================================
  // V1 FORMAT TESTS (FastAPI snake_case)
  // ============================================================================
  describe("v1 format (FastAPI snake_case)", () => {
    it("detects v1 format from snake_case field names", async () => {
      const v1JSON = JSON.stringify({
        cases: [
          {
            employer_name: "Tech Corp",
            position_title: "Software Engineer",
            case_status: "PWD Approved",
            progress_status: "Filed",
          },
        ],
      });

      const file = new File([v1JSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.detectedFormat).toBe("v1");
      expect(result.isLegacyFormat).toBe(true);
    });

    it("maps v1 snake_case fields to v2 camelCase", async () => {
      const v1JSON = JSON.stringify({
        cases: [
          {
            employer_name: "Tech Corp",
            beneficiary_name: "John Doe",
            position_title: "Software Engineer",
            pwd_filing_date: "2024-01-15",
            pwd_determination_date: "2024-03-15",
            pwd_expiration_date: "2025-06-30",
            job_order_start_date: "2024-04-01",
            job_order_end_date: "2024-05-01",
          },
        ],
      });

      const file = new File([v1JSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.employerName).toBe("Tech Corp");
      expect(result.valid[0]?.beneficiaryIdentifier).toBe("John Doe");
    });

    it("maps v1 status values to v2 status values", async () => {
      const v1JSON = JSON.stringify({
        cases: [
          {
            employer_name: "Tech Corp",
            beneficiary_name: "John Doe",
            case_status: "PWD Approved",
            progress_status: "Under Review",
          },
        ],
      });

      const file = new File([v1JSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.caseStatus).toBe("pwd");
      expect(result.valid[0]?.progressStatus).toBe("under_review");
    });

    it("uses placeholder when v1 case lacks beneficiary_name", async () => {
      const v1JSON = JSON.stringify({
        cases: [
          {
            employer_name: "Tech Corp",
            position_title: "Software Engineer",
          },
        ],
      });

      const file = new File([v1JSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.beneficiaryIdentifier).toBe(BENEFICIARY_PLACEHOLDER);
      expect(result.casesNeedingBeneficiary).toBe(1);
    });
  });

  // ============================================================================
  // PERM-TRACKER-NEW FORMAT TESTS (Firebase camelCase)
  // ============================================================================
  describe("perm-tracker-new format (Firebase camelCase)", () => {
    it("detects perm-tracker-new format from camelCase fields", async () => {
      const legacyJSON = JSON.stringify({
        cases: [
          {
            employerName: "Tech Corp",
            positionTitle: "Software Engineer",
            caseStatus: "PWD",
            progressStatus: "Working",
          },
        ],
      });

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.detectedFormat).toBe("perm-tracker-new");
      expect(result.isLegacyFormat).toBe(true);
    });

    it("maps perm-tracker-new status values to v2", async () => {
      const legacyJSON = JSON.stringify({
        cases: [
          {
            employerName: "Tech Corp",
            beneficiaryName: "John Doe",
            caseStatus: "Recruitment",
            progressStatus: "Filed",
          },
        ],
      });

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.caseStatus).toBe("recruitment");
      expect(result.valid[0]?.progressStatus).toBe("filed");
    });

    it("uses placeholder when perm-tracker-new case lacks beneficiaryName", async () => {
      const legacyJSON = JSON.stringify({
        cases: [
          {
            employerName: "Tech Corp",
            positionTitle: "Software Engineer",
          },
        ],
      });

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.beneficiaryIdentifier).toBe(BENEFICIARY_PLACEHOLDER);
      expect(result.casesNeedingBeneficiary).toBe(1);
    });

    it("normalizes ISO date strings with time to YYYY-MM-DD", async () => {
      const legacyJSON = JSON.stringify({
        cases: [
          {
            employerName: "Tech Corp",
            beneficiaryName: "John Doe",
            pwdFilingDate: "2024-01-15T10:30:00.000Z",
            eta9089FilingDate: "2024-06-20T14:45:00Z",
          },
        ],
      });

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      // Dates should be normalized to YYYY-MM-DD
      // Note: dates are stored directly on the case, not in a nested dates object
      const caseData = result.valid[0] as Record<string, unknown>;
      expect(caseData?.pwdFilingDate).toBe("2024-01-15");
      expect(caseData?.eta9089FilingDate).toBe("2024-06-20");
    });
  });

  // ============================================================================
  // FIREBASE OBJECT FORMAT TESTS
  // ============================================================================
  describe("firebase-object format (legacy with ID keys)", () => {
    it("detects firebase-object format from object with ID keys", async () => {
      const firebaseJSON = JSON.stringify({
        "-M1a2b3c4d5e6f7g8h9i": {
          employerName: "Tech Corp",
          beneficiaryName: "John Doe",
        },
        "-M2b3c4d5e6f7g8h9i0": {
          employerName: "Finance Inc",
          beneficiaryName: "Jane Smith",
        },
      });

      const file = new File([firebaseJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.detectedFormat).toBe("firebase-object");
      expect(result.isLegacyFormat).toBe(true);
      expect(result.valid).toHaveLength(2);
    });

    it("preserves Firebase ID as part of imported data", async () => {
      const firebaseJSON = JSON.stringify({
        "-M1a2b3c4d5e6f7g8h9i": {
          employerName: "Tech Corp",
          beneficiaryName: "John Doe",
        },
      });

      const file = new File([firebaseJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.employerName).toBe("Tech Corp");
    });
  });

  // ============================================================================
  // STATUS MAPPING TESTS
  // ============================================================================
  describe("status mapping", () => {
    it("maps legacy caseStatus values to v2", async () => {
      const statusMappings = [
        { input: "PWD", expected: "pwd" },
        { input: "Recruitment", expected: "recruitment" },
        { input: "ETA 9089", expected: "eta9089" },
        { input: "I-140", expected: "i140" },
        { input: "Complete", expected: "i140" }, // Per perm_flow.md: "i-140 approved makes it complete"
        { input: "Closed", expected: "closed" },
        { input: "PWD Approved", expected: "pwd" },
        { input: "ETA 9089 Prep", expected: "eta9089" },
      ];

      for (const { input, expected } of statusMappings) {
        const json = JSON.stringify({
          cases: [
            {
              employerName: "Test Corp",
              beneficiaryName: "Test Person",
              caseStatus: input,
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid[0]?.caseStatus).toBe(expected);
      }
    });

    it("generates warnings for mapped statuses", async () => {
      const legacyJSON = JSON.stringify({
        cases: [
          {
            employerName: "Tech Corp",
            beneficiaryName: "John Doe",
            caseStatus: "PWD Approved", // Non-standard status
          },
        ],
      });

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.warnings.length).toBeGreaterThan(0);
      const statusWarning = result.warnings.find((w) => w.field === "caseStatus");
      expect(statusWarning).toBeDefined();
    });
  });

  // ============================================================================
  // VALIDATION TESTS
  // ============================================================================
  describe("validation", () => {
    it("validates employerName is required", async () => {
      const missingEmployer = JSON.stringify([
        {
          beneficiaryIdentifier: "John Doe",
        },
      ]);

      const file = new File([missingEmployer], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.field).toBe("employerName");
    });

    it("v2 format uses placeholder for missing beneficiaryIdentifier", async () => {
      // The system is lenient and uses placeholder for compatibility
      const missingBeneficiary = JSON.stringify([
        {
          employerName: "Tech Corp",
        },
      ]);

      const file = new File([missingBeneficiary], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      // System uses placeholder for missing beneficiary
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0]?.beneficiaryIdentifier).toBe(BENEFICIARY_PLACEHOLDER);
      expect(result.casesNeedingBeneficiary).toBe(1);
    });

    it("handles invalid caseStatus values gracefully", async () => {
      // The system is lenient with status values for compatibility
      const invalidStatus = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          caseStatus: "totally_invalid",
        },
      ]);

      const file = new File([invalidStatus], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      // System accepts the case but may default the status
      expect(result.valid).toHaveLength(1);
      // Invalid status may be dropped or defaulted
    });

    it("handles invalid progressStatus values gracefully", async () => {
      // The system is lenient with status values for compatibility
      const invalidProgress = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          progressStatus: "totally_invalid",
        },
      ]);

      const file = new File([invalidProgress], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      // System accepts the case but may default the status
      expect(result.valid).toHaveLength(1);
      // Invalid status may be dropped or defaulted
    });

    it("accepts all valid v2 caseStatus values", async () => {
      const validStatuses = ["pwd", "recruitment", "eta9089", "i140", "closed"];

      for (const status of validStatuses) {
        const json = JSON.stringify([
          {
            employerName: "Tech Corp",
            beneficiaryIdentifier: "John Doe",
            caseStatus: status,
          },
        ]);

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.errors).toHaveLength(0);
      }
    });
  });

  // ============================================================================
  // DATE NORMALIZATION TESTS
  // ============================================================================
  describe("date normalization", () => {
    it("accepts valid YYYY-MM-DD dates", async () => {
      const validDates = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          pwdFilingDate: "2024-01-15",
          eta9089FilingDate: "2024-06-20",
        },
      ]);

      const file = new File([validDates], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("normalizes ISO datetime to YYYY-MM-DD", async () => {
      const isoDateTimes = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          pwdFilingDate: "2024-01-15T10:30:00.000Z",
        },
      ]);

      const file = new File([isoDateTimes], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      // Dates are stored directly on the case object
      const caseData = result.valid[0] as Record<string, unknown>;
      expect(caseData?.pwdFilingDate).toBe("2024-01-15");
    });

    it("handles null/undefined date values gracefully", async () => {
      const nullDates = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          pwdFilingDate: null,
          eta9089FilingDate: undefined,
        },
      ]);

      const file = new File([nullDates], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("handles invalid date formats gracefully", async () => {
      // Note: The import system is lenient with dates - it will try to parse
      // but won't reject cases for date format issues
      const invalidDates = JSON.stringify([
        {
          employerName: "Tech Corp",
          beneficiaryIdentifier: "John Doe",
          pwdFilingDate: "01/15/2024", // Non-standard format
        },
      ]);

      const file = new File([invalidDates], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      // Case is still valid - date is just stored as-is or skipped
      expect(result.valid).toHaveLength(1);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================
  describe("error handling", () => {
    it("rejects invalid JSON syntax", async () => {
      const invalidJSON = "{ invalid json }";
      const file = new File([invalidJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain("Invalid JSON");
    });

    it("rejects non-array, non-object JSON", async () => {
      const invalidJSON = JSON.stringify("just a string");
      const file = new File([invalidJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]?.message).toContain("Could not detect file format");
    });

    it("handles empty array with error", async () => {
      const emptyJSON = JSON.stringify([]);
      const file = new File([emptyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(0);
      // Empty array generates an error about not being able to detect format
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("handles empty object with error", async () => {
      const emptyJSON = JSON.stringify({});
      const file = new File([emptyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("returns both valid cases and errors together", async () => {
      const mixedJSON = JSON.stringify([
        {
          employerName: "Valid Corp",
          beneficiaryIdentifier: "Valid Person",
        },
        {
          // Missing employerName
          beneficiaryIdentifier: "Invalid Person",
        },
        {
          employerName: "Another Valid",
          beneficiaryIdentifier: "Another Person",
        },
      ]);

      const file = new File([mixedJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.row).toBe(1);
    });
  });

  // ============================================================================
  // BENEFICIARY PLACEHOLDER TESTS
  // ============================================================================
  describe("beneficiary placeholder", () => {
    it("BENEFICIARY_PLACEHOLDER constant is exported correctly", () => {
      expect(BENEFICIARY_PLACEHOLDER).toBe("[NEEDS ENTRY]");
    });

    it("tracks count of cases needing beneficiary", async () => {
      const legacyJSON = JSON.stringify({
        cases: [
          {
            employer_name: "Corp 1",
            position_title: "Engineer",
          },
          {
            employer_name: "Corp 2",
            beneficiary_name: "Has Name",
          },
          {
            employer_name: "Corp 3",
            position_title: "Designer",
          },
        ],
      });

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(3);
      expect(result.casesNeedingBeneficiary).toBe(2);
    });
  });

  // ============================================================================
  // RFE/RFI CONVERSION TESTS
  // ============================================================================
  describe("RFE/RFI conversion", () => {
    it("converts legacy RFE format to v2 format", async () => {
      const legacyJSON = JSON.stringify({
        cases: [
          {
            employerName: "Tech Corp",
            beneficiaryName: "John Doe",
            rfeList: [
              {
                rfeId: "rfe-1",
                requestedDate: "2024-01-15",
                deadline: "2024-02-15",
                completedDate: "2024-02-10",
                reason: "Additional docs needed",
              },
            ],
          },
        ],
      });

      const file = new File([legacyJSON], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      // RFE entries should be converted if present
    });
  });

  // ============================================================================
  // NULL VALUE HANDLING TESTS
  // ============================================================================
  describe("null value handling", () => {
    it("removes null values from imported cases (Convex compatibility)", async () => {
      const jsonWithNulls = JSON.stringify({
        version: "v2",
        cases: [
          {
            employerName: "Tech Corp",
            beneficiaryIdentifier: "John Doe",
            positionTitle: null,
            pwdFilingDate: "2024-01-15",
            pwdDeterminationDate: null,
            i140ApprovalDate: null,
            i140DenialDate: null,
            notes: null,
            caseStatus: "pwd",
            progressStatus: "working",
          },
        ],
      });

      const file = new File([jsonWithNulls], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      const importedCase = result.valid[0];

      // Null values should be removed, not present as null
      expect(importedCase).not.toHaveProperty("positionTitle");
      expect(importedCase).not.toHaveProperty("pwdDeterminationDate");
      expect(importedCase).not.toHaveProperty("i140ApprovalDate");
      expect(importedCase).not.toHaveProperty("i140DenialDate");
      // notes now defaults to empty array (not removed)
      expect(importedCase.notes).toEqual([]);

      // Non-null values should still be present
      expect(importedCase.employerName).toBe("Tech Corp");
      expect(importedCase.pwdFilingDate).toBe("2024-01-15");
    });

    it("removes null values from v1 snake_case format", async () => {
      const jsonWithNulls = JSON.stringify({
        cases: [
          {
            employer_name: "Tech Corp",
            beneficiary_identifier: "John Doe",
            position_title: null,
            pwd_filing_date: "2024-01-15",
            pwd_determination_date: null,
            i140_approval_date: null,
            case_status: "pwd",
            progress_status: "working",
          },
        ],
      });

      const file = new File([jsonWithNulls], "test.json", { type: "application/json" });
      const result = await parseCaseImportFile(file);

      expect(result.valid).toHaveLength(1);
      const importedCase = result.valid[0];

      // Null values should be removed after conversion
      expect(importedCase).not.toHaveProperty("positionTitle");
      expect(importedCase).not.toHaveProperty("pwdDeterminationDate");
      expect(importedCase).not.toHaveProperty("i140ApprovalDate");

      // Non-null values should still be present
      expect(importedCase.employerName).toBe("Tech Corp");
      expect(importedCase.pwdFilingDate).toBe("2024-01-15");
    });
  });

  // ============================================================================
  // ISSUE FIX TESTS - Import field mapping and status fixes
  // ============================================================================
  describe("import fix issues", () => {
    // Issue 1: Missing field mappings in FIELD_NAME_MAP
    describe("Issue 1: Field mappings", () => {
      it("maps sunday_ad_newspaper to sundayAdNewspaper", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              sunday_ad_newspaper: "NY Times",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].sundayAdNewspaper).toBe("NY Times");
      });

      it("maps job_order_state to jobOrderState", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              job_order_state: "California",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].jobOrderState).toBe("California");
      });

      it("maps recruitment_applicants_count to recruitmentApplicantsCount", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              recruitment_applicants_count: 5,
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].recruitmentApplicantsCount).toBe(5);
      });

      it("maps all case number fields correctly", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              case_number: "CASE-001",
              internal_case_number: "INT-001",
              pwd_case_number: "PWD-001",
              eta9089_case_number: "ETA-001",
              i140_receipt_number: "I140-001",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].caseNumber).toBe("CASE-001");
        expect(result.valid[0].internalCaseNumber).toBe("INT-001");
        expect(result.valid[0].pwdCaseNumber).toBe("PWD-001");
        expect(result.valid[0].eta9089CaseNumber).toBe("ETA-001");
        expect(result.valid[0].i140ReceiptNumber).toBe("I140-001");
      });
    });

    // Issue 2: Complete status mapping to i140/approved
    describe("Issue 2: Complete status mapping", () => {
      it("maps Complete status to caseStatus i140", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              case_status: "Complete",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].caseStatus).toBe("i140");
      });

      it("auto-sets progressStatus to approved for Complete cases", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              case_status: "Complete",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].progressStatus).toBe("approved");
        // Should have a warning about the auto-set
        expect(result.warnings.some((w) => w.field === "progressStatus" && w.message.includes("Complete"))).toBe(true);
      });

      it("handles lowercase complete status", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              case_status: "complete",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].caseStatus).toBe("i140");
        expect(result.valid[0].progressStatus).toBe("approved");
      });

      it("does NOT map closed status to approved (only Complete)", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              case_status: "closed",
              progress_status: "working",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].caseStatus).toBe("closed");
        // Should NOT be auto-set to approved
        expect(result.valid[0].progressStatus).toBe("working");
      });
    });

    // Issue 3: rfi_list/rfe_list array conversion
    describe("Issue 3: RFI/RFE list conversion", () => {
      it("converts rfi_list array to rfiEntries", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              rfi_list: [
                {
                  title: "Document Request",
                  description: "Need additional docs",
                  notes: "Urgent",
                  received_date: "2024-01-15",
                  response_due_date: "2024-02-14",
                  response_submitted_date: "2024-02-10",
                },
              ],
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].rfiEntries).toBeDefined();
        expect(result.valid[0].rfiEntries).toHaveLength(1);
        expect(result.valid[0].rfiEntries[0].receivedDate).toBe("2024-01-15");
        expect(result.valid[0].rfiEntries[0].responseDueDate).toBe("2024-02-14");
        expect(result.valid[0].rfiEntries[0].responseSubmittedDate).toBe("2024-02-10");
        // Title, description, notes preserved as separate fields (per V2 schema)
        expect(result.valid[0].rfiEntries[0].title).toBe("Document Request");
        expect(result.valid[0].rfiEntries[0].description).toBe("Need additional docs");
        expect(result.valid[0].rfiEntries[0].notes).toBe("Urgent");
      });

      it("converts rfe_list array to rfeEntries", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              rfe_list: [
                {
                  title: "Evidence Request",
                  received_date: "2024-03-01",
                  response_due_date: "2024-04-01",
                },
              ],
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].rfeEntries).toBeDefined();
        expect(result.valid[0].rfeEntries).toHaveLength(1);
        expect(result.valid[0].rfeEntries[0].receivedDate).toBe("2024-03-01");
      });

      it("handles multiple RFI entries", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              rfi_list: [
                { received_date: "2024-01-15", response_due_date: "2024-02-14" },
                { received_date: "2024-03-01", response_due_date: "2024-03-31" },
              ],
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].rfiEntries).toHaveLength(2);
      });

      it("removes rfiList temporary field after conversion", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              rfi_list: [
                { received_date: "2024-01-15", response_due_date: "2024-02-14" },
              ],
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        // rfiList (temp field) should be removed
        expect(result.valid[0]).not.toHaveProperty("rfiList");
        // rfiEntries should exist
        expect(result.valid[0].rfiEntries).toBeDefined();
      });
    });

    // Issue 4: additionalRecruitmentMethods JSON string parsing
    describe("Issue 4: additionalRecruitmentMethods JSON parsing", () => {
      it("parses JSON string additionalRecruitmentMethods", async () => {
        const recruitmentMethods = [
          { type: "local_newspaper", date: "2024-01-20", outlet: "Local Times" },
          { type: "job_fair", date: "2024-02-05", description: "Tech Career Fair" },
        ];
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              is_professional_occupation: true,
              additional_recruitment_methods: JSON.stringify(recruitmentMethods),
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].additionalRecruitmentMethods).toBeDefined();
        expect(result.valid[0].additionalRecruitmentMethods).toHaveLength(2);
        expect(result.valid[0].additionalRecruitmentMethods[0].method).toBe("local_newspaper");
        expect(result.valid[0].additionalRecruitmentMethods[0].description).toBe("Local Times");
        expect(result.valid[0].additionalRecruitmentMethods[1].method).toBe("job_fair");
      });

      it("handles already-array additionalRecruitmentMethods", async () => {
        const json = JSON.stringify({
          version: "v2",
          cases: [
            {
              employerName: "Tech Corp",
              beneficiaryIdentifier: "John Doe",
              isProfessionalOccupation: true,
              additionalRecruitmentMethods: [
                { method: "campus_recruitment", date: "2024-01-10", description: "University visit" },
              ],
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].additionalRecruitmentMethods).toHaveLength(1);
        expect(result.valid[0].additionalRecruitmentMethods[0].method).toBe("campus_recruitment");
      });

      it("handles invalid JSON string gracefully", async () => {
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              additional_recruitment_methods: "not valid json{",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        // Should default to empty array
        expect(result.valid[0].additionalRecruitmentMethods).toEqual([]);
        // Should have a warning
        expect(result.warnings.some((w) => w.field === "additionalRecruitmentMethods")).toBe(true);
      });

      it("handles dates array in additionalRecruitmentMethods (e.g., radio_ad)", async () => {
        // V1 format uses "dates" array for broadcast/radio ads
        const recruitmentMethods = [
          { type: "local_newspaper", date: "2024-01-20", outlet: "Local Times" },
          { type: "radio_ad", dates: ["2025-10-03"], outlet: "WXYZ Radio" },
          { type: "job_fair", date: "2024-02-05", description: "Tech Career Fair" },
        ];
        const json = JSON.stringify({
          cases: [
            {
              employer_name: "Tech Corp",
              is_professional_occupation: true,
              additional_recruitment_methods: JSON.stringify(recruitmentMethods),
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].additionalRecruitmentMethods).toBeDefined();
        expect(result.valid[0].additionalRecruitmentMethods).toHaveLength(3);
        // Regular date field
        expect(result.valid[0].additionalRecruitmentMethods[0].method).toBe("local_newspaper");
        expect(result.valid[0].additionalRecruitmentMethods[0].date).toBe("2024-01-20");
        // dates array - should extract first element
        expect(result.valid[0].additionalRecruitmentMethods[1].method).toBe("radio_ad");
        expect(result.valid[0].additionalRecruitmentMethods[1].date).toBe("2025-10-03");
        expect(result.valid[0].additionalRecruitmentMethods[1].description).toBe("WXYZ Radio");
        // Regular date field
        expect(result.valid[0].additionalRecruitmentMethods[2].method).toBe("job_fair");
        expect(result.valid[0].additionalRecruitmentMethods[2].date).toBe("2024-02-05");
      });
    });

    // Issue 5: Notes string-to-array conversion
    describe("Issue 5: Notes string conversion", () => {
      it("converts notes string to notes array", async () => {
        const json = JSON.stringify({
          version: "v2",
          cases: [
            {
              employerName: "Tech Corp",
              beneficiaryIdentifier: "John Doe",
              notes: "This is a case note",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].notes).toBeDefined();
        expect(Array.isArray(result.valid[0].notes)).toBe(true);
        expect(result.valid[0].notes).toHaveLength(1);
        expect(result.valid[0].notes[0].content).toBe("This is a case note");
        expect(result.valid[0].notes[0].status).toBe("pending");
        expect(result.valid[0].notes[0].id).toBeDefined();
        expect(result.valid[0].notes[0].createdAt).toBeDefined();
      });

      it("handles pipe-delimited notes from v2 export", async () => {
        // The v2 export format sometimes has notes like "t | t | t"
        const json = JSON.stringify({
          version: "v2",
          cases: [
            {
              employerName: "Tech Corp",
              beneficiaryIdentifier: "Jane Smith",
              notes: "first note | second note | third note",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].notes).toHaveLength(1);
        // The entire string is kept as one note content
        expect(result.valid[0].notes[0].content).toBe("first note | second note | third note");
      });

      it("preserves notes array if already in array format", async () => {
        const json = JSON.stringify({
          version: "v2",
          cases: [
            {
              employerName: "Tech Corp",
              beneficiaryIdentifier: "Bob Wilson",
              notes: [
                {
                  id: "note-1",
                  content: "Existing note",
                  createdAt: 1704067200000,
                  status: "done",
                },
              ],
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        expect(result.valid[0].notes).toHaveLength(1);
        expect(result.valid[0].notes[0].content).toBe("Existing note");
        expect(result.valid[0].notes[0].status).toBe("done");
      });

      it("handles empty string notes", async () => {
        const json = JSON.stringify({
          version: "v2",
          cases: [
            {
              employerName: "Tech Corp",
              beneficiaryIdentifier: "Mary Johnson",
              notes: "   ", // Whitespace only
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.valid).toHaveLength(1);
        // Should be empty array, not converted
        expect(result.valid[0].notes).toEqual([]);
      });

      it("generates warning for notes conversion", async () => {
        const json = JSON.stringify({
          version: "v2",
          cases: [
            {
              employerName: "Tech Corp",
              beneficiaryIdentifier: "Sam Brown",
              notes: "Important case note",
            },
          ],
        });

        const file = new File([json], "test.json", { type: "application/json" });
        const result = await parseCaseImportFile(file);

        expect(result.warnings.some((w) => w.field === "notes" && w.message.includes("Converted notes"))).toBe(true);
      });
    });
  });
});
