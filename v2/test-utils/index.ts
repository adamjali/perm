/**
 * Test Utilities - Centralized Exports
 *
 * This barrel export provides a single import point for all test utilities.
 *
 * @example
 * ```ts
 * import { renderWithProviders, createTestCase, createMockDashboardSummary } from '@/test-utils';
 * ```
 */

// Render utilities and provider helpers
export {
  AllProviders,
  renderWithProviders,
  mockUsePathname,
  mockUseRouter,
  mockUseQuery,
  mockUseMutation,
  waitForAsync,
  renderLoadingState,
  suppressConsoleError,
} from "./render-utils";

// Convex function testing utilities
export {
  createTestContext,
  createAuthenticatedContext,
  fixtures as convexFixtures,
  type AuthenticatedContext,
} from "./convex";

// Convex API mock for component tests
export { api as mockApi } from "./convex-api-mock";

// UI fixtures for dashboard and component testing
export {
  type MockUser,
  type NavLink,
  createMockDashboardSummary,
  createMockUser,
  NAV_LINKS,
  AUTH_NAV_LINKS,
  STATUS_COLORS,
  URGENCY_COLORS,
  TAG_COLORS,
  dashboardScenarios,
} from "./ui-fixtures";

// Dashboard case fixtures with full test data
export {
  formatISO,
  today,
  addDays,
  daysFromNow,
  daysAgo,
  lastSundayBeforeDaysAgo,
  type TestCaseData,
  createTestCase,
  pwdFixtures,
  recruitmentFixtures,
  eta9089Fixtures,
  i140Fixtures,
  specialFixtures,
  fixtures as dashboardFixtures,
} from "./dashboard-fixtures";

// Deadline panel fixtures
export {
  createMockDeadlineItem,
  createOverdueDeadline,
  createThisWeekDeadline,
  createThisMonthDeadline,
  createLaterDeadline,
  createMockDeadlineGroups,
  createEmptyDeadlineGroups,
  createManyDeadlinesGroup,
  URGENCY_STYLES,
  deadlineScenarios,
} from "./deadline-fixtures";

// Activity feed fixtures
export {
  now,
  minutesAgo,
  hoursAgo,
  daysAgo as activityDaysAgo,
  ACTIVITY_ACTIONS,
  createMockActivityItem,
  createMockActivityList,
  createEmptyActivityList,
  daysFromNowISO,
  type UpcomingDeadline,
  UPCOMING_DEADLINE_TYPES,
  createMockUpcomingDeadline,
  createMockUpcomingDeadlines,
  createEmptyUpcomingDeadlines,
  activityScenarios,
  upcomingDeadlineScenarios,
} from "./activity-fixtures";

// Timer utilities for fake timer management
export {
  useFakeTimers,
  useAutoAdvancingTimers,
  useFakeTimersWithDate,
  setupFakeTimersOnce,
} from "./timer-utils";
