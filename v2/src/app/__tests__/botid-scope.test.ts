import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Vercel BotID starts only where a protected route can be called.
 *
 * It protects POST /api/chat, the signed-in AI chat, and it used to start in
 * src/instrumentation-client.ts, which Next runs on every page: every public
 * visitor loaded the BotID client and had fetch and XMLHttpRequest wrapped for
 * a route they cannot reach (outside audit and measurement, 2026-09-23). It
 * now starts in the (authenticated) layout through BotIdInit. These checks
 * keep it there and keep the client list and the server checks in step.
 */

const SRC = join(process.cwd(), "src");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.includes(".test.")) out.push(full);
  }
  return out;
}

describe("BotID scope", () => {
  it("the every-page client file does not load BotID", () => {
    expect(read("instrumentation-client.ts")).not.toMatch(/from\s+["']botid/);
  });

  it("only BotIdInit imports the BotID client, and only the signed-in layout renders it", () => {
    const clientImporters = walk(SRC)
      .filter((f) => /from\s+["']botid\/client/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(clientImporters).toEqual(["components/security/BotIdInit.tsx"]);

    const renderers = walk(SRC)
      .filter((f) => /<BotIdInit\s*\/>/.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(renderers).toEqual(["app/(authenticated)/layout.tsx"]);
  });

  it("every protected path has a route that calls checkBotId(), and every such route is protected", async () => {
    const { BOTID_PROTECTED } = await import("@/components/security/BotIdInit");
    const checked = walk(join(SRC, "app", "api"))
      .filter((f) => f.endsWith("route.ts") && /checkBotId\s*\(/.test(readFileSync(f, "utf8")))
      .map((f) => "/" + relative(join(SRC, "app"), f).replace(/\/route\.ts$/, ""));
    expect(checked.length).toBeGreaterThan(0);
    expect(BOTID_PROTECTED.map((p) => p.path).sort()).toEqual([...checked].sort());
    for (const p of BOTID_PROTECTED) {
      const route = read(`app${p.path}/route.ts`);
      expect(route, `${p.path} exports ${p.method}`).toMatch(new RegExp(`export\\s+(async\\s+)?(function|const)\\s+${p.method}\\b`));
    }
  });

  it("starts BotID once per page session, with the protected list", async () => {
    vi.resetModules();
    const initBotId = vi.fn();
    vi.doMock("botid/client/core", () => ({ initBotId }));
    const { render } = await import("@testing-library/react");
    const { createElement } = await import("react");
    const { BotIdInit, BOTID_PROTECTED } = await import("@/components/security/BotIdInit");
    render(createElement("div", null, createElement(BotIdInit), createElement(BotIdInit)));
    expect(initBotId).toHaveBeenCalledTimes(1);
    expect(initBotId).toHaveBeenCalledWith({ protect: BOTID_PROTECTED });
    vi.doUnmock("botid/client/core");
  });
});
