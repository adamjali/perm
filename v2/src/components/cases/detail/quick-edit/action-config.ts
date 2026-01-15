/**
 * Quick Edit Action Configuration
 *
 * Maps each NextAction type to its required fields, validation constraints,
 * and display configuration. Used by QuickEditFields to render the correct
 * fields for each action type.
 *
 * Action Categories:
 * - Editable: Has fields the user can fill in
 * - Waiting: Info-only display (estimated timeline, tips)
 * - Complete: No action needed
 */

import type { CaseFormData } from "@/lib/forms";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Field configuration for a quick-edit field
 */
export interface QuickEditFieldConfig {
  /** Field name from CaseFormData */
  name: keyof CaseFormData;
  /** Display label */
  label: string;
  /** Type of field */
  type: "date" | "select" | "text" | "number";
  /** Whether Sunday-only constraint applies (for Sunday ads) */
  sundayOnly?: boolean;
  /** Whether this field triggers auto-calculation of a dependent field */
  triggersCalculation?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether this field is auto-calculated (read-only display) */
  autoCalculated?: boolean;
}

/**
 * Waiting action info configuration
 */
export interface WaitingInfo {
  /** Estimated wait time */
  estimatedTime: string;
  /** Helpful tips for the user */
  tips: string[];
}

/**
 * Action configuration
 */
export interface ActionConfig {
  /** Whether this action has editable fields */
  type: "editable" | "waiting" | "complete" | "complex";
  /** Fields to render (for editable actions) */
  fields?: QuickEditFieldConfig[];
  /** Info to display (for waiting actions) */
  waitingInfo?: WaitingInfo;
  /** Custom message for complex actions */
  complexMessage?: string;
  /** Link to full form for complex actions */
  linkToFullForm?: boolean;
}

// ============================================================================
// ACTION CONFIGURATION MAP
// ============================================================================

/**
 * Configuration for each action type returned by calculateNextAction().
 * Keys match the `action` string from NextAction.
 */
export const ACTION_CONFIG: Record<string, ActionConfig> = {
  // ========== PWD Stage ==========
  "File PWD": {
    type: "editable",
    fields: [
      {
        name: "pwdFilingDate",
        label: "PWD Filing Date",
        type: "date",
        placeholder: "Select date filed",
      },
    ],
  },

  "Wait for PWD": {
    type: "editable",
    fields: [
      {
        name: "pwdDeterminationDate",
        label: "Determination Date",
        type: "date",
        triggersCalculation: true,
        placeholder: "Enter when received",
      },
      {
        name: "pwdExpirationDate",
        label: "Expiration Date",
        type: "date",
        autoCalculated: true,
        placeholder: "Auto-calculated",
      },
    ],
  },

  "Start Recruitment": {
    type: "editable",
    fields: [
      {
        name: "jobOrderStartDate",
        label: "Job Order Start",
        type: "date",
        triggersCalculation: true,
        placeholder: "Select start date",
      },
    ],
  },

  // ========== Recruitment Stage ==========
  "Post Job Order": {
    type: "editable",
    fields: [
      {
        name: "jobOrderStartDate",
        label: "Job Order Start",
        type: "date",
        triggersCalculation: true,
        placeholder: "Select start date",
      },
      {
        name: "jobOrderEndDate",
        label: "Job Order End",
        type: "date",
        autoCalculated: true,
        placeholder: "Auto-calculated (+30 days)",
      },
    ],
  },

  "Post Notice of Filing": {
    type: "editable",
    fields: [
      {
        name: "noticeOfFilingStartDate",
        label: "Notice Start",
        type: "date",
        triggersCalculation: true,
        placeholder: "Select start date",
      },
      {
        name: "noticeOfFilingEndDate",
        label: "Notice End",
        type: "date",
        autoCalculated: true,
        placeholder: "Auto-calculated (+10 business days)",
      },
    ],
  },

  "Place Sunday Ads": {
    type: "editable",
    fields: [
      {
        name: "sundayAdFirstDate",
        label: "First Sunday Ad",
        type: "date",
        sundayOnly: true,
        placeholder: "Select first Sunday",
      },
      {
        name: "sundayAdSecondDate",
        label: "Second Sunday Ad",
        type: "date",
        sundayOnly: true,
        placeholder: "Select second Sunday",
      },
    ],
  },

  "Complete Additional Recruitment": {
    type: "complex",
    complexMessage: "Professional recruitment requires 3 methods. Use the full edit form to add recruitment methods.",
    linkToFullForm: true,
  },

  "Wait for Filing Window": {
    type: "waiting",
    waitingInfo: {
      estimatedTime: "Check deadline countdown",
      tips: [
        "30-day waiting period after last recruitment step",
        "Filing window opens automatically",
        "Prepare ETA 9089 application in advance",
      ],
    },
  },

  // ========== ETA 9089 Stage ==========
  "File ETA 9089": {
    type: "editable",
    fields: [
      {
        name: "eta9089FilingDate",
        label: "ETA 9089 Filing Date",
        type: "date",
        placeholder: "Select filing date",
      },
    ],
  },

  "Wait for Certification": {
    type: "editable",
    fields: [
      {
        name: "eta9089CertificationDate",
        label: "Certification Date",
        type: "date",
        triggersCalculation: true,
        placeholder: "Enter when certified",
      },
      {
        name: "eta9089ExpirationDate",
        label: "Expiration Date",
        type: "date",
        autoCalculated: true,
        placeholder: "Auto-calculated (+180 days)",
      },
    ],
  },

  // ========== I-140 Stage ==========
  "File I-140": {
    type: "editable",
    fields: [
      {
        name: "i140FilingDate",
        label: "I-140 Filing Date",
        type: "date",
        placeholder: "Select filing date",
      },
    ],
  },

  "Wait for I-140 Decision": {
    type: "editable",
    fields: [
      {
        name: "i140ApprovalDate",
        label: "Approval Date",
        type: "date",
        placeholder: "Enter when approved",
      },
    ],
  },

  "Case Complete": {
    type: "complete",
  },

  // ========== RFI/RFE (Complex - handled in full form) ==========
  "Respond to RFI": {
    type: "complex",
    complexMessage: "RFI response requires detailed entry. Use the full edit form to record your response.",
    linkToFullForm: true,
  },

  "Respond to RFE": {
    type: "complex",
    complexMessage: "RFE response requires detailed entry. Use the full edit form to record your response.",
    linkToFullForm: true,
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get the configuration for an action by its name
 */
export function getActionConfig(actionName: string): ActionConfig | undefined {
  return ACTION_CONFIG[actionName];
}

/**
 * Check if an action has editable fields
 */
export function isEditableAction(actionName: string): boolean {
  const config = ACTION_CONFIG[actionName];
  return config?.type === "editable" && (config.fields?.length ?? 0) > 0;
}

/**
 * Check if an action is a waiting/info-only action
 */
export function isWaitingAction(actionName: string): boolean {
  const config = ACTION_CONFIG[actionName];
  return config?.type === "waiting";
}

/**
 * Check if an action is complex (requires full form)
 */
export function isComplexAction(actionName: string): boolean {
  const config = ACTION_CONFIG[actionName];
  return config?.type === "complex";
}

/**
 * Get field names for an action (for partial update payload)
 */
export function getActionFieldNames(actionName: string): (keyof CaseFormData)[] {
  const config = ACTION_CONFIG[actionName];
  if (config?.type !== "editable" || !config.fields) {
    return [];
  }
  return config.fields.map(f => f.name);
}
