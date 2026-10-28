import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * A query that names its index (`INDEXED BY x`) fails outright on a database without it, so
 * every such index must be created by a script, or a rebuilt database breaks the page that
 * reads it. `pwd_events_recent` was made on production by hand and defined nowhere until
 * Oct 28 2026.
 */
const files = (dir: string, ext: RegExp): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "node_modules" || name === "__tests__" ? [] : files(full, ext);
    return ext.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
  });

describe("every index a query names is created by a script", () => {
  it("finds each INDEXED BY name in a CREATE INDEX on the table the query reads", () => {
    // `FROM pwd_case_events e INDEXED BY pwd_events_recent`: the table, then the index. Names carry
    // an underscore, which a word in a comment doesn't; one built in a template is left out.
    const named: { table: string; index: string }[] = [];
    for (const f of files(join(process.cwd(), "src"), /\.tsx?$/)) {
      for (const m of readFileSync(f, "utf8").matchAll(/(\w+)(?:\s+(?:AS\s+)?\w+)?\s+INDEXED BY ([a-z][a-z0-9]*_[a-z0-9_]+)/g)) {
        named.push({ table: m[1]!, index: m[2]! });
      }
    }
    expect(new Set(named.map((n) => n.index)).size).toBeGreaterThanOrEqual(8);
    const created = new Set<string>();
    for (const f of files(join(process.cwd(), "scripts"), /\.py$/)) {
      for (const m of readFileSync(f, "utf8").matchAll(/CREATE INDEX(?: IF NOT EXISTS)? (\{?\w+\}?\w*)/g)) created.add(m[1]!);
    }
    // The tables the scripts build templated indexes over (`"table": "lca_cases"`, `TABLE = "..."`).
    const tables = new Set<string>();
    for (const f of files(join(process.cwd(), "scripts"), /\.py$/)) {
      for (const m of readFileSync(f, "utf8").matchAll(/(?:["']table["']\s*:\s*|^TABLE\s*=\s*)["']([a-z_]+)["']/gm)) tables.add(m[1]!);
    }
    expect(tables.size).toBeGreaterThanOrEqual(6);
    // A name built from its table ({t}_emp) counts only as a table's own: table + suffix. Where the
    // query's table is itself built in a template, any table the scripts build will do.
    const suffixes = [...created].filter((c) => c.startsWith("{")).map((c) => c.replace(/^\{\w+\}/, ""));
    const made = ({ table, index }: { table: string; index: string }) =>
      created.has(index) ||
      (tables.has(table) ? [table] : /^(FROM|JOIN)$/i.test(table) ? [...tables] : []).some((t) => suffixes.some((x) => index === t + x));
    expect(named.filter((n) => !made(n)).map((n) => `${n.table} INDEXED BY ${n.index}`)).toEqual([]);
  });
});
