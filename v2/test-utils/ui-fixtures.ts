/**
 * UI Test Fixtures
 * Mock data factories for dashboard and component testing.
 *
 * Provides:
 * - createMockDashboardSummary() - Dashboard summary data factory
 * - createMockUser() - Authenticated user data factory
 * - NAV_LINKS - Authenticated navigation links
 * - AUTH_NAV_LINKS - Public/auth page navigation links
 * - STATUS_COLORS - Case status color mappings
 */

import type { DashboardSummary } from "../convex/lib/dashboardTypes";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Mock user data matching auth context
 */
export interface MockUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Navigation link structure
 */
export interface NavLink {
  href: string;
  label: string;
  icon?: string;
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create mock dashboard summary with realistic defaults.
 * All overrides are optional - factory provides complete valid data.
 *
 * Subtext follows perm_flow.md specifications:
 * - PWD: "X working, Y filed"
 * - Recruitment: "X ready to start, Y in progress"
 * - ETA 9089: "X prep, Y RFI, Z filed"
 * - I-140: "X prep, Y RFE, Z filed"
 * - Complete: No subtext (just count)
 * - Closed: No subtext (just count)
 *
 * @example
 * const summary = createMockDashboardSummary({
 *   pwd: { count: 10, subtext: "5 working, 5 filed" }
 * });
 */
export function createMockDashboardSummary(
  overrides: Partial<DashboardSummary> = {}
): DashboardSummary {
  const defaults: DashboardSummary = {
    pwd: {
      count: 5,
      subtext: "3 working, 2 filed",
    },
    recruitment: {
      count: 8,
      subtext: "3 ready to start, 5 in progress",
    },
    eta9089: {
      count: 6,
      subtext: "2 prep, 1 RFI, 3 filed",
    },
    i140: {
      count: 4,
      subtext: "1 prep, 1 RFE, 2 filed",
    },
    complete: {
      count: 12,
      subtext: "",
    },
    closed: {
      count: 3,
      subtext: "",
    },
    duplicates: {
      count: 0,
      subtext: "",
    },
    total: 38,
  };

  return {
    ...defaults,
    ...overrides,
    // Recalculate total if any counts were overridden
    total:
      (overrides.pwd?.count ?? defaults.pwd.count) +
      (overrides.recruitment?.count ?? defaults.recruitment.count) +
      (overrides.eta9089?.count ?? defaults.eta9089.count) +
      (overrides.i140?.count ?? defaults.i140.count) +
      (overrides.complete?.count ?? defaults.complete.count) +
      (overrides.closed?.count ?? defaults.closed.count),
  };
}

/**
 * Create mock authenticated user.
 * All overrides are optional - factory provides complete valid data.
 *
 * @example
 * const user = createMockUser({ name: "Jane Doe" });
 */
export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: "user_test123",
    name: "Test User",
    email: "test@example.com",
    ...overrides,
  };
}

// ============================================================================
// NAVIGATION LINKS
// ============================================================================

/**
 * Authenticated app navigation links (header)
 * Updated to match new design: removed Settings/Notifications, added Timeline
 */
export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/cases", label: "Cases", icon: "Briefcase" },
  { href: "/calendar", label: "Calendar", icon: "Calendar" },
  { href: "/timeline", label: "Timeline", icon: "Clock" },
];

/**
 * Public/auth page navigation links
 * Re-exported from canonical source for test convenience
 */
export { AUTH_NAV_LINKS } from "../src/lib/constants/navigation";

// ============================================================================
// STATUS COLORS
// ============================================================================

/**
 * Case status colors from v1 (preserved in v2).
 * Provides both hex values and CSS variable names.
 *
 * Source: .planning/FRONTEND_DESIGN_SKILL.md (lines 66-76)
 *
 * @example
 * // Use hex directly
 * <div style={{ color: STATUS_COLORS.pwd.hex }}>PWD</div>
 *
 * // Use CSS variable (requires globals.css loaded)
 * <div className="text-stage-pwd">PWD</div>
 */
export const STATUS_COLORS = {
  pwd: {
    hex: "#0066FF",
    cssVar: "--stage-pwd",
    className: "text-stage-pwd",
    bgClassName: "bg-stage-pwd",
    label: "PWD",
  },
  recruitment: {
    hex: "#9333ea",
    cssVar: "--stage-recruitment",
    className: "text-stage-recruitment",
    bgClassName: "bg-stage-recruitment",
    label: "Recruitment",
  },
  eta9089: {
    hex: "#D97706",
    cssVar: "--stage-eta9089",
    className: "text-stage-eta9089",
    bgClassName: "bg-stage-eta9089",
    label: "ETA 9089",
  },
  eta9089_working: {
    hex: "#EAB308",
    cssVar: "--stage-eta9089-working",
    className: "text-stage-eta9089-working",
    bgClassName: "bg-stage-eta9089-working",
    label: "ETA 9089 (Working)",
  },
  i140: {
    hex: "#059669",
    cssVar: "--stage-i140",
    className: "text-stage-i140",
    bgClassName: "bg-stage-i140",
    label: "I-140",
  },
  closed: {
    hex: "#6B7280",
    cssVar: "--stage-closed",
    className: "text-stage-closed",
    bgClassName: "bg-stage-closed",
    label: "Closed",
  },
} as const;

/**
 * Urgency level colors (for deadlines)
 *
 * Source: .planning/FRONTEND_DESIGN_SKILL.md (lines 85-91)
 */
export const URGENCY_COLORS = {
  urgent: {
    hex: "#DC2626",
    cssVar: "--urgency-urgent",
    className: "text-urgency-urgent",
    bgClassName: "bg-urgency-urgent",
    label: "Urgent",
    daysUntil: "≤ 7 days",
  },
  soon: {
    hex: "#EA580C",
    cssVar: "--urgency-soon",
    className: "text-urgency-soon",
    bgClassName: "bg-urgency-soon",
    label: "Soon",
    daysUntil: "8-30 days",
  },
  normal: {
    hex: "#059669",
    cssVar: "--urgency-normal",
    className: "text-urgency-normal",
    bgClassName: "bg-urgency-normal",
    label: "Normal",
    daysUntil: "30+ days",
  },
} as const;

/**
 * Additional tag colors
 *
 * Source: .planning/FRONTEND_DESIGN_SKILL.md (lines 77-83)
 */
export const TAG_COLORS = {
  professional: {
    bgHex: "#1F2937",
    textHex: "#F9FAFB",
    label: "Professional",
  },
  rfi_active: {
    hex: "#DC2626",
    label: "RFI Active",
  },
  rfe_active: {
    hex: "#DC2626",
    label: "RFE Active",
  },
} as const;

// ============================================================================
// PRESET SCENARIOS
// ============================================================================

/**
 * Common dashboard scenarios for testing
 */
export const dashboardScenarios = {
  /**
   * Empty dashboard (new user)
   */
  empty: createMockDashboardSummary({
    pwd: { count: 0, subtext: "" },
    recruitment: { count: 0, subtext: "" },
    eta9089: { count: 0, subtext: "" },
    i140: { count: 0, subtext: "" },
    complete: { count: 0, subtext: "" },
    closed: { count: 0, subtext: "" },
    duplicates: { count: 0, subtext: "" },
  }),

  /**
   * Minimal dashboard (1 case in PWD)
   */
  minimal: createMockDashboardSummary({
    pwd: { count: 1, subtext: "1 working, 0 filed" },
    recruitment: { count: 0, subtext: "" },
    eta9089: { count: 0, subtext: "" },
    i140: { count: 0, subtext: "" },
    complete: { count: 0, subtext: "" },
    closed: { count: 0, subtext: "" },
    duplicates: { count: 0, subtext: "" },
  }),

  /**
   * Balanced dashboard (realistic mix)
   */
  balanced: createMockDashboardSummary({
    pwd: { count: 5, subtext: "3 working, 2 filed" },
    recruitment: { count: 8, subtext: "3 ready to start, 5 in progress" },
    eta9089: { count: 6, subtext: "2 prep, 1 RFI, 3 filed" },
    i140: { count: 4, subtext: "1 prep, 1 RFE, 2 filed" },
    complete: { count: 12, subtext: "" },
    closed: { count: 3, subtext: "" },
    duplicates: { count: 0, subtext: "" },
  }),

  /**
   * High-volume dashboard (busy firm)
   */
  highVolume: createMockDashboardSummary({
    pwd: { count: 25, subtext: "15 working, 10 filed" },
    recruitment: { count: 40, subtext: "12 ready to start, 28 in progress" },
    eta9089: { count: 30, subtext: "18 prep, 5 RFI, 7 filed" },
    i140: { count: 20, subtext: "10 prep, 3 RFE, 7 filed" },
    complete: { count: 150, subtext: "" },
    closed: { count: 45, subtext: "" },
    duplicates: { count: 0, subtext: "" },
  }),

  /**
   * End-stage heavy (many completions)
   */
  endStageHeavy: createMockDashboardSummary({
    pwd: { count: 2, subtext: "1 working, 1 filed" },
    recruitment: { count: 3, subtext: "1 ready to start, 2 in progress" },
    eta9089: { count: 5, subtext: "2 prep, 0 RFI, 3 filed" },
    i140: { count: 15, subtext: "3 prep, 2 RFE, 10 filed" },
    complete: { count: 50, subtext: "" },
    closed: { count: 10, subtext: "" },
    duplicates: { count: 0, subtext: "" },
  }),
};
