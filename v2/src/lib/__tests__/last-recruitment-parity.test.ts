import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { getLastRecruitmentDate } from "@/lib/perm";

/** The fixture scripts/test_recruitment_dates.py runs through the Python twin, run through the rule itself. */
const fixture = JSON.parse(readFileSync(join(process.cwd(), "scripts/fixtures/last_recruitment.json"), "utf8")) as {
  cases: { why: string; professional: boolean; input: Parameters<typeof getLastRecruitmentDate>[0]; expect: string | null }[];
};

describe("the last recruitment step, held equal in TypeScript and Python", () => {
  it("has cases to hold", () => expect(fixture.cases.length).toBeGreaterThanOrEqual(6));
  for (const c of fixture.cases) {
    it(c.why, () => expect(getLastRecruitmentDate(c.input, c.professional) ?? null).toBe(c.expect));
  }
});
