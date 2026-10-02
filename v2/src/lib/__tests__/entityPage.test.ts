import { describe, it, expect } from "vitest";
import { entityMetadata } from "@/lib/entityPage";

describe("entityMetadata", () => {
  const base = { title: "ACME CORP PERM Filings", absolute: false, description: "d", path: "/perm-employers/acme" };

  it("names one path as the canonical and the Open Graph URL", () => {
    const meta = entityMetadata(base);
    expect(meta.alternates).toEqual({ canonical: "/perm-employers/acme" });
    expect(meta.openGraph).toMatchObject({
      title: "ACME CORP PERM Filings | PERM Tracker",
      description: "d",
      url: "/perm-employers/acme",
    });
    expect(meta.twitter).toEqual({ card: "summary_large_image" });
  });

  it("emits a robots directive only for a page under its own-page floor", () => {
    expect("robots" in entityMetadata(base)).toBe(false);
    expect(entityMetadata({ ...base, noindex: true }).robots).toEqual({ index: false, follow: true });
  });

  it("drops the brand template when the title had to", () => {
    expect(entityMetadata(base).title).toBe("ACME CORP PERM Filings");
    expect(entityMetadata({ ...base, absolute: true }).title).toEqual({ absolute: "ACME CORP PERM Filings" });
  });
});
