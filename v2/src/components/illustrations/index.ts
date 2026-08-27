/**
 * SVG Illustration Library
 *
 * Inline SVG illustrations for use across the PERM Tracker app.
 *
 * These are full-colour illustrations, not monoline icons. Where a slot only
 * needs a glyph, use the Phosphor icon that is already on the page instead:
 * mixing an illustration with the icon set beside it reads as two visual
 * languages on one surface.
 *
 * EVERY COLOUR IS A TOKEN, and that is load-bearing rather than tidiness.
 * These files previously baked #F5F5F5 and #FAFAFA surfaces into the artwork,
 * so a calendar body stayed near-white in dark mode and punched a bright hole
 * through the card it sat on. A token follows the theme; a hex cannot.
 *
 * The stage colours in TimelineSVG are the --stage-* family in PERM order,
 * so a stage is the same colour here as it is anywhere else in the app.
 *
 * Unused as of 2026-08-26: ClockUrgentSVG, DocumentStackSVG, GlobePassportSVG,
 * NewspaperAdSVG. Kept and tokenised rather than deleted, because removing
 * exports while other work is in flight is a conflict nobody needs.
 *
 * Usage:
 *   import { FolderOpenSVG, RocketLaunchSVG } from '@/components/illustrations';
 */

export { DocumentStackSVG } from "./DocumentStackSVG";
export { GlobePassportSVG } from "./GlobePassportSVG";
export { CalendarDeadlineSVG } from "./CalendarDeadlineSVG";
export { CalendarSyncSVG } from "./CalendarSyncSVG";
export { ShieldCheckSVG } from "./ShieldCheckSVG";
export { NotificationBellSVG } from "./NotificationBellSVG";
export { TimelineSVG } from "./TimelineSVG";
export { LawGavelSVG } from "./LawGavelSVG";
export { FolderOpenSVG } from "./FolderOpenSVG";
export { RocketLaunchSVG } from "./RocketLaunchSVG";
export { ClockUrgentSVG } from "./ClockUrgentSVG";
export { SuccessCelebrationSVG } from "./SuccessCelebrationSVG";
export { NewspaperAdSVG } from "./NewspaperAdSVG";
