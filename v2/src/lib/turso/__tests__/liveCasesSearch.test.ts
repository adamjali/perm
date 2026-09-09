import { describe, expect, it } from "vitest";

import { likeContains, liveOrderBy, planLiveSql } from "../liveCases";

describe("planLiveSql with a search needle", () => {
  it("adds a contains-match over employer, case number and job title, after the month bounds", () => {
    const plan = planLiveSql("pending", "2025-11", "cognizant");
    expect(plan.where).toBe(
      "is_final = ? AND filing_date >= ? AND filing_date < ? AND (employer_name LIKE ? ESCAPE '\\' OR case_number LIKE ? ESCAPE '\\' OR job_title LIKE ? ESCAPE '\\')",
    );
    expect(plan.params).toEqual([0, "2025-11-01", "2025-12-01", "%cognizant%", "%cognizant%", "%cognizant%"]);
  });

  it("ignores an empty or blank needle", () => {
    expect(planLiveSql("all", null, "   ").where).toBe("1");
    expect(planLiveSql("all", null, null).params).toEqual([]);
  });

  it("escapes the LIKE wildcards so a typed percent or underscore is literal", () => {
    expect(likeContains("100%_x")).toBe("%100\\%\\_x%");
    expect(likeContains("a\\b")).toBe("%a\\\\b%");
  });
});

describe("liveOrderBy", () => {
  it("leads with the chosen column and always breaks ties on the case number", () => {
    expect(liveOrderBy("filed", "DESC")).toBe("filing_date DESC, case_number DESC");
    expect(liveOrderBy("employer", "ASC")).toBe("employer_name ASC, filing_date ASC, case_number ASC");
    expect(liveOrderBy("status", "DESC")).toBe("status DESC, filing_date DESC, case_number DESC");
    expect(liveOrderBy(undefined, "ASC")).toBe("filing_date ASC, case_number ASC");
  });
});
