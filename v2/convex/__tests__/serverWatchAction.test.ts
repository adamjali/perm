import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestContext } from "../../test-utils/convex";
import { internal } from "../_generated/api";

/**
 * The watch's action: the switch, the recorded state, and the one scheduled
 * admin email. Its rules (judge, step) are tested in convex/lib/serverWatch.test.ts.
 */
const originalFetch = global.fetch;

function mirrorAnswers(row: { computed_at: number; json: string } | null) {
  global.fetch = (async () => {
    const cols = [{ name: "computed_at" }, { name: "json" }];
    const rows = row ? [[{ type: "integer", value: String(row.computed_at) }, { type: "text", value: row.json }]] : [];
    return new Response(
      JSON.stringify({ results: [{ type: "ok", response: { type: "execute", result: { cols, rows } } }, { type: "ok", response: { type: "close" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as unknown as typeof fetch;
}

async function scheduledEmails(t: ReturnType<typeof createTestContext>) {
  const s = await t.run(async (ctx) => ctx.db.system.query("_scheduled_functions").collect());
  return s.filter((f) => f.name.includes("sendAdminNotificationEmail"));
}

beforeEach(() => {
  vi.stubEnv("TURSO_DATABASE_URL", "https://example.turso.io");
  vi.stubEnv("TURSO_AUTH_TOKEN", "stub-token");
});
afterEach(() => {
  global.fetch = originalFetch;
  vi.unstubAllEnvs();
});

describe("the server watch", () => {
  it("does nothing where SERVER_WATCH isn't on", async () => {
    const t = createTestContext();
    mirrorAnswers(null);
    await t.action(internal.serverWatch.check, {});
    expect(await t.run(async (ctx) => ctx.db.query("serverWatch").collect())).toHaveLength(0);
    expect(await scheduledEmails(t)).toHaveLength(0);
  });

  it("emails once when the report goes stale, and not again 15 minutes later", async () => {
    vi.stubEnv("SERVER_WATCH", "on");
    const t = createTestContext();
    const stale = Date.now() - 2 * 60 * 60 * 1000;
    mirrorAnswers({ computed_at: stale, json: JSON.stringify({ at: new Date(stale).toISOString(), now: { diskPct: 40 } }) });
    await t.action(internal.serverWatch.check, {});
    expect(await scheduledEmails(t)).toHaveLength(1);
    const [row] = await t.run(async (ctx) => ctx.db.query("serverWatch").collect());
    expect(row?.down).toBe(true);
    await t.action(internal.serverWatch.check, {});
    expect(await scheduledEmails(t), "a second check inside the reminder window sends nothing").toHaveLength(1);
  });
});
