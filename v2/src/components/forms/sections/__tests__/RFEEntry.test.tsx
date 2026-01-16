import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FormProvider, useForm } from "react-hook-form";
import { RFEEntry } from "../RFEEntry";
import type { CaseFormData, RFEEntry as RFEEntryType } from "@/lib/forms/case-form-schema";

// ============================================================================
// TEST WRAPPER
// ============================================================================

/**
 * Wrapper component that provides FormProvider context for RFEEntry tests
 */
function TestWrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues: Partial<CaseFormData>;
}) {
  const methods = useForm<CaseFormData>({
    defaultValues: defaultValues as CaseFormData,
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Helper to create a test RFE entry
 */
const createEntry = (overrides: Partial<RFEEntryType> = {}): RFEEntryType => ({
  id: "test-rfe-1",
  receivedDate: "2024-01-15",
  responseDueDate: "2024-04-12",
  createdAt: Date.now(),
  ...overrides,
});

/**
 * Render RFEEntry with FormProvider context
 */
function renderRFEEntry({
  entry = createEntry(),
  index = 0,
  minReceivedDate,
  maxReceivedDate,
  receivedDisabled,
  onRemove = vi.fn(),
}: {
  entry?: RFEEntryType;
  index?: number;
  minReceivedDate?: string;
  maxReceivedDate?: string;
  receivedDisabled?: { disabled: boolean; reason?: string };
  onRemove?: (index: number) => void;
}) {
  const defaultValues: Partial<CaseFormData> = {
    rfeEntries: [entry],
  };

  return {
    ...render(
      <TestWrapper defaultValues={defaultValues}>
        <RFEEntry
          index={index}
          minReceivedDate={minReceivedDate}
          maxReceivedDate={maxReceivedDate}
          receivedDisabled={receivedDisabled}
          onRemove={onRemove}
        />
      </TestWrapper>
    ),
    onRemove,
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe("RFEEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Fix test determinism: Use frozen time for date-dependent tests
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Rendering", () => {
    it("renders all RFE fields", () => {
      renderRFEEntry({});

      expect(screen.getByLabelText(/received date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/response due/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/response submitted/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it("renders remove button", () => {
      renderRFEEntry({});
      const removeButton = screen.getByRole("button", { name: /remove/i });
      expect(removeButton).toBeInTheDocument();
    });

    it("populates fields with existing values", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-04-12",
        responseSubmittedDate: "2024-04-10",
        title: "Additional evidence of ability to pay",
        description: "USCIS requested tax returns",
        notes: "Submitted 3 years of tax returns",
      });
      renderRFEEntry({ entry });

      expect(screen.getByDisplayValue("2024-01-15")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2024-04-12")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2024-04-10")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Additional evidence of ability to pay")).toBeInTheDocument();
      expect(screen.getByDisplayValue("USCIS requested tax returns")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Submitted 3 years of tax returns")).toBeInTheDocument();
    });
  });

  describe("RFE Due Date Manual Entry", () => {
    it("response due date input is EDITABLE (not auto-calculated)", () => {
      renderRFEEntry({});
      const dueInput = screen.getByLabelText(/response due/i) as HTMLInputElement;
      expect(dueInput).not.toBeDisabled();
    });

    it("shows hint suggesting ~87 days", () => {
      renderRFEEntry({});
      // Check for hint text about 87 days
      expect(screen.getByText(/30-90 days.*standard 87/i)).toBeInTheDocument();
    });

    it("allows user to manually change due date", () => {
      renderRFEEntry({});
      const dueInput = screen.getByLabelText(/response due/i);
      fireEvent.change(dueInput, { target: { value: "2024-04-20" } });

      expect((dueInput as HTMLInputElement).value).toBe("2024-04-20");
    });

    it("does NOT show auto-calculated badge on due date", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-04-12",
      });
      renderRFEEntry({ entry });

      // Should NOT have "Auto" badge (RFE due dates are manually entered)
      expect(screen.queryByLabelText("Auto-calculated value")).not.toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("updates form value when received date changes", () => {
      renderRFEEntry({});
      const receivedInput = screen.getByLabelText(/received date/i);
      fireEvent.change(receivedInput, { target: { value: "2024-01-20" } });

      expect((receivedInput as HTMLInputElement).value).toBe("2024-01-20");
    });

    it("updates form value when due date changes", () => {
      renderRFEEntry({});
      const dueInput = screen.getByLabelText(/response due/i);
      fireEvent.change(dueInput, { target: { value: "2024-04-15" } });

      expect((dueInput as HTMLInputElement).value).toBe("2024-04-15");
    });

    it("updates form value when submitted date changes", () => {
      renderRFEEntry({});
      const submittedInput = screen.getByLabelText(/response submitted/i);
      fireEvent.change(submittedInput, { target: { value: "2024-04-10" } });

      expect((submittedInput as HTMLInputElement).value).toBe("2024-04-10");
    });

    it("updates form value when title changes", () => {
      renderRFEEntry({});
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: "Ability to pay" } });

      expect((titleInput as HTMLInputElement).value).toBe("Ability to pay");
    });

    it("calls onRemove with index when remove button clicked", () => {
      const mockOnRemove = vi.fn();
      renderRFEEntry({ onRemove: mockOnRemove, index: 2 });
      const removeButton = screen.getByRole("button", { name: /remove/i });
      fireEvent.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalledWith(2);
    });
  });

  describe("Active Status Badge", () => {
    it("shows Active RFE badge when not submitted", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-04-12",
        responseSubmittedDate: undefined,
      });
      renderRFEEntry({ entry });
      expect(screen.getByText(/active rfe/i)).toBeInTheDocument();
    });

    it("does not show Active RFE badge when submitted", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-04-12",
        responseSubmittedDate: "2024-04-10",
      });
      renderRFEEntry({ entry });
      expect(screen.queryByText(/active rfe/i)).not.toBeInTheDocument();
    });

    it("shows completion checkmark when submitted", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-04-12",
        responseSubmittedDate: "2024-04-10",
      });
      renderRFEEntry({ entry });
      const completedBadge = screen.getByText(/completed/i);
      expect(completedBadge).toBeInTheDocument();
    });
  });

  describe("Urgency Indicators", () => {
    it("shows urgent styling when due date is within 7 days", () => {
      // System time is frozen to 2024-06-15
      const entry = createEntry({
        receivedDate: "2024-03-15",
        responseDueDate: "2024-06-20", // 5 days from frozen "today"
        responseSubmittedDate: undefined,
      });
      renderRFEEntry({ entry });

      const entryDiv = screen.getByTestId("rfe-entry");
      expect(entryDiv).toHaveClass("border-red-600");
    });

    it("shows normal styling when due date is far away", () => {
      // System time is frozen to 2024-06-15
      const entry = createEntry({
        receivedDate: "2024-03-15",
        responseDueDate: "2024-08-14", // 60 days from frozen "today"
        responseSubmittedDate: undefined,
      });
      renderRFEEntry({ entry });

      const entryDiv = screen.getByTestId("rfe-entry");
      // Check it doesn't have urgent styling
      expect(entryDiv).not.toHaveClass("border-red-600");
      expect(entryDiv).not.toHaveClass("bg-red-50");
    });
  });

  describe("Disabled States", () => {
    it("disables received date when receivedDisabled is true", () => {
      renderRFEEntry({
        receivedDisabled: { disabled: true, reason: "I-140 filing date required" },
      });
      const receivedInput = screen.getByLabelText(/received date/i);
      expect(receivedInput).toBeDisabled();
    });

    it("shows reason text when received date is disabled", () => {
      renderRFEEntry({
        receivedDisabled: { disabled: true, reason: "I-140 filing date required" },
      });
      expect(screen.getByText(/I-140 filing date required/i)).toBeInTheDocument();
    });

    it("disables response submitted when no received date or due date", () => {
      const entry = createEntry({
        receivedDate: "",
        responseDueDate: "",
      });
      renderRFEEntry({ entry });
      const submittedInput = screen.getByLabelText(/response submitted/i);
      expect(submittedInput).toBeDisabled();
    });
  });

  describe("Date Constraints", () => {
    it("applies min date constraint to received date", () => {
      renderRFEEntry({ minReceivedDate: "2024-01-10" });
      const receivedInput = screen.getByLabelText(/received date/i);
      expect(receivedInput).toHaveAttribute("min", "2024-01-10");
    });

    it("applies max date constraint to received date", () => {
      renderRFEEntry({ maxReceivedDate: "2024-12-31" });
      const receivedInput = screen.getByLabelText(/received date/i);
      expect(receivedInput).toHaveAttribute("max", "2024-12-31");
    });

    it("shows hint about date constraints when provided", () => {
      renderRFEEntry({ minReceivedDate: "2024-01-10" });
      expect(screen.getByText(/must be after i-140 filing/i)).toBeInTheDocument();
    });
  });
});
