import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { neutralPath, parseWithheldEnv, shownLabel } from "@/lib/privacy/withheld";

// Every name here is made up. The real lists are server settings and build
// secrets; this public repository must never hold a name a request took down.
// The masking rule itself is tested in convex/lib/withheldNames.test.ts; its
// path through the read layer in src/lib/db/__tests__/clientWithheld.test.ts.
const ROOT = path.resolve(__dirname, "../../../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

describe("the setting's format", () => {
  it("reads the shared fixture exactly as the Python tool does", () => {
    const fx = JSON.parse(read("scripts/fixtures/withheld_format.json")) as {
      settings: Record<string, string>;
      entries: unknown[];
    };
    const got = parseWithheldEnv(fx.settings).map((e) => ({
      kind: e.kind,
      slug: e.slug,
      name: e.name,
      label: e.label,
      cases: e.cases,
      number: e.number,
      slugs: e.slugs,
      names: e.names,
      shown: shownLabel(e),
      neutralPath: neutralPath(e),
    }));
    expect(got).toEqual(fx.entries);
  });
});

describe("the wiring", () => {
  it("masks every read where it passes: the database and Convex's copy of it", () => {
    const client = read("src/lib/db/client.ts");
    expect(client).toMatch(/const prepared = prepareStatement\(sql, args\);/);
    expect(client).toMatch(/db\.execute\(\{ sql: prepared\.sql, args: prepared\.args as never\[\] \}\)/);
    expect(client).toMatch(/maskRowsIndexed\(out, prepared\.ctx, mask\)/);
    const mirror = read("convex/lib/publicMirror.ts");
    expect(mirror).toMatch(/const masker = maskerForEnv\(process\.env\);/);
    expect(mirror).toMatch(/out\.push\(ctx \? masker\.mask\(read, ctx\) : read\);/);
  });

  it("masks DOL's live answers and never records a withheld one", () => {
    const discovery = read("src/lib/db/caseDiscovery.ts");
    expect(discovery).toMatch(/employerName: shownName\(hit\.employerName, caseNumber\)/);
    expect(discovery).toMatch(/withheld: shownName\(hit\.employerName, caseNumber\) !== \(hit\.employerName \?\? null\)/);
    expect(discovery.match(/if \(!rec\.withheld\) try \{\s+await exec\(\s+`INSERT/g)?.length).toBe(2);
    const flag = read("src/lib/db/flagCases.ts");
    expect(flag).toMatch(/if \(!rec\.withheld\) try \{\s+await exec\(\s+`INSERT/);
  });

  it("drops a withheld entity from every navigation list", () => {
    const drop = /\{ withheld: "drop" \}/;
    const publicData = read("src/lib/db/publicData.ts");
    for (const fn of ["getEntitySlugWindow", "getLiveOnlySlugWindow"]) {
      const body = publicData.slice(publicData.indexOf(`export async function ${fn}`));
      expect(body.slice(0, body.indexOf("\n}\n")), fn).toMatch(drop);
    }
    expect(read("src/lib/db/otherEmployers.ts")).toMatch(drop);
    expect(read("src/lib/db/entityBrowse.ts")).toMatch(drop);
    expect(read("src/lib/db/nameSuggest.ts")).toMatch(drop);
    expect(read("src/lib/db/entityDetail.ts")).toMatch(drop);
  });

  it("keeps a neutral page out of the index and its name blocks off it", () => {
    expect(read("src/lib/entityPage.ts")).toMatch(/const hidden = noindex \|\| isNeutralPath\(path\);/);
    const firm = read("src/app/(site)/(public)/perm-attorneys/[slug]/page.tsx");
    expect(firm).toMatch(/const neutral = neutralPageEntry\(KIND, canonicalSlug\) !== null;/);
    expect(firm).toMatch(/\{neutral \? null : \(\s+<Chapter id="firm"/);
    expect(firm).toMatch(/\{neutral \? null : \(\s+<NameSpellings/);
    const employer = read("src/app/(site)/(public)/perm-employers/[slug]/page.tsx");
    expect(employer).toMatch(/\{neutral \? null : \(\s+<NameSpellings/);
    expect(employer).toMatch(/return neutralPageEntry\(KIND, slug\) \? undefined : caseSearchHref/);
  });

  it("refuses a search by a withheld name, and a claim of a withheld firm", () => {
    expect(read("src/lib/db/nameSuggest.ts").match(/if \(isWithheldQuery\(kind, q\)\) return \[\];/g)?.length).toBe(2);
    expect(read("src/lib/caseSearchRequest.ts")).toMatch(/if \(firmText && !firm\) return \{ kind: "noMatch"/);
    expect(read("src/app/api/decided-cases/route.ts")).toMatch(/isWithheldQuery\("attorney", narrow\.attorney\)/);
    const claims = read("convex/firmClaims.ts");
    expect(claims.match(/maskerForEnv\(process\.env\)\.withheldBySlug\("firm", (args\.)?slug\)/g)?.length).toBe(2);
  });

  it("reaches the build, the page checks and the purge, which read the same database", () => {
    const deploy = read("../.github/workflows/oracle-deploy.yml");
    expect(deploy.match(/WITHHELD_EMPLOYERS: \$\{\{ secrets\.WITHHELD_EMPLOYERS \}\}/g)?.length).toBe(3);
    expect(deploy.match(/WITHHELD_FIRMS: \$\{\{ secrets\.WITHHELD_FIRMS \}\}/g)?.length).toBe(3);
  });
});
