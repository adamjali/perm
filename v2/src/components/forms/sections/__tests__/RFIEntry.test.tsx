import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FormProvider, useForm } from "react-hook-form";
import { RFIEntry } from "../RFIEntry";
import type { CaseFormData, RFIEntry as RFIEntryType } from "@/lib/forms/case-form-schema";

// ============================================================================
// TEST WRAPPER
// ============================================================================

/**
 * Wrapper component that provides FormProvider context for RFIEntry tests
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
 * Helper to create a test RFI entry
 */
const createEntry = (overrides: Partial<RFIEntryType> = {}): RFIEntryType => ({
  id: "test-rfi-1",
  receivedDate: "2024-01-15",
  responseDueDate: "2024-02-14",
  createdAt: Date.now(),
  ...overrides,
});

/**
 * Render RFIEntry with FormProvider context
 */
function renderRFIEntry({
  entry = createEntry(),
  index = 0,
  minReceivedDate,
  maxReceivedDate,
  receivedDisabled,
  onRemove = vi.fn(),
}: {
  entry?: RFIEntryType;
  index?: number;
  minReceivedDate?: string;
  maxReceivedDate?: string;
  receivedDisabled?: { disabled: boolean; reason?: string };
  onRemove?: (index: number) => void;
}) {
  const defaultValues: Partial<CaseFormData> = {
    rfiEntries: [entry],
  };

  return {
    ...render(
      <TestWrapper defaultValues={defaultValues}>
        <RFIEntry
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

describe("RFIEntry", () => {
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
    it("renders all RFI fields", () => {
      renderRFIEntry({});

      expect(screen.getByLabelText(/received date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/response due/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/response submitted/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    });

    it("renders remove button", () => {
      renderRFIEntry({});
      const removeButton = screen.getByRole("button", { name: /remove/i });
      expect(removeButton).toBeInTheDocument();
    });

    it("populates fields with existing values", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-02-14",
        responseSubmittedDate: "2024-02-10",
        title: "Clarification on job duties",
        description: "DOL requested more detail",
        notes: "Responded with revised job description",
      });
      renderRFIEntry({ entry });

      expect(screen.getByDisplayValue("2024-01-15")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2024-02-14")).toBeInTheDocument();
      expect(screen.getByDisplayValue("2024-02-10")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Clarification on job duties")).toBeInTheDocument();
      expect(screen.getByDisplayValue("DOL requested more detail")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Responded with revised job description")).toBeInTheDocument();
    });
  });

  describe("RFI Due Date Auto-Calculation", () => {
    it("marks response due date as auto-calculated when received date is set", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-02-14",
      });
      renderRFIEntry({ entry });

      // Check for "Auto" badge using aria-label
      expect(screen.getByLabelText("Auto-calculated value")).toBeInTheDocument();
    });

    it("response due date input is disabled (not editable)", () => {
      renderRFIEntry({});
      const dueInput = screen.getByLabelText(/response due/i) as HTMLInputElement;
      expect(dueInput).toBeDisabled();
    });

    it("shows hint that due date is strict +30 days", () => {
      renderRFIEntry({});
      expect(screen.getByText(/strict 30 days/i)).toBeInTheDocument();
    });

    it("displays auto-calculated due date value", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-02-14", // +30 days
      });
      renderRFIEntry({ entry });

      const dueInput = screen.getByLabelText(/response due/i) as HTMLInputElement;
      expect(dueInput.value).toBe("2024-02-14");
      expect(dueInput).toBeDisabled();
    });
  });

  describe("User Interactions", () => {
    it("updates form value when received date changes", () => {
      renderRFIEntry({});
      const receivedInput = screen.getByLabelText(/received date/i);
      fireEvent.change(receivedInput, { target: { value: "2024-01-20" } });

      expect((receivedInput as HTMLInputElement).value).toBe("2024-01-20");
    });

    it("updates form value when submitted date changes", () => {
      renderRFIEntry({});
      const submittedInput = screen.getByLabelText(/response submitted/i);
      fireEvent.change(submittedInput, { target: { value: "2024-02-10" } });

      expect((submittedInput as HTMLInputElement).value).toBe("2024-02-10");
    });

    it("updates form value when title changes", () => {
      renderRFIEntry({});
      const titleInput = screen.getByLabelText(/title/i);
      fireEvent.change(titleInput, { target: { value: "Job duties clarification" } });

      expect((titleInput as HTMLInputElement).value).toBe("Job duties clarification");
    });

    it("calls onRemove with index when remove button clicked", () => {
      const mockOnRemove = vi.fn();
      renderRFIEntry({ onRemove: mockOnRemove, index: 2 });
      const removeButton = screen.getByRole("button", { name: /remove/i });
      fireEvent.click(removeButton);

      expect(mockOnRemove).toHaveBeenCalledWith(2);
    });
  });

  describe("Active Status Badge", () => {
    it("shows Active RFI badge when not submitted", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-02-14",
        responseSubmittedDate: undefined,
      });
      renderRFIEntry({ entry });
      expect(screen.getByText(/active rfi/i)).toBeInTheDocument();
    });

    it("does not show Active RFI badge when submitted", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-02-14",
        responseSubmittedDate: "2024-02-10",
      });
      renderRFIEntry({ entry });
      expect(screen.queryByText(/active rfi/i)).not.toBeInTheDocument();
    });

    it("shows completion checkmark when submitted", () => {
      const entry = createEntry({
        receivedDate: "2024-01-15",
        responseDueDate: "2024-02-14",
        responseSubmittedDate: "2024-02-10",
      });
      renderRFIEntry({ entry });
      // Check for checkmark via accessible name or icon
      const completedBadge = screen.getByText(/completed/i);
      expect(completedBadge).toBeInTheDocument();
    });
  });

  describe("Urgency Indicators", () => {
    it("shows urgent styling when due date is within 7 days", () => {
      // System time is frozen to 2024-06-15
      const entry = createEntry({
        receivedDate: "2024-05-16",
        responseDueDate: "2024-06-20", // 5 days from frozen "today"
        responseSubmittedDate: undefined,
      });
      renderRFIEntry({ entry });

      // Check for urgent styling via red border color
      const entryDiv = screen.getByTestId("rfi-entry");
      expect(entryDiv).toHaveClass("border-red-600");
    });

    it("shows normal styling when due date is far away", () => {
      // System time is frozen to 2024-06-15
      const entry = createEntry({
        receivedDate: "2024-05-16",
        responseDueDate: "2024-07-05", // 20 days from frozen "today"
        responseSubmittedDate: undefined,
      });
      renderRFIEntry({ entry });

      const entryDiv = screen.getByTestId("rfi-entry");
      // Check it doesn't have urgent styling
      expect(entryDiv).not.toHaveClass("border-red-600");
      expect(entryDiv).not.toHaveClass("bg-red-50");
    });
  });

  describe("Disabled States", () => {
    it("disables received date when receivedDisabled is true", () => {
      renderRFIEntry({
        receivedDisabled: { disabled: true, reason: "ETA 9089 filing date required" },
      });
      const receivedInput = screen.getByLabelText(/received date/i);
      expect(receivedInput).toBeDisabled();
    });

    it("shows reason text when received date is disabled", () => {
      renderRFIEntry({
        receivedDisabled: { disabled: true, reason: "ETA 9089 filing date required" },
      });
      expect(screen.getByText(/ETA 9089 filing date required/i)).toBeInTheDocument();
    });

    it("disables response submitted when no received date", () => {
      const entry = createEntry({
        receivedDate: "",
        responseDueDate: "",
      });
      renderRFIEntry({ entry });
      const submittedInput = screen.getByLabelText(/response submitted/i);
      expect(submittedInput).toBeDisabled();
    });
  });

  describe("Date Constraints", () => {
    it("applies min date constraint to received date", () => {
      renderRFIEntry({ minReceivedDate: "2024-01-10" });
      const receivedInput = screen.getByLabelText(/received date/i);
      expect(receivedInput).toHaveAttribute("min", "2024-01-10");
    });

    it("applies max date constraint to received date", () => {
      renderRFIEntry({ maxReceivedDate: "2024-12-31" });
      const receivedInput = screen.getByLabelText(/received date/i);
      expect(receivedInput).toHaveAttribute("max", "2024-12-31");
    });

    it("shows hint about date constraints when provided", () => {
      renderRFIEntry({ minReceivedDate: "2024-01-10" });
      expect(screen.getByText(/must be after eta 9089 filing/i)).toBeInTheDocument();
    });
  });
});
