/**
 * Convex API Mock for Testing
 * Provides a mock implementation of the Convex generated API module.
 *
 * This file is aliased in vitest.config.ts to replace @/convex/_generated/api
 * during tests, avoiding import errors when Convex codegen hasn't run.
 *
 * Phase: 20-02 (Dashboard Data Layer)
 * Created: 2025-12-24
 */

/**
 * Mock API object matching Convex generated API structure.
 * This allows components to import `api` without errors in tests.
 */
export const api = {
  dashboard: {
    getRecentActivity: "dashboard.getRecentActivity",
    getSummary: "dashboard.getSummary",
    getUpcomingDeadlines: "dashboard.getUpcomingDeadlines",
  },
  cases: {
    list: "cases.list",
    get: "cases.get",
    create: "cases.create",
    update: "cases.update",
    delete: "cases.delete",
    hasAnyCases: "cases.hasAnyCases",
  },
  onboarding: {
    getOnboardingState: "onboarding.getOnboardingState",
    updateOnboardingStep: "onboarding.updateOnboardingStep",
    saveOnboardingRole: "onboarding.saveOnboardingRole",
    completeChecklistItem: "onboarding.completeChecklistItem",
    dismissChecklist: "onboarding.dismissChecklist",
    resetOnboarding: "onboarding.resetOnboarding",
  },
} as const;
