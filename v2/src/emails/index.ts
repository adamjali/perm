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

// Shared components
export {
  EmailLayout,
  EmailButton,
  EmailHeader,
} from "./components";

export type {
  EmailLayoutProps,
  EmailButtonProps,
  EmailHeaderProps,
} from "./components";
