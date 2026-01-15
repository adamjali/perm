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

import { useMemo, useState, useCallback } from "react";
import type { CaseFormData } from "@/lib/forms/case-form-schema";
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
  isManualOverride: boolean;
  disabledReason?: string;
  overrideWarning?: string;
  statusInfo?: string;
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
function createSectionState(
  isOpen: boolean,
  isEnabled: boolean,
  isManualOverride: boolean,
  disabledReason?: string,
  overrideWarning?: string,
  statusInfo?: string
): SectionState {
  return {
    isOpen,
    isEnabled,
    isManualOverride,
    disabledReason,
    overrideWarning,
    statusInfo,
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
    return DEFAULT_WINDOW_STATUS;
  }
}

/**
 * Hook to manage section states
 */
export function useSectionState(values: Partial<CaseFormData>) {
  const [overrides, setOverride, _toggleOverride] = useToggleMap<SectionName>({
    pwd: false,
    recruitment: false,
    professional: false,
    eta9089: false,
    i140: false,
    notes: false,
  });

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
    const pwdState = createSectionState(expanded.pwd, true, false);

    // Recruitment Section - Needs PWD determination date
    const recruitmentEnabled = !!values.pwdDeterminationDate;
    const recruitmentOverride = overrides.recruitment && !recruitmentEnabled;
    const recruitmentState = createSectionState(
      expanded.recruitment || (recruitmentEnabled && !expanded.pwd),
      recruitmentEnabled,
      recruitmentOverride,
      !recruitmentEnabled ? 'Enter PWD determination date first' : undefined,
      recruitmentOverride
        ? 'Warning: Entering recruitment dates before PWD determination may cause validation issues'
        : undefined
    );

    // Professional Section - Enabled when recruitment is enabled
    const professionalOverride = overrides.professional && !recruitmentEnabled;
    const professionalState = createSectionState(
      expanded.professional,
      recruitmentEnabled,
      professionalOverride,
      !recruitmentEnabled ? 'Complete PWD section first' : undefined
    );

    // ETA 9089 Section - Needs complete recruitment + 30-day window open
    const recruitmentComplete = isBasicRecruitmentComplete(values) && isProfessionalRecruitmentComplete(values);
    const eta9089Enabled = recruitmentComplete && eta9089Window.isOpen;
    const eta9089Override = overrides.eta9089 && !eta9089Enabled;

    let eta9089DisabledReason: string | undefined;
    let eta9089StatusInfo: string | undefined;

    if (!recruitmentComplete) {
      eta9089DisabledReason = 'Complete all recruitment activities first';
    } else if (!eta9089Window.isOpen && eta9089Window.daysUntilOpen && eta9089Window.daysUntilOpen > 0) {
      eta9089DisabledReason = `30-day waiting period: ${eta9089Window.daysUntilOpen} days remaining`;
      eta9089StatusInfo = `Filing window opens on ${eta9089Window.opensOn}`;
    } else if (eta9089Window.daysRemaining && eta9089Window.daysRemaining <= 0) {
      eta9089DisabledReason = 'Filing window has closed';
    }

    const eta9089State = createSectionState(
      expanded.eta9089,
      eta9089Enabled,
      eta9089Override,
      eta9089DisabledReason,
      eta9089Override
        ? 'Warning: Filing ETA 9089 outside the proper window may cause issues'
        : undefined,
      eta9089StatusInfo
    );

    // I-140 Section - Needs ETA 9089 certification date
    const i140Enabled = !!values.eta9089CertificationDate;
    const i140Override = overrides.i140 && !i140Enabled;
    const i140State = createSectionState(
      expanded.i140,
      i140Enabled,
      i140Override,
      !i140Enabled ? 'Enter ETA 9089 certification date first' : undefined,
      i140Override
        ? 'Warning: I-140 cannot be filed before ETA 9089 certification'
        : undefined
    );

    // Notes Section - Always enabled
    const notesState = createSectionState(expanded.notes, true, false);

    return {
      pwd: pwdState,
      recruitment: recruitmentState,
      professional: professionalState,
      eta9089: eta9089State,
      i140: i140State,
      notes: notesState,
    };
  }, [values, expanded, overrides]);

  const enableOverride = useCallback((section: SectionName) => {
    setOverride(section, true);
    setExpanded(section, true);
  }, [setOverride, setExpanded]);

  const disableOverride = useCallback((section: SectionName) => {
    setOverride(section, false);
  }, [setOverride]);

  const isSectionInteractable = useCallback((section: SectionName): boolean => {
    const state = sectionStates[section];
    return state.isEnabled || state.isManualOverride;
  }, [sectionStates]);

  const eta9089WindowStatus = useMemo(() => getETA9089WindowStatus(values), [values]);

  return {
    sectionStates,
    toggleSection: toggleExpanded,
    enableOverride,
    disableOverride,
    openSection: useCallback((s: SectionName) => setExpanded(s, true), [setExpanded]),
    closeSection: useCallback((s: SectionName) => setExpanded(s, false), [setExpanded]),
    isSectionInteractable,
    eta9089WindowStatus,
    isRecruitmentComplete: isBasicRecruitmentComplete(values),
    isProfessionalComplete: isProfessionalRecruitmentComplete(values),
  };
}
