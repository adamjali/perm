import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Text must clear 4.5:1 against the surfaces it can land on, in BOTH themes.
 *
 * Two ways this codebase broke it, both found by measuring rather than
 * looking:
 *
 * 1. The brand lime used AS TEXT measures 2.05:1 on the light background.
 *    `text-primary` appeared 264 times across 92 files. It reads as an "ugly
 *    green" because it is unreadable, not because the hue is wrong - the
 *    fills use the same colour at 9.83:1 and look fine.
 *
 * 2. Opacity utilities silently undo whatever the token promised.
 *    `text-muted-foreground/70` renders 2.98:1 in light mode even though the
 *    token itself is 5.50:1. 74 of those were in the tree.
 *
 * scripts/audit_contrast.py checks the tokens. This checks the CLASSES,
 * which is the half a token audit cannot see.
 */

const SRC = join(process.cwd(), "src");

/** Measured, in the worse of the two themes. Anything under 4.5 is banned. */
const BANNED: Record<string, string> = {
  "text-foreground/50": "3.94:1 in light — use text-muted-foreground (5.50:1)",
  "text-foreground/45": "3.31:1 in light — use text-muted-foreground",
  "text-foreground/40": "2.83:1 in light — use text-muted-foreground",
  "text-muted-foreground/70": "2.98:1 in light — drop the opacity",
  "text-muted-foreground/60": "2.48:1 in light — drop the opacity",
  "text-muted-foreground/50": "2.08:1 in light — drop the opacity",
  "text-destructive/80": "2.67:1 in light — drop the opacity",
  "text-primary/60": "1.58:1 in light — drop the opacity",
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "node_modules" || name === "__tests__") continue;
      walk(full, out);
    } else if (name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("text contrast", () => {
  const files = walk(SRC);

  it("scanned a plausible number of files", () => {
    // Coverage before verdict: a walk that finds nothing reports zero
    // violations and reads exactly like a pass.
    expect(files.length).toBeGreaterThan(300);
  });

  it.each(Object.entries(BANNED))(
    "%s is not used (%s)",
    (cls, why) => {
      const pattern = new RegExp(`\\b${cls.replace("/", "\\/")}\\b`);
      const offenders = files
        .filter((f) => pattern.test(readFileSync(f, "utf8")))
        .map((f) => f.replace(SRC, "src"));
      expect(offenders, why).toEqual([]);
    },
  );
});
