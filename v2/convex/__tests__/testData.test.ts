import { describe, expect, it } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import { ratingKey } from "../alertRatings";

const EMAIL = "owner@example.com";
const CASE = "G-100-25356-503779";

async function seed(t: ReturnType<typeof createTestContext>, source: string) {
  await t.run(async (ctx) => {
    const id = await ctx.db.insert("caseStatusAlerts", { email: EMAIL, caseNumber: CASE, createdAt: 1, confirmedAt: 1, source, lastSeenStatus: "CERTIFIED" });
    await ctx.db.insert("alertRatings", { key: await ratingKey(EMAIL, CASE), email: EMAIL, caseNumber: CASE, score: 1, createdAt: 1, updatedAt: 1 });
    await ctx.db.insert("congratsNotes", {
      alertId: id,
      email: EMAIL,
      caseNumber: CASE,
      program: "perm",
      status: "CERTIFIED",
      decidedAt: 1,
      dueOn: "2026-10-27",
      state: "due",
      createdAt: 1,
    } as never);
  });
}

const counts = (t: ReturnType<typeof createTestContext>) =>
  t.run(async (ctx) => ({
    watches: (await ctx.db.query("caseStatusAlerts").collect()).length,
    ratings: (await ctx.db.query("alertRatings").collect()).length,
    notes: (await ctx.db.query("congratsNotes").collect()).length,
  }));

describe("removeOwnerTest", () => {
  it("counts on a dry run, then removes the owner's test watch, its rating and its note", async () => {
    const t = createTestContext();
    await seed(t, "owner-test");
    const dry = await t.mutation(internal.testData.removeOwnerTest, { email: EMAIL, caseNumber: CASE, dryRun: true });
    expect(dry).toMatchObject({ watches: 1, ratings: 1, congratsNotes: 1, refused: null });
    expect(await counts(t)).toEqual({ watches: 1, ratings: 1, notes: 1 });
    await t.mutation(internal.testData.removeOwnerTest, { email: EMAIL, caseNumber: CASE, dryRun: false });
    expect(await counts(t)).toEqual({ watches: 0, ratings: 0, notes: 0 });
  });

  it("refuses a real subscriber's watch and removes nothing", async () => {
    const t = createTestContext();
    await seed(t, "case-page");
    const res = await t.mutation(internal.testData.removeOwnerTest, { email: EMAIL, caseNumber: CASE, dryRun: false });
    expect(res.refused).toMatch(/isn't marked "owner-test"/);
    expect(await counts(t)).toEqual({ watches: 1, ratings: 1, notes: 1 });
  });
});

describe("removeOwnerBulletinTest", () => {
  const seedBulletin = (t: ReturnType<typeof createTestContext>, sources: string[]) =>
    t.run(async (ctx) => {
      for (const [i, source] of sources.entries()) {
        await ctx.db.insert("bulletinAlerts", {
          email: EMAIL,
          category: i === 0 ? "EB2" : "EB3",
          country: "india",
          source,
          createdAt: 1,
          confirmedAt: 1,
        });
      }
    });
  const bulletinRows = (t: ReturnType<typeof createTestContext>) =>
    t.run(async (ctx) => (await ctx.db.query("bulletinAlerts").collect()).length);

  it("counts on a dry run, then removes the owner's test watches", async () => {
    const t = createTestContext();
    await seedBulletin(t, ["owner-test"]);
    const dry = await t.mutation(internal.testData.removeOwnerBulletinTest, { email: EMAIL, dryRun: true });
    expect(dry).toMatchObject({ watches: 1, refused: null });
    expect(await bulletinRows(t)).toBe(1);
    await t.mutation(internal.testData.removeOwnerBulletinTest, { email: EMAIL, dryRun: false });
    expect(await bulletinRows(t)).toBe(0);
  });

  it("refuses when any bulletin watch on the address is a real one", async () => {
    const t = createTestContext();
    await seedBulletin(t, ["owner-test", "visa-bulletin"]);
    const res = await t.mutation(internal.testData.removeOwnerBulletinTest, { email: EMAIL, dryRun: false });
    expect(res.refused).toMatch(/isn't marked "owner-test"/);
    expect(await bulletinRows(t)).toBe(2);
  });
});

