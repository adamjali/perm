import { describe, expect, it } from "vitest";

import { exportUsersToCSV } from "../csvExport";
import type { UserSummary } from "../types";

const USER: UserSummary = {
  userId: "u1" as UserSummary["userId"],
  email: "a@example.com",
  name: "=HYPERLINK(\"x\")",
  emailVerified: true,
  verificationMethod: "password_otp",
  authProviders: ["password"],
  accountCreated: Date.UTC(2026, 9, 6),
  lastLoginTime: null,
  totalLogins: 1,
  totalCases: 2,
  activeCases: 2,
  deletedCases: 0,
  lastCaseUpdate: null,
  userType: "individual",
  accountStatus: "active",
  deletedAt: null,
  termsAccepted: null,
  termsVersion: null,
  lastActivity: Date.UTC(2026, 9, 6),
  role: "Waiting on my own case",
  audience: "own-case",
};

/** Splits one CSV line on commas outside quotes. */
function cells(line: string): string[] {
  return line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.slice(0, -1).map((c) => c.replace(/,$/, ""));
}

describe("exportUsersToCSV", () => {
  it("writes one cell under every heading, so no column shifts", () => {
    const [head, row] = exportUsersToCSV([USER]).split("\n");
    expect(cells(row!)).toHaveLength(cells(head!).length);
    const at = (h: string) => cells(row!)[cells(head!).indexOf(h)];
    expect(at("Account Status")).toBe("active");
    expect(at("Role")).toBe("Waiting on my own case");
    expect(at("For")).toBe("own-case");
  });

  it("writes a cell a spreadsheet would run as a formula as text", () => {
    const [, row] = exportUsersToCSV([USER]).split("\n");
    expect(row).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
