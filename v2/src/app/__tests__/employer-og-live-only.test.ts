import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The employer social card resolves in the same order as the page: the
 * published record, then the live-only record, and a 404 only when both miss.
 *
 * It used to stop at the published record. A file-based image is attached to
 * every page in the segment, so all ~22,600 live-only employer pages advertised
 * an og:image that answered 404 to every link-preview agent (measured on
 * /perm-employers/the-wine-group-llc, 2026-09-23). The card generators are
 * mocked: this pins the ROUTING, which is where the defect was.
 */

const published = { name: "Acme Corp", total: 12 };
const live = { slug: "okemos-software-llc", name: "Okemos Software LLC", cases: 1, pending: 1 };

async function load({ found, record }: { found: unknown; record: unknown }) {
  vi.resetModules();
  const generateEntityOG = vi.fn(() => "published-card");
  const generateLiveEmployerOG = vi.fn(() => "live-card");
  vi.doMock("@/lib/turso/entityDetail", () => ({ resolveEntity: vi.fn().mockResolvedValue(found) }));
  vi.doMock("@/lib/turso/liveEmployers", () => ({ liveEmployerRecord: vi.fn().mockResolvedValue(record) }));
  vi.doMock("@/lib/entityOg", () => ({
    ENTITY_OG_SIZE: { width: 1200, height: 630 },
    generateEntityOG,
    generateLiveEmployerOG,
  }));
  const mod = await import("../(site)/(public)/perm-employers/[slug]/opengraph-image");
  const out = await mod.default({ params: Promise.resolve({ slug: "x" }) });
  return { out, generateEntityOG, generateLiveEmployerOG };
}

afterEach(() => {
  vi.doUnmock("@/lib/turso/entityDetail");
  vi.doUnmock("@/lib/turso/liveEmployers");
  vi.doUnmock("@/lib/entityOg");
});

describe("employer social card", () => {
  it("a published employer gets the published card", async () => {
    const r = await load({ found: { row: published }, record: live });
    expect(r.out).toBe("published-card");
    expect(r.generateLiveEmployerOG).not.toHaveBeenCalled();
  });

  it("a live-only employer gets the live card with its own name and count, not a 404", async () => {
    const r = await load({ found: null, record: live });
    expect(r.out).toBe("live-card");
    expect(r.generateLiveEmployerOG).toHaveBeenCalledWith("Okemos Software LLC", 1);
  });

  it("a slug in neither corpus is still a 404, like its page", async () => {
    const r = await load({ found: null, record: null });
    expect(r.out).toBeInstanceOf(Response);
    expect((r.out as Response).status).toBe(404);
  });
});
