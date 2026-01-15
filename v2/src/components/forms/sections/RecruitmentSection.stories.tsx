import type { Meta, StoryObj } from '@storybook/nextjs';
import { RecruitmentSection } from './RecruitmentSection';
import { addDays } from 'date-fns';

/**
 * Format date to ISO string (YYYY-MM-DD)
 */
function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Get next Sunday from a given date
 */
function getNextSunday(date: Date): Date {
  const dayOfWeek = date.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return addDays(date, daysUntilSunday);
}

const meta = {
  title: 'Forms/Sections/RecruitmentSection',
  component: RecruitmentSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: `
Recruitment form section with Professional Occupation toggle.

**Features:**
- Sunday newspaper ads with Sunday-only validation
- Job order with 30-day minimum duration
- Notice of filing with 10 business day auto-calculation
- Recruitment deadline indicator
- Professional Occupation toggle with 3 additional methods requirement
- Duplicate method prevention across dropdowns
- Framer Motion reveal animation for professional section

**Professional Occupation (20 CFR 656.17(e)):**
- Checkbox toggles additional requirements
- 3 different recruitment methods required
- 11 method types available
- Warning displayed when < 3 methods selected
- Methods filtered to prevent duplicates

**Recruitment Methods Available:**
1. Local/Ethnic Newspaper Ad
2. Radio Advertisement
3. Television Advertisement
4. Job Fair
5. Campus Placement Office
6. Trade/Professional Organization
7. Private Employment Firm
8. Employee Referral Program
9. Employer's Website
10. Job Website (Indeed, Monster, etc.)
11. On-Campus Recruitment
        `,
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onChange: { action: 'onChange' },
    onDateChange: { action: 'onDateChange' },
  },
} satisfies Meta<typeof RecruitmentSection>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// BASIC RECRUITMENT STORIES
// ============================================================================

/**
 * Empty state - no dates entered yet
 */
export const Empty: Story = {
  args: {
    values: {
      isProfessionalOccupation: false,
    },
  },
};

/**
 * With PWD dates for deadline calculation
 */
export const WithPWDDates: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)), // ~365 days from determination
      isProfessionalOccupation: false,
    },
  },
};

/**
 * Partial recruitment - some dates filled
 */
export const PartialRecruitment: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      sundayAdFirstDate: toISODate(getNextSunday(addDays(new Date(), -21))),
      jobOrderStartDate: toISODate(addDays(new Date(), -25)),
      isProfessionalOccupation: false,
    },
  },
};

/**
 * Complete recruitment - all mandatory steps filled
 */
export const CompleteRecruitment: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -60)),
      pwdExpirationDate: toISODate(addDays(new Date(), 305)),
      sundayAdFirstDate: toISODate(getNextSunday(addDays(new Date(), -50))),
      sundayAdSecondDate: toISODate(getNextSunday(addDays(new Date(), -43))),
      sundayAdNewspaper: 'New York Times',
      jobOrderStartDate: toISODate(addDays(new Date(), -55)),
      jobOrderEndDate: toISODate(addDays(new Date(), -25)),
      jobOrderState: 'NY',
      noticeOfFilingStartDate: toISODate(addDays(new Date(), -50)),
      noticeOfFilingEndDate: toISODate(addDays(new Date(), -36)), // +10 business days
      recruitmentApplicantsCount: 3,
      isProfessionalOccupation: false,
    },
    autoCalculatedFields: new Set(['noticeOfFilingEndDate', 'jobOrderEndDate']),
  },
};

/**
 * With validation errors
 */
export const WithErrors: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      sundayAdFirstDate: '2024-03-04', // Monday - not a Sunday
      sundayAdSecondDate: '2024-03-03', // Before first ad
      jobOrderStartDate: toISODate(addDays(new Date(), -10)),
      jobOrderEndDate: toISODate(addDays(new Date(), -5)), // < 30 days
      isProfessionalOccupation: false,
    },
    errors: {
      sundayAdFirstDate: 'Date must be a Sunday',
      sundayAdSecondDate: 'Must be after first Sunday ad',
      jobOrderEndDate: 'Job order must be at least 30 days',
    },
  },
};

// ============================================================================
// PROFESSIONAL OCCUPATION STORIES
// ============================================================================

/**
 * Professional occupation unchecked (default)
 */
export const ProfessionalUnchecked: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      isProfessionalOccupation: false,
    },
  },
};

/**
 * Professional occupation checked - empty methods (0/3)
 */
export const ProfessionalEmpty: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: '', date: '', description: '' },
      ],
    },
  },
};

/**
 * Professional occupation - 1/3 methods filled
 */
export const ProfessionalOneMethod: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'job_fair', date: toISODate(addDays(new Date(), -15)), description: 'Local tech job fair' },
      ],
    },
  },
};

/**
 * Professional occupation - 2/3 methods filled
 */
export const ProfessionalTwoMethods: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'job_fair', date: toISODate(addDays(new Date(), -20)), description: 'Local tech job fair' },
        { method: 'employer_website', date: toISODate(addDays(new Date(), -18)), description: 'Company careers page' },
      ],
    },
  },
};

/**
 * Professional occupation - all 3 methods filled (complete)
 */
export const ProfessionalComplete: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -60)),
      pwdExpirationDate: toISODate(addDays(new Date(), 305)),
      sundayAdFirstDate: toISODate(getNextSunday(addDays(new Date(), -50))),
      sundayAdSecondDate: toISODate(getNextSunday(addDays(new Date(), -43))),
      sundayAdNewspaper: 'New York Times',
      jobOrderStartDate: toISODate(addDays(new Date(), -55)),
      jobOrderEndDate: toISODate(addDays(new Date(), -25)),
      jobOrderState: 'NY',
      noticeOfFilingStartDate: toISODate(addDays(new Date(), -50)),
      noticeOfFilingEndDate: toISODate(addDays(new Date(), -36)),
      recruitmentApplicantsCount: 5,
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'job_fair', date: toISODate(addDays(new Date(), -45)), description: 'NYC Tech Job Fair' },
        { method: 'employer_website', date: toISODate(addDays(new Date(), -48)), description: 'careers.company.com' },
        { method: 'campus_placement', date: toISODate(addDays(new Date(), -42)), description: 'Columbia University' },
      ],
      additionalRecruitmentStartDate: toISODate(addDays(new Date(), -48)),
      additionalRecruitmentEndDate: toISODate(addDays(new Date(), -42)),
    },
    autoCalculatedFields: new Set(['noticeOfFilingEndDate', 'jobOrderEndDate']),
  },
};

/**
 * Professional occupation with method validation errors
 */
export const ProfessionalWithErrors: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: '', date: '', description: '' },
        { method: 'job_fair', date: '', description: '' },
      ],
    },
    errors: {
      'additionalRecruitmentMethods.0.method': 'Method is required',
      'additionalRecruitmentMethods.1.date': 'Date is required',
    },
  },
};

// ============================================================================
// DEADLINE INDICATOR STORIES
// ============================================================================

/**
 * Deadline indicator - plenty of time
 */
export const DeadlinePlentyOfTime: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -10)),
      pwdExpirationDate: toISODate(addDays(new Date(), 355)),
      isProfessionalOccupation: false,
    },
  },
};

/**
 * Deadline indicator - warning (30 days remaining)
 */
export const DeadlineWarning: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -300)),
      pwdExpirationDate: toISODate(addDays(new Date(), 55)), // ~25 days left for recruitment
      isProfessionalOccupation: false,
    },
  },
};

/**
 * Deadline indicator - urgent (14 days remaining)
 */
export const DeadlineUrgent: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -340)),
      pwdExpirationDate: toISODate(addDays(new Date(), 40)), // ~10 days left for recruitment
      isProfessionalOccupation: false,
    },
  },
};

/**
 * Deadline indicator - expired
 */
export const DeadlineExpired: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -400)),
      pwdExpirationDate: toISODate(addDays(new Date(), -5)), // Already expired
      isProfessionalOccupation: false,
    },
  },
};

// ============================================================================
// AUTO-CALCULATION STORIES
// ============================================================================

/**
 * Auto-calculated fields marked with "Auto" badge
 */
export const AutoCalculatedFields: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      noticeOfFilingStartDate: toISODate(addDays(new Date(), -20)),
      noticeOfFilingEndDate: toISODate(addDays(new Date(), -6)), // Auto-calculated
      jobOrderStartDate: toISODate(addDays(new Date(), -25)),
      jobOrderEndDate: toISODate(addDays(new Date(), 5)), // Auto-calculated
      isProfessionalOccupation: false,
    },
    autoCalculatedFields: new Set(['noticeOfFilingEndDate', 'jobOrderEndDate']),
  },
};

// ============================================================================
// INTERACTIVE STORIES
// ============================================================================

/**
 * Interactive playground - all features
 */
export const Playground: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -30)),
      pwdExpirationDate: toISODate(addDays(new Date(), 335)),
      sundayAdFirstDate: '',
      sundayAdSecondDate: '',
      sundayAdNewspaper: '',
      jobOrderStartDate: '',
      jobOrderEndDate: '',
      jobOrderState: '',
      noticeOfFilingStartDate: '',
      noticeOfFilingEndDate: '',
      recruitmentApplicantsCount: 0,
      isProfessionalOccupation: false,
      additionalRecruitmentMethods: [],
    },
  },
};

/**
 * Dark mode showcase
 */
export const DarkMode: Story = {
  args: {
    values: {
      pwdDeterminationDate: toISODate(addDays(new Date(), -60)),
      pwdExpirationDate: toISODate(addDays(new Date(), 305)),
      sundayAdFirstDate: toISODate(getNextSunday(addDays(new Date(), -50))),
      sundayAdSecondDate: toISODate(getNextSunday(addDays(new Date(), -43))),
      sundayAdNewspaper: 'New York Times',
      jobOrderStartDate: toISODate(addDays(new Date(), -55)),
      jobOrderEndDate: toISODate(addDays(new Date(), -25)),
      jobOrderState: 'NY',
      noticeOfFilingStartDate: toISODate(addDays(new Date(), -50)),
      noticeOfFilingEndDate: toISODate(addDays(new Date(), -36)),
      recruitmentApplicantsCount: 3,
      isProfessionalOccupation: true,
      additionalRecruitmentMethods: [
        { method: 'job_fair', date: toISODate(addDays(new Date(), -45)), description: 'NYC Tech Job Fair' },
        { method: 'employer_website', date: toISODate(addDays(new Date(), -48)), description: '' },
        { method: 'campus_placement', date: toISODate(addDays(new Date(), -42)), description: 'Columbia University' },
      ],
    },
    autoCalculatedFields: new Set(['noticeOfFilingEndDate', 'jobOrderEndDate']),
  },
  parameters: {
    backgrounds: { default: 'dark' },
  },
};
