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
