import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Nothing a person can press sits inside a <summary>.
 *
 * A <summary> is the toggle that opens its <details>, so a link or a button
 * inside it is a control inside a control: a screen reader announces one and
 * hides the other, and a tap meant for the link can open the fold instead
 * (axe: nested-interactive). The RFI stage glossary and the status-meanings
 * page both put their count links there until Oct 15 2026; the count stays in
 * the row as text and the link sits inside the opened entry.
 */

const CONTROL = /<(Link|a|button|Button|input|select|textarea)\b/;

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

function controlsInSummaries(source: string): string[] {
  return [...source.matchAll(/<summary\b[\s\S]*?<\/summary>/g)].map((m) => m[0]).filter((s) => CONTROL.test(s));
}

describe("no control inside a <summary>", () => {
  const files = sourceFiles("src");

  it("reads the tree, and its check finds a control when one is there", () => {
    expect(files.length).toBeGreaterThan(200);
    expect(controlsInSummaries('<summary className="x"><b>965</b> <Link href="/a">cases</Link></summary>')).toHaveLength(1);
    expect(controlsInSummaries('<summary className="x"><b>965</b> cases</summary>')).toHaveLength(0);
  });

  it("holds for every component and page", () => {
    const found = files.flatMap((f) => controlsInSummaries(readFileSync(f, "utf8")).map((s) => `${f}: ${s.slice(0, 120)}`));
    expect(found).toEqual([]);
  });
});
