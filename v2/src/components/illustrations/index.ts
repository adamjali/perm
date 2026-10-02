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
 * EVERY COLOUR IS A TOKEN, and that is load-bearing rather than tidiness. A
 * #F5F5F5 surface baked into the artwork stays near-white in dark mode and
 * punches a bright hole through the card it sits on. A token follows the
 * theme; a hex cannot.
 *
 * The stage colours in TimelineSVG are the --stage-* family in PERM order,
 * so a stage is the same colour here as it is anywhere else in the app.
 *
 * Not used by any page: ClockUrgentSVG, DocumentStackSVG, GlobePassportSVG,
 * NewspaperAdSVG. Kept and tokenised rather than deleted.
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
