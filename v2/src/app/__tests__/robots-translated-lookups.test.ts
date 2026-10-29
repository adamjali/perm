import { describe, expect, it } from "vitest";

import robots from "../robots";
import { LOCALES } from "@/lib/i18n/locales";

/**
 * A case lookup in another language asks DOL live just as the English one does, so
 * crawlers are asked to skip it the same way (Oct 29 2026: the five translated
 * lookups went live without it). The bare translated pages stay open.
 */
describe("robots.txt and the translated case lookups", () => {
  const rule = [robots().rules].flat().find((r) => r.userAgent === "*")!;
  const disallow = [rule.disallow].flat();

  it("asks crawlers to skip every language's lookup with a case number", () => {
    expect(disallow).toContain("/perm-case-status?");
    for (const l of LOCALES) expect(disallow, l.code).toContain(`${l.path}/perm-case-status?`);
  });

  it("leaves the bare translated pages open", () => {
    for (const l of LOCALES) {
      const path = `${l.path}/perm-case-status`;
      expect(disallow.some((d) => d !== "/" && path.startsWith(d)), l.code).toBe(false);
    }
  });
});
