import type { Meta, StoryObj } from '@storybook/nextjs';
import { ETA9089Section } from './ETA9089Section';
import { addDays } from 'date-fns';

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const meta = {
  title: 'Forms/Sections/ETA9089Section',
  component: ETA9089Section,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
ETA 9089 form section with filing window indicator.

**Features:**
- Auto-calculated expiration date (certification + 180 days)
- Filing window indicator with color-coded status
- Window countdown when closing soon
- Validation errors and warnings display
- Neobrutalist design with hard shadows

**Filing Window Rules:**
- Not yet open: < 30 days after recruitment
- Open: 30-180 days after recruitment, before PWD expiration
- Closing soon: < 14 days remaining
- Closed: > 180 days or past PWD expiration
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'onChange' },
    onDateChange: { action: 'onDateChange' },
  },
} satisfies Meta<typeof ETA9089Section>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// Stories
// ============================================================================

/**
 * Empty state - no dates entered yet
 */
export const Empty: Story = {
  args: {
    values: {},
  },
};

/**
 * Filing window not yet open (< 30 days after recruitment)
 */
export const WindowNotYetOpen: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -20)), // 20 days ago
      jobOrderEndDate: toISODate(addDays(new Date(), -20)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
    },
  },
};

/**
 * Filing window open (30-180 days after recruitment)
 */
export const WindowOpen: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -60)), // 60 days ago
      jobOrderEndDate: toISODate(addDays(new Date(), -60)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
    },
  },
};

/**
 * Filing window closing soon (< 14 days remaining)
 */
export const WindowClosingSoon: Story = {
  args: {
    values: {
      // Recruitment ended 168 days ago (180 - 12 = window closes in 12 days)
      sundayAdSecondDate: toISODate(addDays(new Date(), -168)),
      jobOrderEndDate: toISODate(addDays(new Date(), -168)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
    },
  },
};

/**
 * Filing window closed (> 180 days after recruitment)
 */
export const WindowClosed: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -200)), // 200 days ago
      jobOrderEndDate: toISODate(addDays(new Date(), -200)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
    },
  },
};

/**
 * Filing date entered (within window)
 */
export const WithFilingDate: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -90)),
      jobOrderEndDate: toISODate(addDays(new Date(), -90)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
      eta9089FilingDate: toISODate(addDays(new Date(), -30)), // Filed 30 days ago
    },
  },
};

/**
 * All dates filled including certification (expiration auto-calculated)
 */
export const WithCertification: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -180)),
      jobOrderEndDate: toISODate(addDays(new Date(), -180)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
      eta9089FilingDate: toISODate(addDays(new Date(), -120)),
      eta9089AuditDate: toISODate(addDays(new Date(), -90)),
      eta9089CertificationDate: toISODate(addDays(new Date(), -60)),
      eta9089ExpirationDate: toISODate(addDays(new Date(), 120)), // Cert + 180 days
      eta9089CaseNumber: 'A-12345-67890',
    },
    autoCalculatedFields: new Set(['eta9089ExpirationDate']),
  },
};

/**
 * With validation errors
 */
export const WithErrors: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -200)),
      jobOrderEndDate: toISODate(addDays(new Date(), -200)),
      pwdExpirationDate: toISODate(addDays(new Date(), -10)),
      eta9089FilingDate: toISODate(addDays(new Date(), -5)), // After PWD expiration
      eta9089CertificationDate: toISODate(addDays(new Date(), -10)), // Before filing
    },
    errors: {
      eta9089FilingDate: 'Filing date must be 30-180 days after recruitment ends',
      eta9089CertificationDate: 'Certification date must be after filing date',
    },
  },
};

/**
 * With validation warnings
 */
export const WithWarnings: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -100)),
      jobOrderEndDate: toISODate(addDays(new Date(), -100)),
      pwdExpirationDate: toISODate(addDays(new Date(), -10)),
      eta9089FilingDate: toISODate(addDays(new Date(), -5)), // After PWD expiration
    },
    warnings: {
      eta9089FilingDate: 'Filing date is after PWD expiration date',
    },
  },
};

/**
 * PWD expiration closes window early
 */
export const PWDExpirationClosesWindowEarly: Story = {
  args: {
    values: {
      // Recruitment ended 60 days ago (window normally open until day 180)
      sundayAdSecondDate: toISODate(addDays(new Date(), -60)),
      jobOrderEndDate: toISODate(addDays(new Date(), -60)),
      // But PWD expires in 10 days (closes window early)
      pwdExpirationDate: toISODate(addDays(new Date(), 10)),
    },
  },
};

/**
 * Interactive playground
 */
export const Playground: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -60)),
      jobOrderEndDate: toISODate(addDays(new Date(), -60)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
      eta9089FilingDate: '',
      eta9089AuditDate: '',
      eta9089CertificationDate: '',
      eta9089ExpirationDate: '',
      eta9089CaseNumber: '',
    },
  },
};

/**
 * Dark mode showcase
 */
export const DarkMode: Story = {
  args: {
    values: {
      sundayAdSecondDate: toISODate(addDays(new Date(), -60)),
      jobOrderEndDate: toISODate(addDays(new Date(), -60)),
      pwdExpirationDate: toISODate(addDays(new Date(), 120)),
      eta9089FilingDate: toISODate(addDays(new Date(), -30)),
      eta9089CertificationDate: toISODate(addDays(new Date(), -10)),
      eta9089ExpirationDate: toISODate(addDays(new Date(), 170)),
      eta9089CaseNumber: 'A-12345-67890',
    },
    autoCalculatedFields: new Set(['eta9089ExpirationDate']),
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};
