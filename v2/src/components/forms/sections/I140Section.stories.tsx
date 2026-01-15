import type { Meta, StoryObj } from "@storybook/nextjs";
import { I140Section } from "./I140Section";

// Mock function for stories
const fn = () => () => {};

/**
 * I140Section displays the I-140 Immigrant Petition form section
 * with filing deadline indicator, date fields, category selection, and premium processing option.
 *
 * ## Features
 * - Filing deadline indicator (color-coded by urgency)
 * - Completion badge when I-140 is approved
 * - Category dropdown (EB-1, EB-2, EB-3)
 * - Premium processing checkbox with tooltip
 * - Receipt tracking (date + number)
 * - Validation support
 *
 * ## Deadline Statuses
 * - **Window open** (green): > 30 days until deadline
 * - **Due soon** (orange): 8-30 days until deadline
 * - **Urgent** (red): ≤ 7 days until deadline
 * - **Past deadline** (red striped): Past the 180-day deadline
 */
const meta = {
  title: "Forms/Sections/I140Section",
  component: I140Section,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
  argTypes: {
    values: {
      description: "Form field values",
      control: "object",
    },
    errors: {
      description: "Validation errors",
      control: "object",
    },
    warnings: {
      description: "Validation warnings",
      control: "object",
    },
    onChange: {
      description: "Field change handler",
      action: "changed",
    },
    onDateChange: {
      description: "Date field change handler (for calculations)",
      action: "date-changed",
    },
  },
} satisfies Meta<typeof I140Section>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Helper: Calculate dates relative to today
// ============================================================================

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function daysAgo(days: number): string {
  return daysFromToday(-days);
}

// ============================================================================
// Stories
// ============================================================================

/**
 * Empty section with no ETA 9089 certification yet.
 * Shows placeholder message for filing deadline.
 */
export const Empty: Story = {
  args: {
    values: {},
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * Window is open with plenty of time (170 days remaining).
 * Green status indicator with calm appearance.
 */
export const WindowOpen: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(10),
      eta9089ExpirationDate: daysFromToday(170), // 170 days remaining
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * Due soon status with 20 days remaining.
 * Orange indicator.
 */
export const DueSoon: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(160),
      eta9089ExpirationDate: daysFromToday(20), // 20 days remaining
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * Urgent status with only 5 days remaining.
 * Red indicator with countdown.
 */
export const Urgent: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(175),
      eta9089ExpirationDate: daysFromToday(5), // 5 days remaining
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * Past deadline (10 days overdue).
 * Red striped indicator showing missed deadline.
 */
export const PastDeadline: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(190),
      eta9089ExpirationDate: daysAgo(10), // 10 days past deadline
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * I-140 filed but not yet approved.
 * No deadline indicator since already filed.
 */
export const Filed: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(100),
      eta9089ExpirationDate: daysFromToday(80),
      i140FilingDate: daysAgo(50),
      i140ReceiptDate: daysAgo(45),
      i140ReceiptNumber: "WAC2412345678",
      i140Category: "EB-2",
      i140ServiceCenter: "Texas Service Center",
      i140PremiumProcessing: true,
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * I-140 approved - shows completion badge!
 * Celebration moment in the PERM journey.
 */
export const Approved: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(150),
      eta9089ExpirationDate: daysAgo(30),
      i140FilingDate: daysAgo(120),
      i140ReceiptDate: daysAgo(115),
      i140ReceiptNumber: "LIN2498765432",
      i140ApprovalDate: daysAgo(30),
      i140Category: "EB-1",
      i140ServiceCenter: "Nebraska Service Center",
      i140PremiumProcessing: true,
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * I-140 denied.
 * Shows denial date, no completion badge.
 */
export const Denied: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(150),
      eta9089ExpirationDate: daysAgo(30),
      i140FilingDate: daysAgo(120),
      i140ReceiptDate: daysAgo(115),
      i140ReceiptNumber: "SRC2487654321",
      i140DenialDate: daysAgo(30),
      i140Category: "EB-3",
      i140ServiceCenter: "California Service Center",
      i140PremiumProcessing: false,
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * With validation errors.
 * Shows multiple error states.
 */
export const WithErrors: Story = {
  args: {
    values: {
      eta9089CertificationDate: "2024-10-01",
      eta9089ExpirationDate: "2025-03-30",
      i140FilingDate: "2025-04-15", // After deadline
      i140ApprovalDate: "2024-12-01", // Before filing
    },
    errors: {
      i140FilingDate: "I-140 must be filed within 180 days of ETA 9089 certification",
      i140ApprovalDate: "I-140 approval date must be after filing date",
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * With validation warnings.
 * Shows warning banner.
 */
export const WithWarnings: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(160),
      eta9089ExpirationDate: daysFromToday(20),
      i140FilingDate: daysFromToday(15), // Close to deadline
    },
    warnings: {
      i140FilingDate: "Filing date is close to the deadline. Consider filing sooner.",
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * All fields populated (complete data).
 * Demonstrates full form with all optional fields.
 */
export const Complete: Story = {
  args: {
    values: {
      eta9089CertificationDate: "2024-10-01",
      eta9089ExpirationDate: "2025-03-30",
      i140FilingDate: "2024-12-01",
      i140ReceiptDate: "2024-12-05",
      i140ReceiptNumber: "IOE-2024-1234567",
      i140ApprovalDate: "2025-01-15",
      i140Category: "EB-2",
      i140ServiceCenter: "Potomac Service Center",
      i140PremiumProcessing: true,
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * Minimal data (only required fields).
 * Shows section with just a filing date.
 */
export const Minimal: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(100),
      eta9089ExpirationDate: daysFromToday(80),
      i140FilingDate: daysAgo(50),
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};

/**
 * Interactive playground.
 * Modify values and see real-time updates.
 */
export const Playground: Story = {
  args: {
    values: {
      eta9089CertificationDate: daysAgo(10),
      eta9089ExpirationDate: daysFromToday(170),
    },
    onChange: fn(),
    onDateChange: fn(),
  },
};
