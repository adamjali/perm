/**
 * Demo Utilities - localStorage-based PERM case management
 *
 * This module provides demo functionality for users who are not authenticated,
 * allowing them to explore the PERM tracker with sample data stored in localStorage.
 *
 * @module
 *
 * @example
 * ```tsx
 * // Using the React hook
 * import { useDemoCases } from "@/lib/demo";
 *
 * function DemoView() {
 *   const { cases, addCase, updateCase, deleteCase, resetCases } = useDemoCases();
 *
 *   return (
 *     <div>
 *       {cases.map(c => (
 *         <CaseCard key={c.id} case={c} />
 *       ))}
 *       <button onClick={resetCases}>Reset Demo Data</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example
 * ```ts
 * // Direct localStorage operations (non-React)
 * import {
 *   getDemoCases,
 *   addDemoCase,
 *   updateDemoCase,
 *   deleteDemoCase,
 *   resetDemoCases,
 *   initDemoCases,
 * } from "@/lib/demo";
 *
 * // Initialize with defaults if empty
 * initDemoCases();
 *
 * // Get all cases
 * const cases = getDemoCases();
 *
 * // Add a new case
 * const newCase = addDemoCase({
 *   beneficiaryName: "Test User",
 *   employerName: "Test Company",
 *   status: "pwd",
 *   progressStatus: "working",
 *   isProfessionalOccupation: false,
 *   isFavorite: false,
 * });
 * ```
 */

// Types
export type {
  DemoCase,
  CreateDemoCaseInput,
  UpdateDemoCaseInput,
  AdditionalRecruitmentMethod,
} from "./types";

// Storage operations
export {
  // Constants
  DEMO_CASES_KEY,
  DEMO_CASES_VERSION_KEY,
  DEMO_CASES_VERSION,
  // CRUD operations
  getDemoCases,
  setDemoCases,
  addDemoCase,
  updateDemoCase,
  deleteDemoCase,
  getDemoCaseById,
  // Utilities
  resetDemoCases,
  clearDemoCases,
  initDemoCases,
  hasDemoCases,
  // React hook
  useDemoCases,
} from "./storage";

// Default cases
export {
  DEFAULT_DEMO_CASES,
  getDefaultDemoCases,
} from "./defaultCases";
