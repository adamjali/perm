/**
 * Email Components Barrel Export
 * Shared components for PERM Tracker email templates.
 *
 * Phase: 24 (Notifications + Email)
 */

export { EmailLayout } from "./EmailLayout";
export type { EmailLayoutProps } from "./EmailLayout";

export { EmailButton } from "./EmailButton";
export type { EmailButtonProps } from "./EmailButton";

export { EmailHeader } from "./EmailHeader";
export type { EmailHeaderProps } from "./EmailHeader";

export { QueueStamp, MONO_STACK, SANS_STACK } from "./QueueStamp";
export type { QueueStampProps } from "./QueueStamp";

export { StatusRail } from "./StatusRail";
export type { StatusRailProps } from "./StatusRail";

export { FigureTable } from "./FigureTable";
export type { FigureRow, FigureTableProps } from "./FigureTable";

export { EmailLinkList } from "./EmailLinkList";
export type { EmailLinkListProps, EmailLinkListItem } from "./EmailLinkList";

export * from "./emailStyles";
