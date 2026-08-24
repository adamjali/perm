import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Adjacent JSX elements are separated by something.
 *
 * JSX strips the whitespace between two elements written on separate lines, so
 *
 *     <h3>Prevailing wage</h3>
 *     <p>How many requests are ahead of mine?</p>
 *
 * reaches the DOM with nothing between the two, and every extractor that walks
 * the DOM reads "Prevailing wageHow many requests are ahead of mine?" as one
 * word. Google has reproduced the glued form verbatim in a search listing. CSS
 * hides it completely, because the children are block or flex, so it looks
 * correct in a browser and is wrong everywhere that matters.
 *
 * A sweep fixed 609 of these across the app, and four new ones were introduced
 * in a component written days later. That is what makes it worth a gate rather
 * than a habit.
 *
 * The fix is an explicit `{" "}` after the closing tag.
 */

const ROOTS = ["src"];

/** Block-level tags whose text an extractor concatenates with its neighbour. */
const TAGS = "h1|h2|h3|h4|h5|h6|p|span|a|li|dt|dd|strong|b|em";

/**
 * A closing tag immediately followed by an opening tag, with only whitespace
 * between them and no `{" "}` separator.
 */
const GLUED = new RegExp(`</(?:${TAGS})>\\s*\\n\\s*<(?:${TAGS})[\\s>]`, "g");

function walk(dir: string, out: string[] = []): string[] {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- seeded from literal ROOTS
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next") continue;
    const full = join(dir, entry);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- same
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("adjacent JSX elements are separated", () => {
  const files = walk(ROOTS[0]!).filter(
    (f) => !/\.test\.tsx$|__tests__|\.stories\./.test(f),
  );

  it("scans a plausible number of components", () => {
    // A gate that cannot see its subject reads exactly like a pass.
    expect(files.length).toBeGreaterThan(100);
  });

  it("finds no glued pairs in the tools and home components", () => {
    // Scoped to what this session owns. The rest of the app was swept
    // separately and widening this to everything would turn one regression
    // into a hundred pre-existing failures, which is a gate nobody runs.
    //
    // The tool PAGES are in scope as well as the components. Leaving them out
    // the first time let four glued pairs ship on the timeline page while the
    // gate reported clean, which is the failure this whole file exists to
    // prevent: a check that cannot see its subject reads exactly like a pass.
    const owned = files.filter(
      (f) =>
        f.includes("components/tools") ||
        f.includes("components/home") ||
        f.includes(join("app", "(public)", "tools")),
    );
    expect(owned.length).toBeGreaterThan(5);

    const offenders = owned
      .map((f) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- walk() only yields ROOTS paths
        const hits = readFileSync(f, "utf8").match(GLUED);
        return hits ? `${f}: ${hits.length} (${hits[0]!.trim().slice(0, 40)})` : null;
      })
      .filter(Boolean);

    expect(offenders).toEqual([]);
  });
});
