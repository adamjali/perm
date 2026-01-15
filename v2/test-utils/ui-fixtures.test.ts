/**
 * Tests for UI Fixtures
 * Validates factory functions and preset scenarios.
 */

import { describe, it, expect } from "vitest";
import {
  createMockDashboardSummary,
  createMockUser,
  dashboardScenarios,
  STATUS_COLORS,
  URGENCY_COLORS,
  NAV_LINKS,
  AUTH_NAV_LINKS,
} from "./ui-fixtures";

describe("createMockDashboardSummary", () => {
  it("creates summary with default values", () => {
    const summary = createMockDashboardSummary();

    expect(summary.pwd.count).toBe(5);
    expect(summary.pwd.subtext).toBe("3 working, 2 filed");
    expect(summary.recruitment.count).toBe(8);
    expect(summary.eta9089.count).toBe(6);
    expect(summary.i140.count).toBe(4);
    expect(summary.complete.count).toBe(12);
    expect(summary.closed.count).toBe(3);
    expect(summary.total).toBe(38);
  });

  it("accepts partial overrides", () => {
    const summary = createMockDashboardSummary({
      pwd: { count: 10, subtext: "5 working, 5 filed" },
    });

    expect(summary.pwd.count).toBe(10);
    expect(summary.pwd.subtext).toBe("5 working, 5 filed");
    expect(summary.recruitment.count).toBe(8); // Default preserved
  });

  it("recalculates total when counts are overridden", () => {
    const summary = createMockDashboardSummary({
      pwd: { count: 0, subtext: "" },
      recruitment: { count: 0, subtext: "" },
      eta9089: { count: 0, subtext: "" },
      i140: { count: 0, subtext: "" },
      complete: { count: 0, subtext: "" },
      closed: { count: 0, subtext: "" },
    });

    expect(summary.total).toBe(0);
  });

  it("preserves subtext format for each status", () => {
    const summary = createMockDashboardSummary();

    // PWD: "X working, Y filed"
    expect(summary.pwd.subtext).toMatch(/\d+ working, \d+ filed/);

    // Recruitment: "X ready to start, Y in progress"
    expect(summary.recruitment.subtext).toMatch(
      /\d+ ready to start, \d+ in progress/
    );

    // ETA 9089: "X prep, Y RFI, Z filed"
    expect(summary.eta9089.subtext).toMatch(/\d+ prep, \d+ RFI, \d+ filed/);

    // I-140: "X prep, Y RFE, Z filed"
    expect(summary.i140.subtext).toMatch(/\d+ prep, \d+ RFE, \d+ filed/);

    // Complete/Closed: Empty
    expect(summary.complete.subtext).toBe("");
    expect(summary.closed.subtext).toBe("");
  });
});

describe("createMockUser", () => {
  it("creates user with default values", () => {
    const user = createMockUser();

    expect(user.id).toBe("user_test123");
    expect(user.name).toBe("Test User");
    expect(user.email).toBe("test@example.com");
  });

  it("accepts partial overrides", () => {
    const user = createMockUser({ name: "Jane Doe" });

    expect(user.id).toBe("user_test123");
    expect(user.name).toBe("Jane Doe");
    expect(user.email).toBe("test@example.com");
  });
});

describe("dashboardScenarios", () => {
  it("empty scenario has all zeros", () => {
    const { empty } = dashboardScenarios;

    expect(empty.pwd.count).toBe(0);
    expect(empty.recruitment.count).toBe(0);
    expect(empty.eta9089.count).toBe(0);
    expect(empty.i140.count).toBe(0);
    expect(empty.complete.count).toBe(0);
    expect(empty.closed.count).toBe(0);
    expect(empty.total).toBe(0);
  });

  it("minimal scenario has 1 case in PWD", () => {
    const { minimal } = dashboardScenarios;

    expect(minimal.pwd.count).toBe(1);
    expect(minimal.total).toBe(1);
  });

  it("balanced scenario has realistic mix", () => {
    const { balanced } = dashboardScenarios;

    expect(balanced.total).toBe(38);
    expect(balanced.pwd.count).toBe(5);
    expect(balanced.recruitment.count).toBe(8);
    expect(balanced.eta9089.count).toBe(6);
    expect(balanced.i140.count).toBe(4);
  });

  it("highVolume scenario has many cases", () => {
    const { highVolume } = dashboardScenarios;

    expect(highVolume.total).toBeGreaterThan(100);
  });

  it("endStageHeavy scenario has most cases in I-140 and Complete", () => {
    const { endStageHeavy } = dashboardScenarios;

    expect(endStageHeavy.i140.count).toBeGreaterThan(
      endStageHeavy.recruitment.count
    );
    expect(endStageHeavy.complete.count).toBeGreaterThan(
      endStageHeavy.pwd.count
    );
  });
});

describe("STATUS_COLORS", () => {
  it("has correct hex values from v1", () => {
    expect(STATUS_COLORS.pwd.hex).toBe("#0066FF");
    expect(STATUS_COLORS.recruitment.hex).toBe("#9333ea");
    expect(STATUS_COLORS.eta9089.hex).toBe("#D97706");
    expect(STATUS_COLORS.eta9089_working.hex).toBe("#EAB308");
    expect(STATUS_COLORS.i140.hex).toBe("#059669");
    expect(STATUS_COLORS.closed.hex).toBe("#6B7280");
  });

  it("has CSS variable names", () => {
    expect(STATUS_COLORS.pwd.cssVar).toBe("--stage-pwd");
    expect(STATUS_COLORS.recruitment.cssVar).toBe("--stage-recruitment");
    expect(STATUS_COLORS.eta9089.cssVar).toBe("--stage-eta9089");
  });

  it("has Tailwind class names", () => {
    expect(STATUS_COLORS.pwd.className).toBe("text-stage-pwd");
    expect(STATUS_COLORS.pwd.bgClassName).toBe("bg-stage-pwd");
  });

  it("has human-readable labels", () => {
    expect(STATUS_COLORS.pwd.label).toBe("PWD");
    expect(STATUS_COLORS.recruitment.label).toBe("Recruitment");
    expect(STATUS_COLORS.eta9089.label).toBe("ETA 9089");
  });
});

describe("URGENCY_COLORS", () => {
  it("has correct hex values", () => {
    expect(URGENCY_COLORS.urgent.hex).toBe("#DC2626");
    expect(URGENCY_COLORS.soon.hex).toBe("#EA580C");
    expect(URGENCY_COLORS.normal.hex).toBe("#059669");
  });

  it("has days until labels", () => {
    expect(URGENCY_COLORS.urgent.daysUntil).toBe("≤ 7 days");
    expect(URGENCY_COLORS.soon.daysUntil).toBe("8-30 days");
    expect(URGENCY_COLORS.normal.daysUntil).toBe("30+ days");
  });
});

describe("NAV_LINKS", () => {
  it("has all main navigation links", () => {
    // Updated: 4 links (Dashboard, Cases, Calendar, Timeline)
    // Settings moved to user dropdown, Notifications removed
    expect(NAV_LINKS).toHaveLength(4);
    expect(NAV_LINKS[0].label).toBe("Dashboard");
    expect(NAV_LINKS[1].label).toBe("Cases");
    expect(NAV_LINKS[2].label).toBe("Calendar");
    expect(NAV_LINKS[3].label).toBe("Timeline");
  });

  it("has correct routes", () => {
    expect(NAV_LINKS[0].href).toBe("/dashboard");
    expect(NAV_LINKS[1].href).toBe("/cases");
    expect(NAV_LINKS[2].href).toBe("/calendar");
    expect(NAV_LINKS[3].href).toBe("/timeline");
  });

  it("has icon identifiers", () => {
    NAV_LINKS.forEach((link) => {
      expect(link.icon).toBeDefined();
      expect(typeof link.icon).toBe("string");
    });
  });
});

describe("AUTH_NAV_LINKS", () => {
  it("has public navigation links", () => {
    expect(AUTH_NAV_LINKS).toHaveLength(2);
    expect(AUTH_NAV_LINKS[0].label).toBe("Home");
    expect(AUTH_NAV_LINKS[1].label).toBe("Demo");
  });

  it("has correct routes", () => {
    expect(AUTH_NAV_LINKS[0].href).toBe("/");
    expect(AUTH_NAV_LINKS[1].href).toBe("/demo");
  });
});
