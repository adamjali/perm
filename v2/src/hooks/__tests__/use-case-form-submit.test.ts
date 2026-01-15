/**
 * Tests for useCaseFormSubmit Hook
 *
 * Tests the extracted form submission logic from CaseForm.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { CaseFormData } from "@/lib/forms/case-form-schema";
import type { Id } from "../../../convex/_generated/dataModel";

// Hoisted mocks - these must be declared before vi.mock calls
const { mockUpdateMutation, mockValidateCaseForm, mockToast } = vi.hoisted(() => ({
  mockUpdateMutation: vi.fn(),
  mockValidateCaseForm: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock convex react
vi.mock("convex/react", () => ({
  useMutation: () => mockUpdateMutation,
}));

// Mock case-form-schema
vi.mock("@/lib/forms/case-form-schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/forms/case-form-schema")>();
  return {
    ...actual,
    validateCaseForm: mockValidateCaseForm,
  };
});

// Mock auth-aware toast wrapper (not sonner directly)
vi.mock("@/lib/toast", () => ({
  toast: mockToast,
  // Required by AuthContext
  updateToastAuthState: vi.fn(),
}));

// Mock API
vi.mock("../../../convex/_generated/api", () => ({
  api: {
    cases: {
      update: "cases:update",
    },
  },
}));

// Mock case-form.helpers
vi.mock("@/components/forms/case-form.helpers", () => ({
  errorsToFieldMap: (errors: Array<{ field: string; message: string }>) => {
    const map: Record<string, string> = {};
    for (const e of errors) {
      map[e.field] = e.message;
    }
    return map;
  },
  parseServerValidationError: (msg: string) => {
    if (msg.includes("Validation error")) {
      return [{ field: "test", message: "Server error" }];
    }
    return null;
  },
}));

// Import hook after mocks are set up
import { useCaseFormSubmit } from "../use-case-form-submit";

// Create valid mock form data
const createMockFormData = (overrides: Partial<CaseFormData> = {}): CaseFormData => ({
  employerName: "Test Corp",
  beneficiaryIdentifier: "John Doe",
  positionTitle: "Software Engineer",
  caseNumber: "",
  caseStatus: "Pending",
  progressStatus: "PWD Requested",
  pwdFilingDate: "",
  pwdDeterminationDate: "",
  pwdExpirationDate: "",
  pwdCaseNumber: "",
  pwdWageAmount: undefined,
  pwdWageLevel: undefined,
  sundayAd1Date: "",
  sundayAd2Date: "",
  jobOrderStartDate: "",
  jobOrderEndDate: "",
  noticeOfFilingPostDate: "",
  noticeOfFilingRemoveDate: "",
  recruitmentStartDate: "",
  recruitmentEndDate: "",
  recruitmentApplicantsCount: 0,
  isProfessionalOccupation: false,
  additionalRecruitmentStartDate: "",
  additionalRecruitmentEndDate: "",
  additionalRecruitmentMethods: [],
  eta9089FilingDate: "",
  eta9089FilingWindowOpens: "",
  eta9089FilingWindowCloses: "",
  eta9089AuditDate: "",
  eta9089CertificationDate: "",
  eta9089DenialDate: "",
  eta9089WithdrawalDate: "",
  rfiEntries: [],
  i140FilingDate: "",
  i140ReceiptDate: "",
  i140ApprovalDate: "",
  i140DenialDate: "",
  rfeEntries: [],
  notes: [],
  calendarSyncEnabled: true,
  isFavorite: false,
  showOnTimeline: true,
  ...overrides,
});

describe("useCaseFormSubmit", () => {
  let mockSetErrors: ReturnType<typeof vi.fn>;
  let mockSetWarnings: ReturnType<typeof vi.fn>;
  let mockSetShowErrorSummary: ReturnType<typeof vi.fn>;
  let mockSetServerErrors: ReturnType<typeof vi.fn>;
  let mockOnSuccess: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetErrors = vi.fn();
    mockSetWarnings = vi.fn();
    mockSetShowErrorSummary = vi.fn();
    mockSetServerErrors = vi.fn();
    mockOnSuccess = vi.fn();

    // Reset all mocks
    vi.clearAllMocks();
    mockUpdateMutation.mockReset();
    mockUpdateMutation.mockResolvedValue(undefined);
    mockValidateCaseForm.mockReset();
    mockValidateCaseForm.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    // Mock window.scrollTo
    Object.defineProperty(window, "scrollTo", {
      value: vi.fn(),
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("returns handleSubmit function and isSubmitting state", () => {
      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "add",
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      expect(typeof result.current.handleSubmit).toBe("function");
      expect(result.current.isSubmitting).toBe(false);
    });

    it("starts with isSubmitting false", () => {
      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId: "test-id" as Id<"cases">,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe("validation", () => {
    it("validates form data before submission", async () => {
      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "add",
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      const formData = createMockFormData();

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(mockValidateCaseForm).toHaveBeenCalledWith(formData);
    });

    it("sets errors when validation fails", async () => {
      mockValidateCaseForm.mockReturnValue({
        valid: false,
        errors: [
          { field: "employerName", message: "Employer name is required" },
        ],
        warnings: [],
      });

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "add",
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      const formData = createMockFormData({ employerName: "" });

      let success: boolean = false;
      await act(async () => {
        success = await result.current.handleSubmit(formData);
      });

      expect(success).toBe(false);
      expect(mockSetErrors).toHaveBeenCalled();
      expect(mockSetShowErrorSummary).toHaveBeenCalledWith(true);
      expect(mockOnSuccess).not.toHaveBeenCalled();
    });

    it("shows error toast when validation fails", async () => {
      mockValidateCaseForm.mockReturnValue({
        valid: false,
        errors: [
          { field: "employerName", message: "Employer name is required" },
        ],
        warnings: [],
      });

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "add",
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData({ employerName: "" }));
      });

      expect(mockToast.error).toHaveBeenCalled();
    });

    it("scrolls to top when validation fails", async () => {
      mockValidateCaseForm.mockReturnValue({
        valid: false,
        errors: [{ field: "test", message: "Error" }],
        warnings: [],
      });

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "add",
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
    });
  });

  describe("add mode", () => {
    it("calls onSuccess with form data in add mode", async () => {
      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "add",
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      const formData = createMockFormData();

      let success: boolean = false;
      await act(async () => {
        success = await result.current.handleSubmit(formData);
      });

      expect(success).toBe(true);
      expect(mockOnSuccess).toHaveBeenCalledWith(formData);
      // In add mode, mutation should NOT be called (parent handles it)
      expect(mockUpdateMutation).not.toHaveBeenCalled();
    });

    it("clears errors and warnings on successful validation", async () => {
      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "add",
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(mockSetErrors).toHaveBeenCalledWith({});
      expect(mockSetWarnings).toHaveBeenCalledWith({});
      expect(mockSetShowErrorSummary).toHaveBeenCalledWith(false);
    });
  });

  describe("edit mode", () => {
    it("calls update mutation in edit mode", async () => {
      const caseId = "test-case-id" as Id<"cases">;

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      const formData = createMockFormData();

      await act(async () => {
        await result.current.handleSubmit(formData);
      });

      expect(mockUpdateMutation).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Case updated successfully");
    });

    it("shows error when editing without caseId", async () => {
      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          // No caseId provided
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(mockToast.error).toHaveBeenCalled();
    });

    it("calls onSuccess with caseId after successful update", async () => {
      const caseId = "test-case-id" as Id<"cases">;

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(mockOnSuccess).toHaveBeenCalledWith(caseId);
    });
  });

  describe("error handling", () => {
    it("handles network errors", async () => {
      mockUpdateMutation.mockRejectedValue(new Error("network error"));

      const caseId = "test-case-id" as Id<"cases">;

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Network error. Please check your connection and try again."
      );
    });

    it("handles permission errors", async () => {
      mockUpdateMutation.mockRejectedValue(new Error("permission denied"));

      const caseId = "test-case-id" as Id<"cases">;

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "You don't have permission to save this case."
      );
    });

    it("handles server validation errors", async () => {
      mockUpdateMutation.mockRejectedValue(
        new Error("Validation error: employerName: Employer name is required")
      );

      const caseId = "test-case-id" as Id<"cases">;

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(mockSetShowErrorSummary).toHaveBeenCalledWith(true);
    });

    it("resets isSubmitting after error", async () => {
      mockUpdateMutation.mockRejectedValue(new Error("Some error"));

      const caseId = "test-case-id" as Id<"cases">;

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      await act(async () => {
        await result.current.handleSubmit(createMockFormData());
      });

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe("isSubmitting state", () => {
    it("sets isSubmitting to true during submission", async () => {
      // Make mutation slow to test isSubmitting
      mockUpdateMutation.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const caseId = "test-case-id" as Id<"cases">;

      const { result } = renderHook(() =>
        useCaseFormSubmit({
          mode: "edit",
          caseId,
          onSuccess: mockOnSuccess,
          setErrors: mockSetErrors,
          setWarnings: mockSetWarnings,
          setShowErrorSummary: mockSetShowErrorSummary,
          setServerErrors: mockSetServerErrors,
        })
      );

      // Start submission without awaiting
      let submitPromise: Promise<boolean>;
      act(() => {
        submitPromise = result.current.handleSubmit(createMockFormData());
      });

      // Check isSubmitting is true during submission
      expect(result.current.isSubmitting).toBe(true);

      // Wait for completion
      await act(async () => {
        await submitPromise;
      });

      expect(result.current.isSubmitting).toBe(false);
    });
  });
});
