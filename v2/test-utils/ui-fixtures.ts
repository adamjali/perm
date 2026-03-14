import type { DashboardSummary } from "../convex/lib/dashboardTypes";

export interface MockUser {
  id: string;
  name: string;
  email: string;
}

export interface NavLink {
  href: string;
  label: string;
  icon?: string;
}

export function createMockDashboardSummary(
  overrides: Partial<DashboardSummary> = {}
): DashboardSummary {
  const defaults: DashboardSummary = {
    pwd: { count: 5, subtext: "3 working, 2 filed" },
    recruitment: { count: 8, subtext: "3 ready to start, 5 in progress" },
    eta9089: { count: 6, subtext: "2 prep, 1 RFI, 3 filed" },
    i140: { count: 4, subtext: "1 prep, 1 RFE, 2 filed" },
    complete: { count: 12, subtext: "" },
    closed: { count: 3, subtext: "" },
    duplicates: { count: 0, subtext: "" },
    total: 38,
  };

  return {
    ...defaults,
    ...overrides,
    total:
      (overrides.pwd?.count ?? defaults.pwd.count) +
      (overrides.recruitment?.count ?? defaults.recruitment.count) +
      (overrides.eta9089?.count ?? defaults.eta9089.count) +
      (overrides.i140?.count ?? defaults.i140.count) +
      (overrides.complete?.count ?? defaults.complete.count) +
      (overrides.closed?.count ?? defaults.closed.count),
  };
}

export function createMockUser(overrides: Partial<MockUser> = {}): MockUser {
  return { id: "user_test123", name: "Test User", email: "test@example.com", ...overrides };
}

export const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/cases", label: "Cases", icon: "Briefcase" },
  { href: "/calendar", label: "Calendar", icon: "Calendar" },
  { href: "/timeline", label: "Timeline", icon: "Clock" },
];

export { AUTH_NAV_LINKS } from "../src/lib/constants/navigation";

export const STATUS_COLORS = {
  pwd: { hex: "#0066FF", cssVar: "--stage-pwd", className: "text-stage-pwd", bgClassName: "bg-stage-pwd", label: "PWD" },
  recruitment: { hex: "#9333ea", cssVar: "--stage-recruitment", className: "text-stage-recruitment", bgClassName: "bg-stage-recruitment", label: "Recruitment" },
  eta9089: { hex: "#D97706", cssVar: "--stage-eta9089", className: "text-stage-eta9089", bgClassName: "bg-stage-eta9089", label: "ETA 9089" },
  eta9089_working: { hex: "#EAB308", cssVar: "--stage-eta9089-working", className: "text-stage-eta9089-working", bgClassName: "bg-stage-eta9089-working", label: "ETA 9089 (Working)" },
  i140: { hex: "#059669", cssVar: "--stage-i140", className: "text-stage-i140", bgClassName: "bg-stage-i140", label: "I-140" },
  closed: { hex: "#6B7280", cssVar: "--stage-closed", className: "text-stage-closed", bgClassName: "bg-stage-closed", label: "Closed" },
} as const;

export const URGENCY_COLORS = {
  urgent: { hex: "#DC2626", cssVar: "--urgency-urgent", className: "text-urgency-urgent", bgClassName: "bg-urgency-urgent", label: "Urgent", daysUntil: "<= 7 days" },
  soon: { hex: "#EA580C", cssVar: "--urgency-soon", className: "text-urgency-soon", bgClassName: "bg-urgency-soon", label: "Soon", daysUntil: "8-30 days" },
  normal: { hex: "#059669", cssVar: "--urgency-normal", className: "text-urgency-normal", bgClassName: "bg-urgency-normal", label: "Normal", daysUntil: "30+ days" },
} as const;

export const TAG_COLORS = {
  professional: { bgHex: "#1F2937", textHex: "#F9FAFB", label: "Professional" },
  rfi_active: { hex: "#DC2626", label: "RFI Active" },
  rfe_active: { hex: "#DC2626", label: "RFE Active" },
} as const;

const EMPTY_STAGE = { count: 0, subtext: "" };

export const dashboardScenarios = {
  empty: createMockDashboardSummary({
    pwd: EMPTY_STAGE, recruitment: EMPTY_STAGE, eta9089: EMPTY_STAGE,
    i140: EMPTY_STAGE, complete: EMPTY_STAGE, closed: EMPTY_STAGE, duplicates: EMPTY_STAGE,
  }),
  minimal: createMockDashboardSummary({
    pwd: { count: 1, subtext: "1 working, 0 filed" },
    recruitment: EMPTY_STAGE, eta9089: EMPTY_STAGE, i140: EMPTY_STAGE,
    complete: EMPTY_STAGE, closed: EMPTY_STAGE, duplicates: EMPTY_STAGE,
  }),
  balanced: createMockDashboardSummary(),
  highVolume: createMockDashboardSummary({
    pwd: { count: 25, subtext: "15 working, 10 filed" },
    recruitment: { count: 40, subtext: "12 ready to start, 28 in progress" },
    eta9089: { count: 30, subtext: "18 prep, 5 RFI, 7 filed" },
    i140: { count: 20, subtext: "10 prep, 3 RFE, 7 filed" },
    complete: { count: 150, subtext: "" },
    closed: { count: 45, subtext: "" },
    duplicates: EMPTY_STAGE,
  }),
  endStageHeavy: createMockDashboardSummary({
    pwd: { count: 2, subtext: "1 working, 1 filed" },
    recruitment: { count: 3, subtext: "1 ready to start, 2 in progress" },
    eta9089: { count: 5, subtext: "2 prep, 0 RFI, 3 filed" },
    i140: { count: 15, subtext: "3 prep, 2 RFE, 10 filed" },
    complete: { count: 50, subtext: "" },
    closed: { count: 10, subtext: "" },
    duplicates: EMPTY_STAGE,
  }),
};
