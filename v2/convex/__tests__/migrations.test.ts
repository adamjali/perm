import { describe, it, expect } from "vitest";
import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// ---------------------------------------------------------------------------
// I3 — migrations.normalizeMixedCaseEmails
//   * Login-critical backfill: lowercases users.email + matching
//     authAccounts.providerAccountId / emailVerified so the Password provider
//     (which lowercases the entered email in profile()) can find pre-existing
//     mixed-case accounts at login.
//   * Collision-guarded at BOTH levels (user and per-account).
//   * Idempotent + supports a no-write dry-run plan.
// ---------------------------------------------------------------------------

type T = ReturnType<typeof createTestContext>;

/** Seed a single user with a password authAccount whose providerAccountId is `email`. */
async function seedPasswordUser(
  t: T,
  email: string | undefined,
  opts: { emailVerified?: string; provider?: string; providerAccountId?: string } = {},
): Promise<{ userId: Id<"users">; accountId: Id<"authAccounts"> }> {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", email === undefined ? {} : { email });
    const accountId = await ctx.db.insert("authAccounts", {
      userId,
      provider: opts.provider ?? "password",
      providerAccountId: opts.providerAccountId ?? email ?? "",
      ...(opts.emailVerified !== undefined ? { emailVerified: opts.emailVerified } : {}),
    });
    return { userId, accountId };
  });
}

/** Read a user row back from the database. */
async function getUser(t: T, userId: Id<"users">) {
  return t.run((ctx) => ctx.db.get(userId));
}

/** Read an authAccount row back from the database. */
async function getAccount(t: T, accountId: Id<"authAccounts">) {
  return t.run((ctx) => ctx.db.get(accountId));
}

describe("normalizeMixedCaseEmails — happy path", () => {
  it("lowercases user.email, providerAccountId, and emailVerified for a single mixed-case user", async () => {
    const t = createTestContext();
    const { userId, accountId } = await seedPasswordUser(t, "Adam@X.com", {
      emailVerified: "Adam@X.com",
    });

    const result = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});

    expect(result.dryRun).toBe(false);
    expect(result.usersChanged).toBe(1);
    expect(result.usersSkipped).toBe(0);
    expect(result.skipped).toEqual([]);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]).toMatchObject({
      userId,
      from: "Adam@X.com",
      to: "adam@x.com",
    });
    expect(result.changes[0]!.accountChanges).toEqual([
      {
        accountId,
        providerAccountId: "adam@x.com",
        emailVerified: "adam@x.com",
      },
    ]);

    const user = await getUser(t, userId);
    expect(user?.email).toBe("adam@x.com");

    const account = await getAccount(t, accountId);
    expect(account?.providerAccountId).toBe("adam@x.com");
    expect(account?.emailVerified).toBe("adam@x.com");
  });
});

describe("normalizeMixedCaseEmails — dry run", () => {
  it("returns the same plan but writes nothing to the database", async () => {
    const t = createTestContext();
    const { userId, accountId } = await seedPasswordUser(t, "Mixed@Case.io", {
      emailVerified: "Mixed@Case.io",
    });

    const result = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.usersChanged).toBe(1);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0]!.from).toBe("Mixed@Case.io");
    expect(result.changes[0]!.to).toBe("mixed@case.io");
    expect(result.changes[0]!.accountChanges).toEqual([
      {
        accountId,
        providerAccountId: "mixed@case.io",
        emailVerified: "mixed@case.io",
      },
    ]);

    // Database must be unchanged.
    const user = await getUser(t, userId);
    expect(user?.email).toBe("Mixed@Case.io");

    const account = await getAccount(t, accountId);
    expect(account?.providerAccountId).toBe("Mixed@Case.io");
    expect(account?.emailVerified).toBe("Mixed@Case.io");
  });
});

describe("normalizeMixedCaseEmails — idempotency", () => {
  it("a second run after a first run reports zero work and zero skips", async () => {
    const t = createTestContext();
    await seedPasswordUser(t, "Mixed@Example.com", { emailVerified: "Mixed@Example.com" });

    const first = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});
    expect(first.usersChanged).toBe(1);

    const second = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});
    expect(second.usersChanged).toBe(0);
    expect(second.usersSkipped).toBe(0);
    expect(second.changes).toEqual([]);
    expect(second.skipped).toEqual([]);
  });
});

describe("normalizeMixedCaseEmails — user-level collision", () => {
  it("skips BOTH users when two users own the same lowercase email; neither is renamed", async () => {
    const t = createTestContext();
    const a = await seedPasswordUser(t, "Mixed@x.com");
    const b = await seedPasswordUser(t, "mixed@x.com");

    const result = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});

    expect(result.usersChanged).toBe(0);
    // The mixed-case row is the one that triggers the skip path (the already-
    // lowercase row short-circuits earlier with `if (u.email === lower) continue;`).
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toMatchObject({ userId: a.userId, email: "Mixed@x.com" });
    expect(result.skipped[0]!.reason).toMatch(/shared|merge|collis/i);

    // Neither user.email is mutated.
    expect((await getUser(t, a.userId))?.email).toBe("Mixed@x.com");
    expect((await getUser(t, b.userId))?.email).toBe("mixed@x.com");
  });
});

describe("normalizeMixedCaseEmails — OAuth subject IDs", () => {
  it("leaves providerAccountId untouched when it is not email-shaped (no '@')", async () => {
    const t = createTestContext();
    const { userId, accountId } = await seedPasswordUser(t, "Mixed@x.com", {
      provider: "google",
      providerAccountId: "google|12345",
    });

    const result = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});

    // User email is still patched.
    expect(result.usersChanged).toBe(1);
    expect(result.changes[0]!.userId).toBe(userId);
    expect(result.changes[0]!.accountChanges).toEqual([]);

    const account = await getAccount(t, accountId);
    expect(account?.providerAccountId).toBe("google|12345");
  });
});

describe("normalizeMixedCaseEmails — empty / undefined email", () => {
  it("skips a user whose users.email is undefined without error or change", async () => {
    const t = createTestContext();
    const { userId } = await seedPasswordUser(t, undefined, {
      providerAccountId: "google|abc",
      provider: "google",
    });

    const result = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});

    expect(result.usersChanged).toBe(0);
    expect(result.usersSkipped).toBe(0);
    expect(result.changes).toEqual([]);
    expect(result.skipped).toEqual([]);

    // User still has no email.
    expect((await getUser(t, userId))?.email).toBeUndefined();
  });
});

describe("normalizeMixedCaseEmails — emailVerified independent of providerAccountId", () => {
  it("patches only emailVerified when providerAccountId is already lowercase", async () => {
    const t = createTestContext();
    const { userId, accountId } = await seedPasswordUser(t, "Mixed@x.com", {
      providerAccountId: "mixed@x.com", // already lowercase
      emailVerified: "Mixed@x.com", // mixed-case
    });

    const result = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});

    expect(result.usersChanged).toBe(1);
    expect(result.changes[0]!.userId).toBe(userId);
    expect(result.changes[0]!.accountChanges).toEqual([
      { accountId, emailVerified: "mixed@x.com" },
    ]);

    const account = await getAccount(t, accountId);
    expect(account?.providerAccountId).toBe("mixed@x.com");
    expect(account?.emailVerified).toBe("mixed@x.com");
  });
});

describe("normalizeMixedCaseEmails — account-level collision", () => {
  it("skips the account rewrite when another account already exists at (provider, lowercase id); user.email is still patched", async () => {
    const t = createTestContext();
    // Two users, distinct lowercase emails so the user-level guard does NOT
    // trip. Their authAccounts collide at (password, lowercase id).
    const a = await seedPasswordUser(t, "Foo@x.com", {
      providerAccountId: "Foo@x.com",
    });
    const b = await seedPasswordUser(t, "other@x.com", {
      providerAccountId: "foo@x.com", // already-lowercase, would collide
    });

    const result = await t.mutation(internal.migrations.normalizeMixedCaseEmails, {});

    // User A's email is patched...
    expect(result.usersChanged).toBe(1);
    expect(result.changes[0]!.userId).toBe(a.userId);
    expect(result.changes[0]!.accountChanges).toEqual([]);

    // ...but the account-level rewrite is refused.
    expect(result.usersSkipped).toBeGreaterThanOrEqual(1);
    const accountSkip = result.skipped.find((s) => s.userId === a.userId);
    expect(accountSkip).toBeDefined();
    expect(accountSkip!.reason).toMatch(/authAccount|exist|collid/i);

    // The colliding account is untouched.
    const aAccount = await getAccount(t, a.accountId);
    expect(aAccount?.providerAccountId).toBe("Foo@x.com");
    const bAccount = await getAccount(t, b.accountId);
    expect(bAccount?.providerAccountId).toBe("foo@x.com");

    // But user A's email DID get lowercased on the users table.
    expect((await getUser(t, a.userId))?.email).toBe("foo@x.com");
  });
});
