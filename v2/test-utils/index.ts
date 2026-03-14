// Render utilities
export {
  AllProviders,
  renderWithProviders,
  mockUsePathname,
  mockUseRouter,
  mockUseQuery,
  mockUseMutation,
  waitForAsync,
} from "./render-utils";

// Convex function testing
export {
  createTestContext,
  createAuthenticatedContext,
  setupSchedulerTests,
  finishScheduledFunctions,
  withScheduler,
  advanceTime,
  type AuthenticatedContext,
} from "./convex";

// Convex API mock
export { api as mockApi } from "./convex-api-mock";

// UI fixtures
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

// Dashboard case fixtures
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

// Deadline fixtures
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

// Activity fixtures
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

// Timer utilities
export {
  useFakeTimers,
  useAutoAdvancingTimers,
  useFakeTimersWithDate,
  setupFakeTimersOnce,
} from "./timer-utils";
