import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CENSUS_DAYS_FROM } from "../backlogMonths";

describe("CENSUS_DAYS_FROM", () => {
  it("is the replay script's first day", () => {
    const py = readFileSync(join(process.cwd(), "scripts/build_census_days.py"), "utf8");
    expect(py).toMatch(new RegExp(`^START = "${CENSUS_DAYS_FROM}"$`, "m"));
  });
});
