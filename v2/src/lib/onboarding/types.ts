/** Wizard step identifiers */
export type OnboardingWizardStep =
  | "welcome"
  | "role"
  | "create_case"
  | "value_preview"
  | "completion";

/** Overall onboarding step stored in DB */
export type OnboardingStep =
  | OnboardingWizardStep
  | "tour_pending"
  | "tour_completed"
  | "done"
  | null;

/** Role options for the role selection step */
export type UserRole =
  | "Immigration Attorney"
  | "Paralegal"
  | "HR Professional"
  | "Employer/Petitioner"
  | "Other";

/** Checklist item definition */
export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  href?: string;
}

/** Tour phase — each phase targets a specific page */
export type TourPhase =
  | "dashboard"
  | "cases"
  | "calendar"
  | "settings"
  | "chat"
  | null;

/** A single tour step targeting a DOM element */
export interface TourStepConfig {
  element: string;
  title: string;
  description: string;
}

/** A tour phase with its target page and steps */
export interface TourPhaseConfig {
  phase: TourPhase;
  page: string;
  steps: TourStepConfig[];
}

/** Onboarding context value */
export interface OnboardingContextValue {
  /** Current onboarding step from DB */
  step: OnboardingStep;
  /** Whether the wizard should be shown (blocking modal) */
  showWizard: boolean;
  /** Whether the tour should be launched */
  showTour: boolean;
  /** Current tour phase for multi-page tour */
  tourPhase: TourPhase;
  /** Completed checklist items */
  completedChecklistItems: string[];
  /** Whether the checklist is dismissed */
  isChecklistDismissed: boolean;
  /** Whether onboarding is loading */
  isLoading: boolean;
  /** Case ID created during onboarding wizard */
  onboardingCaseId: string | null;
  /** Case info created during wizard (for display in completion step) */
  onboardingCaseInfo: { employerName: string; positionTitle: string } | null;
  /** Actions */
  advanceWizardStep: (step: string) => Promise<void>;
  setOnboardingCaseId: (id: string) => void;
  setOnboardingCaseInfo: (info: { employerName: string; positionTitle: string }) => void;
  completeChecklistItem: (itemId: string) => Promise<void>;
  dismissChecklist: () => Promise<void>;
  startTour: () => void;
  skipTour: () => void;
  advanceTourPhase: () => void;
}
