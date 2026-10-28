import { describe, expect, it } from "vitest";

import { statusCasesHref } from "../statusLinks";

describe("a pending status's own cases", () => {
  it("for one filing month: the case search at that status and month", () => {
    expect(statusCasesHref("APPLICATION ON HOLD", "2025-11")).toBe("/case-search?stage=application-on-hold&from=2025-11&to=2025-11");
    expect(statusCasesHref("ANALYST REVIEW", "2025-11")).toBe("/case-search?stage=analyst-review&from=2025-11&to=2025-11");
  });

  it("for the whole line: the review stage's own page, or the case search when it has none", () => {
    expect(statusCasesHref("APPLICATION ON HOLD")).toBe("/perm-rfi-audit/application-on-hold");
    // Analyst review is the ordinary queue and has no stage page.
    expect(statusCasesHref("ANALYST REVIEW")).toBe("/case-search?stage=analyst-review");
  });

  it("a status nothing lists gives no link", () => {
    expect(statusCasesHref("NOT A DOL STATUS", "2025-11")).toBeNull();
  });
});
