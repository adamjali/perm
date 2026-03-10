/**
 * useSectionState Hook
 *
 * Manages section visibility and dependency states for the PERM case form.
 * Sections can be enabled/disabled based on form data, with manual override support.
 *
 * Per perm_flow.md:
 * - PWD: Always enabled (entry point)
 * - Recruitment: Enabled when PWD determination date is filled
 * - Professional: Enabled when isProfessionalOccupation is checked (within Recruitment)
 * - ETA 9089: Enabled when recruitment is complete (all required fields filled) + 30-day waiting period
 * - I-140: Enabled when ETA 9089 certification date is filled
 */

import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { format, parseISO } from "date-fns";
import type { CaseFormData } from "@/lib/forms/case-form-schema";
import { captureError } from "@/lib/sentry";
import {
  getFirstRecruitmentDate,
  getLastRecruitmentDate,
  getFilingWindowStatus,
  isBasicRecruitmentComplete,
  isProfessionalRecruitmentComplete,
} from "@/lib/perm";

export type SectionName = 'pwd' | 'recruitment' | 'professional' | 'eta9089' | 'i140' | 'notes';

export interface SectionState {
  isOpen: boolean;
  isEnabled: boolean;
  disabledReason?: string;
  statusInfo?: string;
  isComplete: boolean;
  summary?: string;
}

export interface WindowStatus {
  isOpen: boolean;
  opensOn?: string;
  closesOn?: string;
  daysUntilOpen?: number;
  daysRemaining?: number;
  isPwdLimited?: boolean;
}

const DEFAULT_WINDOW_STATUS: WindowStatus = {
  isOpen: false,
  daysUntilOpen: 0,
  daysRemaining: 0,
};

/**
 * Creates a toggle map state with set/toggle operations
 */
function useToggleMap<K extends string>(
  initialState: Record<K, boolean>
): [
  Record<K, boolean>,
  (key: K, value: boolean) => void,
  (key: K) => void
] {
  const [state, setState] = useState(initialState);

  const set = useCallback((key: K, value: boolean) => {
    setState(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggle = useCallback((key: K) => {
    setState(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  return [state, set, toggle];
}

/**
 * Creates a section state object
 */
function createSectionState(opts: {
  isOpen: boolean;
  isEnabled: boolean;
  disabledReason?: string;
  statusInfo?: string;
  isComplete?: boolean;
  summary?: string;
}): SectionState {
  return {
    isOpen: opts.isOpen,
    isEnabled: opts.isEnabled,
    disabledReason: opts.disabledReason,
    statusInfo: opts.statusInfo,
    isComplete: opts.isComplete || false,
    summary: opts.summary,
  };
}

/**
 * Get the ETA 9089 filing window status from form values
 */
function getETA9089WindowStatus(values: Partial<CaseFormData>): WindowStatus {
  try {
    const status = getFilingWindowStatus({
      firstRecruitmentDate: getFirstRecruitmentDate(values),
      lastRecruitmentDate: getLastRecruitmentDate(values, values.isProfessionalOccupation ?? false),
      pwdExpirationDate: values.pwdExpirationDate,
    });

    return {
      isOpen: status.status === 'open',
      opensOn: status.window?.opens,
      closesOn: status.window?.closes,
      daysUntilOpen: status.daysUntilOpen ?? 0,
      daysRemaining: status.daysRemaining ?? 0,
      isPwdLimited: status.window?.isPwdLimited,
    };
  } catch (error) {
    console.error('[useSectionState] Failed to calculate ETA 9089 window status:', error);
    captureError(error, { operation: "calculateETA9089WindowStatus" });
    return DEFAULT_WINDOW_STATUS;
  }
}

// ============================================================================
// Completion Detection
// ============================================================================

function isPWDComplete(values: Partial<CaseFormData>): boolean {
  return !!(values.pwdDeterminationDate && values.pwdExpirationDate);
}

function isETA9089Complete(values: Partial<CaseFormData>): boolean {
  return !!values.eta9089CertificationDate;
}

function isI140Complete(values: Partial<CaseFormData>): boolean {
  return !!(values.i140ApprovalDate || values.i140DenialDate);
}

// ============================================================================
// Section Summaries
// ============================================================================

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return "";
  try {
    return format(parseISO(iso), "MMM d");
  } catch {
    return "";
  }
}

function getPWDSummary(values: Partial<CaseFormData>): string | undefined {
  const det = fmtDate(values.pwdDeterminationDate);
  const exp = fmtDate(values.pwdExpirationDate);
  if (!det || !exp) return undefined;

  const parts = [`Determined ${det}`, `Expires ${exp}`];
  if (values.pwdWageAmount) {
    const wage = `$${Number(values.pwdWageAmount).toLocaleString()}`;
    const level = values.pwdWageLevel ? ` ${values.pwdWageLevel.replace("Level ", "L")}` : "";
    parts.push(`${wage}${level}`);
  }
  return parts.join(" · ");
}

function getRecruitmentSummary(values: Partial<CaseFormData>): string | undefined {
  const parts: string[] = [];

  // Job order
  const joStart = fmtDate(values.jobOrderStartDate);
  const joEnd = fmtDate(values.jobOrderEndDate);
  if (joStart && joEnd) parts.push(`Job Order ${joStart}–${joEnd}`);

  // Sunday ads count
  const adCount = [values.sundayAdFirstDate, values.sundayAdSecondDate].filter(Boolean).length;
  if (adCount > 0) parts.push(`${adCount} Ad${adCount > 1 ? "s" : ""}`);

  // Notice of filing
  const nofStart = fmtDate(values.noticeOfFilingStartDate);
  if (nofStart) parts.push(`NOF ${nofStart}`);

  // Professional methods
  if (values.isProfessionalOccupation && values.additionalRecruitmentMethods) {
    const methodCount = values.additionalRecruitmentMethods.filter(
      (m) => m.method && (m.date || m.startDate || (m.subEntries && m.subEntries.length > 0))
    ).length;
    if (methodCount > 0) parts.push(`${methodCount} method${methodCount > 1 ? "s" : ""}`);
  }

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function getETA9089Summary(values: Partial<CaseFormData>): string | undefined {
  const parts: string[] = [];

  const filed = fmtDate(values.eta9089FilingDate);
  if (filed) parts.push(`Filed ${filed}`);

  const cert = fmtDate(values.eta9089CertificationDate);
  if (cert) parts.push(`Certified ${cert}`);

  if (values.eta9089CaseNumber) parts.push(`Case ${values.eta9089CaseNumber}`);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

function getI140Summary(values: Partial<CaseFormData>): string | undefined {
  const parts: string[] = [];

  const filed = fmtDate(values.i140FilingDate);
  if (filed) parts.push(`Filed ${filed}`);

  const approved = fmtDate(values.i140ApprovalDate);
  const denied = fmtDate(values.i140DenialDate);
  if (approved) parts.push(`Approved ${approved}`);
  else if (denied) parts.push(`Denied ${denied}`);

  if (values.i140ReceiptNumber) parts.push(values.i140ReceiptNumber);

  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Hook to manage section states
 */
export function useSectionState(values: Partial<CaseFormData>) {
  const [expanded, setExpanded, toggleExpanded] = useToggleMap<SectionName>({
    pwd: true,
    recruitment: false,
    professional: false,
    eta9089: false,
    i140: false,
    notes: false,
  });

  const sectionStates = useMemo((): Record<SectionName, SectionState> => {
    const eta9089Window = getETA9089WindowStatus(values);

    // PWD Section - Always enabled
    const pwdComplete = isPWDComplete(values);
    const pwdState = createSectionState({ isOpen: expanded.pwd, isEnabled: true, isComplete: pwdComplete, summary: getPWDSummary(values) });

    // Recruitment Section - Needs PWD determination date
    const recruitmentEnabled = !!values.pwdDeterminationDate;
    const recruitmentComplete = isBasicRecruitmentComplete(values) && isProfessionalRecruitmentComplete(values);
    const recruitmentState = createSectionState({
      isOpen: expanded.recruitment,
      isEnabled: recruitmentEnabled,
      disabledReason: !recruitmentEnabled ? 'Enter PWD determination date first' : undefined,
      isComplete: recruitmentComplete,
      summary: getRecruitmentSummary(values),
    });

    // Professional Section - Enabled when recruitment is enabled
    const professionalState = createSectionState({
      isOpen: expanded.professional,
      isEnabled: recruitmentEnabled,
      disabledReason: !recruitmentEnabled ? 'Complete PWD section first' : undefined,
    });

    // ETA 9089 Section - Needs complete recruitment + 30-day window open
    const eta9089Enabled = recruitmentComplete && eta9089Window.isOpen;

    let eta9089DisabledReason: string | undefined;
    let eta9089StatusInfo: string | undefined;

    if (!recruitmentComplete) {
      eta9089DisabledReason = 'Complete all recruitment activities first';
    } else if (!eta9089Window.isOpen && eta9089Window.daysUntilOpen && eta9089Window.daysUntilOpen > 0) {
      eta9089DisabledReason = `30-day waiting period: ${eta9089Window.daysUntilOpen} days remaining`;
      eta9089StatusInfo = `Opens ${fmtDate(eta9089Window.opensOn)} · ${eta9089Window.daysUntilOpen}d remaining`;
    } else if (eta9089Window.isOpen && eta9089Window.daysRemaining && eta9089Window.daysRemaining > 0) {
      eta9089StatusInfo = `Window closes in ${eta9089Window.daysRemaining}d`;
    } else if (eta9089Window.daysRemaining !== undefined && eta9089Window.daysRemaining <= 0) {
      eta9089DisabledReason = 'Filing window has closed';
    }

    const eta9089Complete = isETA9089Complete(values);
    const eta9089State = createSectionState({
      isOpen: expanded.eta9089,
      isEnabled: eta9089Enabled,
      disabledReason: eta9089DisabledReason,
      statusInfo: eta9089StatusInfo,
      isComplete: eta9089Complete,
      summary: getETA9089Summary(values),
    });

    // I-140 Section - Needs ETA 9089 certification date
    const i140Enabled = !!values.eta9089CertificationDate;
    const i140Complete = isI140Complete(values);
    const i140State = createSectionState({
      isOpen: expanded.i140,
      isEnabled: i140Enabled,
      disabledReason: !i140Enabled ? 'Enter ETA 9089 certification date first' : undefined,
      isComplete: i140Complete,
      summary: getI140Summary(values),
    });

    // Notes Section - Always enabled, never "completes"
    const notesState = createSectionState({ isOpen: expanded.notes, isEnabled: true });

    return {
      pwd: pwdState,
      recruitment: recruitmentState,
      professional: professionalState,
      eta9089: eta9089State,
      i140: i140State,
      notes: notesState,
    };
  }, [values, expanded]);

  // ============================================================================
  // Auto-open/collapse on prerequisite changes
  // ============================================================================

  const prevValues = useRef<Partial<CaseFormData>>({});
  const prevEta9089Enabled = useRef(false);
  // Track which sections have been acknowledged as complete (to prevent re-collapse)
  // Initialized to `null` — set to actual state after first render to skip initial mount
  const prevCompletionState = useRef<Record<string, boolean> | null>(null);

  useEffect(() => {
    const prev = prevValues.current;

    // PWD determination filled → auto-open Recruitment
    if (!prev.pwdDeterminationDate && values.pwdDeterminationDate) {
      setExpanded('recruitment', true);
    }

    // PWD determination cleared → collapse downstream
    if (prev.pwdDeterminationDate && !values.pwdDeterminationDate) {
      setExpanded('recruitment', false);
      setExpanded('eta9089', false);
      setExpanded('i140', false);
    }

    // ETA 9089 certification filled → auto-open I-140
    if (!prev.eta9089CertificationDate && values.eta9089CertificationDate) {
      setExpanded('i140', true);
    }

    // ETA 9089 certification cleared → collapse I-140
    if (prev.eta9089CertificationDate && !values.eta9089CertificationDate) {
      setExpanded('i140', false);
    }

    prevValues.current = { ...values };
  }, [values, setExpanded]);

  // ETA 9089 enabled transition → auto-open
  useEffect(() => {
    const currentEnabled = sectionStates.eta9089.isEnabled;
    if (!prevEta9089Enabled.current && currentEnabled) {
      setExpanded('eta9089', true);
    }
    prevEta9089Enabled.current = currentEnabled;
  }, [sectionStates.eta9089.isEnabled, setExpanded]);

  // Recruitment completeness cleared → collapse downstream
  const prevRecruitmentComplete = useRef(false);
  useEffect(() => {
    const currentComplete = sectionStates.recruitment.isComplete;
    if (prevRecruitmentComplete.current && !currentComplete) {
      // Recruitment went from complete → incomplete
      setExpanded('eta9089', false);
      setExpanded('i140', false);
    }
    prevRecruitmentComplete.current = currentComplete;
  }, [sectionStates.recruitment.isComplete, setExpanded]);

  // ============================================================================
  // Auto-collapse on completion (transition detection: incomplete → complete)
  // ============================================================================

  // Timers stored in ref so they survive effect re-runs (effect cleanup would cancel them)
  const collapseTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const sections = ['pwd', 'recruitment', 'eta9089', 'i140'] as const;
    const currentState: Record<string, boolean> = {};
    for (const s of sections) currentState[s] = sectionStates[s].isComplete;

    // Skip initial mount — record state without collapsing anything
    if (prevCompletionState.current === null) {
      prevCompletionState.current = currentState;
      return;
    }

    const prev = prevCompletionState.current;

    for (const section of sections) {
      // Detect transition: was NOT complete → IS complete, and section is open
      if (!prev[section] && currentState[section] && expanded[section] && !collapseTimers.current[section]) {
        collapseTimers.current[section] = setTimeout(() => {
          setExpanded(section, false);
          delete collapseTimers.current[section];
        }, 600);
      }
      // If section went back to incomplete, cancel any pending timer
      if (prev[section] && !currentState[section] && collapseTimers.current[section]) {
        clearTimeout(collapseTimers.current[section]);
        delete collapseTimers.current[section];
      }
    }

    prevCompletionState.current = currentState;
    // NO cleanup — timers must survive effect re-runs
  }, [sectionStates, expanded, setExpanded]);

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      for (const t of Object.values(collapseTimers.current)) clearTimeout(t);
    };
  }, []);

  const eta9089WindowStatus = useMemo(() => getETA9089WindowStatus(values), [values]);

  return {
    sectionStates,
    toggleSection: toggleExpanded,
    openSection: useCallback((s: SectionName) => setExpanded(s, true), [setExpanded]),
    closeSection: useCallback((s: SectionName) => setExpanded(s, false), [setExpanded]),
    eta9089WindowStatus,
    isRecruitmentComplete: isBasicRecruitmentComplete(values),
    isProfessionalComplete: isProfessionalRecruitmentComplete(values),
  };
}
