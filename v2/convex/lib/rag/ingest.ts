/**
 * Knowledge Ingestion Actions
 *
 * Ingests structured knowledge sections into the RAG system.
 * Run these actions to populate the knowledge base with PERM rules and app guides.
 */

import { internalAction, ActionCtx } from "../../_generated/server";
import { rag } from "./index";
import { PERM_KNOWLEDGE_SECTIONS, PERMKnowledgeSection } from "./permKnowledge";
import { APP_GUIDE_SECTIONS } from "./appGuideKnowledge";

/**
 * Shared ingestion logic for knowledge sections.
 * Reduces duplication between PERM and App Guide ingestion.
 *
 * @param ctx - Convex action context
 * @param sections - Array of knowledge sections to ingest
 * @param label - Label for logging (e.g., "PERM", "App Guide")
 */
async function ingestSections(
  ctx: ActionCtx,
  sections: PERMKnowledgeSection[],
  label: string
) {
  const totalSections = sections.length;
  console.log(`Starting ${label} knowledge ingestion: ${totalSections} sections`);

  let successCount = 0;
  let errorCount = 0;
  let replacedCount = 0;
  const errors: Array<{ section: string; error: string }> = [];

  for (const section of sections) {
    try {
      const result = await rag.add(ctx, {
        namespace: "perm_knowledge",
        key: section.metadata.section,
        title: section.title,
        text: section.content,
        metadata: section.metadata,
      });

      successCount++;
      if (result.replacedEntry) {
        replacedCount++;
        console.log(`[${successCount}/${totalSections}] Replaced: ${section.title}`);
      } else {
        console.log(`[${successCount}/${totalSections}] Added: ${section.title}`);
      }
    } catch (error) {
      errorCount++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({ section: section.metadata.section, error: errorMessage });
      console.error(`[ERROR] Failed to ingest "${section.title}": ${errorMessage}`);
    }
  }

  console.log(`\n${label} knowledge ingestion complete:`);
  console.log(`- Total: ${totalSections}`);
  console.log(`- Added: ${successCount - replacedCount}`);
  console.log(`- Replaced: ${replacedCount}`);
  console.log(`- Errors: ${errorCount}`);

  if (errors.length > 0) {
    console.log(`\nFailed sections:`);
    for (const err of errors) {
      console.log(`  - ${err.section}: ${err.error}`);
    }
  }

  return {
    total: totalSections,
    success: successCount,
    added: successCount - replacedCount,
    replaced: replacedCount,
    errors: errorCount,
    failedSections: errors,
  };
}

/**
 * Ingest all PERM knowledge sections into the RAG system.
 *
 * Usage:
 * - Run via Convex dashboard: internal.lib.rag.ingest.ingestPERMKnowledge
 * - Or call from another action: ctx.runAction(internal.lib.rag.ingest.ingestPERMKnowledge, {})
 */
export const ingestPERMKnowledge = internalAction({
  args: {},
  handler: async (ctx) => ingestSections(ctx, PERM_KNOWLEDGE_SECTIONS, "PERM"),
});

/**
 * Get information about the PERM knowledge namespace.
 *
 * Returns namespace details if it exists.
 */
export const getPERMKnowledgeStatus = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Checking PERM knowledge namespace status...");

    try {
      const namespace = await rag.getNamespace(ctx, {
        namespace: "perm_knowledge",
      });

      if (namespace) {
        console.log(`PERM knowledge namespace found: ${namespace.status}`);
        return {
          exists: true,
          namespace,
        };
      } else {
        console.log("PERM knowledge namespace not found");
        return {
          exists: false,
          namespace: null,
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to get namespace status: ${errorMessage}`);
      return {
        exists: false,
        namespace: null,
        error: errorMessage,
      };
    }
  },
});

/**
 * Ingest all App Guide knowledge sections into the RAG system.
 *
 * Usage:
 * - Run via Convex dashboard: internal.lib.rag.ingest.ingestAppGuideKnowledge
 * - Or call from another action: ctx.runAction(internal.lib.rag.ingest.ingestAppGuideKnowledge, {})
 */
export const ingestAppGuideKnowledge = internalAction({
  args: {},
  handler: async (ctx) => ingestSections(ctx, APP_GUIDE_SECTIONS, "App Guide"),
});

/**
 * Ingest all knowledge sections (PERM + App Guide) into the RAG system.
 *
 * This is a convenience action that runs both ingestion actions sequentially.
 * Useful for initial setup or full re-ingestion of the knowledge base.
 *
 * Usage:
 * - Run via Convex dashboard: internal.lib.rag.ingest.ingestAllKnowledge
 */
export const ingestAllKnowledge = internalAction({
  args: {},
  handler: async (ctx) => {
    console.log("Starting full knowledge ingestion (PERM + App Guide)...");

    // Ingest PERM knowledge
    const permResult = await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "lib/rag/ingest:ingestPERMKnowledge" as any,
      {}
    );

    // Ingest App Guide knowledge
    const appGuideResult = await ctx.runAction(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "lib/rag/ingest:ingestAppGuideKnowledge" as any,
      {}
    );

    console.log("\nFull knowledge ingestion complete:");
    console.log(`- PERM sections: ${permResult.success}/${permResult.total}`);
    console.log(`- App Guide sections: ${appGuideResult.success}/${appGuideResult.total}`);

    return {
      perm: permResult,
      appGuide: appGuideResult,
      totalSections: permResult.total + appGuideResult.total,
      totalSuccess: permResult.success + appGuideResult.success,
    };
  },
});
