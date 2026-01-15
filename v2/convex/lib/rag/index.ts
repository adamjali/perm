import { components } from "../../_generated/api";
import { RAG } from "@convex-dev/rag";
import { google } from "@ai-sdk/google";

export const rag = new RAG(components.rag, {
  // gemini-embedding-001 outputs 3072 dimensions by default
  textEmbeddingModel: google.embedding("gemini-embedding-001"),
  embeddingDimension: 3072,
});

// Re-export knowledge section types and data
export { PERM_KNOWLEDGE_SECTIONS } from "./permKnowledge";
export type { PERMKnowledgeSection } from "./permKnowledge";
export { APP_GUIDE_SECTIONS } from "./appGuideKnowledge";
export type { AppGuideSection } from "./appGuideKnowledge";
