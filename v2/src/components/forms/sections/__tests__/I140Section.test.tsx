import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I140Section } from "../I140Section";
import { CaseFormProvider } from "../../CaseFormContext";
import type { CaseFormData } from "@/lib/forms/case-form-schema";

// ============================================================================
// FIXTURES
// ============================================================================

const mockOnChange = vi.fn();
const mockOnDateChange = vi.fn();

beforeEach(() => {
  mockOnChange.mockReset();
  mockOnDateChange.mockReset();
  // Fix test determinism: Use frozen time for date-dependent tests
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * Wrapper component that provides CaseFormContext for I140Section tests.
 * RFEEntryList (within I140Section) now uses useFieldArray which requires the context.
 */
const TestWrapper = ({
  values,
  children,
}: {
  values: Partial<CaseFormData>;
  children: React.ReactNode;
}) => (
  <CaseFormProvider mode="edit" initialData={values}>
    {children}
  </CaseFormProvider>
);

const renderI140Section = (
  values: Partial<CaseFormData>,
  props?: {
    errors?: Record<string, string>;
    warnings?: Record<string, string>;
    autoCalculatedFields?: Set<string>;
  }
) => {
  return render(
    <TestWrapper values={values}>
      <I140Section
        values={values}
        errors={props?.errors}
        warnings={props?.warnings}
        autoCalculatedFields={props?.autoCalculatedFields}
        onChange={mockOnChange}
        onDateChange={mockOnDateChange}
      />
    </TestWrapper>
  );
};

const createMockValues = (overrides?: Partial<CaseFormData>): Partial<CaseFormData> => ({
  i140FilingDate: undefined,
  i140ReceiptDate: undefined,
  i140ReceiptNumber: undefined,
  i140ApprovalDate: undefined,
  i140DenialDate: undefined,
  i140Category: undefined,
  i140ServiceCenter: undefined,
  i140PremiumProcessing: false,
  eta9089CertificationDate: undefined,
  eta9089ExpirationDate: undefined,
  ...overrides,
});

// ============================================================================
// TESTS: Filing Deadline Calculation
// ============================================================================

describe("I140Section - Filing Deadline", () => {
  it("should calculate filing deadline as ETA 9089 certification + 180 days", () => {
    const values = createMockValues({
      eta9089CertificationDate: "2024-10-01",
      eta9089ExpirationDate: "2025-03-30", // +180 days
    });

    renderI140Section(values);

    // Updated in Phase 5: FilingWindowIndicator formats dates as "MMM d, yyyy"
    expect(screen.getByText(/Mar 30, 2025/)).toBeInTheDocument();
  });

  it("should show 'OPEN' status when within 180 days", () => {
    // System time frozen to 2024-06-15
    // Cert date: 2024-06-05 (10 days ago)
    // Exp date: 2024-12-02 (+180 days from cert = 170 days remaining)
    const values = createMockValues({
      eta9089CertificationDate: "2024-06-05",
      eta9089ExpirationDate: "2024-12-02",
    });

    renderI140Section(values);

    // Updated in Phase 5: FilingWindowIndicator uses "OPEN" status badge
    // Use getAllByText since there might be multiple "open" references
    const openBadges = screen.getAllByText(/OPEN/i);
    expect(openBadges.length).toBeGreaterThan(0);
  });

  it("should show 'Closing Soon' status when <=14 days remaining", () => {
    // System time frozen to 2024-06-15
    // Exp date: 2024-06-25 (10 days remaining triggers closing_soon)
    // Cert date: 2023-12-28 (+180 days = exp date)
    const values = createMockValues({
      eta9089CertificationDate: "2023-12-28",
      eta9089ExpirationDate: "2024-06-25",
    });

    renderI140Section(values);

    // Updated in Phase 5: FilingWindowIndicator uses "Closing Soon" for <= 14 days
    expect(screen.getByText(/Closing Soon/i)).toBeInTheDocument();
  });

  it("should show 'Closing Soon' status when <7 days remaining", () => {
    // System time frozen to 2024-06-15
    // Exp date: 2024-06-20 (5 days remaining)
    // Cert date: 2023-12-23 (+180 days = exp date)
    const values = createMockValues({
      eta9089CertificationDate: "2023-12-23",
      eta9089ExpirationDate: "2024-06-20",
    });

    renderI140Section(values);

    // Updated in Phase 5: FilingWindowIndicator uses "Closing Soon" for <= 14 days (including < 7)
    expect(screen.getByText(/Closing Soon/i)).toBeInTheDocument();
  });

  it("should show 'CLOSED' status when >180 days past certification", () => {
    // System time frozen to 2024-06-15
    // Exp date: 2024-06-05 (expired 10 days ago)
    // Cert date: 2023-12-08 (+180 days = exp date)
    const values = createMockValues({
      eta9089CertificationDate: "2023-12-08",
      eta9089ExpirationDate: "2024-06-05",
    });

    renderI140Section(values);

    // Updated in Phase 5: FilingWindowIndicator uses "CLOSED" status badge
    // Use getAllByText since there might be multiple "closed" references (badge + message)
    const closedElements = screen.getAllByText(/CLOSED/i);
    expect(closedElements.length).toBeGreaterThan(0);
  });

  it("should show countdown when deadline is near", () => {
    // System time frozen to 2024-06-15
    // Exp date: 2024-06-20 (~5 days remaining)
    // Cert date: 2023-12-23 (+180 days = exp date)
    const values = createMockValues({
      eta9089CertificationDate: "2023-12-23",
      eta9089ExpirationDate: "2024-06-20",
    });

    renderI140Section(values);

    // Updated in Phase 5: FilingWindowIndicator shows "days remaining" as separate span
    expect(screen.getByText(/days remaining/i)).toBeInTheDocument();
  });

  it("should show prerequisites message when no ETA 9089 certification exists", () => {
    const values = createMockValues({
      eta9089CertificationDate: undefined,
      eta9089ExpirationDate: undefined,
    });

    renderI140Section(values);

    // Updated in Phase 5: FilingWindowIndicator shows "Complete prerequisites to see window"
    expect(
      screen.getByText(/Complete prerequisites to see window/i)
    ).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: Validation
// ============================================================================

describe("I140Section - Validation", () => {
  it("should display error when filing date is after deadline", () => {
    const values = createMockValues({
      eta9089CertificationDate: "2024-10-01",
      eta9089ExpirationDate: "2025-03-30",
      i140FilingDate: "2025-04-15", // After deadline
    });

    const errors = {
      i140FilingDate: "I-140 must be filed within 180 days of ETA 9089 certification",
    };

    renderI140Section(values, { errors });

    expect(screen.getByText(errors.i140FilingDate)).toBeInTheDocument();
  });

  it("should display error when filing date is before certification", () => {
    const values = createMockValues({
      eta9089CertificationDate: "2024-10-01",
      i140FilingDate: "2024-09-01", // Before certification
    });

    const errors = {
      i140FilingDate: "I-140 filing date must be after ETA 9089 certification date",
    };

    renderI140Section(values, { errors });

    expect(screen.getByText(errors.i140FilingDate)).toBeInTheDocument();
  });

  it("should display error when approval date is before filing date", () => {
    const values = createMockValues({
      i140FilingDate: "2024-12-01",
      i140ApprovalDate: "2024-11-01", // Before filing
    });

    const errors = {
      i140ApprovalDate: "I-140 approval date must be after filing date",
    };

    renderI140Section(values, { errors });

    expect(screen.getByText(errors.i140ApprovalDate)).toBeInTheDocument();
  });

  it("should display error when denial date is before filing date", () => {
    const values = createMockValues({
      i140FilingDate: "2024-12-01",
      i140DenialDate: "2024-11-01", // Before filing
    });

    const errors = {
      i140DenialDate: "I-140 denial date must be after filing date",
    };

    renderI140Section(values, { errors });

    expect(screen.getByText(errors.i140DenialDate)).toBeInTheDocument();
  });

  it("should display error when both approval and denial dates are set", () => {
    const values = createMockValues({
      i140FilingDate: "2024-12-01",
      i140ApprovalDate: "2025-01-15",
      i140DenialDate: "2025-01-15",
    });

    const errors = {
      i140ApprovalDate: "Cannot have both approval and denial dates",
    };

    renderI140Section(values, { errors });

    expect(screen.getByText(errors.i140ApprovalDate)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: Category Dropdown
// ============================================================================

describe("I140Section - Category Dropdown", () => {
  it("should have all EB category options", () => {
    const values = createMockValues();

    renderI140Section(values);

    const categorySelect = screen.getByLabelText(/Category/i) as HTMLSelectElement;

    // Check for all options (including EB-2-NIW added in Phase 6)
    expect(categorySelect).toHaveValue("");
    expect(screen.getByRole("option", { name: /Select category/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /EB-1/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /^EB-2 \(/i })).toBeInTheDocument(); // EB-2 (Advanced Degree...)
    expect(screen.getByRole("option", { name: /EB-2 National Interest/i })).toBeInTheDocument(); // EB-2-NIW
    expect(screen.getByRole("option", { name: /EB-3/i })).toBeInTheDocument();
  });

  it("should call onChange when category is selected", () => {
    const values = createMockValues();

    renderI140Section(values);

    const categorySelect = screen.getByLabelText(/Category/i);
    fireEvent.change(categorySelect, { target: { value: "EB-2" } });

    expect(mockOnChange).toHaveBeenCalledWith("i140Category", "EB-2");
  });
});

// ============================================================================
// TESTS: Premium Processing Checkbox
// ============================================================================

describe("I140Section - Premium Processing", () => {
  it("should render premium processing checkbox", () => {
    const values = createMockValues();

    renderI140Section(values);

    expect(screen.getByLabelText(/Premium Processing/i)).toBeInTheDocument();
  });

  it("should call onChange when premium processing is toggled", () => {
    const values = createMockValues({ i140PremiumProcessing: false });

    renderI140Section(values);

    const checkbox = screen.getByLabelText(/Premium Processing/i);
    fireEvent.click(checkbox);

    expect(mockOnChange).toHaveBeenCalledWith("i140PremiumProcessing", true);
  });

  it("should show tooltip explaining premium processing", () => {
    const values = createMockValues();

    renderI140Section(values);

    // Look for info icon or help text (updated in Phase 6 to mention 15 business days)
    expect(screen.getByText(/15 business day/i)).toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: Completion Badge
// ============================================================================

describe("I140Section - Completion Badge", () => {
  it("should show completion badge when approval date is set", () => {
    const values = createMockValues({
      i140FilingDate: "2024-12-01",
      i140ApprovalDate: "2025-01-15",
    });

    renderI140Section(values);

    expect(screen.getByText(/Complete/i)).toBeInTheDocument();
  });

  it("should not show completion badge when no approval date", () => {
    const values = createMockValues({
      i140FilingDate: "2024-12-01",
    });

    renderI140Section(values);

    expect(screen.queryByText(/Complete/i)).not.toBeInTheDocument();
  });

  it("should not show completion badge when denied", () => {
    const values = createMockValues({
      i140FilingDate: "2024-12-01",
      i140DenialDate: "2025-01-15",
    });

    renderI140Section(values);

    expect(screen.queryByText(/Complete/i)).not.toBeInTheDocument();
  });
});

// ============================================================================
// TESTS: Form Fields
// ============================================================================

describe("I140Section - Form Fields", () => {
  it("should render all required form fields", () => {
    const values = createMockValues();

    renderI140Section(values);

    expect(screen.getByLabelText(/Filing Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Receipt Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Receipt Number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Approval Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Denial Date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Category/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Service Center/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Premium Processing/i)).toBeInTheDocument();
  });

  it("should call onDateChange when filing date changes", () => {
    const values = createMockValues();

    renderI140Section(values);

    const filingDateInput = screen.getByLabelText(/Filing Date/i);
    fireEvent.change(filingDateInput, { target: { value: "2024-12-01" } });

    expect(mockOnDateChange).toHaveBeenCalledWith("i140FilingDate", "2024-12-01");
  });

  it("should populate fields with existing values", () => {
    // Service center is now a dropdown with simple values (Texas, Nebraska, etc.)
    // Updated in Phase 6 to use dropdown instead of text input
    const values = createMockValues({
      i140FilingDate: "2024-12-01",
      i140ReceiptDate: "2024-12-05",
      i140ReceiptNumber: "WAC2412345678",
      i140ApprovalDate: "2025-01-15",
      i140Category: "EB-2",
      i140ServiceCenter: "Texas",
      i140PremiumProcessing: true,
    });

    renderI140Section(values);

    expect(screen.getByLabelText(/Filing Date/i)).toHaveValue("2024-12-01");
    expect(screen.getByLabelText(/Receipt Date/i)).toHaveValue("2024-12-05");
    expect(screen.getByLabelText(/Receipt Number/i)).toHaveValue("WAC2412345678");
    expect(screen.getByLabelText(/Approval Date/i)).toHaveValue("2025-01-15");
    expect(screen.getByLabelText(/Category/i)).toHaveValue("EB-2");
    expect(screen.getByLabelText(/Service Center/i)).toHaveValue("Texas");
    expect(screen.getByLabelText(/Premium Processing/i)).toBeChecked();
  });
});
