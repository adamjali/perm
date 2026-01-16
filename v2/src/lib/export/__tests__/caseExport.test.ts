/**
 * Tests for Case Export Utilities
 * Test FIRST approach - define expected behavior before implementation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  exportCasesCSV,
  exportCasesJSON,
  exportFullCasesJSON,
  exportFullCasesCSV,
  EXPORT_VERSION,
} from "../caseExport";
import type { CaseCardData } from "../../../../convex/lib/caseListTypes";
import type { FullCaseData } from "../caseExport";

// ============================================================================
// MOCKS
// ============================================================================

// Mock document.createElement and related DOM APIs
const mockAnchor = {
  href: "",
  download: "",
  click: vi.fn(),
};

const originalCreateElement = document.createElement;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalAppendChild = document.body.appendChild;
const originalRemoveChild = document.body.removeChild;

beforeEach(() => {
  // Mock createElement to return our mock anchor
  document.createElement = vi.fn((tagName: string) => {
    if (tagName === "a") {
      return mockAnchor as any;
    }
    return originalCreateElement.call(document, tagName);
  });

  // Mock URL methods
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();

  // Mock appendChild/removeChild
  document.body.appendChild = vi.fn();
  document.body.removeChild = vi.fn();
});

afterEach(() => {
  // Restore originals
  document.createElement = originalCreateElement;
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
  document.body.appendChild = originalAppendChild;
  document.body.removeChild = originalRemoveChild;

  // Reset mock state
  vi.clearAllMocks();
  mockAnchor.href = "";
  mockAnchor.download = "";
});

// ============================================================================
// TEST DATA
// ============================================================================

const mockCaseData: CaseCardData = {
  _id: "case1" as any,
  employerName: "Tech Corp",
  beneficiaryIdentifier: "John Doe - Software Engineer",
  caseStatus: "pwd",
  progressStatus: "on_track",
  nextDeadline: "2025-02-15",
  nextDeadlineLabel: "PWD expires",
  isFavorite: true,
  isProfessionalOccupation: true,
  hasActiveRfi: false,
  hasActiveRfe: false,
  calendarSyncEnabled: true,
  notes: "Initial filing notes",
  dates: {
    pwdFiled: "2024-12-01",
    pwdDetermined: "2024-12-15",
    pwdExpires: "2025-02-15",
    created: 1733000000000,
    updated: 1733500000000,
  },
} as CaseCardData;

const mockCaseWithNulls: CaseCardData = {
  _id: "case2" as any,
  employerName: "Startup Inc",
  beneficiaryIdentifier: "Jane Smith - Designer",
  caseStatus: "recruitment",
  progressStatus: "at_risk",
  isFavorite: false,
  dates: {
    created: 1733000000000,
    updated: 1733500000000,
  },
} as CaseCardData;

const mockCaseWithSpecialChars: CaseCardData = {
  _id: "case3" as any,
  employerName: 'Company "Quotes" LLC',
  beneficiaryIdentifier: "Smith, Jane\nMultiline",
  caseStatus: "eta9089",
  progressStatus: "blocked",
  isFavorite: false,
  notes: "Notes with, commas\nand newlines",
  dates: {
    created: 1733000000000,
    updated: 1733500000000,
  },
} as CaseCardData;

// ============================================================================
// CSV EXPORT TESTS
// ============================================================================

describe("exportCasesCSV", () => {
  it("should produce valid CSV format with header row", async () => {
    exportCasesCSV([mockCaseData]);

    // Verify Blob was created with CSV content
    const createCall = (URL.createObjectURL as any).mock.calls[0];
    expect(createCall).toBeDefined();

    const blob = createCall[0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");

    const csvContent = await blob.text();
    const lines = csvContent.split("\n");

    // First line should be header
    const header = lines[0];
    expect(header).toContain("_id");
    expect(header).toContain("employerName");
    expect(header).toContain("beneficiaryIdentifier");
    expect(header).toContain("caseStatus");
    expect(header).toContain("progressStatus");
    expect(header).toContain("pwdFilingDate");
    expect(header).toContain("isProfessionalOccupation");
    expect(header).toContain("isFavorite");
    expect(header).toContain("calendarSyncEnabled");
  });

  it("should format dates as YYYY-MM-DD", async () => {
    exportCasesCSV([mockCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();
    const lines = csvContent.split("\n");
    const dataLine = lines[1];

    expect(dataLine).toContain("2024-12-01"); // pwdFiled
    expect(dataLine).toContain("2024-12-15"); // pwdDetermined
    expect(dataLine).toContain("2025-02-15"); // pwdExpires
  });

  it("should escape special characters (commas, quotes, newlines)", async () => {
    exportCasesCSV([mockCaseWithSpecialChars]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();

    // Quotes should be escaped
    expect(csvContent).toContain('"Company ""Quotes"" LLC"');

    // Newlines should be within quotes (beneficiaryIdentifier field)
    expect(csvContent).toContain('"Smith, Jane\nMultiline"');
  });

  it("should handle empty/null values correctly", async () => {
    exportCasesCSV([mockCaseWithNulls]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();
    const lines = csvContent.split("\n");
    const dataLine = lines[1];

    // Empty values should be represented as empty fields
    expect(dataLine).toMatch(/,,/); // Adjacent commas indicate empty fields
  });

  it("should include current date in filename (perm-cases-YYYY-MM-DD.csv)", () => {
    exportCasesCSV([mockCaseData]);

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const expectedFilename = `perm-cases-${dateStr}.csv`;

    expect(mockAnchor.download).toBe(expectedFilename);
  });

  it("should produce header-only CSV when array is empty", async () => {
    exportCasesCSV([]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();
    const lines = csvContent.trim().split("\n");

    // Should have only header line
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("_id");
  });

  it("should trigger download with correct Blob", () => {
    exportCasesCSV([mockCaseData]);

    // Verify download flow
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("should export multiple cases correctly", async () => {
    exportCasesCSV([mockCaseData, mockCaseWithNulls, mockCaseWithSpecialChars]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();

    // Should contain all 3 case IDs
    expect(csvContent).toContain("case1");
    expect(csvContent).toContain("case2");
    expect(csvContent).toContain("case3");
  });

  it("should throw error when download fails", () => {
    // Mock URL.createObjectURL to throw an error
    URL.createObjectURL = vi.fn(() => {
      throw new Error("Browser blocked download");
    });

    expect(() => exportCasesCSV([mockCaseData])).toThrow(
      "Failed to initiate download. Please check your browser settings and try again."
    );
  });
});

// ============================================================================
// JSON EXPORT TESTS
// ============================================================================

describe("exportCasesJSON", () => {
  it("should produce valid JSON format with versioned wrapper", async () => {
    exportCasesJSON([mockCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json;charset=utf-8");

    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);

    // Legacy JSON export uses versioned wrapper
    expect(parsed.version).toBe(EXPORT_VERSION);
    expect(Array.isArray(parsed.cases)).toBe(true);
    expect(parsed.cases.length).toBe(1);
    expect(parsed.cases[0]._id).toBe("case1");
  });

  it("should format dates as YYYY-MM-DD strings", async () => {
    exportCasesJSON([mockCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);
    const exportedCase = parsed.cases[0];

    // Dates are flattened from CaseCardData.dates to flat fields
    expect(exportedCase.pwdFilingDate).toBe("2024-12-01");
    expect(exportedCase.pwdDeterminationDate).toBe("2024-12-15");
    expect(exportedCase.pwdExpirationDate).toBe("2025-02-15");
  });

  it("should include current date in filename (perm-cases-YYYY-MM-DD.json)", () => {
    exportCasesJSON([mockCaseData]);

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const expectedFilename = `perm-cases-${dateStr}.json`;

    expect(mockAnchor.download).toBe(expectedFilename);
  });

  it("should produce empty cases array in wrapper when input is empty", async () => {
    exportCasesJSON([]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);

    // Uses versioned wrapper even for empty export
    expect(parsed.version).toBe(EXPORT_VERSION);
    expect(Array.isArray(parsed.cases)).toBe(true);
    expect(parsed.cases.length).toBe(0);
  });

  it("should trigger download with correct Blob", () => {
    exportCasesJSON([mockCaseData]);

    // Verify download flow
    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("should pretty-print JSON with proper indentation", async () => {
    exportCasesJSON([mockCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const jsonContent = await blob.text();

    // Pretty-printed JSON should have newlines and indentation
    expect(jsonContent).toContain("\n");
    expect(jsonContent).toContain("  "); // 2-space indent
  });

  it("should throw error when download fails", () => {
    // Mock URL.createObjectURL to throw an error
    URL.createObjectURL = vi.fn(() => {
      throw new Error("Browser blocked download");
    });

    expect(() => exportCasesJSON([mockCaseData])).toThrow(
      "Failed to initiate download. Please check your browser settings and try again."
    );
  });
});

// ============================================================================
// FULL CASE DATA TEST FIXTURES
// ============================================================================

const mockFullCaseData: FullCaseData = {
  _id: "case_full_1" as any,
  _creationTime: 1733000000000,
  employerName: "Tech Corp",
  beneficiaryIdentifier: "John Doe - Software Engineer",
  positionTitle: "Software Engineer",
  caseStatus: "pwd",
  progressStatus: "on_track",
  isProfessionalOccupation: true,
  isFavorite: true,
  calendarSyncEnabled: true,
  priorityLevel: "high",
  tags: ["priority", "tech"],
  pwdFilingDate: "2024-12-01",
  pwdDeterminationDate: "2024-12-15",
  pwdExpirationDate: "2025-06-30",
  pwdWageAmount: 85000,
  pwdWageLevel: "Level 2",
  recruitmentApplicantsCount: 5,
  additionalRecruitmentMethods: [
    { method: "job_fair", date: "2024-12-20", description: "Tech Job Fair" },
  ],
  documents: [
    {
      id: "doc1",
      name: "resume.pdf",
      url: "https://example.com/resume.pdf",
      mimeType: "application/pdf",
      size: 1024000,
      uploadedAt: 1733000000000,
    },
  ],
  notes: [
    {
      id: "note1",
      content: "Initial filing notes",
      createdAt: 1733000000000,
      status: "pending",
      priority: "high",
      category: "follow-up",
    },
  ],
  createdAt: 1733000000000,
  updatedAt: 1733500000000,
};

const mockFullCaseWithLargeValues: FullCaseData = {
  _id: "case_large_values_test" as any,
  _creationTime: 1733000000000,
  employerName: "Large Values Test Corp",
  beneficiaryIdentifier: "Jane Smith",
  positionTitle: "Data Scientist",
  caseStatus: "recruitment",
  progressStatus: "in_progress",
  isProfessionalOccupation: true,
  isFavorite: false,
  calendarSyncEnabled: false,
  priorityLevel: "normal",
  tags: [],
  pwdWageAmount: 9007199254740991, // Max safe integer
  recruitmentApplicantsCount: 100,
  additionalRecruitmentMethods: [],
  documents: [
    {
      id: "doc2",
      name: "large-file.zip",
      url: "https://example.com/large.zip",
      mimeType: "application/zip",
      size: 5368709120, // 5GB
      uploadedAt: 1733000000000,
    },
  ],
  createdAt: 1733000000000,
  updatedAt: 1733500000000,
};

const mockFullCaseMinimal: FullCaseData = {
  _id: "case_minimal" as any,
  _creationTime: 1733000000000,
  employerName: "Minimal Corp",
  beneficiaryIdentifier: "Bob",
  positionTitle: "Analyst",
  caseStatus: "eta9089",
  progressStatus: "blocked",
  isProfessionalOccupation: false,
  isFavorite: false,
  calendarSyncEnabled: false,
  priorityLevel: "low",
  tags: [],
  recruitmentApplicantsCount: 0,
  additionalRecruitmentMethods: [],
  documents: [],
  createdAt: 1733000000000,
  updatedAt: 1733000000000,
};

// ============================================================================
// FULL CASE JSON EXPORT TESTS
// ============================================================================

describe("exportFullCasesJSON", () => {
  it("should produce versioned JSON wrapper with metadata", async () => {
    exportFullCasesJSON([mockFullCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/json;charset=utf-8");

    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);

    // Check wrapper structure
    expect(parsed.version).toBe(EXPORT_VERSION);
    expect(parsed.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(parsed.totalCases).toBe(1);
    expect(Array.isArray(parsed.cases)).toBe(true);
    expect(parsed.cases.length).toBe(1);
  });

  it("should convert BigInt fields to numbers", async () => {
    exportFullCasesJSON([mockFullCaseWithLargeValues]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);
    const exportedCase = parsed.cases[0];

    // BigInt should be converted to number
    expect(typeof exportedCase.pwdWageAmount).toBe("number");
    expect(exportedCase.pwdWageAmount).toBe(9007199254740991);

    expect(typeof exportedCase.recruitmentApplicantsCount).toBe("number");
    expect(exportedCase.recruitmentApplicantsCount).toBe(100);

    // Document size should also be converted
    expect(typeof exportedCase.documents[0].size).toBe("number");
    expect(exportedCase.documents[0].size).toBe(5368709120);
  });

  it("should include all case fields in export", async () => {
    exportFullCasesJSON([mockFullCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);
    const exportedCase = parsed.cases[0];

    // Core identity
    expect(exportedCase._id).toBe("case_full_1");

    // Employer/beneficiary
    expect(exportedCase.employerName).toBe("Tech Corp");
    expect(exportedCase.beneficiaryIdentifier).toBe("John Doe - Software Engineer");
    expect(exportedCase.positionTitle).toBe("Software Engineer");

    // Status fields
    expect(exportedCase.caseStatus).toBe("pwd");
    expect(exportedCase.progressStatus).toBe("on_track");

    // PWD dates
    expect(exportedCase.pwdFilingDate).toBe("2024-12-01");
    expect(exportedCase.pwdDeterminationDate).toBe("2024-12-15");
    expect(exportedCase.pwdExpirationDate).toBe("2025-06-30");
    expect(exportedCase.pwdWageLevel).toBe("Level 2");

    // Arrays
    expect(exportedCase.tags).toContain("priority");
    expect(exportedCase.additionalRecruitmentMethods.length).toBe(1);
    expect(exportedCase.documents.length).toBe(1);
    expect(exportedCase.notes.length).toBe(1);

    // Metadata
    expect(exportedCase.isFavorite).toBe(true);
    expect(exportedCase.isProfessionalOccupation).toBe(true);
    expect(exportedCase.calendarSyncEnabled).toBe(true);
  });

  it("should handle empty cases array with versioned wrapper", async () => {
    exportFullCasesJSON([]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);

    expect(parsed.version).toBe(EXPORT_VERSION);
    expect(parsed.totalCases).toBe(0);
    expect(parsed.cases).toEqual([]);
  });

  it("should export multiple cases correctly", async () => {
    exportFullCasesJSON([mockFullCaseData, mockFullCaseWithLargeValues, mockFullCaseMinimal]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const jsonContent = await blob.text();
    const parsed = JSON.parse(jsonContent);

    expect(parsed.totalCases).toBe(3);
    expect(parsed.cases.length).toBe(3);

    const ids = parsed.cases.map((c: any) => c._id);
    expect(ids).toContain("case_full_1");
    expect(ids).toContain("case_large_values_test");
    expect(ids).toContain("case_minimal");
  });

  it("should include correct filename with date", () => {
    exportFullCasesJSON([mockFullCaseData]);

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const expectedFilename = `perm-cases-${dateStr}.json`;

    expect(mockAnchor.download).toBe(expectedFilename);
  });

  it("should trigger download correctly", () => {
    exportFullCasesJSON([mockFullCaseData]);

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("should throw error when download fails", () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error("Browser blocked download");
    });

    expect(() => exportFullCasesJSON([mockFullCaseData])).toThrow(
      "Failed to initiate download. Please check your browser settings and try again."
    );
  });
});

// ============================================================================
// FULL CASE CSV EXPORT TESTS
// ============================================================================

describe("exportFullCasesCSV", () => {
  it("should produce valid CSV with comprehensive header", async () => {
    exportFullCasesCSV([mockFullCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("text/csv;charset=utf-8");

    const csvContent = await blob.text();
    const lines = csvContent.split("\n");
    const header = lines[0];

    // Check key headers are present
    expect(header).toContain("_id");
    expect(header).toContain("employerName");
    expect(header).toContain("beneficiaryIdentifier");
    expect(header).toContain("positionTitle");
    expect(header).toContain("caseStatus");
    expect(header).toContain("progressStatus");
    expect(header).toContain("pwdFilingDate");
    expect(header).toContain("pwdWageAmount");
    expect(header).toContain("isProfessionalOccupation");
    expect(header).toContain("eta9089FilingDate");
    expect(header).toContain("i140FilingDate");
  });

  it("should convert BigInt fields to numbers in CSV", async () => {
    exportFullCasesCSV([mockFullCaseWithLargeValues]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();

    // BigInt values should appear as numbers
    expect(csvContent).toContain("9007199254740991");
    expect(csvContent).toContain("100");

    // Should NOT contain BigInt notation (n suffix)
    expect(csvContent).not.toMatch(/\d+n/);
  });

  it("should include all case data in row", async () => {
    exportFullCasesCSV([mockFullCaseData]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();
    const lines = csvContent.split("\n");
    const dataLine = lines[1];

    // Core fields
    expect(dataLine).toContain("case_full_1");
    expect(dataLine).toContain("Tech Corp");
    expect(dataLine).toContain("Software Engineer");

    // Dates
    expect(dataLine).toContain("2024-12-01");
    expect(dataLine).toContain("2024-12-15");
    expect(dataLine).toContain("2025-06-30");

    // Boolean values
    expect(dataLine).toMatch(/true/i);
  });

  it("should produce header-only CSV when array is empty", async () => {
    exportFullCasesCSV([]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();
    const lines = csvContent.trim().split("\n");

    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("_id");
  });

  it("should export multiple cases correctly", async () => {
    exportFullCasesCSV([mockFullCaseData, mockFullCaseMinimal]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();
    const lines = csvContent.trim().split("\n");

    // Header + 2 data rows
    expect(lines.length).toBe(3);

    expect(csvContent).toContain("case_full_1");
    expect(csvContent).toContain("case_minimal");
  });

  it("should include correct filename with date", () => {
    exportFullCasesCSV([mockFullCaseData]);

    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    const expectedFilename = `perm-cases-${dateStr}.csv`;

    expect(mockAnchor.download).toBe(expectedFilename);
  });

  it("should trigger download correctly", () => {
    exportFullCasesCSV([mockFullCaseData]);

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(document.body.appendChild).toHaveBeenCalledWith(mockAnchor);
    expect(mockAnchor.click).toHaveBeenCalledOnce();
    expect(document.body.removeChild).toHaveBeenCalledWith(mockAnchor);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("should throw error when download fails", () => {
    URL.createObjectURL = vi.fn(() => {
      throw new Error("Browser blocked download");
    });

    expect(() => exportFullCasesCSV([mockFullCaseData])).toThrow(
      "Failed to initiate download. Please check your browser settings and try again."
    );
  });

  it("should handle cases with optional fields undefined", async () => {
    exportFullCasesCSV([mockFullCaseMinimal]);

    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob;
    const csvContent = await blob.text();

    // Should not throw and should have data row
    expect(csvContent).toContain("case_minimal");
    expect(csvContent).toContain("Minimal Corp");
  });
});
