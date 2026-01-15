/**
 * Centralized z-index constants for consistent layering.
 *
 * This prevents z-index conflicts between modals, overlays, and third-party libraries.
 * Always use these constants instead of arbitrary z-index values.
 *
 * Layering order (lowest to highest):
 * - Base content: 0
 * - Sticky headers: 50
 * - Dropdowns: 100
 * - Modals/Dialogs: 200
 * - Overlays: 300
 * - Tooltips: 400
 * - Toast notifications: 500
 */

export const Z_INDEX = {
  /** Base content layer */
  base: 0,

  /** Sticky headers and navigation */
  header: 50,

  /** Dropdown menus and popovers */
  dropdown: 100,

  /** Modal dialogs and sheets */
  modal: 200,

  /** Timeout warning modal (above regular modals) */
  timeoutWarning: 250,

  /** Full-screen overlays (sign-out, loading) */
  overlay: 300,

  /** Tooltips and hover cards */
  tooltip: 400,

  /** Toast notifications (highest priority) */
  toast: 500,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
