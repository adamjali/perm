import { describe, it, expect } from "vitest";
import { createTestContext, createAuthenticatedContext } from "../../test-utils/convex";
import { api, internal } from "../_generated/api";
import { PERM_KNOWLEDGE_SECTIONS } from "../lib/rag/permKnowledge";
import { APP_GUIDE_SECTIONS } from "../lib/rag/appGuideKnowledge";

// KNOWLEDGE TESTS

describe("knowledge", () => {
  // ============================================================================
  // getIngestionStatus TESTS
  // ============================================================================

  describe("getIngestionStatus", () => {
    it("returns correct total sections count from static data", async () => {
      const t = createTestContext();

      const status = await t.query(internal.knowledge.getIngestionStatus, {});

      expect(status).toHaveProperty("sectionsAvailable");
      expect(status.sectionsAvailable).toBe(
        PERM_KNOWLEDGE_SECTIONS.length + APP_GUIDE_SECTIONS.length
      );
      expect(status.sectionsAvailable).toBeGreaterThan(0);
    });

    it("returns 48 total sections (18 PERM + 30 app guide)", async () => {
      const t = createTestContext();

      const status = await t.query(internal.knowledge.getIngestionStatus, {});

      // This validates the exact count matches our knowledge base
      expect(status.sectionsAvailable).toBe(48);
      expect(status.permSections).toBe(18);
      expect(status.appGuideSections).toBe(30);
    });

    it("returns breakdown of PERM and app guide sections", async () => {
      const t = createTestContext();

      const status = await t.query(internal.knowledge.getIngestionStatus, {});

      expect(status).toHaveProperty("permSections");
      expect(status).toHaveProperty("appGuideSections");
      expect(status.permSections).toBe(PERM_KNOWLEDGE_SECTIONS.length);
      expect(status.appGuideSections).toBe(APP_GUIDE_SECTIONS.length);
    });
  });

  // ============================================================================
  // searchKnowledge TESTS
  // ============================================================================

  describe("searchKnowledge", () => {
    /**
     * These tests verify the action's handling of edge cases.
     * Since RAG search requires actual embeddings (not available in tests),
     * we test the pre-search validation and error handling.
     * searchKnowledge requires authentication (auth gate added in security audit).
     */

    it("returns empty results for empty query", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t);

      const result = await user.action(api.knowledge.searchKnowledge, {
        query: "",
      });

      expect(result).toEqual({
        context: "",
        sources: [],
      });
    });

    it("returns empty results for single character query", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t);

      const result = await user.action(api.knowledge.searchKnowledge, {
        query: "a",
      });

      expect(result).toEqual({
        context: "",
        sources: [],
      });
    });

    it("returns empty results for whitespace-only query", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t);

      const result = await user.action(api.knowledge.searchKnowledge, {
        query: "   ",
      });

      expect(result).toEqual({
        context: "",
        sources: [],
      });
    });

    it("returns object with correct structure for valid query", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t);

      const result = await user.action(api.knowledge.searchKnowledge, {
        query: "PWD expiration rules",
      });

      expect(result).toHaveProperty("context");
      expect(result).toHaveProperty("sources");
      expect(typeof result.context).toBe("string");
      expect(Array.isArray(result.sources)).toBe(true);
    });

    it("handles search errors gracefully (returns empty results)", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t);

      const result = await user.action(api.knowledge.searchKnowledge, {
        query: "test query that might fail",
      });

      expect(result).toHaveProperty("context");
      expect(result).toHaveProperty("sources");
    });

    it("rejects unauthenticated requests", async () => {
      const t = createTestContext();

      await expect(
        t.action(api.knowledge.searchKnowledge, { query: "test" })
      ).rejects.toThrow("Not authenticated");
    });
  });

  // ============================================================================
  // KNOWLEDGE SECTIONS DATA TESTS
  // ============================================================================

  describe("PERM_KNOWLEDGE_SECTIONS", () => {
    it("has required fields for each section", () => {
      for (const section of PERM_KNOWLEDGE_SECTIONS) {
        expect(section).toHaveProperty("title");
        expect(section).toHaveProperty("content");
        expect(section).toHaveProperty("metadata");
        expect(section.metadata).toHaveProperty("source");
        expect(section.metadata).toHaveProperty("section");
        expect(typeof section.title).toBe("string");
        expect(typeof section.content).toBe("string");
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.content.length).toBeGreaterThan(0);
      }
    });

    it("has unique section identifiers", () => {
      const sectionIds = PERM_KNOWLEDGE_SECTIONS.map((s) => s.metadata.section);
      const uniqueIds = new Set(sectionIds);
      expect(uniqueIds.size).toBe(sectionIds.length);
    });

    it("includes key PERM topics", () => {
      const titles = PERM_KNOWLEDGE_SECTIONS.map((s) => s.title.toLowerCase());

      // Check for essential PERM topics
      expect(titles.some((t) => t.includes("pwd"))).toBe(true);
      expect(titles.some((t) => t.includes("recruitment"))).toBe(true);
      expect(titles.some((t) => t.includes("eta 9089") || t.includes("eta9089"))).toBe(true);
      expect(titles.some((t) => t.includes("i-140") || t.includes("i140"))).toBe(true);
      expect(titles.some((t) => t.includes("rfi"))).toBe(true);
      expect(titles.some((t) => t.includes("rfe"))).toBe(true);
    });

    it("includes CFR references where applicable", () => {
      const sectionsWithCFR = PERM_KNOWLEDGE_SECTIONS.filter(
        (s) => s.metadata.cfr
      );

      // Should have at least some sections with CFR references
      expect(sectionsWithCFR.length).toBeGreaterThan(0);

      // Verify CFR format
      for (const section of sectionsWithCFR) {
        expect(section.metadata.cfr).toMatch(/20 CFR 656/);
      }
    });

    it("all sections reference perm_flow.md as source", () => {
      for (const section of PERM_KNOWLEDGE_SECTIONS) {
        expect(section.metadata.source).toBe("perm_flow.md");
      }
    });
  });

  // ============================================================================
  // APP GUIDE SECTIONS DATA TESTS
  // ============================================================================

  describe("APP_GUIDE_SECTIONS", () => {
    it("has required fields for each section", () => {
      for (const section of APP_GUIDE_SECTIONS) {
        expect(section).toHaveProperty("title");
        expect(section).toHaveProperty("content");
        expect(section).toHaveProperty("metadata");
        expect(section.metadata).toHaveProperty("source");
        expect(section.metadata).toHaveProperty("section");
        expect(typeof section.title).toBe("string");
        expect(typeof section.content).toBe("string");
        expect(section.title.length).toBeGreaterThan(0);
        expect(section.content.length).toBeGreaterThan(0);
      }
    });

    it("has unique section identifiers", () => {
      const sectionIds = APP_GUIDE_SECTIONS.map((s) => s.metadata.section);
      const uniqueIds = new Set(sectionIds);
      expect(uniqueIds.size).toBe(sectionIds.length);
    });

    it("has 30 sections covering pages, features, and workflows", () => {
      expect(APP_GUIDE_SECTIONS.length).toBe(30);

      const sectionIds = APP_GUIDE_SECTIONS.map((s) => s.metadata.section);

      // Check for page guides (sections 1-10)
      expect(sectionIds.filter((id) => id.startsWith("app-")).length).toBeGreaterThanOrEqual(10);

      // Check for workflow guides (sections 23-30)
      expect(sectionIds.filter((id) => id.startsWith("workflow-")).length).toBeGreaterThanOrEqual(8);
    });

    it("includes key app topics", () => {
      const titles = APP_GUIDE_SECTIONS.map((s) => s.title.toLowerCase());

      // Check for essential app topics
      expect(titles.some((t) => t.includes("dashboard"))).toBe(true);
      expect(titles.some((t) => t.includes("case") && (t.includes("list") || t.includes("detail")))).toBe(true);
      expect(titles.some((t) => t.includes("calendar"))).toBe(true);
      expect(titles.some((t) => t.includes("notification"))).toBe(true);
      expect(titles.some((t) => t.includes("setting"))).toBe(true);
      expect(titles.some((t) => t.includes("filter") || t.includes("sort"))).toBe(true);
    });

    it("all sections reference app_guide as source", () => {
      for (const section of APP_GUIDE_SECTIONS) {
        expect(section.metadata.source).toBe("app_guide");
      }
    });

    it("no sections have CFR references (app guides, not regulations)", () => {
      for (const section of APP_GUIDE_SECTIONS) {
        expect(section.metadata.cfr).toBeUndefined();
      }
    });
  });

  // ============================================================================
  // CROSS-COLLECTION UNIQUENESS TESTS
  // ============================================================================

  describe("cross-collection uniqueness", () => {
    it("has unique section identifiers across PERM and app guide sections", () => {
      const permIds = PERM_KNOWLEDGE_SECTIONS.map((s) => s.metadata.section);
      const appGuideIds = APP_GUIDE_SECTIONS.map((s) => s.metadata.section);
      const allIds = [...permIds, ...appGuideIds];
      const uniqueIds = new Set(allIds);

      expect(uniqueIds.size).toBe(allIds.length);
    });

    it("distinguishes sources between PERM and app guide sections", () => {
      const permSources = new Set(PERM_KNOWLEDGE_SECTIONS.map((s) => s.metadata.source));
      const appGuideSources = new Set(APP_GUIDE_SECTIONS.map((s) => s.metadata.source));

      expect(permSources.has("perm_flow.md")).toBe(true);
      expect(appGuideSources.has("app_guide")).toBe(true);
      expect(permSources.has("app_guide")).toBe(false);
      expect(appGuideSources.has("perm_flow.md")).toBe(false);
    });
  });

  // ============================================================================
  // RESPONSE TYPE TESTS
  // ============================================================================

  describe("response types", () => {
    it("KnowledgeSearchResult has expected shape", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t);

      const result = await user.action(api.knowledge.searchKnowledge, {
        query: "test",
      });

      // Type assertion test - this validates TypeScript types at compile time
      const typedResult: {
        context: string;
        sources: Array<{
          title: string;
          source: string;
          section?: string;
          cfr?: string;
        }>;
      } = result;

      expect(typedResult).toBeDefined();
    });

    it("sources array contains properly typed items when populated", async () => {
      const t = createTestContext();
      const user = await createAuthenticatedContext(t);

      const result = await user.action(api.knowledge.searchKnowledge, {
        query: "PWD determination date rules",
      });

      // If sources are returned, verify their structure
      for (const source of result.sources) {
        expect(source).toHaveProperty("title");
        expect(source).toHaveProperty("source");
        expect(typeof source.title).toBe("string");
        expect(typeof source.source).toBe("string");
        if (source.section !== undefined) {
          expect(typeof source.section).toBe("string");
        }
        if (source.cfr !== undefined) {
          expect(typeof source.cfr).toBe("string");
        }
      }
    });
  });
});
