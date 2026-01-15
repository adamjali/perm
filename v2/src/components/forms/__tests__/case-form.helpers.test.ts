/**
 * case-form.helpers Tests
 *
 * Tests for form helper functions including field mapping,
 * error extraction, and server validation parsing.
 */

import { describe, it, expect } from "vitest";
import {
  DEFAULT_FORM_DATA,
  initializeFormData,
  errorsToFieldMap,
  parseServerValidationError,
  extractRfiEntryErrors,
  extractRfeEntryErrors,
  mapFieldToInputName,
} from "../case-form.helpers";

describe("DEFAULT_FORM_DATA", () => {
  it("has all required fields with default values", () => {
    // These are partial defaults, not full form data
    expect(DEFAULT_FORM_DATA.caseStatus).toBe("pwd");
    expect(DEFAULT_FORM_DATA.progressStatus).toBe("working");
    expect(DEFAULT_FORM_DATA.isProfessionalOccupation).toBe(false);
    expect(DEFAULT_FORM_DATA.recruitmentApplicantsCount).toBe(0);
    expect(DEFAULT_FORM_DATA.rfiEntries).toEqual([]);
    expect(DEFAULT_FORM_DATA.rfeEntries).toEqual([]);
    expect(DEFAULT_FORM_DATA.calendarSyncEnabled).toBe(true);
    expect(DEFAULT_FORM_DATA.showOnTimeline).toBe(true);
    expect(DEFAULT_FORM_DATA.isFavorite).toBe(false);
    expect(DEFAULT_FORM_DATA.priorityLevel).toBe("normal");
  });
});

describe("initializeFormData", () => {
  it("returns merged data for add mode with no initial data", () => {
    const result = initializeFormData("add");
    // Add mode merges defaults with empty initial data
    expect(result.caseStatus).toBe("pwd");
    expect(result.progressStatus).toBe("working");
    expect(result.employerName).toBe("");
    expect(result.beneficiaryIdentifier).toBe("");
  });

  it("merges initial data over defaults in add mode", () => {
    const result = initializeFormData("add", { employerName: "Test Corp" });
    // Add mode: defaults + initialData overlay
    expect(result.employerName).toBe("Test Corp");
    expect(result.caseStatus).toBe("pwd"); // From defaults
  });

  it("merges initial data in edit mode", () => {
    const result = initializeFormData("edit", {
      employerName: "Acme Inc",
      beneficiaryIdentifier: "John Doe",
    });
    expect(result.employerName).toBe("Acme Inc");
    expect(result.beneficiaryIdentifier).toBe("John Doe");
    expect(result.caseStatus).toBe("pwd"); // Fallback when not provided
  });

  it("returns fallback data for edit mode with no initial data", () => {
    const result = initializeFormData("edit");
    // Edit mode with no data uses empty base + field defaults
    expect(result.employerName).toBe("");
    expect(result.caseStatus).toBe("pwd");
  });
});

describe("errorsToFieldMap", () => {
  it("converts validation errors array to field map", () => {
    const errors = [
      { field: "employerName", message: "Required" },
      { field: "beneficiaryIdentifier", message: "Too short" },
    ];

    const result = errorsToFieldMap(errors);

    expect(result).toEqual({
      employerName: "Required",
      beneficiaryIdentifier: "Too short",
    });
  });

  it("returns empty object for empty array", () => {
    const result = errorsToFieldMap([]);
    expect(result).toEqual({});
  });

  it("uses last error for duplicate fields", () => {
    const errors = [
      { field: "name", message: "First error" },
      { field: "name", message: "Second error" },
    ];

    const result = errorsToFieldMap(errors);

    expect(result).toEqual({ name: "Second error" });
  });
});

describe("parseServerValidationError", () => {
  it("parses server validation error format", () => {
    // Server format: "Validation failed: [V-XXX-00] snake_field: message"
    const errorMessage =
      "Validation failed: [V-PWD-01] pwd_determination_date: Invalid date format";

    const result = parseServerValidationError(errorMessage);

    expect(result).toEqual([
      {
        field: "pwdDeterminationDate",
        message: "[V-PWD-01] Invalid date format",
      },
    ]);
  });

  it("parses multiple validation errors", () => {
    const errorMessage =
      "Validation failed: [V-RFI-01] rfi_received_date: Date required; [V-RFI-02] rfi_due_date: Must be after received";

    const result = parseServerValidationError(errorMessage);

    expect(result).toEqual([
      { field: "rfiReceivedDate", message: "[V-RFI-01] Date required" },
      { field: "rfiDueDate", message: "[V-RFI-02] Must be after received" },
    ]);
  });

  it("returns null for non-validation error message", () => {
    const result = parseServerValidationError("Some random error");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = parseServerValidationError("");
    expect(result).toBeNull();
  });

  it("returns null for malformed validation message", () => {
    // Missing the [V-XXX-00] pattern
    const result = parseServerValidationError(
      "Validation failed: some_field: error message"
    );
    expect(result).toBeNull();
  });
});

describe("extractRfiEntryErrors", () => {
  it("extracts and maps RFI field errors to nested structure", () => {
    const errors = {
      rfiReceivedDate: "Invalid date",
      rfiDueDate: "Date required",
      someOtherField: "Unrelated error",
    };

    const result = extractRfiEntryErrors(errors);

    // Returns nested structure with index "0" for active entry
    expect(result).toEqual({
      "0": {
        receivedDate: "Invalid date",
        responseDueDate: "Date required",
      },
    });
  });

  it("returns empty object when no RFI errors", () => {
    const errors = {
      employerName: "Required",
      beneficiaryIdentifier: "Required",
    };

    const result = extractRfiEntryErrors(errors);

    expect(result).toEqual({});
  });

  it("handles rfiSubmittedDate mapping", () => {
    const errors = {
      rfiSubmittedDate: "Must be after received date",
    };

    const result = extractRfiEntryErrors(errors);

    expect(result).toEqual({
      "0": {
        responseSubmittedDate: "Must be after received date",
      },
    });
  });
});

describe("extractRfeEntryErrors", () => {
  it("extracts and maps RFE field errors to nested structure", () => {
    const errors = {
      rfeReceivedDate: "Invalid date",
      rfeDueDate: "Date required",
      someOtherField: "Unrelated error",
    };

    const result = extractRfeEntryErrors(errors);

    // Returns nested structure with index "0" for active entry
    expect(result).toEqual({
      "0": {
        receivedDate: "Invalid date",
        responseDueDate: "Date required",
      },
    });
  });

  it("returns empty object when no RFE errors", () => {
    const errors = {
      employerName: "Required",
      beneficiaryIdentifier: "Required",
    };

    const result = extractRfeEntryErrors(errors);

    expect(result).toEqual({});
  });

  it("handles rfeSubmittedDate mapping", () => {
    const errors = {
      rfeSubmittedDate: "Must be after received date",
    };

    const result = extractRfeEntryErrors(errors);

    expect(result).toEqual({
      "0": {
        responseSubmittedDate: "Must be after received date",
      },
    });
  });
});

describe("mapFieldToInputName", () => {
  it("maps RFI field names to input element names", () => {
    expect(mapFieldToInputName("rfiReceivedDate")).toBe("rfi-0-receivedDate");
    expect(mapFieldToInputName("rfiDueDate")).toBe("rfi-0-responseDueDate");
    expect(mapFieldToInputName("rfiSubmittedDate")).toBe(
      "rfi-0-responseSubmittedDate"
    );
  });

  it("maps RFE field names to input element names", () => {
    expect(mapFieldToInputName("rfeReceivedDate")).toBe("rfe-0-receivedDate");
    expect(mapFieldToInputName("rfeDueDate")).toBe("rfe-0-responseDueDate");
    expect(mapFieldToInputName("rfeSubmittedDate")).toBe(
      "rfe-0-responseSubmittedDate"
    );
  });

  it("returns standard field names unchanged", () => {
    // Regular fields are passed through unchanged
    expect(mapFieldToInputName("employerName")).toBe("employerName");
    expect(mapFieldToInputName("pwdDeterminationDate")).toBe(
      "pwdDeterminationDate"
    );
    expect(mapFieldToInputName("notes")).toBe("notes");
  });
});
