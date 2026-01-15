/**
 * AI Module Exports
 *
 * Central export point for AI-related utilities
 */

export {
  chatModel,
  PRIMARY_MODEL_NAME,
  SUPPORTED_MODELS,
} from './providers';
export { SYSTEM_PROMPT, getSystemPrompt } from './system-prompt';
export {
  // Individual tools - Query/Navigation
  queryCasesTool,
  searchKnowledgeTool,
  searchWebTool,
  navigateTool,
  viewCaseTool,
  scrollToTool,
  refreshPageTool,
  // Individual tools - Case CRUD
  createCaseTool,
  updateCaseTool,
  archiveCaseTool,
  reopenCaseTool,
  deleteCaseTool,
  // Bundled tools object
  chatTools,
  // Output schemas for type safety
  QueryCasesOutputSchema,
  QueryCasesCountOutputSchema,
  SearchKnowledgeOutputSchema,
  SearchWebOutputSchema,
  // Input schemas - Query/Navigation
  NavigateInputSchema,
  ViewCaseInputSchema,
  ScrollToInputSchema,
  RefreshPageInputSchema,
  // Input schemas - Case CRUD
  CreateCaseInputSchema,
  UpdateCaseInputSchema,
  ArchiveCaseInputSchema,
  ReopenCaseInputSchema,
  DeleteCaseInputSchema,
  // Types - Query/Navigation
  type QueryCasesOutput,
  type QueryCasesCountOutput,
  type SearchKnowledgeOutput,
  type SearchWebOutput,
  type QueryCasesInput,
  type SearchKnowledgeInput,
  type SearchWebInput,
  type NavigateInput,
  type ViewCaseInput,
  type ScrollToInput,
  type RefreshPageInput,
  // Types - Case CRUD
  type CreateCaseInput,
  type UpdateCaseInput,
  type ArchiveCaseInput,
  type ReopenCaseInput,
  type DeleteCaseInput,
  type ChatToolName,
} from './tools';

// Tool permission system
export {
  TOOL_PERMISSIONS,
  getToolPermission,
  requiresConfirmation,
  isToolAllowed,
  getConfirmationReason,
  type PermissionLevel,
  type ActionMode,
} from './tool-permissions';

// Client action types for frontend execution
export {
  type ClientActionType,
  type ClientAction,
  type NavigateAction,
  type ViewCaseAction,
  type ScrollToAction,
  type RefreshPageAction,
  type AnyClientAction,
  type NavigationToolResult,
  isClientAction,
  isNavigateAction,
  isViewCaseAction,
  isScrollToAction,
  isRefreshPageAction,
  hasClientAction,
} from './client-actions';
