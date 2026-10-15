import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

/**
 * The calm system (Oct 14 2026), held in place.
 *
 * The owner's brief: simple, plain, readable, nothing moving unless the
 * visitor did something. The redesign took out hard shadows, hover lifts,
 * all-caps labels, black-weight type, looping animation and the textures; this
 * fails the moment one comes back, and checks every text colour token against
 * every surface it sits on.
 *
 * Source checks over the class strings and the stylesheet, comments stripped.
 */

const SRC = resolve(__dirname, "..", "..");
const CSS = readFileSync(join(SRC, "app", "globals.css"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "__tests__" || name === "emails") continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const FILES = walk(SRC).map((p) => ({ rel: relative(SRC, p), src: stripComments(readFileSync(p, "utf8")) }));

/** Every match of `re` across the source, as "file: token". */
function findAll(re: RegExp): string[] {
  const hits: string[] = [];
  for (const { rel, src } of FILES) {
    for (const m of src.matchAll(re)) hits.push(`${rel}: ${m[0].trim()}`);
  }
  return hits;
}

// A token inside a class string: bounded by a quote, backtick, space or start.
const tok = (body: string) => new RegExp(`(?<=["'\`\\s])${body}(?=["'\`\\s])`, "g");

describe("the calm system", () => {
  it("scanned the source tree", () => {
    // Without this a broken walk reports every rule clean.
    expect(FILES.length).toBeGreaterThan(800);
  });

  it("draws no hard offset shadow", () => {
    expect(findAll(tok("(?:[\\w-]+:)*shadow-(?:hard(?:-sm|-lg)?|\\[[^\\]\\s]*px[^\\]\\s]*\\])"))).toEqual([]);
  });

  it("moves nothing on hover, press or focus", () => {
    expect(
      findAll(tok("(?:[\\w-]+:)*(?:hover|active|group-hover|focus|focus-visible|peer-hover):-?(?:translate-[xy]|scale|rotate)-[\\w./\\[\\]-]+")),
    ).toEqual([]);
  });

  it("transitions colours, never everything", () => {
    expect(findAll(tok("transition-all"))).toEqual([]);
  });

  it("sets headings bold, never black", () => {
    expect(findAll(tok("(?:[\\w-]+:)*font-(?:black|extrabold)"))).toEqual([]);
  });

  it("writes labels in sentence case: no all-caps class outside a typed field", () => {
    // An input may show what's typed in capitals (a case number); nothing
    // else on the page shouts. The element is the nearest JSX tag opened
    // before the class.
    const hits: string[] = [];
    for (const { rel, src } of FILES) {
      for (const m of src.matchAll(tok("uppercase"))) {
        const before = src.slice(Math.max(0, m.index! - 1500), m.index);
        const tag = [...before.matchAll(/<([A-Za-z][\w.]*)/g)].pop()?.[1];
        if (tag !== "input") hits.push(`${rel} (${tag ?? "?"})`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("has no Motion props that animate by themselves", () => {
    expect(findAll(/\b(?:whileInView|whileHover|whileTap|whileFocus)=/g)).toEqual([]);
  });

  it("follows the visitor's reduced-motion setting everywhere", () => {
    const providers = FILES.find((f) => f.rel === "app/shared-providers.tsx")!.src;
    expect(providers).toMatch(/<MotionConfig reducedMotion="user">/);
  });

  it("loops no animation but the skeleton sweep and a spinner", () => {
    const css = stripComments(CSS);
    const infinite = [...css.matchAll(/animation:\s*([\w-]+)[^;]*\binfinite\b/g)].map((m) => m[1]);
    expect(infinite.filter((name) => !["skeleton-sweep", "spin"].includes(name!))).toEqual([]);
    expect(findAll(tok("(?:[\\w-]+:)*animate-(?:bounce|ping|pulse)"))).toEqual([]);
  });

  it("draws no texture on the page", () => {
    expect(findAll(tok("(?:bg-dots|grain-overlay|hazard-bg|hazard-strip-red)"))).toEqual([]);
  });

  it("keeps corners square: a radius class only on what is round by nature", () => {
    // Every radius token is 0, so `rounded-md` and its kin do nothing and
    // only mislead the next reader. `rounded-full` draws a real circle, kept
    // for dots, spinners and the switch.
    expect(findAll(tok("(?:[\\w-]+:)*rounded-(?:xs|sm|md|lg|xl|2xl|3xl|none|[trblse]{1,2}(?:-\\w+)?|\\[[^\\]]*\\])"))).toEqual([]);
    // The bare word is also English and a variable name: as a class it sits
    // against a string's quote.
    expect(findAll(/(?<=["'`])rounded(?=\s)|(?<=\s)rounded(?=["'`])/g)).toEqual([]);
  });

  it("draws every hatch with the shared utility, at one pitch", () => {
    expect(findAll(tok("bg-\\[repeating-linear-gradient[^\\s\"'`]*"))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Contrast: every text token on every surface, both themes.
// ---------------------------------------------------------------------------

function block(selector: string): Record<string, string> {
  const m = CSS.match(new RegExp(`(?:^|\\n)${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`no ${selector} block`);
  const out: Record<string, string> = {};
  for (const d of m[1]!.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) out[d[1]!] = d[2]!;
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe("token contrast", () => {
  const light = block(":root");
  const dark = { ...light, ...block(".dark") };
  const SURFACES = ["background", "card", "muted", "tint"];
  const TEXT = ["foreground", "soft-foreground", "muted-foreground", "primary-text", "data-warn-ink", "data-bad-ink", "data-info-ink"];

  for (const [theme, t] of [["light", light], ["dark", dark]] as const) {
    it(`${theme}: every text colour reads at 4.5:1 or better on every surface`, () => {
      const fails: string[] = [];
      for (const s of SURFACES) for (const c of TEXT) {
        const r = contrast(t[c]!, t[s]!);
        if (r < 4.5) fails.push(`${c} on ${s}: ${r.toFixed(2)}`);
      }
      expect(fails).toEqual([]);
    });

    it(`${theme}: a control's outline reads at 3:1 on every surface`, () => {
      for (const s of SURFACES) expect(contrast(t.input!, t[s]!)).toBeGreaterThanOrEqual(3);
    });
  }

  it("the lime main button's label reads on the lime", () => {
    expect(contrast(light["primary-foreground"]!, light.primary!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("globals.css parses", () => {
  // A cut that leaves one stray brace makes the dev server answer every page
  // with a CSS error and a production build fail; the typecheck can't see it.
  it("has balanced rules a CSS parser accepts", async () => {
    const postcss = (await import("postcss")).default;
    const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");
    expect(() => postcss.parse(css)).not.toThrow();
  });
});
