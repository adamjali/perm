import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ENDPOINTS, MCP_TOOLS, openApiDocument } from "../openapi";

const ROOT = join(__dirname, "..", "..", "..", "..");
const V1 = join(ROOT, "src", "app", "v1");

/** Every route under src/app/v1, as an OpenAPI path ("[slug]" becomes "{slug}"). */
function routePaths(): string[] {
  const out: string[] = [];
  const walk = (dir: string, path: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      const next = `${path}/${entry.replace(/^\[(.+)\]$/, "{$1}")}`;
      if (readdirSync(full).includes("route.ts")) out.push(next);
      walk(full, next);
    }
  };
  walk(V1, "");
  return out.sort();
}

describe("the API description matches the API", () => {
  it("found the routes", () => {
    expect(routePaths().length).toBeGreaterThan(8);
  });

  it("describes every route, and every described path has a route", () => {
    // The spec itself and the index describe the API rather than being part of it.
    const routes = routePaths().filter((p) => p !== "/openapi.json");
    expect(ENDPOINTS.map((e) => e.path).sort()).toEqual(routes);
  });

  it("puts every endpoint in the OpenAPI document", () => {
    const doc = openApiDocument() as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths).sort()).toEqual(ENDPOINTS.map((e) => e.path).sort());
  });

  it("lists the same tools the MCP server registers", () => {
    const src = readFileSync(join(ROOT, "src", "lib", "api", "mcp.ts"), "utf8");
    const registered = [...src.matchAll(/registerTool\(\s*"([a-z_]+)"/g)].map((m) => m[1]).sort();
    expect(registered.length).toBeGreaterThan(3);
    expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual(registered);
  });
});
