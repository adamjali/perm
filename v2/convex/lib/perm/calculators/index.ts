/**
 * PERM deadline calculators.
 *
 * This module provides calculators for computing critical PERM deadlines
 * based on 20 CFR § 656.40 regulations.
 */

export { calculatePWDExpiration } from './pwd';
export {
  calculateETA9089Window,
  calculateETA9089Expiration,
  calculateRecruitmentEnd,
  type ETA9089Window,
} from './eta9089';
export {
  calculateRecruitmentDeadlines,
  calculateStepDeadline,
  STEP_DEADLINE_CONFIGS,
  lastSundayOnOrBefore,
  calculateNoticeOfFilingEnd,
  calculateJobOrderEnd,
  type RecruitmentDeadlines,
} from './recruitment';
export { calculateI140FilingDeadline } from './i140';
export { calculateRFIDueDate } from './rfi';
export {
  calculateH1bMaxOut,
  H1B_MAX_YEARS,
  PERM_ADVANCE_DAYS,
  type H1bMaxOutInput,
  type H1bMaxOutResult,
} from './h1bMaxOut';
export {
  calculatePriorityDateRetention,
  RETENTION_DAYS,
  type RetentionInput,
  type RetentionResult,
} from './priorityDateRetention';
export {
  estimateQueueDecision,
  measureFrontierAdvance,
  measureFrontierAdvanceRange,
  cohortMaturity,
  reportablePercentiles,
  COHORT_SETTLED_MONTHS,
  type QueueEstimate,
  type QueueEstimateInput,
  type QueuePosition,
  type CohortMaturity,
  type CohortStat,
  type DolFrontier,
  type EstimateModel,
  type EstimateModelId,
} from './queueEstimate';
// Decision-pace estimation: cases-ahead divided by DOL's measured daily rate,
// the shape both rivals use. Exported and tested but NOT yet feeding any
// rendered number - the substitution it would need in production (our
// observation dates for DOL's decision dates) has zero days of overlap to be
// validated against until FY2026 Q4 publishes. See the module header.
export {
  measurePace,
  estimateByPace,
  MIN_WEEKDAYS,
  COLLAPSE_FRACTION,
  MAX_HORIZON_DAYS,
  MIN_BAND_FRACTION,
  MIN_BAND_DAYS,
  type DecisionDay,
  type MeasuredPace,
  type PaceEstimateInput,
  type PaceEstimate,
  type PaceRefusal,
} from './decisionPace';
export {
  estimatePwdQueue,
  measurePwdClearance,
  type PwdBacklogMonth,
  type PwdQueueInput,
  type PwdQueueEstimate,
} from './pwdQueue';
export {
  estimateI140Queue,
  type I140QuarterStats,
  type I140QueueInput,
  type I140QueueEstimate,
} from './i140Queue';
export {
  buildGreenCardTimeline,
  keyDatesFromPwd,
  type StageCertainty,
  type TimelineStage,
  type GreenCardTimelineInput,
  type GreenCardTimeline,
} from './greenCardTimeline';
export {
  estimatePriorityDate,
  parseCutoff,
  type CountryKey,
  type ChartKind,
  type BulletinMonth,
  type Cutoff,
  type CutoffPoint,
  type PriorityDateInput,
  type PriorityDateEstimate,
} from './priorityDate';
export {
  calculateGreenCardFees,
  FEE_SCHEDULE,
  type FeeInput,
  type FeeLine,
  type FeeResult,
  type PetitionerKind,
} from './greenCardFees';
