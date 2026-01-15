/**
 * RecruitmentSection Constants
 *
 * US States and recruitment method options for PERM forms.
 */

// ============================================================================
// US STATES
// ============================================================================

/**
 * US States (50 states + DC)
 * Sorted alphabetically by name
 */
export const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

export type USStateCode = (typeof US_STATES)[number]['value'];

// ============================================================================
// RECRUITMENT METHODS
// ============================================================================

/**
 * Additional recruitment methods per 20 CFR § 656.17(e)
 * Professional occupations require 3 from this list
 */
export const RECRUITMENT_METHODS = [
  { value: 'local_newspaper', label: 'Local/Ethnic Newspaper Ad' },
  { value: 'radio_ad', label: 'Radio Advertisement' },
  { value: 'tv_ad', label: 'Television Advertisement' },
  { value: 'job_fair', label: 'Job Fair' },
  { value: 'campus_placement', label: 'Campus Placement Office' },
  { value: 'trade_organization', label: 'Trade/Professional Organization' },
  { value: 'private_employment_firm', label: 'Private Employment Firm' },
  { value: 'employee_referral', label: 'Employee Referral Program' },
  { value: 'employer_website', label: "Employer's Website" },
  { value: 'job_website_ad', label: 'Job Website (Indeed, Monster, etc.)' },
  { value: 'on_campus_recruitment', label: 'On-Campus Recruitment' },
];

export type RecruitmentMethodValue = (typeof RECRUITMENT_METHODS)[number]['value'];
