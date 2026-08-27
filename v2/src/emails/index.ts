/**
 * Email Templates Barrel Export
 * All PERM Tracker email templates.
 *
 * Templates:
 * - DeadlineReminder: Sent when deadlines are approaching
 * - StatusChange: Sent when case status changes
 * - RfiAlert: Sent for RFI (Request for Information) events
 * - RfeAlert: Sent for RFE (Request for Evidence) events
 * - WeeklyDigest: Weekly summary email sent every Monday morning
 *
 * Shared components are in ./components/
 *
 * Phase: 24 (Notifications + Email), 25.1 (Weekly Digest)
 */

// Email templates
export { DeadlineReminder } from "./DeadlineReminder";
export type { DeadlineReminderProps } from "./DeadlineReminder";

export { StatusChange } from "./StatusChange";
export type { StatusChangeProps } from "./StatusChange";

export { RfiAlert } from "./RfiAlert";
export type { RfiAlertProps } from "./RfiAlert";

export { RfeAlert } from "./RfeAlert";
export type { RfeAlertProps } from "./RfeAlert";

export { AutoClosure } from "./AutoClosure";
export type { AutoClosureProps } from "./AutoClosure";

export { WeeklyDigest } from "./WeeklyDigest";
export type { WeeklyDigestProps } from "./WeeklyDigest";

export { VerificationCode } from "./VerificationCode";
export type { VerificationCodeProps } from "./VerificationCode";

export { PasswordResetCode } from "./PasswordResetCode";
export type { PasswordResetCodeProps } from "./PasswordResetCode";

export { TestEmail } from "./TestEmail";
export type { TestEmailProps } from "./TestEmail";

export { QueueAlertConfirm } from "./QueueAlertConfirm";
export type { QueueAlertConfirmProps } from "./QueueAlertConfirm";

export { QueueReached, DOL_PROCESSING_TIMES_URL } from "./QueueReached";
export type { QueueReachedProps } from "./QueueReached";

export { CaseAlertConfirm } from "./CaseAlertConfirm";
export type { CaseAlertConfirmProps } from "./CaseAlertConfirm";

export { CaseStatusChanged, CASE_PAGE_URL } from "./CaseStatusChanged";
export type { CaseStatusChangedProps } from "./CaseStatusChanged";

// Shared components
export {
  EmailLayout,
  EmailButton,
  EmailHeader,
  EmailLinkList,
  FigureTable,
  QueueStamp,
  StatusRail,
} from "./components";

export type {
  EmailLayoutProps,
  EmailButtonProps,
  EmailHeaderProps,
  EmailLinkListProps,
  EmailLinkListItem,
  FigureRow,
  FigureTableProps,
  QueueStampProps,
  StatusRailProps,
} from "./components";
