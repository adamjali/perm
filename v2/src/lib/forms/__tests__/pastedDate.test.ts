import { describe, expect, it } from "vitest";

import { parsePastedDate } from "../pastedDate";

describe("parsePastedDate", () => {
  it.each([
    ["03/15/2025", "2025-03-15"],
    ["3/5/2025", "2025-03-05"],
    ["12/31/1999", "1999-12-31"],
    ["2025-03-15", "2025-03-15"],
    ["2025-3-5", "2025-03-05"],
    ["March 15, 2025", "2025-03-15"],
    ["march 15 2025", "2025-03-15"],
    ["Mar 15 2025", "2025-03-15"],
    ["Mar. 15, 2025", "2025-03-15"],
    ["Sept 15, 2025", "2025-09-15"],
    ["15 March 2025", "2025-03-15"],
    ["15 Mar 2025", "2025-03-15"],
    ["1st March 2025", "2025-03-01"],
    ["March 1st, 2025", "2025-03-01"],
  ])("reads %s as %s", (text, iso) => {
    // Arrange, Act
    const got = parsePastedDate(text);
    // Assert
    expect(got).toBe(iso);
  });

  it("ignores space and a trailing period around the date", () => {
    // Arrange, Act, Assert
    expect(parsePastedDate("  03/15/2025\n")).toBe("2025-03-15");
    expect(parsePastedDate("March 15, 2025.")).toBe("2025-03-15");
  });

  it.each([
    "",
    "next Tuesday",
    "02/30/2025",
    "13/01/2025",
    "2025-02-29",
    "Smarch 15, 2025",
    "03/15/25",
    "03/15/1850",
    "15 March",
    "2025",
    "March 15, 2025 and April 2, 2025",
  ])("refuses %j", (text) => {
    // Arrange, Act, Assert
    expect(parsePastedDate(text)).toBeNull();
  });

  it("knows a leap day", () => {
    // Arrange, Act, Assert
    expect(parsePastedDate("02/29/2024")).toBe("2024-02-29");
  });
});
