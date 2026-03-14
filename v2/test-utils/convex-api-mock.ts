/** Mock Convex API object — aliased in vitest.config.ts to replace @/convex/_generated/api */
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
