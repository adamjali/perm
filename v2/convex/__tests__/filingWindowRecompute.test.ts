/**
 * The one-time recompute moves a case's saved windows to the corrected PWD rule
 * (convex/lib/perm/dates/pwdValidity.ts, Oct 16 2026) without counting as an
 * edit, and the read-only report finds cases the old rule closed.
 */
import { describe, expect, it } from "vitest";
import { createAuthenticatedContext, createTestContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";

// Determination Jan 15, expiry Jun 30; job order Feb 1 begins recruitment
// inside validity, so the window closes Feb 1 + 180 = Jul 31.
const INSIDE = {
  pwdFilingDate: "2026-01-02",
  pwdDeterminationDate: "2026-01-15",
  pwdExpirationDate: "2026-06-30",
  jobOrderStartDate: "2026-02-01",
  jobOrderEndDate: "2026-03-03",
  sundayAdFirstDate: "2026-02-08",
  sundayAdSecondDate: "2026-02-15",
  noticeOfFilingStartDate: "2026-02-02",
  noticeOfFilingEndDate: "2026-02-16",
};

async function seed() {
  const t = createTestContext();
  const owner = await createAuthenticatedContext(t, "Owner");
  const id = await owner.mutation(api.cases.create, {
    employerName: "Acme Corp",
    beneficiaryIdentifier: "",
    positionTitle: "Engineer",
    ...INSIDE,
  });
  return { t, id };
}

describe("filingWindowRecompute", () => {
  it("a new case already gets the corrected window", async () => {
    const { t, id } = await seed();
    const c = await t.run((ctx) => ctx.db.get(id));
    expect(c!.filingWindowCloses).toBe("2026-07-31");
  });

  it("moves a window saved under the old cap, leaves updatedAt alone, and the dry run writes nothing", async () => {
    const { t, id } = await seed();
    await t.run((ctx) => ctx.db.patch(id, { filingWindowCloses: "2026-06-30", updatedAt: 1 }));

    const dry = await t.mutation(internal.filingWindowRecompute.recompute, { dryRun: true });
    expect(dry.changed).toBe(1);
    expect(dry.cases[0]!.changes.filingWindowCloses).toEqual({ from: "2026-06-30", to: "2026-07-31" });
    expect((await t.run((ctx) => ctx.db.get(id)))!.filingWindowCloses).toBe("2026-06-30");

    const real = await t.mutation(internal.filingWindowRecompute.recompute, {});
    expect(real.changed).toBe(1);
    const after = await t.run((ctx) => ctx.db.get(id));
    expect(after!.filingWindowCloses).toBe("2026-07-31");
    expect(after!.updatedAt).toBe(1);

    const again = await t.mutation(internal.filingWindowRecompute.recompute, {});
    expect(again.changed).toBe(0);
  });

  it("reports a case the old rule closed for an expired PWD although recruitment began in time", async () => {
    const { t, id } = await seed();
    await t.run((ctx) => ctx.db.patch(id, { caseStatus: "closed", closureReason: "pwd_expired", closedAt: 5 }));
    const rows = await t.query(internal.filingWindowRecompute.closedUnderOldRule, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ firstRecruitmentStep: "2026-02-01", filingWindowCloses: "2026-07-31" });
  });
});
