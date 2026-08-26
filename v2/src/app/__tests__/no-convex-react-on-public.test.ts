import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A public page must not reach for the Convex REACT client.
 *
 * `src/app/providers.tsx` mounts ConvexProviders in the auth and
 * authenticated layouts only, with the comment "Public pages skip this
 * entirely, avoiding Convex WebSocket + auth overhead."
 *
 * A client component under (public) that calls `useQuery` from `convex/react`
 * does not degrade gracefully. It throws "Could not find Convex client!
 * `useQuery` must be used in the React component tree under ConvexProvider"
 * and takes the whole route down. /perm-cases shipped exactly that and was
 * dead in production until someone opened it.
 *
 * The supported path for a public page is `usePublicQuery`, which fetches a
 * route under /api with no provider and no socket. (It replaced
 * `useConvexHttpQuery`, which did the same against Convex before the public
 * DOL data moved to Turso.)
 */

const ROOT = join(process.cwd(), "src");
const PUBLIC_DIR = join(ROOT, "app", "(site)", "(public)");
/** Components a public route is allowed to render must obey the same rule. */
const SHARED_DIRS = [join(ROOT, "components", "tools"), join(ROOT, "components", "home")];

const BANNED = /from\s+["']convex\/react["']/;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("public routes never import convex/react", () => {
  const files = [PUBLIC_DIR, ...SHARED_DIRS].flatMap((d) => walk(d));

  it("scanned a plausible number of files", () => {
    // A gate that cannot see its subject reports a perfect pass.
    expect(files.length).toBeGreaterThan(40);
  });

  it("finds no convex/react import under a public route", () => {
    const offenders = files.filter((f) => BANNED.test(readFileSync(f, "utf8")));
    expect(
      offenders.map((f) => f.replace(process.cwd() + "/", "")),
    ).toEqual([]);
  });
});
