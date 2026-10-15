import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { ScrollToInputSchema } from "@/lib/ai/tools";

/**
 * Every place the assistant can scroll to exists on some signed-in page.
 *
 * The scroll tool names its targets in an enum, and the page finds them by
 * `data-scroll-target` or by id. When the dashboard was rebuilt, two of them
 * ("deadlines", "recent-activity") were on no element at all, and "form-section"
 * never had been: the assistant said it had scrolled while nothing moved.
 */

/** Handled by the scroll code itself, not by an element. */
const BUILT_IN = new Set(["top", "bottom"]);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      sourceFiles(path, out);
    } else if (path.endsWith(".tsx") && !path.endsWith(".test.tsx") && !path.endsWith(".stories.tsx")) {
      out.push(path);
    }
  }
  return out;
}

describe("assistant scroll targets", () => {
  const files = sourceFiles("src");
  const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const targets = ScrollToInputSchema.shape.target.options.filter((t) => !BUILT_IN.has(t));

  it("reads the tree and the enum", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(targets.length).toBeGreaterThan(2);
  });

  it.each(targets)("%s is on an element", (target) => {
    const onElement = source.includes(`data-scroll-target="${target}"`) || source.includes(`id="${target}"`);
    expect(onElement, `no element carries data-scroll-target="${target}" or id="${target}"`).toBe(true);
  });
});
