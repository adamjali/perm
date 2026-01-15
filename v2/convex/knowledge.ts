/**
 * Knowledge Search Functions
 *
 * Provides semantic search over the PERM knowledge base using RAG.
 * This module enables the chat system to retrieve relevant PERM regulations,
 * deadlines, and procedures based on natural language queries.
 *
 * @module knowledge
 */

import { action, internalAction, query } from "./_generated/server";
import { v } from "convex/values";
import { rag } from "./lib/rag";
import { internal } from "./_generated/api";
import { PERM_KNOWLEDGE_SECTIONS } from "./lib/rag/permKnowledge";
import { APP_GUIDE_SECTIONS } from "./lib/rag/appGuideKnowledge";

/**
 * Source metadata returned with search results
 */
export interface KnowledgeSource {
  title: string;
  source: string;
  section?: string;
  cfr?: string;
}

/**
 * Result from knowledge search
 */
export interface KnowledgeSearchResult {
  context: string;
  sources: KnowledgeSource[];
}

/**
 * Public action to search the PERM knowledge base.
 *
 * Performs semantic search over ingested PERM knowledge sections,
 * returning relevant context and source metadata.
 *
 * @param query - Natural language search query
 * @returns Object with concatenated context text and source metadata
 *
 * @example
 * const result = await ctx.runAction(api.knowledge.searchKnowledge, {
 *   query: "What is the PWD expiration rule?"
 * });
 * // Returns: { context: "...", sources: [{ title: "...", source: "perm_flow.md", ... }] }
 */
export const searchKnowledge = action({
  args: { query: v.string() },
  handler: async (ctx, { query }): Promise<KnowledgeSearchResult> => {
    // Return empty for empty/very short queries
    if (!query || query.trim().length < 2) {
      return { context: "", sources: [] };
    }

    try {
      // Debug: Log search query
      console.log(`[Knowledge Search] Query: "${query}"`);

      const { text, entries } = await rag.search(ctx, {
        namespace: "perm_knowledge",
        query,
        limit: 5,
        chunkContext: { before: 1, after: 1 },
        // Lower threshold from 0.5 to 0.3 to catch more results
        vectorScoreThreshold: 0.3,
      });

      // Debug: Log results
      console.log(`[Knowledge Search] Found ${entries.length} entries, text length: ${text.length}`);

      return {
        context: text,
        sources: entries.map((e) => ({
          title: e.title || "Unknown",
          source: String(e.metadata?.source ?? "perm_flow.md"),
          section: e.metadata?.section
            ? String(e.metadata.section)
            : undefined,
          cfr: e.metadata?.cfr ? String(e.metadata.cfr) : undefined,
        })),
      };
    } catch (error) {
      console.error("Knowledge search failed:", error);
      return { context: "", sources: [] };
    }
  },
});

/**
 * Internal action to trigger PERM knowledge ingestion.
 *
 * Checks if the knowledge base is populated and triggers ingestion
 * if empty. This is typically called once during setup or when
 * re-ingestion is needed.
 *
 * @returns Object indicating whether ingestion was triggered
 *
 * @example
 * // From Convex dashboard or another action
 * await ctx.runAction(internal.knowledge.triggerIngestion, {});
 */
export const triggerIngestion = internalAction({
  args: {},
  handler: async (ctx) => {
    // Check if already ingested by trying to search
    try {
      const testSearch = await rag.search(ctx, {
        namespace: "perm_knowledge",
        query: "PWD",
        limit: 1,
      });

      if (testSearch.results.length === 0) {
        console.log("Knowledge base empty, triggering ingestion...");
        await ctx.runAction(internal.lib.rag.ingest.ingestPERMKnowledge, {});
        return { ingested: true, sections: PERM_KNOWLEDGE_SECTIONS.length };
      }

      return { ingested: false, reason: "already_populated" };
    } catch (_error) {
      // If search fails (namespace doesn't exist), trigger ingestion
      console.log(
        "Knowledge namespace not found or search failed, triggering ingestion..."
      );
      await ctx.runAction(internal.lib.rag.ingest.ingestPERMKnowledge, {});
      return { ingested: true, sections: PERM_KNOWLEDGE_SECTIONS.length };
    }
  },
});

/**
 * Query to check ingestion status and available sections.
 *
 * Returns the count of knowledge sections available for ingestion,
 * including both PERM regulations and app guide sections.
 * This is useful for monitoring and debugging the knowledge base.
 *
 * Note: This query cannot check actual ingested entries count
 * (would need an action for that), but returns the static section counts.
 *
 * @returns Object with section counts (total, PERM, and app guide)
 */
export const getIngestionStatus = query({
  args: {},
  handler: async () => {
    return {
      sectionsAvailable: PERM_KNOWLEDGE_SECTIONS.length + APP_GUIDE_SECTIONS.length,
      permSections: PERM_KNOWLEDGE_SECTIONS.length,
      appGuideSections: APP_GUIDE_SECTIONS.length,
    };
  },
});

/**
 * Debug action to verify RAG entries exist
 */
export const debugSearchRaw = action({
  args: { query: v.string() },
  handler: async (ctx, { query }) => {
    console.log(`[Debug RAG] Testing raw search for: "${query}"`);

    try {
      // Try search without threshold
      const result = await rag.search(ctx, {
        namespace: "perm_knowledge",
        query,
        limit: 10,
        // No threshold - get everything
      });

      console.log(`[Debug RAG] Raw search returned:`, {
        textLength: result.text.length,
        entriesCount: result.entries.length,
        resultsCount: result.results.length,
      });

      // Log each result's score
      if (result.results.length > 0) {
        console.log(`[Debug RAG] Result scores:`, result.results.map((r, i) => ({
          index: i,
          score: r.score,
          order: r.order,
        })));
      }

      return {
        textLength: result.text.length,
        textPreview: result.text.slice(0, 200),
        entriesCount: result.entries.length,
        resultsCount: result.results.length,
        entries: result.entries.map(e => ({
          title: e.title,
          status: e.status,
        })),
        scores: result.results.map(r => r.score),
      };
    } catch (error) {
      console.error(`[Debug RAG] Error:`, error);
      return { error: String(error) };
    }
  },
});
