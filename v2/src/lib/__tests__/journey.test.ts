import { describe, expect, it } from "vitest";

import { calculateGreenCardFees, FEE_SCHEDULE } from "@/lib/perm";

import { JOURNEY_STEPS, journeySteps } from "../journey";

const FEES = calculateGreenCardFees({ petitioner: "regular", adults: 1, workPermits: 1, travelDocuments: 1 });

describe("journeySteps", () => {
  it("walks the planner's steps in order, without the I-140's preparation", () => {
    // Act
    const steps = journeySteps({}, FEES);
    // Assert
    expect(steps.map((s) => s.key)).toEqual([...JOURNEY_STEPS]);
    expect(steps.map((s) => s.name)).toEqual(["Wage request", "Recruitment", "PERM", "I-140", "Visa bulletin", "I-485 and the green card"]);
    expect(steps.find((s) => s.key === "perm")?.who).toBe("DOL");
  });

  it("prints each length the planner reads, and none for the bulletin wait", () => {
    // Act
    const steps = journeySteps({ pwd: 95, perm: 288, visa: 400 }, FEES);
    // Assert
    expect(steps.find((s) => s.key === "pwd")?.length).toBe("about 3 months");
    expect(steps.find((s) => s.key === "perm")?.length).toBe("about 9½ months");
    expect(steps.find((s) => s.key === "visa")).toMatchObject({ days: null, length: "Depends on your line" });
    expect(steps.find((s) => s.key === "i485")).toMatchObject({ days: null, length: "Not read today" });
  });

  it("charges each step the fee schedule's own fees, adding up to the whole case", () => {
    // Act
    const steps = journeySteps({}, FEES);
    // Assert
    const i140 = steps.find((s) => s.key === "i140");
    expect(i140?.fee).toBe(FEE_SCHEDULE.i140Paper + FEE_SCHEDULE.asylumProgramFee.regular);
    expect(i140?.feeNote).toBe(`The I-140 $${FEE_SCHEDULE.i140Paper} and the asylum program fee $${FEE_SCHEDULE.asylumProgramFee.regular}`);
    expect(steps.filter((s) => s.key === "pwd" || s.key === "perm").every((s) => s.fee === 0)).toBe(true);
    expect(steps.reduce((sum, s) => sum + s.fee, 0)).toBe(FEES.total);
  });
});
