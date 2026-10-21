import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * A drawing that reads live data sits inside a guide, a page the refresh routes' own tests can't see
 * (they walk page files for readers, and a guide is one `[slug]` page). Without its path on the
 * route for its data, a guide's drawing lags its data by up to the guide's daily window. Each data
 * figure names the routes its readers' data arrives through; every guide that uses one is listed
 * on each of them.
 */

const FIGURE_ROUTES: Record<string, Array<"sweep" | "dol" | "bulletin">> = {
  // the line (live census) and DOL's pace come with the sweep; DOL's published month with processing times
  QueueFigure: ["sweep", "dol"],
  // the RFI path document is written by the sweep (the measured clock by the nightly backtest)
  RfiFigure: ["sweep"],
  BulletinFigure: ["bulletin"],
  // the wage-request count is written by the wage-request pass, which calls the sweep route; DOL's month by processing times
  PwdQueueFigure: ["sweep", "dol"],
};

async function lists() {
  const [{ SWEEP_PAGES }, { DOL_PAGES }, { BULLETIN_PAGES }] = await Promise.all([
    import("../revalidate-sweep/paths"),
    import("../revalidate-dol/paths"),
    import("../revalidate-bulletin/paths"),
  ]);
  return {
    sweep: SWEEP_PAGES as readonly string[],
    dol: DOL_PAGES as readonly string[],
    bulletin: BULLETIN_PAGES as readonly string[],
  };
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("guides with a data drawing are refreshed when that data moves", () => {
  it("every data drawing names its routes", () => {
    // An async component under src/components/figures reads data on the server.
    const files = walk(join(process.cwd(), "src", "components", "figures")).filter(
      (f) => /\.tsx$/.test(f) && !f.includes("__tests__"),
    );
    const servers = files.flatMap((f) =>
      [...readFileSync(f, "utf8").matchAll(/export async function (\w+Figure)\b/g)].map((m) => m[1]!),
    );
    expect(servers.length).toBeGreaterThan(2);
    expect(servers.filter((s) => !(s in FIGURE_ROUTES)), "a data figure with no routes named here").toEqual([]);
  });

  it("each guide using one is on each of its routes", async () => {
    const routes = await lists();
    const missing: string[] = [];
    let uses = 0;
    for (const kind of ["guides", "blog", "changelog"]) {
      const dir = join(process.cwd(), "content", kind);
      for (const name of readdirSync(dir).filter((n) => n.endsWith(".mdx"))) {
        const src = readFileSync(join(dir, name), "utf8");
        const path = `/${kind}/${name.replace(/\.mdx$/, "")}`;
        for (const [tag, need] of Object.entries(FIGURE_ROUTES)) {
          if (!new RegExp(`<${tag}\\b`).test(src)) continue;
          uses += 1;
          for (const r of need) if (!routes[r].includes(path)) missing.push(`${path} (${tag}) not on ${r}`);
        }
      }
    }
    expect(uses).toBeGreaterThan(2);
    expect(missing).toEqual([]);
  });
});
