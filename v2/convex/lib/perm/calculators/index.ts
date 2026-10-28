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
  calculateStepDeadlineUnderPwd,
  STEP_DEADLINE_CONFIGS,
  lastSundayOnOrBefore,
  calculateNoticeOfFilingEnd,
  calculateJobOrderEnd,
  type RecruitmentDeadlines,
} from './recruitment';
export { calculateI140FilingDeadline } from './i140';
export { calculateRFIDueDate } from './rfi';
export {
  denialReviewStep,
  denialReviewDeadline,
  calculateDenialReviewDeadline,
  calculateBalcaRequestDeadline,
  type DenialReviewInput,
  type DenialReviewStep,
} from './denialReview';
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
  rangeCaveat,
  SERVED_MIN_JUDGED,
  type RangeCoverage,
  type MeasuredBucket,
  type QueueEstimate,
  type QueueEstimateInput,
  type QueuePosition,
  type CohortMaturity,
  type CohortStat,
  type DolFrontier,
  type EstimateModel,
  type EstimateModelId,
} from './queueEstimate';
// Decision-pace estimation: cases ahead divided by DOL's measured daily rate.
// It leads the PERM estimate; the module header says where its rate comes
// from and how that is checked.
export {
  measurePace,
  estimateByPace,
  MIN_WEEKDAYS,
  COLLAPSE_FRACTION,
  MAX_HORIZON_DAYS,
  MIN_BAND_FRACTION,
  MIN_BAND_DAYS,
  MAX_BAND_DAYS,
  boundRange,
  type DecisionDay,
  type MeasuredPace,
  type PaceEstimateInput,
  type PaceEstimate,
  type PaceRefusal,
  type MeasuredRangeRow,
} from './decisionPace';
export {
  estimatePwdQueue,
  monthInDolTable,
  estimatePwdDay,
  measureWorkdayPace,
  PWD_MIN_WORKDAYS,
  PWD_DAY_MAX_AGE_DAYS,
  measurePwdClearance,
  type PwdBacklogMonth,
  type PwdDayQueue,
  type WorkdayPace,
  type PwdDayInput,
  type PwdDayEstimate,
  type PwdQueueInput,
  type PwdQueueEstimate,
} from './pwdQueue';
export { estimateRfiCase, type RfiClock, type RfiEstimate } from './rfiClock';
export {
  estimateI140Queue,
  type I140QuarterStats,
  type I140QueueInput,
  type I140QueueEstimate,
} from './i140Queue';
export {
  buildPlan,
  I140_FILE_BY_DAYS,
  I140_PREP_DAYS_ASSUMED,
  MILESTONE_ORDER,
  MILESTONES,
  monthsToDays,
  orderedSpan,
  PLAN_STAGES,
  RECRUITMENT_MIN_DAYS,
  SIDE_STAGES,
  type BulletinMethod,
  type BulletinReading,
  type DayRange,
  type Milestone,
  type OwnCosts,
  type Payer,
  type Plan,
  type PlanCost,
  type PlanFigures,
  type PlanInput,
  type PlanStage,
  type PlanStep,
  type QueueDating,
  type SideStage,
  type Span,
  type StageInfo,
  type StageOwner,
  type StepState,
} from './greenCardPlan';
export {
  estimatePriorityDate,
  parseCutoff,
  monthsToReach,
  paceByLine,
  type PaceBasis,
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
